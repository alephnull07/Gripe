import { spawn } from "child_process";
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
  "https://gregarious-marmot-798.convex.site";

export async function POST() {
  // 1. Trigger a run in Convex so the dashboard UI updates immediately
  const triggerResp = await fetch(`${CONVEX_SITE_URL}/api/runs/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  let runId: string | null = null;
  if (triggerResp.ok) {
    const data = await triggerResp.json();
    runId = data.runId;
  }

  // 2. Spawn the Python scraper (scrape → classify → validate → push to Convex)
  const pipelineDir = path.join(process.cwd(), "pipeline");
  const orchestratorDir = path.join(process.cwd(), "orchestrator");

  // Log output to a file so errors are visible
  const logFile = path.join(process.cwd(), "pipeline-run.log");
  const logFd = fs.openSync(logFile, "a");
  fs.writeSync(logFd, `\n${"=".repeat(60)}\n[${new Date().toISOString()}] Pipeline run started (runId: ${runId})\n${"=".repeat(60)}\n`);

  // Run pipeline + orchestrator in PARALLEL:
  // - Python pipeline: scrape → classify → validate → push items to Convex
  // - TS orchestrator: pre-warm sandbox → poll for items → build → verify → PR
  // The orchestrator starts creating the sandbox immediately while scraping happens.
  // If both fail, mark the run as completed so the UI doesn't get stuck.
  const envFile = `${process.cwd()}/.env`;
  const shellCmd = runId
    ? `(cd "${orchestratorDir}" && npx tsx --env-file="${envFile}" src/main.ts) &
       ORCH_PID=$!
       cd "${pipelineDir}" && python3 main.py
       PIPE_EXIT=$?
       wait $ORCH_PID
       ORCH_EXIT=$?
       if [ $PIPE_EXIT -ne 0 ] && [ $ORCH_EXIT -ne 0 ]; then
         curl -s -X POST "${CONVEX_SITE_URL}/api/runs/complete" -H "Content-Type: application/json" -d '{"id":"${runId}","itemsProcessed":0}'
       fi`
    : `(cd "${orchestratorDir}" && npx tsx --env-file="${envFile}" src/main.ts) &
       ORCH_PID=$!
       cd "${pipelineDir}" && python3 main.py
       wait $ORCH_PID`;

  const child = spawn("bash", ["-c", shellCmd], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env, PATH: process.env.PATH },
  });

  child.unref();
  fs.closeSync(logFd);

  return NextResponse.json({ ok: true, runId, pid: child.pid, logFile });
}
