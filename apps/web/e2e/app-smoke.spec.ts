import { expect, test, type Page, type Route } from "playwright/test";

const streamHeaders = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  "x-vercel-ai-ui-message-stream": "v1",
};

function streamBody(parts: unknown[]): string {
  return `${parts.map((part) => `data: ${JSON.stringify(part)}\n\n`).join("")}data: [DONE]\n\n`;
}

async function installApiMocks(page: Page) {
  const requests: Array<{ path: string; method: string; body: unknown }> = [];
  const unexpectedPaths: string[] = [];

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    let body: unknown = null;
    if (request.postData()) {
      try {
        body = request.postDataJSON();
      } catch {
        body = request.postData();
      }
    }
    requests.push({ path, method, body });

    if (path === "/api/chat" && method === "POST") {
      const messages = (body as { messages?: Array<{ parts?: Array<{ type: string; text?: string }> }> })?.messages ?? [];
      const prompt = messages
        .at(-1)
        ?.parts?.filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("") ?? "";

      if (prompt.includes("approval")) {
        await route.fulfill({
          status: 200,
          headers: streamHeaders,
          body: streamBody([
            {
              type: "data-aio-approval",
              id: "approval-1",
              data: {
                kind: "request",
                requestId: "approval-1",
                runId: "run-approval",
                command: "send_email",
                description: "Send the prepared email",
                allowPermanent: false,
                choices: ["once", "session", "deny"],
                ts: Date.now(),
              },
            },
          ]),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: streamHeaders,
        body: streamBody([
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "Task complete." },
          { type: "text-end", id: "text-1" },
        ]),
      });
      return;
    }

    if (path === "/api/chat/approval" && method === "POST") {
      await route.fulfill({ json: { ok: true } });
      return;
    }

    const responses: Record<string, unknown> = {
      "/api/credits": {
        balance: 9_999,
        usedPercent: 0,
        resetAt: "2026-07-01T00:00:00.000Z",
        planTier: "pro",
      },
      "/api/conversations": { conversations: [] },
      "/api/kanban": { columns: [] },
      "/api/memory": { available: true, facts: [], summary: null },
      "/api/gallery": { images: [] },
      "/api/connections": { platforms: [] },
      "/api/credentials": {
        credentials: [
          { id: "openrouter", label: "OpenRouter API Key", envVar: "OPENROUTER_API_KEY", set: false, masked: null },
          { id: "kie", label: "Kie.ai Image API Key", envVar: "KIE_API_KEY", set: true, masked: "****test" },
        ],
      },
      "/api/knowledge": { files: [] },
      "/api/cron": { jobs: [] },
      "/api/integrations/mcp": { servers: [] },
    };
    if (Object.hasOwn(responses, path)) {
      await route.fulfill({ json: responses[path] });
      return;
    }

    unexpectedPaths.push(`${method} ${path}`);
    await route.fulfill({ status: 501, json: { error: "Unexpected mocked API request" } });
  });

  return { requests, unexpectedPaths };
}

test("chat, research, approval, settings, and image controls work", async ({ page }) => {
  const { requests, unexpectedPaths } = await installApiMocks(page);
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: /What can I do for you/i })).toBeVisible();

  const composer = page.locator("textarea.message-input");
  await composer.fill("Run a smoke task");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Task complete.")).toBeVisible();
  expect(
    requests.some(
      (entry) =>
        entry.path === "/api/chat"
        && (entry.body as { mode?: string })?.mode === "auto",
    ),
  ).toBe(true);

  await page.getByRole("button", { name: /Response mode:/ }).click();
  await page.getByRole("menuitemradio", { name: "Research" }).click();
  await composer.fill("Research a small topic");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Task complete.")).toHaveCount(2);
  expect(
    requests.some(
      (entry) =>
        entry.path === "/api/chat"
        && (entry.body as { mode?: string })?.mode === "research",
    ),
  ).toBe(true);

  await page.getByRole("button", { name: /Response mode:/ }).click();
  await page.getByRole("menuitemradio", { name: "Auto" }).click();
  await composer.fill("Request approval");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Approval requested")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect.poll(() =>
    requests.some((entry) => entry.path === "/api/chat/approval" && entry.method === "POST"),
  ).toBe(true);

  if (await page.getByRole("button", { name: "Open nav" }).isVisible()) {
    await page.getByRole("button", { name: "Open nav" }).click();
  }
  await page.getByRole("button", { name: "Settings" }).first().click();
  const settingsDialog = page.getByRole("dialog");
  await expect(settingsDialog).toBeVisible();
  await page.getByRole("button", { name: "Model Providers" }).click();
  await expect(settingsDialog.locator(".mcp-server-name", { hasText: "Kie.ai Image API Key" })).toBeVisible();
  await settingsDialog.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "Create image" }).click();
  await expect(page.getByLabel("Image creation options")).toBeVisible();
  await expect(composer).toHaveAttribute("placeholder", /Describe/);
  expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
  expect(unexpectedPaths).toEqual([]);
});
