import { chromium } from "playwright";
async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/app", { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const bubbles = await page.locator(".message-bubble").allTextContents();
  console.log("BUBBLES AFTER RELOAD:", JSON.stringify(bubbles, null, 2));
  const cardCount = await page.locator(".message-artifact-card").count();
  console.log("card count:", cardCount);
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
