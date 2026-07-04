import { expect, test, type Page, type Route } from "playwright/test";

const streamHeaders = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  "x-vercel-ai-ui-message-stream": "v1",
};

function streamBody(parts: unknown[]): string {
  return `${parts.map((part) => `data: ${JSON.stringify(part)}\n\n`).join("")}data: [DONE]\n\n`;
}

async function installApiMocks(page: Page, replyText: string) {
  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/api/chat" && method === "POST") {
      await route.fulfill({
        status: 200,
        headers: streamHeaders,
        body: streamBody([
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: replyText },
          { type: "text-end", id: "text-1" },
        ]),
      });
      return;
    }

    const responses: Record<string, unknown> = {
      "/api/credits": { balance: 9_999, usedPercent: 0, resetAt: "2026-07-01T00:00:00.000Z", planTier: "pro" },
      "/api/conversations": { conversations: [] },
      "/api/kanban": { columns: [] },
      "/api/memory": { available: true, facts: [], summary: null },
      "/api/gallery": { images: [] },
      "/api/connections": { platforms: [] },
      "/api/credentials": { credentials: [] },
      "/api/knowledge": { files: [] },
      "/api/cron": { jobs: [] },
      "/api/integrations/mcp": { servers: [] },
      "/api/onboarding": { onboardedAt: "2026-06-01T00:00:00.000Z" },
      "/api/saved-agents": { savedAgents: [] },
      "/api/notifications": { notifications: [], unreadCount: 0 },
      "/api/connections/google": { configured: false, connected: false, googleEmail: null, grantedScopes: [], connectedAt: null },
    };
    if (Object.hasOwn(responses, path)) {
      await route.fulfill({ json: responses[path] });
      return;
    }

    await route.fulfill({ status: 501, json: { error: "Unexpected mocked API request" } });
  });
}

test("quick-suggestion chips appear above the composer after a real reply and fill it on click", async ({ page }) => {
  const reply = [
    "Here is a plan:",
    "1. Set up the repo",
    "2. Write the tests",
    "```ts",
    "console.log('done');",
    "```",
    "See https://example.com/docs for more.",
  ].join("\n");
  await installApiMocks(page, reply);

  await page.goto("/app");
  const composer = page.locator("textarea.message-input");
  await expect(composer).toBeVisible();

  await composer.fill("Give me a plan with code and a link");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Here is a plan:")).toBeVisible();

  const chipGroup = page.getByRole("group", { name: "Quick suggestions" });
  await expect(chipGroup).toBeVisible();
  const chips = chipGroup.locator(".quick-suggestion-chip");
  await expect(chips).toHaveCount(3);

  // Positioned directly above the composer.
  const groupBox = await chipGroup.boundingBox();
  const composerBox = await composer.boundingBox();
  expect(groupBox).not.toBeNull();
  expect(composerBox).not.toBeNull();
  expect(groupBox!.y).toBeLessThan(composerBox!.y);

  const firstChipLabel = await chips.first().textContent();
  await chips.first().click();
  await expect(composer).not.toHaveValue("");
  const value = await composer.inputValue();
  expect(value.length).toBeGreaterThan(0);
  expect(firstChipLabel).toBeTruthy();
});

test("quick-suggestion chips do not appear before any assistant reply exists", async ({ page }) => {
  await installApiMocks(page, "Task complete.");
  await page.goto("/app");
  const composer = page.locator("textarea.message-input");
  await expect(composer).toBeVisible();
  await expect(page.getByRole("group", { name: "Quick suggestions" })).toHaveCount(0);
});
