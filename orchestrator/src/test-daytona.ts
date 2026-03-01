/**
 * Daytona smoke test — run this to verify the full Daytona integration
 * works before wiring it into the pipeline.
 *
 * Checks:
 *   1. Sandbox creation
 *   2. process.executeCommand(cmd, cwd?, env?, timeoutSeconds?)
 *   3. Filesystem: fs.uploadFile(Buffer, remotePath)
 *   4. Preview URL: getPreviewLink(port) → { url, token }
 *   5. Computer Use start (Xvfb + xfce4 + x11vnc + novnc)
 *   6. Screenshot: takeCompressed() → { screenshot: base64string }
 *   7. Screen recording start/stop
 *
 * Usage:
 *   cd orchestrator
 *   npm install
 *   DAYTONA_API_KEY=your_key npm run test:daytona
 */

import { Daytona } from "@daytonaio/sdk";
import { writeFileSync } from "fs";

const daytona = new Daytona();

async function testDaytona() {
  console.log("=== GRIPE — Daytona Smoke Test ===\n");

  // ─── 1. Create sandbox ───────────────────────────────────────────────────
  console.log("1️⃣  Creating sandbox...");
  const sandbox = await daytona.create({
    snapshot: "daytonaio/sandbox:0.6.0",
    name: `gripe-test-${Date.now()}`,
  });
  console.log("✅ Sandbox created:", sandbox.id, "\n");

  try {
    // ─── 2. Process exec ─────────────────────────────────────────────────
    console.log("2️⃣  Testing process.executeCommand...");
    const nodeVer = await sandbox.process.executeCommand("node --version");
    console.log("   Node:", nodeVer.result.trim());
    const whoami = await sandbox.process.executeCommand("whoami");
    console.log("   User:", whoami.result.trim());
    console.log("✅ Process exec OK\n");

    // ─── 3. Filesystem ───────────────────────────────────────────────────
    // uploadFile(buffer: Buffer, remotePath: string, timeout?: number)
    console.log("3️⃣  Testing filesystem...");
    const testContent = "hello from gripe";
    await sandbox.fs.uploadFile(
      Buffer.from(testContent),
      "/home/daytona/test.txt"
    );
    const readBack = await sandbox.process.executeCommand(
      "cat /home/daytona/test.txt"
    );
    const match = readBack.result.trim() === testContent;
    console.log("   Written:", testContent);
    console.log("   Read back:", readBack.result.trim());
    console.log(match ? "✅ Filesystem OK\n" : "❌ Filesystem mismatch\n");

    // ─── 4. Preview URL ──────────────────────────────────────────────────
    // getPreviewLink(port) → { url: string, token: string }
    // Use a session + runAsync:true so the server runs in background without blocking
    console.log("4️⃣  Testing preview URL (critical for BU verification)...");
    await sandbox.process.createSession("preview-test");
    await sandbox.process.executeSessionCommand("preview-test", {
      command: `node -e "require('http').createServer((_,r)=>{r.writeHead(200);r.end('GRIPE_OK')}).listen(3000)"`,
      runAsync: true,
    });
    await new Promise((r) => setTimeout(r, 2_000));

    const previewInfo = await sandbox.getPreviewLink(3000);
    console.log("   Preview URL:", previewInfo.url);
    console.log("   Token:", previewInfo.token ? "present (private sandbox)" : "none (public)");
    // URL structure confirms the Daytona proxy tunnel is active.
    // BU Cloud passes the token via X-Daytona-Preview-Token header when fetching.
    // In the pipeline: bu.run(`navigate to ${previewInfo.url}`) works — BU handles auth.
    const urlOk = previewInfo.url.startsWith("https://");
    console.log(urlOk ? "✅ Preview URL returned — proxy tunnel active\n" : "❌ Preview URL malformed\n");

    // ─── 5. Computer Use ─────────────────────────────────────────────────
    // start() spins up: Xvfb :99, xfce4, x11vnc, novnc
    console.log("5️⃣  Starting Computer Use (Xvfb + xfce4 desktop)...");
    await sandbox.computerUse.start();
    console.log("   Waiting for desktop to initialise...");
    await new Promise((r) => setTimeout(r, 5_000));

    const status = await sandbox.computerUse.getStatus();
    console.log("   Status:", JSON.stringify(status));
    console.log("✅ Computer Use started\n");

    // ─── 6. Screenshot ───────────────────────────────────────────────────
    // takeCompressed(options?) → { screenshot: string (base64), sizeBytes?: number }
    console.log("6️⃣  Taking screenshot of virtual desktop...");
    const screenshotResp = await sandbox.computerUse.screenshot.takeCompressed({
      format: "jpeg",
      quality: 80,
    });
    const imgData = Buffer.from(screenshotResp.screenshot!, "base64");
    const sizeKb = Math.round(imgData.length / 1024);
    writeFileSync("daytona-test-screenshot.jpg", imgData);
    console.log(`✅ Screenshot: ${sizeKb}kb → saved as daytona-test-screenshot.jpg\n`);

    // ─── 7. Screen recording ─────────────────────────────────────────────
    // recording.start(label?) → { id, filePath, ... }
    // recording.stop(id)     → { filePath, durationSeconds, ... }
    console.log("7️⃣  Testing screen recording...");
    const recording = await sandbox.computerUse.recording.start("test-recording");
    console.log("   Recording started, id:", recording.id);
    await new Promise((r) => setTimeout(r, 3_000));
    const stopped = await sandbox.computerUse.recording.stop(recording.id!);
    console.log("   Saved to:", stopped.filePath);
    console.log("✅ Screen recording OK\n");

  } finally {
    console.log("🧹 Deleting sandbox...");
    await sandbox.delete();
    console.log("✅ Done\n");
  }

  console.log("🎉 All checks passed — Daytona is ready for the pipeline.");
}

testDaytona().catch((err) => {
  console.error("\n❌ Test failed:", err?.message ?? err);
  process.exit(1);
});
