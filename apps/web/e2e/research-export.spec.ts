import { expect, test, type Page, type Route } from "playwright/test";

const streamHeaders = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  "x-vercel-ai-ui-message-stream": "v1",
};

function streamBody(parts: unknown[]): string {
  return `${parts.map((part) => `data: ${JSON.stringify(part)}\n\n`).join("")}data: [DONE]\n\n`;
}

async function installApiMocks(
  page: Page,
  options?: {
    handler?: (input: {
      route: Route;
      path: string;
      method: string;
      body: unknown;
      url: URL;
    }) => Promise<boolean> | boolean;
  },
) {
  const requests: Array<{ path: string; search: string; method: string }> = [];

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    requests.push({ path, search: url.search, method });

    const handled = await options?.handler?.({ route, path, method, body: null, url });
    if (handled) return;

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
    };
    if (Object.hasOwn(responses, path)) {
      await route.fulfill({ json: responses[path] });
      return;
    }

    await route.fulfill({ status: 501, json: { error: "Unexpected mocked API request" } });
  });

  return { requests };
}

test("R9.2/R9.3: research report export buttons and sources panel work after a completed run", async ({ page }) => {
  const runId = "55555555-5555-4555-8555-555555555555";
  const reportText = "## Findings\n\nThe sky is blue because of Rayleigh scattering.";

  await installApiMocks(page, {
    handler: async ({ route, path, method, body: _body, url: _url }) => {
      if (path === "/api/chat" && method === "POST") {
        await route.fulfill({
          status: 200,
          headers: streamHeaders,
          body: streamBody([
            { type: "data-aio-run", id: "run-part", data: { runId, threadId: "thread-1" } },
            { type: "text-start", id: "text-1" },
            { type: "text-delta", id: "text-1", delta: reportText },
            { type: "text-end", id: "text-1" },
          ]),
        });
        return true;
      }
      if (path === `/api/runs/${runId}/sources` && method === "GET") {
        await route.fulfill({
          json: {
            sources: [
              {
                id: "src-1",
                url: "https://example.com/rayleigh-scattering",
                title: "Rayleigh scattering — Example Encyclopedia",
                sourceType: "web",
                relevanceScore: 0.92,
                fetchedAt: "2026-07-02T10:00:00.000Z",
                createdAt: "2026-07-02T10:00:00.000Z",
              },
            ],
          },
        });
        return true;
      }
      return false;
    },
  });

  await page.goto("/app");
  const composer = page.locator("textarea.message-input");
  await expect(composer).toBeVisible();

  await page.getByRole("button", { name: /Response mode:/ }).click();
  await page.getByRole("menuitemradio", { name: "Research" }).click();
  await composer.fill("Why is the sky blue?");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("The sky is blue because of Rayleigh scattering.")).toBeVisible();

  const downloadBtn = page.getByRole("button", { name: "Download report as Markdown" });
  const pdfBtn = page.getByRole("button", { name: "Export report as PDF" });
  const sourcesBtn = page.getByRole("button", { name: "Show sources" });
  await expect(downloadBtn).toBeVisible();
  await expect(pdfBtn).toBeVisible();
  await expect(sourcesBtn).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await downloadBtn.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("why-is-the-sky-blue.md");

  const popupPromise = page.waitForEvent("popup");
  await pdfBtn.click();
  const popup = await popupPromise;
  await expect(popup.locator("h1.report-title")).toHaveText("Why is the sky blue?");
  await expect(popup.locator(".markdown-message")).toContainText("Rayleigh scattering");
  await popup.close();

  await sourcesBtn.click();
  const panel = page.locator(".research-sources-panel");
  await expect(panel).toBeVisible();
  const sourceItem = panel.locator(".research-source-item");
  await expect(sourceItem).toHaveCount(1);
  await expect(sourceItem.locator("a")).toHaveText("Rayleigh scattering — Example Encyclopedia");
  await expect(sourceItem.locator(".research-source-type")).toHaveText("web");

  await sourcesBtn.click();
  await expect(panel).toHaveCount(0);
});
