#!/usr/bin/env node
/**
 * Live E2E check for the chat-bubble artifact-attach fix (Q14).
 * Drives the real /app chat UI via dev-bypass auth, sends a message that
 * triggers the powerpoint skill, and asserts:
 *  1. a download card renders inside the chat bubble (not just side panel)
 *  2. it survives a page reload (metadata.artifacts persistence)
 *  3. the download link actually resolves a real file
 *
 * Usage: npx tsx scripts/test-artifact-attach.ts
 * Requires dev server (npm run dev) + Hermes gateway (aio profile) running.
 */
import { chromium } from "playwright";

const BASE_URL = process.env.AIO_SCREENSHOT_BASE_URL ?? "http://localhost:3000";
// .csv is in the gateway's recognized artifact extensions (api_server.py
// _ARTIFACT_EXTENSIONS) and needs no extra packages, unlike .pptx/python-pptx
// which the small local model struggled to self-heal around.
const PROMPT =
  "Run code to write a file called test.csv with header 'name,value' and one row 'hello,world', and give it to me.";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[browser console error]", msg.text());
  });

  console.log(`Navigating to ${BASE_URL}/app ...`);
  await page.goto(`${BASE_URL}/app`, { waitUntil: "networkidle" });

  const textarea = page.getByPlaceholder("Describe a task for Aio...");
  await textarea.waitFor({ state: "visible", timeout: 15000 });
  await textarea.fill(PROMPT);
  await page.getByRole("button", { name: "Send" }).click();
  console.log("Prompt sent, watching for approval gate + artifact card (up to 180s)...");

  // execute_code is behind a human-in-the-loop approval gate — click through it
  // ("session" scope so it won't ask again) whenever it shows up, in parallel
  // with waiting for the artifact card.
  const approveBtn = page.locator(".approval-btn.approve");
  const card = page.locator(".message-bubble .message-artifact-card");
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (await card.first().isVisible().catch(() => false)) break;
    if (await approveBtn.first().isVisible().catch(() => false)) {
      console.log("Approval gate shown, clicking Approve...");
      await approveBtn.first().click();
    }
    await page.waitForTimeout(1000);
  }
  await card.first().waitFor({ state: "visible", timeout: 5000 });
  const href = await card.first().getAttribute("href");
  console.log(`Artifact card rendered in chat bubble. href=${href}`);

  await page.screenshot({ path: "Aio/.tmp/screenshots/artifact-in-bubble.png", fullPage: true });

  console.log("Fetching artifact link immediately (pre-reload) to isolate timing...");
  const preReloadResp = await page.request.get(new URL(href!, BASE_URL).toString());
  console.log(`Pre-reload artifact fetch status=${preReloadResp.status()}`);

  // persistConversation() only runs once the full assistant turn ends (in
  // route.ts's stream `finally` block) — the artifact card can render mid-stream,
  // well before that. Reloading before the turn fully finishes races the DB
  // write and 404s. Wait for the "Live"/"Idle" status indicator to settle.
  console.log("Waiting for turn to fully finish (status -> Idle) before reload...");
  await page.locator(".stat-value", { hasText: "Idle" }).first().waitFor({ state: "visible", timeout: 60000 });

  console.log("Reloading page to test persistence...");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const bubblesAfterReload = await page.locator(".message-bubble").allTextContents();
  console.log("BUBBLES AFTER RELOAD:", JSON.stringify(bubblesAfterReload, null, 2));
  const cardAfterReload = page.locator(".message-bubble .message-artifact-card");
  await cardAfterReload.first().waitFor({ state: "visible", timeout: 15000 });
  const hrefAfterReload = await cardAfterReload.first().getAttribute("href");
  console.log(`Artifact card survived reload. href=${hrefAfterReload}`);

  if (!hrefAfterReload) throw new Error("No href on persisted artifact card");

  console.log("Fetching artifact link to confirm it resolves a real file...");
  const resp = await page.request.get(new URL(hrefAfterReload, BASE_URL).toString());
  console.log(`Artifact fetch status=${resp.status()} content-type=${resp.headers()["content-type"]}`);
  if (!resp.ok()) throw new Error(`Artifact fetch failed with status ${resp.status()}`);
  const body = await resp.body();
  console.log(`Artifact body size=${body.length} bytes`);
  const expected = "name,value\nhello,world\n";
  const actual = body.toString("utf-8");
  if (actual !== expected) {
    throw new Error(
      `Artifact body content mismatch — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }

  console.log("PASS: artifact attaches to chat bubble, persists across reload, and resolves a real file.");
  await browser.close();
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
