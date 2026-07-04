import { expect, test, type Page, type Route } from "playwright/test";

const streamHeaders = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  "x-vercel-ai-ui-message-stream": "v1",
};

function streamBody(parts: unknown[]): string {
  return `${parts.map((part) => `data: ${JSON.stringify(part)}\n\n`).join("")}data: [DONE]\n\n`;
}

const PNG_1PX_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function installApiMocks(page: Page) {
  const requests: Array<{ path: string; method: string; body: unknown }> = [];
  let preferences = { notifyDiscordGlobal: true, dataTrainingOptOut: false };
  const facts: Array<{ id: string; label: string; value: string; source: string; createdAt: string; updatedAt: string }> = [];
  let nextFactId = 1;

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
      await route.fulfill({
        status: 200,
        headers: streamHeaders,
        body: streamBody([
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "Got it." },
          { type: "text-end", id: "text-1" },
        ]),
      });
      return;
    }

    if (path === "/api/preferences" && method === "GET") {
      await route.fulfill({ json: { preferences } });
      return;
    }
    if (path === "/api/preferences" && method === "PATCH") {
      preferences = { ...preferences, ...(body as Record<string, boolean>) };
      await route.fulfill({ json: { preferences } });
      return;
    }

    if (path === "/api/user-memory" && method === "GET") {
      await route.fulfill({ json: { facts } });
      return;
    }
    if (path === "/api/user-memory" && method === "POST") {
      const { label, value } = body as { label: string; value: string };
      const fact = {
        id: `fact-${nextFactId++}`,
        label,
        value,
        source: "manual",
        createdAt: "2026-07-04T00:00:00.000Z",
        updatedAt: "2026-07-04T00:00:00.000Z",
      };
      facts.push(fact);
      await route.fulfill({ json: { fact } });
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

    await route.fulfill({ status: 501, json: { error: "Unexpected mocked API request", path, method } });
  });

  return { requests };
}

test("R11.1: Settings modal Notifications tab toggles the Discord master switch", async ({ page }) => {
  const { requests } = await installApiMocks(page);
  await page.goto("/app");

  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Notifications" }).click();
  const checkbox = dialog.locator('input[type="checkbox"]');
  await expect(checkbox).toBeChecked();

  await checkbox.uncheck();
  await expect.poll(() =>
    requests.some(
      (r) => r.path === "/api/preferences" && r.method === "PATCH" && (r.body as { notifyDiscordGlobal?: boolean })?.notifyDiscordGlobal === false,
    ),
  ).toBe(true);
  await expect(checkbox).not.toBeChecked();
});

test("R11.1: Settings modal Memory tab creates and lists a fact", async ({ page }) => {
  const { requests } = await installApiMocks(page);
  await page.goto("/app");

  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("button", { name: "Memory" }).click();

  await expect(dialog.getByText("No facts yet. Add one above.")).toBeVisible();

  await dialog.getByPlaceholder("Label (e.g. Lives in)").fill("Lives in");
  await dialog.getByPlaceholder("Value (e.g. Hanoi)").fill("Hanoi");
  await dialog.getByRole("button", { name: "Add fact" }).click();

  await expect.poll(() =>
    requests.some((r) => r.path === "/api/user-memory" && r.method === "POST"),
  ).toBe(true);
  await expect(dialog.getByText("Lives in")).toBeVisible();
  await expect(dialog.getByText("Hanoi")).toBeVisible();
});

test("R11.1: Settings modal Account tab shows signed-in identity, read-only", async ({ page }) => {
  await installApiMocks(page);
  await page.goto("/app");

  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("button", { name: "Account" }).click();
  await expect(dialog.getByText("Profile")).toBeVisible();
});

test("#6 Vision: attaching an image via the composer file input shows a thumbnail chip and is sent with the message", async ({ page }) => {
  const { requests } = await installApiMocks(page);
  await page.goto("/app");

  const fileInput = page.locator('input[type="file"].sr-only');
  await fileInput.setInputFiles({
    name: "cat.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG_1PX_BASE64, "base64"),
  });

  await expect(page.locator(".composer-attachments-row .image-reference-chip")).toHaveCount(1);
  await expect(page.getByText("cat.png")).toBeVisible();

  // Send button is enabled with an attachment and no text.
  await page.getByRole("button", { name: "Send" }).click();

  await expect.poll(() => {
    const chatCalls = requests.filter((r) => r.path === "/api/chat" && r.method === "POST");
    if (chatCalls.length === 0) return false;
    const bodyStr = JSON.stringify(chatCalls.at(-1)!.body);
    return bodyStr.includes('"type":"file"') && bodyStr.includes("data:image/png;base64");
  }).toBe(true);

  await expect(page.locator(".composer-attachments-row")).toHaveCount(0);
});

test("#6 Vision: composer enforces the 8MB per-file guardrail", async ({ page }) => {
  await installApiMocks(page);
  await page.goto("/app");

  const fileInput = page.locator('input[type="file"].sr-only');
  await fileInput.setInputFiles({
    name: "huge.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(9 * 1024 * 1024, 1),
  });

  await expect(page.getByText("huge.png is over 8MB.")).toBeVisible();
  await expect(page.locator(".composer-attachments-row")).toHaveCount(0);
});

test("#6 Vision: composer enforces the 4-image cap", async ({ page }) => {
  await installApiMocks(page);
  await page.goto("/app");

  const fileInput = page.locator('input[type="file"].sr-only');
  const small = (name: string) => ({ name, mimeType: "image/png", buffer: Buffer.from(PNG_1PX_BASE64, "base64") });
  await fileInput.setInputFiles([small("a.png"), small("b.png"), small("c.png"), small("d.png")]);
  await expect(page.locator(".composer-attachments-row .image-reference-chip")).toHaveCount(4);

  await fileInput.setInputFiles([small("e.png")]);
  await expect(page.getByText("Up to 4 images per message.")).toBeVisible();
  await expect(page.locator(".composer-attachments-row .image-reference-chip")).toHaveCount(4);
});
