import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("console", (msg) => console.log("[console]", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("[pageerror]", err));
  await page.goto("http://localhost:3000/app", { waitUntil: "networkidle" });
  const textarea = page.getByPlaceholder("Describe a task for Aio...");
  await textarea.waitFor({ state: "visible", timeout: 15000 });
  await textarea.fill("Create a 1-slide PowerPoint titled 'Test Deck' with the bullet 'Hello world'. Save it as test.pptx and give it to me.");
  await page.getByRole("button", { name: "Send" }).click();
  await page.waitForTimeout(30000);
  await page.screenshot({ path: ".tmp/screenshots/debug-30s.png", fullPage: true });
  const bubbles = await page.locator(".message-bubble").allTextContents();
  console.log("BUBBLES:", JSON.stringify(bubbles, null, 2));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
