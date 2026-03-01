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

async function listSourceFiles(sandbox: Sandbox): Promise<string[]> {
  const cmd =
    `find /home/daytona/app -type f \\( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \\) ` +
    `-not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.git/*" -not -path "*/dist/*"`;
  const result = await sandbox.process.executeCommand(cmd);
  return result.result.trim().split("\n").filter(Boolean);
}

async function readSelectedFiles(sandbox: Sandbox, paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  // Batch read only the selected files
  const escaped = paths.map((p) => `"${p}"`).join(" ");
  const cmd = `for f in ${escaped}; do echo "===FILE:$f==="; cat "$f" 2>/dev/null; done`;
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
  return files;
}

// Files that should ALWAYS be included regardless of what Haiku picks
const ALWAYS_INCLUDE_PATTERNS = [
  /layout\.tsx$/,
  /globals\.css$/,
  /page\.tsx$/,
  /tailwind\.config/,
  /next\.config/,
  /tsconfig/,
];

async function filterRelevantFiles(
  allPaths: string[],
  item: PipelineItem,
): Promise<string[]> {
  // Paths relative to app root for readability
  const relPaths = allPaths.map((p) => p.replace("/home/daytona/app/", ""));

  const prompt = `You are selecting which source files a developer needs to read to ${
    item.type === "bug" ? "fix a bug" : "add a feature"
  } in a Next.js app.

TASK: ${item.summary}
DETAILS: ${item.body}

FILES IN THE PROJECT:
${relPaths.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Select ALL files that are likely relevant. Be GENEROUS — it's much better to include
a file that turns out to be unnecessary than to miss one that's needed. Include:
- Files directly related to the feature/bug area
- Layout files, CSS files, and config files that might need changes
- Component files that could be affected
- Any shared utilities or types used by the affected components

Return ONLY a JSON array of the file numbers (integers), nothing else.
Example: [1, 3, 7, 12, 15]`;

  try {
    const response = await anthropic.messages.create({
      model: "us.anthropic.claude-3-5-haiku-20241022-v1:0",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const arrMatch = text.match(/\[[\d\s,]+\]/);
    if (!arrMatch) throw new Error("Haiku didn't return a valid array");
    const indices: number[] = JSON.parse(arrMatch[0]);
    const selected = new Set<string>();

    // Add Haiku's picks
    for (const idx of indices) {
      const absPath = allPaths[idx - 1]; // 1-indexed
      if (absPath) selected.add(absPath);
    }

    // Always include core files
    for (const path of allPaths) {
      if (ALWAYS_INCLUDE_PATTERNS.some((pat) => pat.test(path))) {
        selected.add(path);
      }
    }

    // Safety: if Haiku picked too few, fall back to all files
    if (selected.size < 5) {
      console.log(`   Haiku only picked ${selected.size} files, falling back to all ${allPaths.length}`);
      return allPaths;
    }

    return Array.from(selected);
  } catch (err) {
    console.log(`   File filtering failed (${(err as Error).message}), using all files`);
    return allPaths;
  }
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

interface ClaudeResponse {
  patches: Array<{ filePath: string; content: string }>;
  verificationSteps: string[];
}

function parseClaudeResponse(raw: string): ClaudeResponse {
  // ── Primary: delimiter-based format (no JSON escaping needed) ──
  const patchBlocks = [...raw.matchAll(/===PATCH:(.+?)===\n([\s\S]*?)===END_PATCH===/g)];
  if (patchBlocks.length > 0) {
    const patches = patchBlocks.map((m) => ({
      filePath: m[1].trim(),
      content: m[2],  // Raw file content, no JSON parsing needed
    }));

    // Extract verification steps
    const stepsMatch = raw.match(/===VERIFICATION_STEPS===\n([\s\S]*?)===END_VERIFICATION_STEPS===/);
    const verificationSteps = stepsMatch
      ? stepsMatch[1].trim().split("\n")
          .map((line) => line.replace(/^\d+\.\s*/, "").trim())
          .filter(Boolean)
      : [];

    console.log(`   Parsed ${patches.length} patch(es) via delimiter format`);
    return { patches, verificationSteps };
  }

  // ── Fallback: JSON format (for backward compat if Claude ignores delimiters) ──
  const tryParseJSON = (text: string): ClaudeResponse | null => {
    try {
      const parsed = JSON.parse(text);
      if (parsed.patches && Array.isArray(parsed.patches)) {
        return { patches: parsed.patches, verificationSteps: parsed.verificationSteps || [] };
      }
      if (Array.isArray(parsed)) {
        return { patches: parsed, verificationSteps: [] };
      }
    } catch { /* fall through */ }
    return null;
  };

  let result = tryParseJSON(raw);
  if (result) return result;

  // Try extracting JSON from surrounding text
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    result = tryParseJSON(arrMatch[0]);
    if (result) return result;
  }

  throw new Error("Could not parse Claude response — no delimiter blocks or valid JSON found");
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
  const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const ts = Date.now().toString(36); // short unique suffix to avoid branch collisions
  const branchName = `gripe/${item.type}-${slug}-${ts}`;
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
- Preserve the existing design language (spacing, fonts, layout) but DO change colors/themes if the bug requires it
- Make sure the fix is testable by navigating the app in a browser
- Do NOT modify package.json or add new dependencies. Use only what's already installed.
- You MUST modify config files (tailwind.config.ts, next.config.ts, etc.) if the fix requires it.
  For example, dark mode in Tailwind requires adding darkMode: "class" to tailwind.config.ts,
  toggling a "dark" class on the <html> element, and using dark: variant classes on all colored elements.

RESPOND using the EXACT format below. Use the delimiters exactly as shown.
Do NOT use JSON for file contents — use the delimiter format instead.

===PATCH:/home/daytona/app/path/to/file.tsx===
(paste the FULL updated file content here — raw code, no escaping)
===END_PATCH===

===PATCH:/home/daytona/app/another/file.css===
(full updated file content)
===END_PATCH===

===VERIFICATION_STEPS===
1. A simple verification step, e.g. "Click the Login button and verify the dashboard loads"
2. One more step if needed — keep it to 1-2 steps maximum
===END_VERIFICATION_STEPS===

Rules:
- One ===PATCH:...=== block per changed file, containing the COMPLETE updated file content
- 1-2 simple verification steps — do NOT ask to check every page, just verify the core fix works
- No markdown fences, no explanation outside the delimiters, no commentary`;
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
- Keep changes clean but thorough — always modify config files (tailwind.config.ts, next.config.ts) when the feature requires it and apply changes to the DOM directly (e.g. document.documentElement.classList for theming)
- Follow the existing code patterns and visual style
- Make sure the feature is testable by navigating the app in a browser
- Add any necessary UI elements (buttons, toggles, etc.)
- Do NOT modify package.json or add new dependencies. Use only what's already installed.
- You MUST modify config files (tailwind.config.ts, next.config.ts, etc.) if the feature requires it.
  For example, dark mode in Tailwind requires adding darkMode: "class" to tailwind.config.ts,
  toggling a "dark" class on the <html> element, and using dark: variant classes on ALL colored elements.
- IMPORTANT: If the feature affects visual theming (e.g. dark mode), you MUST patch EVERY component
  and page that has hardcoded colors — including dashboard components, cards, tables, navs, etc.
  Do not just patch the homepage and layout — patch ALL files that contain bg-white, text-black,
  border-gray, or any other hardcoded color class. Add dark: variants to every single one.

RESPOND using the EXACT format below. Use the delimiters exactly as shown.
Do NOT use JSON for file contents — use the delimiter format instead.

===PATCH:/home/daytona/app/path/to/file.tsx===
(paste the FULL updated file content here — raw code, no escaping)
===END_PATCH===

===PATCH:/home/daytona/app/another/file.css===
(full updated file content)
===END_PATCH===

===VERIFICATION_STEPS===
1. A simple verification step, e.g. "Click the Toggle theme button and verify the background changes"
2. One more step if needed — keep it to 1-2 steps maximum, focused on the main page only
===END_VERIFICATION_STEPS===

Rules:
- One ===PATCH:...=== block per changed file, containing the COMPLETE updated file content
- 1-2 simple verification steps — do NOT ask to check every page, just verify it works on ONE page
- No markdown fences, no explanation outside the delimiters, no commentary`;
}

function buildVerificationPrompt(
  item: PipelineItem,
  previewUrl: string,
  verificationSteps: string[],
): string {
  const isDarkMode = /dark\s*mode|theme\s*toggle|light.*dark|dark.*light/i.test(
    `${item.summary} ${item.body}`,
  );

  if (isDarkMode) {
    return `Go to ${previewUrl}/login, log in with email "demo@shop.com" and password "password123", then Navigate to the home page and click the moon icon button in the top right corner of the header. Then Verify the page background changes from light to dark and all text becomes light colored. Then Click the sun icon button in the top right corner to toggle back to light mode. Then Navigate to the login page and verify the theme toggle button appears in the top right corner and functions correctly. Be quick — do not navigate away from the app or re-login. Return ONLY: { "pass": true/false, "reason": "one sentence" }`;
  }

  const whatToVerify = verificationSteps.length > 0
    ? verificationSteps.join(". Then ")
    : item.type === "bug"
      ? `verify that this bug is fixed: "${item.summary}"`
      : `verify this new feature works: "${item.summary}"`;

  return `Go to ${previewUrl}/login, log in with email "demo@shop.com" and password "password123", then ${whatToVerify}. If the core feature works on ANY page (e.g. background visibly changes), that is a PASS — it does not need to be perfect on every page. Only FAIL if the feature has zero visible effect anywhere. Do not navigate away from the app or re-login. Return ONLY: { "pass": true/false, "reason": "one sentence describing what you actually saw" }`;
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

    console.log("4. Starting dev server (non-blocking)...");
    await sandbox.process.createSession("dev-server");
    await sandbox.process.executeSessionCommand("dev-server", {
      command: "cd /home/daytona/app && npm run dev",
      runAsync: true,
    });
    // Don't await dev server here — do file listing + Claude in parallel
  }

  try {
    // Get preview URL (doesn't need server to be ready)
    const preview = await sandbox.getPreviewLink(3000);
    console.log(`   Preview: ${preview.url}\n`);

    // A. List files + filter with Haiku + read files + Claude — all BEFORE dev server needed
    console.log("A. Listing source files...");
    const allPaths = await listSourceFiles(sandbox);
    console.log(`   Found ${allPaths.length} source files`);

    console.log("A2. Filtering relevant files (Haiku)...");
    const relevantPaths = await filterRelevantFiles(allPaths, item);
    console.log(`   Selected ${relevantPaths.length}/${allPaths.length} files`);

    console.log("A3. Reading selected files...");
    const files = await readSelectedFiles(sandbox, relevantPaths);
    const sourceCode = formatForClaude(files);

    // B. Claude writes the fix/feature (dev server still booting — that's fine)
    console.log("B. Sending to Claude...");
    await updateItemStatus(item._id, "building", { statusMessage: "Claude writing code..." });
    const prompt = item.type === "bug"
      ? buildBugPrompt(item, sourceCode)
      : buildFeaturePrompt(item, sourceCode);

    const response = await anthropic.messages.create({
      model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
      max_tokens: 16384,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const { patches, verificationSteps } = parseClaudeResponse(raw);
    if (verificationSteps.length > 0) {
      console.log(`   Claude provided ${verificationSteps.length} verification step(s)`);
    }

    // C. Now ensure dev server is up before applying patches
    console.log("C. Waiting for dev server...");
    await waitForDevServer(sandbox);

    // D. Apply patches
    console.log(`D. Applying ${patches.length} patch(es)...`);
    for (const p of patches) {
      await sandbox.fs.uploadFile(Buffer.from(p.content), p.filePath);
      console.log(`   Patched: ${p.filePath}`);
    }

    // E. Wait for hot reload
    console.log("E. Waiting for hot reload (~3s)...");
    await new Promise((r) => setTimeout(r, 3_000));

    // F. Verify with Browser Use
    console.log("F. Verifying with Browser Use...\n");
    await updateItemStatus(item._id, "verifying", { statusMessage: "Browser Use verifying..." });
    await updateRunStep(runId, "BUILD", "done", "VERIFY");
    await updateRunStep(runId, "VERIFY", "running");

    const verifyPrompt = buildVerificationPrompt(item, preview.url, verificationSteps);

    const buResult = await bu.run(verifyPrompt, {
      maxSteps: 10,
      timeout: 300_000,
    });
    console.log("   Raw BU result:", JSON.stringify(buResult, null, 2));

    // Extract the last screenshot from BU steps
    const buSteps = (buResult as any).steps ?? [];
    const screenshotUrl: string | undefined = [...buSteps]
      .reverse()
      .find((s: any) => s.screenshotUrl)?.screenshotUrl;
    if (screenshotUrl) console.log(`   Screenshot: ${screenshotUrl}`);

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
          screenshotUrl,
        });

        await updateRunStep(runId, "DEPLOY", "done");
        return true;
      } else {
        console.log(`\n   VERIFICATION FAILED — ${verification.reason}\n`);
        await updateItemStatus(item._id, "failed", {
          verified: false,
          detail: verification.reason,
          statusMessage: "Verification failed",
          traceUrl,
          screenshotUrl,
        });
        return false;
      }
    } else {
      const traceId = Laminar.getLaminarSpanContext()?.traceId;
      const lmnrProjectId2 = process.env.LMNR_PROJECT_ID || "";
      const traceUrl = traceId && lmnrProjectId2 ? `https://laminar.sh/project/${lmnrProjectId2}/traces?traceId=${traceId}` : undefined;
      console.log("\n   Could not parse BU output\n");
      await updateItemStatus(item._id, "failed", {
        verified: false,
        detail: "Could not parse Browser Use verification output",
        statusMessage: "Verification parse error",
        traceUrl,
        screenshotUrl,
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

  // 1. Poll Convex for detected items (Python pipeline will push them when done)
  console.log("Polling Convex for detected items...");
  const items = await pollForItems(300); // 5 min timeout

  if (items.length === 0) {
    console.log("No items found after polling. Exiting.");
    return;
  }

  console.log(`Found ${items.length} item(s) to process:\n`);
  for (const item of items) {
    console.log(`  - [${item.type.toUpperCase()}] ${item.title} (${item.severity})`);
  }

  // 2. Prewarm sandboxes for ALL items in parallel
  console.log(`\nPrewarming ${items.length} sandbox(es) in parallel...`);
  const warmSandboxPromises = items.map((_, i) =>
    prewarmSandbox().catch((err) => {
      console.error(`[PREWARM ${i}] Failed:`, (err as Error).message);
      return null;
    })
  );

  // 4. Get or create a pipeline run (runs while sandboxes prewarm)
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

  // Await all prewarmed sandboxes
  const warmSandboxes = await Promise.all(warmSandboxPromises);
  console.log(`   ${warmSandboxes.filter(Boolean).length}/${items.length} sandboxes ready\n`);

  let successCount = 0;
  try {
    // 5. Process items in PARALLEL — each item gets its own prewarmed sandbox
    const results = await Promise.allSettled(
      items.map((item, i) => {
        const sandbox = warmSandboxes[i];
        return processItem(item, runId, sandbox).catch(async (err) => {
          console.error(`\nFailed to process "${item.title}":`, (err as Error).message);
          await updateItemStatus(item._id, "failed", {
            verified: false,
            detail: `Pipeline error: ${(err as Error).message}`,
            statusMessage: "Pipeline error",
          });
          return false;
        });
      })
    );

    successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value === true
    ).length;
  } finally {
    // ALWAYS mark the run as complete, even if processing throws
    try {
      await updateRunStep(runId, "POST", "done");
      await completeRun(runId, successCount);
    } catch (e) {
      console.error("Failed to complete run in Convex:", (e as Error).message);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`  Done! ${successCount}/${items.length} items processed successfully`);
  console.log("=".repeat(50) + "\n");
}

main().catch(async (err) => {
  console.error("\n Pipeline failed:", err?.message ?? err);
  // Try to complete any active run so the UI doesn't get stuck
  try {
    const resp = await fetch(`${CONVEX_SITE_URL}/api/runs/current`);
    if (resp.ok) {
      const run = (await resp.json()) as { _id?: string };
      if (run._id) {
        await completeRun(run._id, 0);
        console.log(" Marked stale run as complete.");
      }
    }
  } catch { /* best effort */ }
  process.exit(1);
});
