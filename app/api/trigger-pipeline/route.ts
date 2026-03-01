import { spawn } from "child_process";
import { NextResponse } from "next/server";
import path from "path";

export async function POST() {
  const pipelineDir = path.join(process.cwd(), "pipeline");

  const child = spawn("python3", ["main.py"], {
    cwd: pipelineDir,
    detached: true,
    stdio: "ignore",
  });

  child.unref();

  return NextResponse.json({ ok: true, pid: child.pid });
}
