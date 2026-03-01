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
import { Laminar, observe } from "@lmnr-ai/lmnr";

// ── Initialize Laminar tracing ──────────────────────────────────────────────

Laminar.initialize({});

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
  return ((await resp.json()) as { items: PipelineItem[] }).items;
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

type Sandbox = Awaited<ReturnType<Daytona["create"]>>;

async function readSourceFiles(sandbox: Sandbox): Promise<Record<string, string>> {
  // Batch read: dump all source files with delimiters in a single command
  // instead of 73+ individual `cat` calls
  const cmd =
    `find /home/daytona/app -type f \\( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \\) ` +
    `-not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.git/*" -not -path "*/dist/*" ` +
    `-exec sh -c 'for f; do echo "===FILE:$f==="; cat "$f"; done' _ {} +`;

  const result = await sandbox.process.executeCommand(cmd);
  const output = result.result;

  const files: Record<string, string> = {};
  const parts = output.split("===FILE:");
  for (const part of parts) {
    if (!part.trim()) continue;
    const eol = part.indexOf("===\n");
    if (eol === -1) continue;
    const filePath = part.slice(0, eol);
    const content = part.slice(eol + 4);
    files[filePath] = content;
  }
  console.log(`   Found ${Object.keys(files).length} source files (batch read)`);
  return files;
}

async function waitForDevServer(sandbox: Sandbox, port = 3000, maxWaitMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const check = await sandbox.process.executeCommand(
        `curl -s -o /dev/null -w "%{http_code}" http://localhost:${port} 2>/dev/null || echo "000"`
      );
      const code = check.result.trim();
      if (code !== "000" && code !== "") return; // Server is responding
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  console.log(`   Dev server didn't respond in ${maxWaitMs / 1000}s, proceeding anyway`);
}

async function prewarmSandbox(): Promise<Sandbox> {
  const pat = process.env.GITHUB_PAT!;
  const repoPath = process.env.PRODUCT_REPO!;

  console.log("[PREWARM] Creating sandbox...");
  const sandbox = await daytona.create({
    snapshot: "daytonaio/sandbox:0.6.0",
    name: `gripe-warm-${Date.now()}`,
    public: true,
  });
  console.log(`[PREWARM] Sandbox: ${sandbox.id}`);

  console.log("[PREWARM] Cloning repo...");
  await sandbox.process.executeCommand(
    `git clone https://${pat}@github.com/${repoPath}.git /home/daytona/app`
  );

  console.log("[PREWARM] Installing dependencies...");
  await sandbox.process.executeCommand("cd /home/daytona/app && npm install");

  console.log("[PREWARM] Starting dev server...");
  await sandbox.process.createSession("dev-server");
  await sandbox.process.executeSessionCommand("dev-server", {
    command: "cd /home/daytona/app && npm run dev",
    runAsync: true,
  });

  console.log("[PREWARM] Waiting for dev server...");
  await waitForDevServer(sandbox);

  console.log("[PREWARM] Sandbox ready!\n");
  return sandbox;
}

async function pollForItems(timeoutSec = 300): Promise<PipelineItem[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutSec * 1000) {
    try {
      const items = await fetchDetectedItems();
      if (items.length > 0) return items;
    } catch {
      // Convex might not have items yet, keep polling
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }
  return [];
}

function formatForClaude(files: Record<string, string>): string {
  return Object.entries(files)
    .map(([path, content]) => `=== ${path} ===\n${content}`)
    .join("\n\n");
}

function parsePatches(raw: string): Array<{ filePath: string; content: string }> {
  // Try parsing the full response first
  try {
    return JSON.parse(raw);
  } catch {
    // Fall through
  }

  // Try extracting a JSON array from surrounding text
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Claude didn't return valid JSON patches");

  try {
    return JSON.parse(match[0]);
  } catch {
    // Claude sometimes returns file content with unescaped characters.
    // Try a more lenient extraction: find individual patch objects
    const patchRegex = /\{\s*"filePath"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*/g;
    const patches: Array<{ filePath: string; content: string }> = [];
    let m;
    while ((m = patchRegex.exec(raw)) !== null) {
      const filePath = m[1];
      // Find the content string start (after the key)
      const contentStart = raw.indexOf('"', m.index + m[0].length);
      if (contentStart === -1) continue;
      // Walk forward to find the closing quote, handling escaped quotes
      let i = contentStart + 1;
      while (i < raw.length) {
        if (raw[i] === '\\') { i += 2; continue; }
        if (raw[i] === '"') break;
        i++;
      }
      const content = JSON.parse(raw.slice(contentStart, i + 1));
      patches.push({ filePath, content });
    }
    if (patches.length > 0) return patches;
    throw new Error("Claude didn't return valid JSON patches");
  }
}

function parseBUResult(buResult: unknown): { pass: boolean; reason: string } | null {
  let output = (buResult as any).output ?? "";

  // Try parsing at each level of unescaping — stop as soon as it works.
  // BU sometimes double- or triple-escapes quotes; blindly stripping all \"
  // breaks valid JSON where \" is a proper escape inside a string value.
  for (let attempt = 0; attempt < 5; attempt++) {
    const jsonMatch = output.match(/\{[\s\S]*"pass"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // This level of escaping didn't work, try unescaping one more layer
      }
    }
    if (!output.includes('\\"')) break;
    output = output.replace(/\\"/g, '"');
  }

  // Last resort: extract pass boolean with regex
  const passMatch = output.match(/"pass"\s*:\s*(true|false)/);
  const reasonMatch = output.match(/"reason"\s*:\s*"([^"]*)"/);
  if (passMatch) {
    return {
      pass: passMatch[1] === "true",
      reason: reasonMatch?.[1] ?? "Parsed from unstructured output",
    };
  }

  return null;
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
  // Sanitize user content for shell safety
  const safeTitle = item.title.replace(/[`$"\\]/g, "");
  const safeBody = item.body.replace(/[`$"\\]/g, "").slice(0, 200);

  const commitMsg = item.type === "bug"
    ? `fix: ${safeTitle}\n\nAutonomously fixed by GRIPE pipeline.`
    : `feat: ${safeTitle}\n\nAutonomously built by GRIPE pipeline.`;

  console.log("   Opening PR...");

  await sandbox.process.executeCommand(
    `cd /home/daytona/app && git config user.email "gripe-bot@gripe.dev" && git config user.name "GRIPE Bot"`
  );
  await sandbox.process.executeCommand(
    `cd /home/daytona/app && git checkout -b ${branchName}`
  );
  // Write commit message to file to avoid shell escaping issues
  await sandbox.fs.uploadFile(Buffer.from(commitMsg), "/tmp/commit-msg.txt");
  await sandbox.process.executeCommand(
    `cd /home/daytona/app && git add -A && git commit -F /tmp/commit-msg.txt`
  );
  await sandbox.process.executeCommand(
    `cd /home/daytona/app && git push origin ${branchName}`
  );
  console.log(`   Pushed branch: ${branchName}`);

  // Write PR body JSON to file to avoid shell escaping issues with curl -d
  const prPayload = {
    title: `[GRIPE] ${item.type === "bug" ? "Fix" : "Feat"}: ${safeTitle}`,
    head: branchName,
    base: "main",
    body: `## ${item.type === "bug" ? "Bug Fix" : "Feature"}\n\n` +
      `**User complaint (${item.subreddit}):**\n> ${safeBody}\n\n` +
      `**Summary:** ${item.summary}\n\n` +
      `**Files changed:**\n${patches.map((p) => `- \`${p.filePath.replace("/home/daytona/app/", "")}\``).join("\n")}\n\n` +
      `**Verified by:** Browser Use Cloud (click-tested in Daytona sandbox)\n\n` +
      `---\n_Autonomously generated by GRIPE pipeline_`,
  };
  await sandbox.fs.uploadFile(Buffer.from(JSON.stringify(prPayload)), "/tmp/pr-body.json");

  const curlResult = await sandbox.process.executeCommand(
    `curl -s -X POST "https://api.github.com/repos/${repoPath}/pulls" ` +
    `-H "Authorization: Bearer ${pat}" ` +
    `-H "Accept: application/vnd.github+json" ` +
    `-d @/tmp/pr-body.json`
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

async function processItem(
  item: PipelineItem,
  runId: string,
  prewarmedSandbox?: Sandbox | null,
): Promise<boolean> {
  return observe({ name: "process-item" }, async () => {
  const pat = process.env.GITHUB_PAT!;
  const repoPath = process.env.PRODUCT_REPO!;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${item.type.toUpperCase()}: "${item.title}"`);
  console.log(`  Source: ${item.subreddit} | Severity: ${item.severity}`);
  console.log(`${"=".repeat(60)}\n`);

  // Mark as building
  await updateItemStatus(item._id, "building", { statusMessage: "Creating sandbox..." });

  let sandbox: Sandbox;

  if (prewarmedSandbox) {
    // Use the pre-warmed sandbox (already cloned, installed, dev server running)
    sandbox = prewarmedSandbox;
    console.log(`1. Using pre-warmed sandbox: ${sandbox.id}`);
  } else {
    // Create a fresh sandbox
    console.log("1. Creating sandbox...");
    sandbox = await daytona.create({
      snapshot: "daytonaio/sandbox:0.6.0",
      name: `gripe-${item.type}-${Date.now()}`,
      public: true,
    });
    console.log(`   Sandbox: ${sandbox.id}`);

    console.log("2. Cloning repo...");
    await sandbox.process.executeCommand(
      `git clone https://${pat}@github.com/${repoPath}.git /home/daytona/app`
    );

    console.log("3. Installing dependencies...");
    await updateItemStatus(item._id, "building", { statusMessage: "Installing dependencies..." });
    await sandbox.process.executeCommand("cd /home/daytona/app && npm install");

    console.log("4. Starting dev server...");
    await sandbox.process.createSession("dev-server");
    await sandbox.process.executeSessionCommand("dev-server", {
      command: "cd /home/daytona/app && npm run dev",
      runAsync: true,
    });
    await waitForDevServer(sandbox);
  }

  try {
    // Get preview URL
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
    console.log("D. Waiting for hot reload (~3s)...");
    await new Promise((r) => setTimeout(r, 3_000));

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

      // Build Laminar trace URL for this item
      const traceId = Laminar.getLaminarSpanContext()?.traceId;
      const lmnrProjectId = process.env.LMNR_PROJECT_ID || "";
      const traceUrl = traceId && lmnrProjectId ? `https://laminar.sh/project/${lmnrProjectId}/traces?traceId=${traceId}` : undefined;
      if (traceUrl) console.log(`   Laminar trace: ${traceUrl}`);

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
          traceUrl,
        });

        await updateRunStep(runId, "DEPLOY", "done");
        return true;
      } else {
        console.log(`\n   VERIFICATION FAILED — ${verification.reason}\n`);
        await updateItemStatus(item._id, "done", {
          verified: false,
          detail: verification.reason,
          statusMessage: "Verification failed",
          traceUrl,
        });
        return false;
      }
    } else {
      const traceId = Laminar.getLaminarSpanContext()?.traceId;
      const lmnrProjectId2 = process.env.LMNR_PROJECT_ID || "";
      const traceUrl = traceId && lmnrProjectId2 ? `https://laminar.sh/project/${lmnrProjectId2}/traces?traceId=${traceId}` : undefined;
      console.log("\n   Could not parse BU output\n");
      await updateItemStatus(item._id, "done", {
        verified: false,
        detail: "Could not parse Browser Use verification output",
        statusMessage: "Verification parse error",
        traceUrl,
      });
      return false;
    }
  } finally {
    console.log("   Cleaning up sandbox...");
    await sandbox.delete();
    console.log("   Sandbox deleted.");
  }
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.CONVEX_SITE_URL) throw new Error("Set CONVEX_SITE_URL in .env");
  if (!process.env.PRODUCT_REPO) throw new Error("Set PRODUCT_REPO in .env");
  if (!process.env.GITHUB_PAT) throw new Error("Set GITHUB_PAT in .env");

  console.log("\n" + "=".repeat(50));
  console.log("  GRIPE Orchestrator — BUILD / VERIFY / DEPLOY");
  console.log("=".repeat(50) + "\n");

  // 1. Start pre-warming a sandbox IMMEDIATELY (runs during Python pipeline scraping)
  console.log("Starting sandbox pre-warm (runs in parallel with Python pipeline)...\n");
  const warmSandboxPromise = prewarmSandbox().catch((err) => {
    console.error("[PREWARM] Failed:", (err as Error).message);
    return null;
  });

  // 2. Poll Convex for detected items (Python pipeline will push them when done)
  console.log("Polling Convex for detected items...");
  const items = await pollForItems(300); // 5 min timeout

  if (items.length === 0) {
    console.log("No items found after polling. Cleaning up...");
    const warmSandbox = await warmSandboxPromise;
    if (warmSandbox) {
      await warmSandbox.delete();
      console.log("Pre-warmed sandbox deleted.");
    }
    return;
  }

  console.log(`Found ${items.length} item(s) to process:\n`);
  for (const item of items) {
    console.log(`  - [${item.type.toUpperCase()}] ${item.title} (${item.severity})`);
  }

  // 3. Get the pre-warmed sandbox (should be ready by now since scraping takes ~50s)
  const warmSandbox = await warmSandboxPromise;

  // 4. Get or create a pipeline run
  const runResp = await fetch(`${CONVEX_SITE_URL}/api/runs/current`);
  let runId: string;
  if (runResp.ok) {
    const runData = (await runResp.json()) as { _id?: string; runId?: string };
    runId = runData._id ?? runData.runId ?? "";
    console.log(`\nUsing existing run: ${runId}`);
  } else {
    const triggerResp = (await convexFetch("/api/runs/trigger", "POST")) as { runId: string };
    runId = triggerResp.runId;
    console.log(`\nTriggered new run: ${runId}`);
  }

  // Mark BUILD step as running
  await updateRunStep(runId, "BUILD", "running");

  // 5. Process items in PARALLEL
  //    First item gets the pre-warmed sandbox, others create their own concurrently
  const results = await Promise.allSettled(
    items.map((item, i) => {
      const sandbox = i === 0 ? warmSandbox : null;
      return processItem(item, runId, sandbox).catch(async (err) => {
        console.error(`\nFailed to process "${item.title}":`, (err as Error).message);
        await updateItemStatus(item._id, "done", {
          verified: false,
          detail: `Pipeline error: ${(err as Error).message}`,
          statusMessage: "Pipeline error",
        });
        return false;
      });
    })
  );

  const successCount = results.filter(
    (r) => r.status === "fulfilled" && r.value === true
  ).length;

  // 6. Complete the run
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
