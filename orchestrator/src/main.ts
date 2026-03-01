/**
 * GRIPE Orchestrator — BUILD / VERIFY / DEPLOY
 *
 * Reads pipeline items with status "detected" from Convex, then for each item:
 *   1. Spins up a Daytona sandbox
 *   2. Clones the product repo
 *   3. Has Claude (Bedrock) write the fix/feature
 *   4. Applies patches, waits for hot reload
 *   5. Verifies with Browser Use Cloud
 *   6. Opens a GitHub PR if verification passes
 *   7. Updates item status in Convex throughout
 *
 * Usage:
 *   npm run start          # process all "detected" items
 *
 * Required env vars:
 *   CONVEX_SITE_URL, DAYTONA_API_KEY, BROWSER_USE_API_KEY,
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, AWS_DEFAULT_REGION,
 *   GITHUB_PAT, PRODUCT_REPO
 */

import { Daytona } from "@daytonaio/sdk";
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { BrowserUse } from "browser-use-sdk";

// ── Clients ──────────────────────────────────────────────────────────────────

const daytona = new Daytona();
const anthropic = new AnthropicBedrock();
const bu = new BrowserUse();

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL!;

// ── Types ────────────────────────────────────────────────────────────────────

interface PipelineItem {
  _id: string;
  title: string;
  body: string;
  summary: string;
  severity: string;
  type: "bug" | "feature";
  source: string;
  subreddit: string;
  url: string;
  upvotes: number;
  topComments: string[];
  status: string;
}

// ── Convex HTTP helpers ──────────────────────────────────────────────────────

async function convexFetch(path: string, method: string, body?: unknown) {
  const resp = await fetch(`${CONVEX_SITE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    throw new Error(`Convex ${method} ${path} failed: ${resp.status} ${await resp.text()}`);
  }
  return resp.json();
}

async function fetchDetectedItems(): Promise<PipelineItem[]> {
  // Convex HTTP API doesn't expose queries directly — we need a GET route.
  // For now, use the mutation API to query. We'll add a GET /api/items route.
  // Actually, Convex httpAction only has POST/PATCH routes defined.
  // We need to add a GET route. For now, let's add one.
  const resp = await fetch(`${CONVEX_SITE_URL}/api/items?status=detected`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch items: ${resp.status} ${await resp.text()}`);
  }
  return (await resp.json()).items;
}

async function updateItemStatus(
  id: string,
  status: string,
  extra: Record<string, unknown> = {}
) {
  await convexFetch("/api/items/status", "PATCH", { id, status, ...extra });
}

async function updateRunStep(
  runId: string,
  stepName: string,
  stepStatus: string,
  nextStep?: string
) {
  await convexFetch("/api/runs/step", "PATCH", {
    id: runId,
    stepName,
    stepStatus,
    ...(nextStep ? { nextStep } : {}),
  });
}

async function completeRun(runId: string, itemsProcessed: number) {
  await convexFetch("/api/runs/complete", "POST", {
    id: runId,
    itemsProcessed,
  });
}

// ── Sandbox helpers ──────────────────────────────────────────────────────────

async function readSourceFiles(
  sandbox: Awaited<ReturnType<Daytona["create"]>>
): Promise<Record<string, string>> {
  const find = await sandbox.process.executeCommand(
    `find /home/daytona/app -type f \\( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \\) ` +
      `-not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.git/*" -not -path "*/dist/*"`
  );
  const paths = find.result.trim().split("\n").filter(Boolean);
  console.log(`   Found ${paths.length} source files`);

  const files: Record<string, string> = {};
  for (const fp of paths) {
    const cat = await sandbox.process.executeCommand(`cat "${fp}"`);
    files[fp] = cat.result;
  }
  return files;
}

function formatForClaude(files: Record<string, string>): string {
  return Object.entries(files)
    .map(([path, content]) => `=== ${path} ===\n${content}`)
    .join("\n\n");
}

function parsePatches(raw: string): Array<{ filePath: string; content: string }> {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Claude didn't return valid JSON patches");
    return JSON.parse(match[0]);
  }
}

function parseBUResult(buResult: unknown): { pass: boolean; reason: string } | null {
  let output = (buResult as any).output ?? "";
  while (output.includes('\\"')) {
    output = output.replace(/\\"/g, '"');
  }
  const jsonMatch = output.match(/\{[\s\S]*"pass"[\s\S]*\}/);
  if (!jsonMatch) return null;
  return JSON.parse(jsonMatch[0]);
}

// ── PR helper ────────────────────────────────────────────────────────────────

async function openPR(
  sandbox: Awaited<ReturnType<Daytona["create"]>>,
  item: PipelineItem,
  patches: Array<{ filePath: string }>,
): Promise<string | null> {
  const pat = process.env.GITHUB_PAT!;
  const repoPath = process.env.PRODUCT_REPO!;
  const branchName = `gripe/${item.type}-${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}`;
  const commitMsg = item.type === "bug"
    ? `fix: ${item.title}\n\nAutonomously fixed by GRIPE pipeline.\nReddit complaint: "${item.body}"`
    : `feat: ${item.title}\n\nAutonomously built by GRIPE pipeline.\nReddit request: "${item.body}"`;

  console.log("   Opening PR...");

  await sandbox.process.executeCommand(
    `cd /home/daytona/app && git config user.email "gripe-bot@gripe.dev" && git config user.name "GRIPE Bot"`
  );
  await sandbox.process.executeCommand(
    `cd /home/daytona/app && git checkout -b ${branchName}`
  );
  await sandbox.process.executeCommand(
    `cd /home/daytona/app && git add -A && git commit -m "${commitMsg.replace(/"/g, '\\"')}"`
  );
  await sandbox.process.executeCommand(
    `cd /home/daytona/app && git push origin ${branchName}`
  );
  console.log(`   Pushed branch: ${branchName}`);

  const prBody = JSON.stringify({
    title: `[GRIPE] ${item.type === "bug" ? "Fix" : "Feat"}: ${item.title}`,
    head: branchName,
    base: "main",
    body: `## ${item.type === "bug" ? "Bug Fix" : "Feature"}\n\n` +
      `**User complaint (${item.subreddit}):**\n> ${item.body}\n\n` +
      `**Summary:** ${item.summary}\n\n` +
      `**Files changed:**\n${patches.map((p) => `- \`${p.filePath.replace("/home/daytona/app/", "")}\``).join("\n")}\n\n` +
      `**Verified by:** Browser Use Cloud (click-tested in Daytona sandbox)\n\n` +
      `---\n_Autonomously generated by GRIPE pipeline_`,
  });

  const curlResult = await sandbox.process.executeCommand(
    `curl -s -X POST "https://api.github.com/repos/${repoPath}/pulls" ` +
    `-H "Authorization: Bearer ${pat}" ` +
    `-H "Accept: application/vnd.github+json" ` +
    `-d '${prBody.replace(/'/g, "'\\''")}'`
  );

  try {
    const pr = JSON.parse(curlResult.result);
    if (pr.html_url) {
      console.log(`   PR opened: ${pr.html_url}`);
      return pr.html_url as string;
    }
    console.log("   PR API response:", curlResult.result.slice(0, 500));
    return null;
  } catch {
    console.log("   PR API response:", curlResult.result.slice(0, 500));
    return null;
  }
}

// ── Claude prompt builders ───────────────────────────────────────────────────

function buildBugPrompt(item: PipelineItem, sourceCode: string): string {
  return `You are fixing a bug in a Next.js e-commerce dashboard app called ShopWave.

BUG REPORT (from ${item.subreddit}):
"${item.body}"

SUMMARY: ${item.summary}

TOP USER COMMENTS:
${item.topComments.map((c) => `- "${c}"`).join("\n")}

SOURCE FILES:
${sourceCode}

YOUR TASK:
Analyze the bug report and fix the issue described. The user's complaint and comments
give you context about what is broken.

Requirements:
- Fix the specific issue described in the bug report
- Keep changes minimal — only modify what's needed to fix the bug
- Do NOT do a full page navigation/reload — update React state only where applicable
- Keep the existing visual style (light mode, clean, minimal)
- Make sure the fix is testable by navigating the app in a browser

RESPOND WITH ONLY a JSON array of file patches. Each element:
  { "filePath": "/home/daytona/app/...", "content": "full updated file content" }

Return raw JSON only. No markdown fences, no explanation, no commentary.`;
}

function buildFeaturePrompt(item: PipelineItem, sourceCode: string): string {
  return `You are adding a feature to a Next.js e-commerce dashboard app called ShopWave.

FEATURE REQUEST (from ${item.subreddit}):
"${item.body}"

SUMMARY: ${item.summary}

TOP USER COMMENTS:
${item.topComments.map((c) => `- "${c}"`).join("\n")}

SOURCE FILES:
${sourceCode}

YOUR TASK:
Implement the feature described in the request. The user's complaint and comments
give you context about what they want.

Requirements:
- Implement the feature as described
- Keep changes clean and minimal
- Follow the existing code patterns and visual style
- Make sure the feature is testable by navigating the app in a browser
- Add any necessary UI elements (buttons, toggles, etc.)

RESPOND WITH ONLY a JSON array of file patches. Each element:
  { "filePath": "/home/daytona/app/...", "content": "full updated file content" }

Return raw JSON only. No markdown fences, no explanation, no commentary.`;
}

function buildBugVerificationPrompt(item: PipelineItem, previewUrl: string): string {
  return `Navigate to ${previewUrl}.
You should see a login page for "ShopWave".

Step 1: Log in with email "demo@shop.com" and password "password123".
        If the login button doesn't work, try navigating directly to ${previewUrl}/login
Step 2: After login you should be on the dashboard.
Step 3: Look for evidence that the following bug has been FIXED:
        Bug: "${item.summary}"
        Original complaint: "${item.body}"
Step 4: Interact with the relevant UI elements to verify the fix works.
Step 5: Confirm the fix is working properly.

Return your final answer as ONLY a JSON object (no other text):
{ "pass": true or false, "reason": "short explanation of what you found" }`;
}

function buildFeatureVerificationPrompt(item: PipelineItem, previewUrl: string): string {
  return `Navigate to ${previewUrl}.
You should see a login page for "ShopWave".

Step 1: Log in with email "demo@shop.com" and password "password123".
        If the login button doesn't work, try navigating directly to ${previewUrl}/login
Step 2: After login you should be on the dashboard.
Step 3: Look for the following NEW FEATURE that was just added:
        Feature: "${item.summary}"
        Original request: "${item.body}"
Step 4: Interact with the feature to verify it works as described.
Step 5: Confirm the feature is present and functional.

Return your final answer as ONLY a JSON object (no other text):
{ "pass": true or false, "reason": "short explanation of what you found" }`;
}

// ── Process a single item ────────────────────────────────────────────────────

async function processItem(item: PipelineItem, runId: string): Promise<boolean> {
  const pat = process.env.GITHUB_PAT!;
  const repoPath = process.env.PRODUCT_REPO!;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${item.type.toUpperCase()}: "${item.title}"`);
  console.log(`  Source: ${item.subreddit} | Severity: ${item.severity}`);
  console.log(`${"=".repeat(60)}\n`);

  // Mark as building
  await updateItemStatus(item._id, "building", { statusMessage: "Creating sandbox..." });

  // 1. Create sandbox
  console.log("1. Creating sandbox...");
  const sandbox = await daytona.create({
    snapshot: "daytonaio/sandbox:0.6.0",
    name: `gripe-${item.type}-${Date.now()}`,
    public: true,
  });
  console.log(`   Sandbox: ${sandbox.id}`);

  try {
    // 2. Clone repo
    console.log("2. Cloning repo...");
    await sandbox.process.executeCommand(
      `git clone https://${pat}@github.com/${repoPath}.git /home/daytona/app`
    );
    console.log("   Cloned to /home/daytona/app");

    // 3. Install deps
    console.log("3. Installing dependencies...");
    await updateItemStatus(item._id, "building", { statusMessage: "Installing dependencies..." });
    await sandbox.process.executeCommand("cd /home/daytona/app && npm install");
    console.log("   Dependencies installed");

    // 4. Start dev server
    console.log("4. Starting dev server...");
    await sandbox.process.createSession("dev-server");
    await sandbox.process.executeSessionCommand("dev-server", {
      command: "cd /home/daytona/app && npm run dev",
      runAsync: true,
    });
    console.log("   Waiting for Next.js to compile (~15s)...");
    await new Promise((r) => setTimeout(r, 15_000));

    // 5. Get preview URL
    const preview = await sandbox.getPreviewLink(3000);
    console.log(`   Preview: ${preview.url}\n`);

    // 6. Read source files
    console.log("A. Reading source files...");
    const files = await readSourceFiles(sandbox);
    const sourceCode = formatForClaude(files);

    // 7. Claude writes the fix/feature
    console.log("B. Sending to Claude...");
    await updateItemStatus(item._id, "building", { statusMessage: "Claude writing code..." });
    const prompt = item.type === "bug"
      ? buildBugPrompt(item, sourceCode)
      : buildFeaturePrompt(item, sourceCode);

    const response = await anthropic.messages.create({
      model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const patches = parsePatches(raw);

    // 8. Apply patches
    console.log(`C. Applying ${patches.length} patch(es)...`);
    for (const p of patches) {
      await sandbox.fs.uploadFile(Buffer.from(p.content), p.filePath);
      console.log(`   Patched: ${p.filePath}`);
    }

    // 9. Wait for hot reload
    console.log("D. Waiting for hot reload (~8s)...");
    await new Promise((r) => setTimeout(r, 8_000));

    // 10. Verify with Browser Use
    console.log("E. Verifying with Browser Use...\n");
    await updateItemStatus(item._id, "verifying", { statusMessage: "Browser Use verifying..." });
    await updateRunStep(runId, "BUILD", "done", "VERIFY");
    await updateRunStep(runId, "VERIFY", "running");

    const verifyPrompt = item.type === "bug"
      ? buildBugVerificationPrompt(item, preview.url)
      : buildFeatureVerificationPrompt(item, preview.url);

    const buResult = await bu.run(verifyPrompt);
    console.log("   Raw BU result:", JSON.stringify(buResult, null, 2));

    const verification = parseBUResult(buResult);
    if (verification) {
      console.log("   Verified:", JSON.stringify(verification));

      if (verification.pass) {
        console.log(`\n   ${item.type.toUpperCase()} FIX VERIFIED\n`);

        // 11. Open PR
        await updateRunStep(runId, "VERIFY", "done", "DEPLOY");
        await updateRunStep(runId, "DEPLOY", "running");

        const prUrl = await openPR(sandbox, item, patches);
        const filesChanged = patches.map((p) => p.filePath.replace("/home/daytona/app/", ""));

        await updateItemStatus(item._id, "done", {
          verified: true,
          pr: prUrl ?? undefined,
          filesChanged,
          detail: verification.reason,
          statusMessage: prUrl ? "PR opened" : "Verified but PR failed",
        });

        await updateRunStep(runId, "DEPLOY", "done");
        return true;
      } else {
        console.log(`\n   VERIFICATION FAILED — ${verification.reason}\n`);
        await updateItemStatus(item._id, "done", {
          verified: false,
          detail: verification.reason,
          statusMessage: "Verification failed",
        });
        return false;
      }
    } else {
      console.log("\n   Could not parse BU output\n");
      await updateItemStatus(item._id, "done", {
        verified: false,
        detail: "Could not parse Browser Use verification output",
        statusMessage: "Verification parse error",
      });
      return false;
    }
  } finally {
    console.log("   Cleaning up sandbox...");
    await sandbox.delete();
    console.log("   Sandbox deleted.");
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.CONVEX_SITE_URL) throw new Error("Set CONVEX_SITE_URL in .env");
  if (!process.env.PRODUCT_REPO) throw new Error("Set PRODUCT_REPO in .env");
  if (!process.env.GITHUB_PAT) throw new Error("Set GITHUB_PAT in .env");

  console.log("\n" + "=".repeat(50));
  console.log("  GRIPE Orchestrator — BUILD / VERIFY / DEPLOY");
  console.log("=".repeat(50) + "\n");

  // 1. Fetch detected items from Convex
  console.log("Fetching detected items from Convex...");
  let items: PipelineItem[];
  try {
    items = await fetchDetectedItems();
  } catch (e) {
    console.error("Failed to fetch items from Convex:", e);
    console.log("Hint: make sure the GET /api/items route is deployed in Convex");
    process.exit(1);
  }

  if (items.length === 0) {
    console.log("No items with status 'detected' found. Nothing to do.");
    return;
  }

  console.log(`Found ${items.length} item(s) to process:\n`);
  for (const item of items) {
    console.log(`  - [${item.type.toUpperCase()}] ${item.title} (${item.severity})`);
  }

  // 2. Get or create a pipeline run
  // We'll look for an existing run that's on the BUILD step, or create context for updates
  // The Python pipeline already created the run, so we find it
  const runResp = await fetch(`${CONVEX_SITE_URL}/api/runs/current`);
  let runId: string;
  if (runResp.ok) {
    const runData = await runResp.json();
    runId = runData._id ?? runData.runId;
    console.log(`\nUsing existing run: ${runId}`);
  } else {
    // Trigger a new run
    const triggerResp = await convexFetch("/api/runs/trigger", "POST");
    runId = triggerResp.runId;
    console.log(`\nTriggered new run: ${runId}`);
  }

  // Mark BUILD step as running
  await updateRunStep(runId, "BUILD", "running");

  // 3. Process each item
  let successCount = 0;
  for (const item of items) {
    try {
      const success = await processItem(item, runId);
      if (success) successCount++;
    } catch (err) {
      console.error(`\nFailed to process "${item.title}":`, (err as Error).message);
      await updateItemStatus(item._id, "done", {
        verified: false,
        detail: `Pipeline error: ${(err as Error).message}`,
        statusMessage: "Pipeline error",
      });
    }
  }

  // 4. Complete the run
  await updateRunStep(runId, "POST", "done");
  await completeRun(runId, successCount);

  console.log("\n" + "=".repeat(50));
  console.log(`  Done! ${successCount}/${items.length} items processed successfully`);
  console.log("=".repeat(50) + "\n");
}

main().catch((err) => {
  console.error("\n Pipeline failed:", err?.message ?? err);
  process.exit(1);
});
