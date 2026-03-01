# GRIPE — Build Plan
## Autonomous Product Intelligence Loop | Browser Use Hackathon @ YC

---

## 1. What We're Building

GRIPE monitors a target product's Reddit + X community, classifies feedback (bug vs. feature), autonomously builds fixes/features in a Daytona sandbox, verifies them with Browser Use, then either posts the fix publicly (bug path) or runs a targeted ad campaign (feature path). The loop is self-sustaining: responses generate new inputs.

**Demo target product**: HelloFresh (r/hellofresh + @hellofresh on X)

---

## 2. Tech Stack Mapping

| Sponsor | Role |
|---|---|
| **Browser Use** | Scrape Reddit/X · verify fix via Daytona preview URL · post to Reddit · navigate Reddit Ads UI |
| **Convex** | Primary DB · vector embeddings · real-time listeners · Slack webhooks |
| **Daytona** | Sandbox for code execution · Computer Use virtual desktop for recording + screenshots |
| **Anthropic (Claude)** | Classification (bug/feat) · code implementation · PR description |
| **Cubic** | Autonomous PR review (repo-wide cross-file analysis) |
| **Mosaic** | Motion graphic ad creative from feature screenshots |
| **Dedalus Labs** | Hosted MCP servers for GitHub OAuth |
| **AgentMail** | Programmatic email inboxes for Reddit Ads account registration + OTP handling |
| **Laminar** | Full pipeline trace: LLM calls + browser sessions + Daytona ops |
| **Supermemory** | Persistent memory for replied-to threads (follow-up Q&A) |
| **Vercel** | Next.js dashboard deployment |

---

## 3. Browser Use SDK — Cloud API

The Browser Use TypeScript SDK (`browser-use-sdk`) is a client for the **Browser Use Cloud** service. Tasks run on their managed cloud infrastructure — no local Playwright, no Python, no subprocess bridge needed.

```bash
npm install browser-use-sdk
```

```typescript
import { BrowserUse } from "browser-use-sdk";

const bu = new BrowserUse();
// Reads BROWSER_USE_API_KEY from env automatically

const result = await bu.run("Go to reddit.com/r/hellofresh and scrape the top 50 posts");
```

**Key implications for GRIPE:**
- All BU tasks are pure TypeScript API calls — clean, no bridge
- BU cloud browsers can access any public URL, including Daytona's proxy preview URLs (e.g. `https://3000-<id>.proxy.daytona.work`) for verification
- File uploads to BU tasks use their presigned URL system (for ad creative)
- Daytona Computer Use still used for: taking screenshots/recordings as evidence, running the dev server, and building code — NOT for running a browser

---

## 4. Language

**100% TypeScript (Node.js)**. No Python anywhere.

---

## 5. Project Structure

```
gripe/
├── orchestrator/
│   ├── src/
│   │   ├── main.ts
│   │   ├── pipeline.ts
│   │   ├── agents/
│   │   │   ├── scraper.ts       # BU Cloud — scrape Reddit/X
│   │   │   ├── classifier.ts    # Anthropic SDK — bug vs feature
│   │   │   ├── builder.ts       # Daytona SDK + Anthropic — write fix
│   │   │   ├── verifier.ts      # BU Cloud navigates Daytona preview URL
│   │   │   ├── prManager.ts     # GitHub PR via Dedalus MCP + Cubic wait
│   │   │   ├── poster.ts        # BU Cloud — post reply + announcement to Reddit
│   │   │   ├── advertiser.ts    # BU Cloud — Reddit Ads campaign creation
│   │   │   └── notifier.ts      # Convex → Slack + Supermemory
│   │   ├── lib/
│   │   │   ├── bu.ts            # BrowserUse client singleton + typed wrappers
│   │   │   ├── convexClient.ts
│   │   │   ├── agentmail.ts
│   │   │   └── mosaic.ts
│   │   └── types.ts
│   ├── package.json
│   └── tsconfig.json
│
├── dashboard/
│   ├── app/
│   │   ├── page.tsx
│   │   └── api/slack/route.ts
│   ├── components/
│   │   ├── RunFeed.tsx
│   │   └── MetricCard.tsx
│   ├── convex/
│   │   ├── schema.ts
│   │   ├── posts.ts
│   │   ├── signals.ts
│   │   ├── runs.ts
│   │   ├── threads.ts
│   │   └── notifications.ts
│   └── package.json
│
├── sandbox/
│   ├── Dockerfile.gripe
│   └── snapshot.ts
│
├── .env.example
└── PLAN.md
```

---

## 6. Browser Use Client (`orchestrator/src/lib/bu.ts`)

```typescript
// orchestrator/src/lib/bu.ts
import { BrowserUse } from "browser-use-sdk";
import { z } from "zod";

// Singleton — reads BROWSER_USE_API_KEY from env
export const bu = new BrowserUse();

// Typed helper: run a task and parse result as JSON matching a Zod schema
export async function buRun<T>(
  task: string,
  schema: z.ZodType<T>
): Promise<T> {
  const result = await bu.run(task, { schema });
  return result as T;
}
```

---

## 7. Step-by-Step Pipeline

### Step 00 — Entry Point (`main.ts`)

```typescript
import { runPipeline } from "./pipeline";

runPipeline({
  subreddit: "hellofresh",
  xHandle: "hellofresh",
  productRepo: process.env.PRODUCT_REPO!,
}).catch(console.error);
```

---

### Step 01 — Scraper (`agents/scraper.ts`)

```typescript
import { bu } from "../lib/bu";
import { z } from "zod";
import { convex } from "../lib/convexClient";

const PostSchema = z.object({
  title: z.string(),
  body: z.string(),
  upvotes: z.number(),
  comments: z.array(z.string()),
  url: z.string(),
  createdAt: z.number(),
  source: z.enum(["reddit", "x"]),
});

const PostsSchema = z.array(PostSchema);

export async function scrapeAndCluster(subreddit: string, xHandle: string) {
  // Run Reddit + X scrapers in parallel via BU Cloud
  const [redditPosts, xPosts] = await Promise.all([
    bu.run(
      `Go to reddit.com/r/${subreddit}.
      Sort by New. Scrape the first 50 posts: title, body text, upvote count, url, created timestamp.
      For each post with 10+ upvotes, scrape the top 20 comments.
      Return a JSON array of posts.`,
      { schema: PostsSchema }
    ),

    bu.run(
      `Search Twitter/X for "@${xHandle}" mentions from the past 7 days.
      Collect up to 100 tweets: text (as body), likes (as upvotes), url, author.
      Return a JSON array.`,
      { schema: PostsSchema }
    ),
  ]);

  const allPosts = [...(redditPosts as any[]), ...(xPosts as any[])];

  // Store in Convex with embeddings, cluster via vector search
  for (const post of allPosts) {
    await convex.mutation("posts:insert", { post });
  }

  return convex.action("signals:clusterAndRank", {
    subreddit,
    minUpvotes: 40,
  });
}
```

---

### Step 02 — Classifier (`agents/classifier.ts`)

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { convex } from "../lib/convexClient";
import type { Signal } from "../types";

export async function classifyCluster(cluster: {
  id: string;
  posts: Array<{ title: string; body: string; upvotes: number; comments: string[] }>;
}): Promise<Signal> {
  const client = new Anthropic();

  const postsText = cluster.posts
    .map(
      (p) =>
        `Post: ${p.title}\n${p.body}\nUpvotes: ${p.upvotes}\n` +
        `Top comments: ${p.comments.slice(0, 5).join(" | ")}`
    )
    .join("\n---\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are a product manager analyzing user feedback clusters.
Classify as BUG (something broken) or FEATURE (desired capability that doesn't exist).
Output ONLY valid JSON:
{"type":"bug"|"feature","rationale":"string","priority":1-5,"title":"string","actionSummary":"string","affectedComponent":"string"}`,
    messages: [
      { role: "user", content: `Classify this cluster:\n\n${postsText}` },
    ],
  });

  const signal = JSON.parse(
    (response.content[0] as Anthropic.TextBlock).text
  ) as Signal;

  await convex.mutation("signals:setClassification", {
    clusterId: cluster.id,
    classification: signal,
  });

  return { ...signal, id: cluster.id };
}
```

---

### Step 03 — Builder (`agents/builder.ts`)

```typescript
import { Daytona } from "@daytonaio/sdk";
import Anthropic from "@anthropic-ai/sdk";
import type { Signal, BuildResult } from "../types";

const daytona = new Daytona();
const anthropic = new Anthropic();

export async function buildFix(signal: Signal, repoUrl: string): Promise<BuildResult> {
  // Spin up sandbox from pre-built snapshot (<90ms)
  const sandbox = await daytona.create({
    snapshot: "gripe-build-sandbox",
    name: `gripe-run-${signal.id.slice(0, 8)}`,
    envVars: { GITHUB_TOKEN: process.env.GITHUB_TOKEN! },
  });

  // Clone repo + install deps
  await sandbox.process.exec(`git clone ${repoUrl} /home/daytona/app`, { timeout: 120 });
  await sandbox.process.exec("cd /home/daytona/app && npm install", { timeout: 300 });

  // Find relevant files for Claude context
  const fileTree = await sandbox.process.exec(
    "find /home/daytona/app/src -name '*.ts' -o -name '*.tsx' | head -60",
    { timeout: 30 }
  );
  const relevantFiles = await getRelevantFiles(sandbox, signal.affectedComponent, fileTree.result);

  // Claude writes the fix
  const fixResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: `You are a senior TypeScript engineer.
Output ONLY a JSON array of file changes:
[{"path":"string","content":"string","changeDescription":"string"}]`,
    messages: [{
      role: "user",
      content: `
Signal type: ${signal.type}
Title: ${signal.title}
Action: ${signal.actionSummary}
Affected component: ${signal.affectedComponent}

Current file contents:
${JSON.stringify(relevantFiles, null, 2)}
      `,
    }],
  });

  const changes = JSON.parse(
    (fixResponse.content[0] as Anthropic.TextBlock).text
  ) as Array<{ path: string; content: string; changeDescription: string }>;

  // Apply changes + commit in sandbox
  const branchName = `gripe/${signal.type}/${signal.id.slice(0, 8)}`;
  await sandbox.process.exec(
    `cd /home/daytona/app && git checkout -b ${branchName}`,
    { timeout: 10 }
  );
  for (const change of changes) {
    await sandbox.fs.uploadFile(change.path, Buffer.from(change.content));
  }
  await sandbox.process.exec(
    `cd /home/daytona/app && git add -A && git commit -m "fix: ${signal.title.slice(0, 72)}"`,
    { timeout: 30 }
  );

  return { sandbox, branchName, changes, signal };
}

async function getRelevantFiles(sandbox: any, component: string, fileTree: string) {
  const resp = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{
      role: "user",
      content: `Which 5 files from this list are most relevant to '${component}'?\n${fileTree}\nReturn only file paths, one per line.`,
    }],
  });
  const paths = (resp.content[0] as Anthropic.TextBlock).text.trim().split("\n").slice(0, 5);
  const contents: Record<string, string> = {};
  for (const p of paths) {
    const res = await sandbox.process.exec(`cat ${p.trim()}`, { timeout: 10 });
    contents[p.trim()] = res.result;
  }
  return contents;
}
```

---

### Step 03b — Verifier (`agents/verifier.ts`)

```typescript
/**
 * VERIFICATION ARCHITECTURE
 * --------------------------
 * 1. Daytona sandbox (already running from builder.ts) starts dev server
 * 2. sandbox.getPreviewUrl(3000) returns a public HTTPS URL:
 *    https://3000-<sandbox-id>.proxy.daytona.work
 * 3. Browser Use Cloud navigates to this public URL — fully accessible
 *    because Daytona proxy tunnels the sandbox port to the internet
 * 4. BU agent clicks through the affected flow and reports PASS/FAIL
 * 5. Daytona Computer Use takes a screenshot of the sandbox desktop
 *    as visual evidence (Xvfb display, not browser-controlled)
 * 6. Screen recording from Computer Use is saved for Laminar upload
 */
import { z } from "zod";
import { bu } from "../lib/bu";
import type { BuildResult, VerifyResult } from "../types";

const VerifyOutputSchema = z.object({
  passed: z.boolean(),
  resultText: z.string(),
});

export async function verifyFix(build: BuildResult): Promise<VerifyResult> {
  const { sandbox, signal } = build;

  // 1. Start Computer Use — gives us screenshot + recording capability
  await sandbox.computerUse.start();
  const recording = await sandbox.computerUse.recording.start(
    `verify-${signal.id.slice(0, 8)}`
  );

  // 2. Start dev server in sandbox
  await sandbox.process.exec("cd /home/daytona/app && npm run dev &", { timeout: 10 });
  await new Promise((r) => setTimeout(r, 8_000));

  // 3. Get public preview URL — BU Cloud can reach this directly
  const preview = await sandbox.getPreviewUrl(3000);
  // e.g. https://3000-<sandbox-id>.proxy.daytona.work

  // 4. BU Cloud agent tests the running app
  const buResult = await bu.run(
    `Navigate to ${preview.url}.
    Test this user flow: ${signal.actionSummary}
    Verify that the issue "${signal.title}" is resolved.
    Click through the affected UI, interact with any forms or flows involved.
    Return JSON: {"passed": true|false, "resultText": "what you found"}`,
    { schema: VerifyOutputSchema }
  ) as z.infer<typeof VerifyOutputSchema>;

  // 5. Take screenshot via Daytona Computer Use (shows Xvfb desktop state)
  const screenshot = await sandbox.computerUse.screenshot.takeCompressed({
    format: "jpeg",
    quality: 85,
    showCursor: true,
  });

  // 6. Stop recording — saved to sandbox filesystem
  const rec = await sandbox.computerUse.recording.stop(recording.id);

  return {
    passed: buResult.passed,
    resultText: buResult.resultText,
    screenshotB64: screenshot.data.toString("base64"),
    recordingPath: rec.filePath,
    previewUrl: preview.url,
  };
}
```

---

### Step 03c — PR Manager (`agents/prManager.ts`)

```typescript
import type { BuildResult, VerifyResult, PrResult } from "../types";
import { callDedalusMcp } from "../lib/dedalus";
import Anthropic from "@anthropic-ai/sdk";

const MAX_CUBIC_RETRIES = 3;

export async function openPrAndReview(
  build: BuildResult,
  verify: VerifyResult
): Promise<PrResult> {
  const { sandbox, signal, branchName, changes } = build;

  // Push branch
  await sandbox.process.exec(
    `cd /home/daytona/app && git push origin ${branchName}`,
    { timeout: 30 }
  );

  const prBody = `
## GRIPE Autonomous Fix

**Signal**: ${signal.title}
**Type**: ${signal.type}
**Action**: ${signal.actionSummary}

### Verification
${verify.passed ? "✅ PASS" : "❌ FAIL"} — ${verify.resultText}

### Changes
${changes.map((c) => `- \`${c.path}\`: ${c.changeDescription}`).join("\n")}

---
*Auto-generated by GRIPE*
  `.trim();

  // Open PR via Dedalus Labs hosted GitHub MCP (handles OAuth)
  const pr = await callDedalusMcp("github", "create_pull_request", {
    owner: process.env.GITHUB_ORG,
    repo: process.env.GITHUB_REPO,
    title: `[GRIPE] ${signal.title}`,
    head: branchName,
    base: "main",
    body: prBody,
  });

  // Wait for Cubic review (triggered by Cubic GitHub App on PR open)
  for (let attempt = 0; attempt < MAX_CUBIC_RETRIES; attempt++) {
    const cubic = await waitForCubicReview(pr.number);

    if (cubic.approved) {
      await callDedalusMcp("github", "merge_pull_request", {
        owner: process.env.GITHUB_ORG,
        repo: process.env.GITHUB_REPO,
        pullNumber: pr.number,
        mergeMethod: "squash",
      });
      return { prUrl: pr.html_url, merged: true };
    }

    if (attempt < MAX_CUBIC_RETRIES - 1) {
      // Ask Claude to address Cubic's comments, push update
      await fixCubicComments(sandbox, build, cubic.comments);
      await sandbox.process.exec(
        `cd /home/daytona/app && git add -A && git commit -m "fix: address Cubic review" && git push origin ${branchName}`,
        { timeout: 30 }
      );
    }
  }

  return { prUrl: pr.html_url, merged: false, needsHuman: true };
}

async function waitForCubicReview(
  prNumber: number,
  timeoutMs = 300_000
): Promise<{ approved: boolean; comments: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const reviews = await callDedalusMcp("github", "list_reviews", {
      owner: process.env.GITHUB_ORG,
      repo: process.env.GITHUB_REPO,
      pullNumber: prNumber,
    }) as any[];
    const cubic = reviews.find((r) =>
      r.user?.login?.toLowerCase().includes("cubic")
    );
    if (cubic) {
      return { approved: cubic.state === "APPROVED", comments: cubic.body ?? "" };
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
  return { approved: true, comments: "" };
}

async function fixCubicComments(sandbox: any, build: BuildResult, comments: string) {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `Fix these code review comments:\n${comments}\n\nCurrent changes:\n${JSON.stringify(build.changes, null, 2)}\nReturn updated file changes as JSON array.`,
    }],
  });
  const fixes = JSON.parse((response.content[0] as Anthropic.TextBlock).text) as any[];
  for (const fix of fixes) {
    await sandbox.fs.uploadFile(fix.path, Buffer.from(fix.content));
  }
}
```

---

### Step 04a — Poster / Bug Path (`agents/poster.ts`)

```typescript
import { bu } from "../lib/bu";
import type { Signal, PrResult } from "../types";

export async function postFixToReddit(
  signal: Signal,
  pr: PrResult,
  subreddit: string
): Promise<void> {
  const replyText = [
    "Hey everyone — this has been fixed! 🎉",
    "",
    `We saw this thread and deployed a fix. ${signal.actionSummary}`,
    "",
    `Details: ${pr.prUrl}`,
    "",
    "Thanks for reporting this — keep the feedback coming!",
  ].join("\n");

  // Reply to original thread
  await bu.run(`
    Go to ${signal.sourceUrl}.
    Log in to Reddit with username from env REDDIT_USERNAME and password from env REDDIT_PASSWORD.
    Find the comment box and post this exact reply:
    ---
    ${replyText}
    ---
    Click Submit. Confirm the reply appeared.
  `);

  // Community announcement post
  await bu.run(`
    Go to reddit.com/r/${subreddit}/submit.
    Log in to Reddit if not already logged in.
    Create a Text post with:
    Title: [Fixed] ${signal.title}
    Body:
    ---
    We noticed many of you reported this issue — it's now resolved.

    ${signal.actionSummary}

    Thank you r/${subreddit} for the detailed reports. Your feedback directly drives what we fix.
    ---
    Submit the post.
  `);
}
```

---

### Step 04b — Advertiser / Feature Path (`agents/advertiser.ts`)

```typescript
/**
 * REDDIT ADS VIA BROWSER USE CLOUD
 * ----------------------------------
 * Architecture:
 *   1. AgentMail creates a disposable inbox for Reddit Ads account
 *   2. Mosaic generates ad creative (MP4 / image)
 *   3. Ad creative uploaded to Browser Use Cloud via presigned URL
 *      so the BU cloud agent can access/upload it within its session
 *   4. BU Cloud agent navigates ads.reddit.com, creates campaign,
 *      uploads the creative, targets the subreddit, submits
 *   5. AgentMail handles email verification / OTP in parallel
 *   6. Daytona Computer Use takes screenshots as audit evidence
 *      (sandbox stays running from build step)
 *
 * PAYMENT CONSTRAINT:
 *   BU Cloud cannot enter credit card numbers (security policy).
 *   Reddit Ads account must have a saved payment method pre-added
 *   manually by the operator ONCE. BU only selects the saved card.
 */
import { bu } from "../lib/bu";
import { createInbox, waitForOtp } from "../lib/agentmail";
import { generateAdCreative } from "../lib/mosaic";
import type { Signal, AdResult } from "../types";
import { z } from "zod";

const CampaignResultSchema = z.object({
  campaignId: z.string(),
  status: z.string(),
});

export async function launchAdCampaign(
  signal: Signal,
  subreddit: string
): Promise<AdResult> {
  // 1. AgentMail inbox for Reddit Ads account email
  const inbox = await createInbox(`reddit-ads-${signal.id.slice(0, 8)}`);

  // 2. Mosaic generates ad creative
  const adCreative = await generateAdCreative({
    featureTitle: signal.title,
    featureDescription: signal.actionSummary,
    screenshotB64: signal.verifyScreenshot,
    format: "reddit_video",
  });
  // { assetUrl: string, assetType: "image" | "video" }

  // 3. BU Cloud campaign creation
  //    BU downloads the Mosaic creative from its public URL and uploads it
  const [campaignResult] = await Promise.all([
    bu.run(
      `You are creating a Reddit Ads campaign.

      Step 1 — Login:
      Navigate to ads.reddit.com.
      Log in: username = ${process.env.REDDIT_ADS_USERNAME}, password from env REDDIT_ADS_PASSWORD.
      If no account exists, create one using email ${inbox.email} and those credentials.
      If email verification is required, wait 30 seconds then check again — verification will arrive.

      Step 2 — Create Campaign:
      Click "Create Campaign".
      Objective: Traffic.
      Campaign name: "GRIPE - ${signal.title.slice(0, 40)}"
      Daily budget: $20.
      Click Next.

      Step 3 — Ad Group:
      Ad group name: "r/${subreddit} targeting".
      Targeting → Communities → search and add: r/${subreddit}.
      Placements: Feed. Schedule: Start today.
      Click Next.

      Step 4 — Creative:
      Ad format: ${adCreative.assetType === "video" ? "Video" : "Image"}.
      Headline: "${signal.title.slice(0, 100)}".
      Download and upload this file as the creative: ${adCreative.assetUrl}
      Destination URL: ${process.env.PRODUCT_LANDING_URL}?utm_source=reddit&utm_campaign=gripe-${signal.id.slice(0, 8)}&discount=GRIPE10
      Save Ad.

      Step 5 — Launch:
      Review the campaign summary.
      Payment: select the saved card on file (DO NOT enter any new card numbers).
      Click "Launch Campaign".

      Return JSON: {"campaignId": "...", "status": "pending_review|active"}`,
      { schema: CampaignResultSchema }
    ) as Promise<z.infer<typeof CampaignResultSchema>>,

    // Run AgentMail OTP polling in parallel in case signup needs email verification
    waitForOtp(inbox.id, 180_000).catch(() => null),
  ]);

  return {
    campaignId: (campaignResult as any).campaignId,
    status: (campaignResult as any).status,
    adEmail: inbox.email,
    discountCode: "GRIPE10",
  };
}
```

---

### Step 05 — Notifier (`agents/notifier.ts`)

```typescript
import { convex } from "../lib/convexClient";
import type { Signal, PrResult, VerifyResult, AdResult } from "../types";

export async function notifyTeam(payload: {
  signal: Signal;
  pr?: PrResult;
  verify?: VerifyResult;
  ad?: AdResult;
  laminarUrl?: string;
  subreddit: string;
}): Promise<void> {
  const { signal, pr, verify, ad, laminarUrl, subreddit } = payload;

  // Log run to Convex — triggers Slack via Convex HTTP action
  await convex.mutation("runs:logRun", {
    signalId: signal.id,
    type: signal.type,
    title: signal.title,
    prUrl: pr?.prUrl,
    merged: pr?.merged,
    passed: verify?.passed ?? false,
    laminarUrl,
    adCampaignId: ad?.campaignId,
    discountCode: ad?.discountCode,
  });

  // Convex action posts structured Slack message
  await convex.action("notifications:postSlack", {
    type: signal.type,
    title: signal.title,
    prUrl: pr?.prUrl,
    passed: verify?.passed,
    campaignId: ad?.campaignId,
    discountCode: ad?.discountCode,
    laminarUrl,
    subreddit,
  });

  // Supermemory — persist for follow-up Q&A on thread replies
  await fetch("https://api.supermemory.ai/v3/memories", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPERMEMORY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: `
GRIPE Run ${signal.id}: ${signal.title}
Type: ${signal.type} | Action: ${signal.actionSummary}
PR: ${pr?.prUrl} | Verified: ${verify?.resultText}
      `.trim(),
      metadata: { signalId: signal.id, type: signal.type },
    }),
  });

  // Register thread for reply monitoring loop
  if (signal.sourceUrl) {
    await convex.mutation("threads:monitor", {
      url: signal.sourceUrl,
      signalId: signal.id,
    });
  }
}
```

---

### Step 06 — Self-Sustaining Loop (`convex/threads.ts`)

```typescript
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { cronJobs } from "convex/server";

export const monitorReplies = internalMutation({
  handler: async (ctx) => {
    const threads = await ctx.db
      .query("monitored_threads")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
    for (const thread of threads) {
      await ctx.scheduler.runAfter(0, internal.scraper.checkThreadReplies, {
        threadUrl: thread.url,
        lastChecked: thread.lastChecked,
        signalId: thread.signalId,
      });
    }
  },
});

const crons = cronJobs();
crons.interval("monitor-replies", { minutes: 30 }, internal.threads.monitorReplies);
crons.interval("scrape-new-posts", { hours: 1 }, internal.scraper.triggerScrape);
export default crons;
```

---

## 8. Pipeline Orchestration with Laminar (`pipeline.ts`)

```typescript
import * as Laminar from "@lmnr-ai/lmnr";
import { scrapeAndCluster } from "./agents/scraper";
import { classifyCluster } from "./agents/classifier";
import { buildFix } from "./agents/builder";
import { verifyFix } from "./agents/verifier";
import { openPrAndReview } from "./agents/prManager";
import { postFixToReddit } from "./agents/poster";
import { launchAdCampaign } from "./agents/advertiser";
import { notifyTeam } from "./agents/notifier";

Laminar.Laminar.initialize({ projectApiKey: process.env.LAMINAR_API_KEY! });

export async function runPipeline(config: {
  subreddit: string;
  xHandle: string;
  productRepo: string;
}): Promise<void> {
  return Laminar.observe(
    { name: "gripe_pipeline_run", sessionId: `run-${Date.now()}` },
    async () => {
      const { subreddit, xHandle, productRepo } = config;

      const cluster = await Laminar.observe({ name: "step_01_scrape" }, () =>
        scrapeAndCluster(subreddit, xHandle)
      );
      const signal = await Laminar.observe({ name: "step_02_classify" }, () =>
        classifyCluster(cluster)
      );
      const build = await Laminar.observe({ name: "step_03_build" }, () =>
        buildFix(signal, productRepo)
      );
      const verify = await Laminar.observe({ name: "step_03b_verify" }, () =>
        verifyFix(build)
      );
      build.signal.verifyScreenshot = verify.screenshotB64;
      const pr = await Laminar.observe({ name: "step_03c_pr" }, () =>
        openPrAndReview(build, verify)
      );

      let ad: Awaited<ReturnType<typeof launchAdCampaign>> | undefined;
      if (signal.type === "bug") {
        await Laminar.observe({ name: "step_04_post" }, () =>
          postFixToReddit(signal, pr, subreddit)
        );
      } else {
        ad = await Laminar.observe({ name: "step_04_ad" }, () =>
          launchAdCampaign(signal, subreddit)
        );
      }

      await Laminar.observe({ name: "step_05_notify" }, () =>
        notifyTeam({ signal, pr, verify, ad, subreddit })
      );
    }
  );
}
```

---

## 9. AgentMail Client (`lib/agentmail.ts`)

```typescript
const BASE = "https://api.agentmail.to/v1";
const h = () => ({
  Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}`,
  "Content-Type": "application/json",
});

export async function createInbox(label: string): Promise<{ id: string; email: string }> {
  const r = await fetch(`${BASE}/inboxes`, {
    method: "POST", headers: h(), body: JSON.stringify({ label }),
  });
  return r.json();
}

export async function waitForOtp(
  inboxId: string,
  timeoutMs = 120_000
): Promise<{ code?: string; link?: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await fetch(`${BASE}/inboxes/${inboxId}/messages`, { headers: h() });
    const { messages } = await r.json();
    if (messages?.length) {
      const extract = await fetch(`${BASE}/messages/${messages[0].id}/extract`, {
        method: "POST",
        headers: h(),
        body: JSON.stringify({
          prompt: "Extract the verification code or link from this email",
        }),
      });
      return extract.json();
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }
  throw new Error("Timed out waiting for verification email");
}
```

---

## 10. Convex Schema (`convex/schema.ts`)

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  posts: defineTable({
    source: v.union(v.literal("reddit"), v.literal("x")),
    url: v.string(),
    title: v.string(),
    body: v.string(),
    upvotes: v.number(),
    comments: v.array(v.string()),
    createdAt: v.number(),
    clusterId: v.optional(v.id("signals")),
    embedding: v.optional(v.array(v.float64())),
  }).vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 1536 }),

  signals: defineTable({
    type: v.union(v.literal("bug"), v.literal("feature")),
    title: v.string(),
    rationale: v.string(),
    priority: v.number(),
    actionSummary: v.string(),
    affectedComponent: v.string(),
    postIds: v.array(v.id("posts")),
    totalUpvotes: v.number(),
    status: v.union(
      v.literal("pending"), v.literal("building"), v.literal("built"),
      v.literal("posted"), v.literal("ad_live")
    ),
    createdAt: v.number(),
  }),

  runs: defineTable({
    signalId: v.id("signals"),
    type: v.union(v.literal("bug"), v.literal("feature")),
    title: v.string(),
    prUrl: v.optional(v.string()),
    merged: v.optional(v.boolean()),
    passed: v.boolean(),
    laminarUrl: v.optional(v.string()),
    adCampaignId: v.optional(v.string()),
    discountCode: v.optional(v.string()),
    slackPosted: v.boolean(),
    createdAt: v.number(),
  }),

  monitored_threads: defineTable({
    url: v.string(),
    signalId: v.id("signals"),
    lastChecked: v.number(),
    active: v.boolean(),
  }),
});
```

---

## 11. Package Files

**`orchestrator/package.json`**:
```json
{
  "name": "gripe-orchestrator",
  "type": "module",
  "scripts": {
    "start": "tsx src/main.ts",
    "dev": "tsx watch src/main.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.36.0",
    "@daytonaio/sdk": "^0.14.0",
    "@lmnr-ai/lmnr": "^0.5.0",
    "browser-use-sdk": "^3.1.0",
    "convex": "^1.17.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  }
}
```

---

## 12. Daytona Snapshot (`sandbox/snapshot.ts` + `Dockerfile.gripe`)

```typescript
// sandbox/snapshot.ts — run once
import { Daytona, Image } from "@daytonaio/sdk";
const daytona = new Daytona();
const image = Image.fromDockerfile("sandbox/Dockerfile.gripe");
await daytona.snapshot.create({ name: "gripe-build-sandbox", image }, { onLogs: console.log });
console.log("Registered: gripe-build-sandbox");
```

```dockerfile
# sandbox/Dockerfile.gripe
FROM daytonaio/sandbox:0.6.0

RUN apt-get update && apt-get install -y \
    nodejs npm git curl ffmpeg \
    xvfb xfce4 x11vnc \
    && rm -rf /var/lib/apt/lists/*

ENV DISPLAY=:99
WORKDIR /home/daytona
```

No Chromium or Playwright in the image — Browser Use Cloud handles its own browser.
Daytona Computer Use (Xvfb + desktop) is only used for screenshots/recordings.

---

## 13. Environment Variables

```bash
# Browser Use Cloud
BROWSER_USE_API_KEY=bu_...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Daytona
DAYTONA_API_KEY=...
DAYTONA_TARGET=us

# Convex
CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=...

# AgentMail
AGENTMAIL_API_KEY=...

# Laminar
LAMINAR_API_KEY=...

# Supermemory
SUPERMEMORY_API_KEY=...

# Dedalus Labs
DEDALUS_API_KEY=...

# Reddit (posting account)
REDDIT_USERNAME=gripe-bot
REDDIT_PASSWORD=...

# Reddit Ads (saved payment method must be pre-added manually once)
REDDIT_ADS_USERNAME=...
REDDIT_ADS_PASSWORD=...

# GitHub
GITHUB_TOKEN=ghp_...
GITHUB_ORG=your-org
GITHUB_REPO=hellofresh-app

# Product
PRODUCT_REPO=git@github.com:org/hellofresh-app.git
PRODUCT_LANDING_URL=https://hellofresh.com/lp

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Mosaic
MOSAIC_API_KEY=...
```

---

## 14. Verification Architecture (Daytona + BU)

```
Orchestrator (TypeScript)               Daytona Sandbox (Linux)
─────────────────────────               ────────────────────────────────────

                                         sandbox.computerUse.start()
                                         → Xvfb :99 starts (virtual display)
                                         → xfce4 desktop starts on :99
                                         → screen recording begins

                                         sandbox.process.exec("npm run dev &")
                                         → Next.js app on localhost:3000

                         HTTPS tunnel ← sandbox.getPreviewUrl(3000)
                       ───────────────   → https://3000-<id>.proxy.daytona.work
                                                         ↓
                                         (public URL — internet accessible)
                                                         ↓
                         BU Cloud ─────── navigates preview URL ─────────────►
                         (managed browser)  clicks through UI
                         returns PASS/FAIL JSON

                                         sandbox.computerUse.screenshot  → JPEG evidence
                                         sandbox.computerUse.recording   → MP4 for Laminar
```

---

## 15. Build Order

| Hour | Task |
|---|---|
| 1 | Init Convex + schema · Register Daytona snapshot · Configure `.env` |
| 2 | `scraper.ts` — BU Cloud scrapes r/hellofresh · test run |
| 3 | `classifier.ts` — Claude classification + Convex vector clustering |
| 4 | `builder.ts` — Daytona sandbox + Claude writes fix |
| 5 | `verifier.ts` — Computer Use + preview URL + BU Cloud verify |
| 6 | `prManager.ts` — Dedalus GitHub MCP + Cubic wait loop |
| 7 | `poster.ts` — BU Cloud posts Reddit reply + announcement |
| 8 | `advertiser.ts` — BU Cloud Reddit Ads campaign creation + AgentMail OTP |
| 9 | `notifier.ts` — Slack + Supermemory + thread monitoring loop |
| 10 | Next.js Vercel dashboard + Laminar trace wiring + end-to-end demo run |

---

## 16. Key Constraints & Decisions

| Constraint | Decision |
|---|---|
| BU cannot enter credit card numbers | Reddit Ads account must have saved payment pre-added once. BU only selects it. |
| BU Cloud needs to access ad creative | Mosaic returns a public asset URL; BU downloads and uploads it within its session. |
| Daytona preview URLs are public HTTPS | BU Cloud can reach them directly — no special tunneling needed. |
| Cubic needs GitHub App installed | Pre-install Cubic GitHub App on target repo before demo. |
| Reddit Ads first-time signup | AgentMail handles email + OTP. Username/password in env vars. |
| Dockerfile no longer needs Chromium | Removed — BU Cloud uses its own managed browsers. Smaller image. |

---

## 17. Demo Script (2 min)

1. Show r/hellofresh — cluster: 40+ upvotes on "checkout crashes on mobile"
2. `npx tsx src/main.ts` — pipeline starts
3. **Step 01**: BU Cloud scrapes thread (Laminar shows browser session)
4. **Step 02**: Claude: `{ type: "bug", title: "Mobile checkout crash" }`
5. **Step 03**: Daytona sandbox spins up · Claude writes fix · Computer Use records screen
6. **Step 03b**: BU Cloud navigates Daytona preview URL · returns PASS
7. Cubic approves PR → auto-merged
8. **Step 04 bug**: BU Cloud posts Reddit reply + announcement
9. **Switch**: "week-skip feature" — 50 upvotes
10. **Step 04 feat**: BU Cloud navigates ads.reddit.com → campaign live with Mosaic creative
11. **Step 05**: Slack + Vercel dashboard: 2 items shipped, 0 humans required
