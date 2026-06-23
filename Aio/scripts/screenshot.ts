#!/usr/bin/env node
/**
 * Standalone screenshot capture for Aio /app routes (dev-bypass auth, no browser session needed).
 *
 * Usage:
 *   npx tsx scripts/screenshot.ts <path> [name]
 *
 * Examples:
 *   npx tsx scripts/screenshot.ts /app
 *   npx tsx scripts/screenshot.ts /app/settings settings-tab
 *
 * Requires NEXT_PUBLIC_DEV_AUTH_BYPASS=true and HERMES_DEV_API_SERVER_KEY set
 * (already in .env.local) and the dev server running (npm run dev).
 * Captures desktop (1440x900) and mobile (390x844) viewports into
 * Aio/.tmp/screenshots/<name>-desktop.png and <name>-mobile.png.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.AIO_SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../.tmp/screenshots");

async function main() {
  const [routeArg, nameArg] = process.argv.slice(2);
  if (!routeArg) {
    console.error("Usage: npx tsx scripts/screenshot.ts <path> [name]");
    process.exit(1);
  }

  const route = routeArg.startsWith("/") ? routeArg : `/${routeArg}`;
  const name = nameArg ?? (route.replace(/^\//, "").replace(/\//g, "-") || "root");
  const url = `${BASE_URL}${route}`;

  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const [label, viewport] of Object.entries({
      desktop: { width: 1440, height: 900 },
      mobile: { width: 390, height: 844 },
    })) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle" });
      const outPath = path.join(OUT_DIR, `${name}-${label}.png`);
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`Saved ${outPath}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
