/**
 * GRIPE Pipeline Test — Bug & Feature paths
 *
 * Spins up a Daytona sandbox, clones the ShopWave repo, starts the dev
 * server, has Claude write a fix/feature, applies it, then verifies
 * with Browser Use Cloud.
 *
 * Usage:
 *   npm run test:bug       # "missing refresh button" bug fix
 *   npm run test:feature   # "add dark mode" feature (placeholder)
 *
 * Required env vars:
 *   DAYTONA_API_KEY, BROWSER_USE_API_KEY,
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, AWS_DEFAULT_REGION,
 *   GITHUB_PAT, PRODUCT_REPO (owner/repo format)
 */

import { Daytona } from "@daytonaio/sdk";
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { BrowserUse } from "browser-use-sdk";
import { z } from "zod";

// ── Clients (all read API keys from env) ────────────────────────────────────

const daytona = new Daytona();
const anthropic = new AnthropicBedrock();
// Reads AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN,
// AWS_DEFAULT_REGION from env automatically
const bu = new BrowserUse();

// ── Types ───────────────────────────────────────────────────────────────────

interface Signal {
  type: "bug" | "feature";
  title: string;
  description: string;
  userComplaint: string;
}

const VerificationResult = z.object({
  pass: z.boolean(),
  reason: z.string(),
});

// ── Demo Signals ────────────────────────────────────────────────────────────

const SIGNALS: Record<string, Signal> = {
  bug: {
    type: "bug",
    title: "No refresh button for order statuses",
    description:
      "Dashboard has no way to re-fetch order data without full page reload",
    userComplaint:
      "I have to reload the entire browser page just to see updated order " +
      "statuses. There's no refresh button anywhere on the dashboard. " +
      "Super annoying when I'm waiting for a shipment update.",
  },
  feature: {
    type: "feature",
    title: "Add dark mode",
    description: "Users want a dark mode toggle for the dashboard",
    userComplaint:
      "This app is blinding at night. Please add a dark mode toggle. " +
      "Every modern app has one.",
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Read all source files from the sandbox, excluding node_modules/.next/dist */
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

/** Format file contents for Claude's context window */
function formatForClaude(files: Record<string, string>): string {
  return Object.entries(files)
    .map(([path, content]) => `=== ${path} ===\n${content}`)
    .join("\n\n");
}

/** Parse Claude's JSON patch response (handles markdown fences) */
function parsePatches(raw: string): Array<{ filePath: string; content: string }> {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Claude didn't return valid JSON patches");
    return JSON.parse(match[0]);
  }
}

/** Create a branch, commit, push, and open a PR via GitHub API */
async function openPR(
  sandbox: Awaited<ReturnType<Daytona["create"]>>,
  signal: Signal,
  patches: Array<{ filePath: string }>,
) {
  const pat = process.env.GITHUB_PAT!;
  const repoPath = process.env.PRODUCT_REPO!;
  const branchName = `gripe/${signal.type}-${signal.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const commitMsg = signal.type === "bug"
    ? `fix: ${signal.title}\n\nAutonomously fixed by GRIPE pipeline.\nReddit complaint: "${signal.userComplaint}"`
    : `feat: ${signal.title}\n\nAutonomously built by GRIPE pipeline.\nReddit request: "${signal.userComplaint}"`;

  console.log("F. Opening PR...");

  // Configure git identity
  await sandbox.process.executeCommand(
    `cd /home/daytona/app && git config user.email "gripe-bot@gripe.dev" && git config user.name "GRIPE Bot"`
  );

  // Create branch, stage, commit, push
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

  // Open PR via GitHub REST API
  const prBody = JSON.stringify({
    title: `[GRIPE] ${signal.type === "bug" ? "Fix" : "Feat"}: ${signal.title}`,
    head: branchName,
    base: "main",
    body: `## ${signal.type === "bug" ? "Bug Fix" : "Feature"}\n\n` +
      `**User complaint (Reddit):**\n> ${signal.userComplaint}\n\n` +
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
    } else {
      console.log("   PR API response:", curlResult.result.slice(0, 500));
      return null;
    }
  } catch {
    console.log("   PR API response:", curlResult.result.slice(0, 500));
    return null;
  }
}

// ── Main Pipeline ───────────────────────────────────────────────────────────

async function runPipeline(signal: Signal) {
  const repoPath = process.env.PRODUCT_REPO;
  const pat = process.env.GITHUB_PAT;

  if (!repoPath) throw new Error("Set PRODUCT_REPO in .env (e.g. youruser/shopwave)");
  if (!pat) throw new Error("Set GITHUB_PAT in .env");

  console.log(
    `\n=== GRIPE Pipeline — ${signal.type.toUpperCase()}: "${signal.title}" ===\n`
  );

  // 1. Create sandbox
  console.log("1. Creating sandbox...");
  const sandbox = await daytona.create({
    snapshot: "daytonaio/sandbox:0.6.0",
    name: `gripe-${signal.type}-${Date.now()}`,
    public: true, // BU Cloud needs to access preview URL without Daytona auth
  });
  console.log(`   Sandbox: ${sandbox.id}`);

  try {
    // 2. Clone private repo
    console.log("2. Cloning repo...");
    const cloneUrl = `https://${pat}@github.com/${repoPath}.git`;
    await sandbox.process.executeCommand(
      `git clone ${cloneUrl} /home/daytona/app`
    );
    console.log("   Cloned to /home/daytona/app");

    // 3. Install dependencies
    console.log("3. Installing dependencies (this may take a minute)...");
    await sandbox.process.executeCommand(
      "cd /home/daytona/app && npm install"
    );
    console.log("   Dependencies installed");

    // 4. Start dev server — MUST use Sessions API (executeCommand blocks on &)
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

    // 6. Branch on signal type
    if (signal.type === "bug") {
      await handleBug(sandbox, signal, preview.url);
    } else {
      await handleFeature(sandbox, signal, preview.url);
    }
  } finally {
    console.log("\nCleaning up sandbox...");
    await sandbox.delete();
    console.log("Done.\n");
  }
}

// ── Bug Path (fully implemented) ───────────────────────────────────────────

async function handleBug(
  sandbox: Awaited<ReturnType<Daytona["create"]>>,
  signal: Signal,
  previewUrl: string
) {
  console.log("--- BUG PATH ---\n");

  // A. Read source files
  console.log("A. Reading source files from sandbox...");
  const files = await readSourceFiles(sandbox);

  // B. Claude writes the fix
  console.log("B. Sending to Claude for fix...");
  const response = await anthropic.messages.create({
    model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are fixing a bug in a Next.js e-commerce dashboard app called ShopWave.

BUG REPORT (from Reddit):
"${signal.userComplaint}"

SUMMARY: ${signal.description}

SOURCE FILES:
${formatForClaude(files)}

YOUR TASK:
Add a refresh button near the orders table that re-fetches the order data
without a full page reload.

Requirements:
- Place a clearly visible "Refresh Orders" button or a reload icon (↻) near
  the orders table heading
- Clicking it should re-trigger the same simulated async data fetch that runs
  on initial page load
- Show a brief loading/spinner state while re-fetching
- Do NOT do a full page navigation/reload — update React state only
- Keep the existing visual style (light mode, clean, minimal)

RESPOND WITH ONLY a JSON array of file patches. Each element:
  { "filePath": "/home/daytona/app/...", "content": "full updated file content" }

Return raw JSON only. No markdown fences, no explanation, no commentary.`,
      },
    ],
  });

  const raw =
    response.content[0].type === "text" ? response.content[0].text : "";
  const patches = parsePatches(raw);

  // C. Apply patches
  console.log(`C. Applying ${patches.length} patch(es)...`);
  for (const p of patches) {
    await sandbox.fs.uploadFile(Buffer.from(p.content), p.filePath);
    console.log(`   Patched: ${p.filePath}`);
  }

  // D. Wait for hot reload
  console.log("D. Waiting for hot reload (~8s)...");
  await new Promise((r) => setTimeout(r, 8_000));

  // E. Verify with Browser Use Cloud
  console.log("E. Verifying fix with Browser Use...\n");
  const buResult = await bu.run(
    `Navigate to ${previewUrl}.
You should see a login page for "ShopWave".

Step 1: Log in with email "demo@shop.com" and password "password123".
Step 2: After login you should be on the dashboard with an orders table.
Step 3: Look for a REFRESH button near the orders table. It might say
        "Refresh", "Refresh Orders", or be an icon button with ↻.
Step 4: Click the refresh button.
Step 5: Confirm:
  - The refresh button EXISTS (this is the fix — it wasn't there before)
  - The orders table is still visible after clicking
  - The page did NOT do a full browser reload (no white flash, URL unchanged)

Return your final answer as ONLY a JSON object (no other text):
{ "pass": true or false, "reason": "short explanation" }`
  );

  console.log("   Raw BU result:", JSON.stringify(buResult, null, 2));

  // Parse the verification result from BU's output field
  try {
    // BU output may have escaped quotes — unescape them
    let output = (buResult as any).output ?? "";
    // Unescape \\\" → " and \\" → "
    while (output.includes('\\"')) {
      output = output.replace(/\\"/g, '"');
    }
    const jsonMatch = output.match(/\{[\s\S]*"pass"[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      console.log("   Verified:", JSON.stringify(result));
      if (result.pass) {
        console.log("\n   BUG FIX VERIFIED — refresh button works\n");
        await openPR(sandbox, signal, patches);
      } else {
        console.log("\n   VERIFICATION FAILED —", result.reason);
      }
    } else {
      console.log("\n   Could not parse JSON from BU output — check raw result above");
    }
  } catch (e) {
    console.log("\n   Parse error:", e);
  }
}

// ── Feature Path (placeholder) ─────────────────────────────────────────────

async function handleFeature(
  _sandbox: Awaited<ReturnType<Daytona["create"]>>,
  _signal: Signal,
  _previewUrl: string
) {
  console.log("--- FEATURE PATH ---\n");
  console.log("   [Not implemented — placeholder for dark mode feature]");
  // TODO:
  // A. Read source files
  // B. Claude writes dark mode (toggle in nav bar, CSS variables or Tailwind dark:)
  // C. Apply patches
  // D. Wait for hot reload
  // E. BU verifies: find toggle → click → background changes to dark color
}

// ── Entry Point ─────────────────────────────────────────────────────────────

const which = process.argv[2] === "feature" ? "feature" : "bug";

runPipeline(SIGNALS[which]).catch((err) => {
  console.error("\n❌ Pipeline failed:", err?.message ?? err);
  process.exit(1);
});
