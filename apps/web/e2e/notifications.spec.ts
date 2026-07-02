import { expect, test, type Page, type Route } from "playwright/test";

async function installApiMocks(
  page: Page,
  options?: {
    connectionsPlatforms?: unknown[];
    notifications?: unknown[];
    unreadCount?: number;
    handler?: (input: {
      route: Route;
      path: string;
      method: string;
      body: unknown;
      url: URL;
    }) => Promise<boolean> | boolean;
  },
) {
  const requests: Array<{ path: string; search: string; method: string; body: unknown }> = [];
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
    requests.push({ path, search: url.search, method, body });

    const handled = await options?.handler?.({ route, path, method, body, url });
    if (handled) return;

    if (path === "/api/notifications" && method === "GET") {
      await route.fulfill({
        json: {
          notifications: options?.notifications ?? [],
          unreadCount: options?.unreadCount ?? 0,
        },
      });
      return;
    }

    if (path.startsWith("/api/notifications/") && method === "POST") {
      await route.fulfill({ json: { notification: null } });
      return;
    }

    if (path === "/api/cron" && method === "POST") {
      await route.fulfill({
        json: {
          job: {
            id: "job-new",
            name: (body as { name?: string })?.name ?? "New task",
            schedule: (body as { schedule?: string })?.schedule ?? "every 1h",
            enabled: true,
            next_run: null,
          },
        },
      });
      return;
    }

    const responses: Record<string, unknown> = {
      "/api/credits": { balance: 9_999, usedPercent: 0, resetAt: "2026-07-01T00:00:00.000Z", planTier: "pro" },
      "/api/conversations": { conversations: [] },
      "/api/kanban": { columns: [] },
      "/api/memory": { available: true, facts: [], summary: null },
      "/api/gallery": { images: [] },
      "/api/connections": { platforms: options?.connectionsPlatforms ?? [] },
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

    unexpectedPaths.push(`${method} ${path}`);
    await route.fulfill({ status: 501, json: { error: "Unexpected mocked API request" } });
  });

  return { requests, unexpectedPaths };
}

test("R10.2: notifications panel shows unread items and supports mark-read / mark-all-read", async ({ page }) => {
  const { requests } = await installApiMocks(page, {
    unreadCount: 2,
    notifications: [
      {
        id: "notif-1",
        source: "scheduled_task",
        title: "Weekly report finished",
        read: false,
        created_at: "2026-07-02T09:00:00.000Z",
      },
      {
        id: "notif-2",
        source: "research_run",
        title: "Deep research on AI trends completed",
        read: false,
        created_at: "2026-07-01T09:00:00.000Z",
      },
    ],
  });

  await page.goto("/app");

  const bellButton = page.getByRole("button", { name: "Notifications" }).first();
  await expect(bellButton).toBeVisible();
  await expect(bellButton.locator(".icon-rail-badge")).toHaveText("2");

  await bellButton.click();
  const dialog = page.getByRole("dialog", { name: "Notifications" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Weekly report finished")).toBeVisible();
  await expect(dialog.getByText("Deep research on AI trends completed")).toBeVisible();

  await dialog.getByRole("button", { name: "Mark read" }).first().click();
  await expect.poll(() =>
    requests.some((entry) => entry.path === "/api/notifications/notif-1" && entry.method === "POST"),
  ).toBe(true);

  await dialog.getByRole("button", { name: "Mark all read" }).click();
  await expect.poll(() =>
    requests.some((entry) => entry.path === "/api/notifications" && entry.method === "POST" && entry.search.includes("mark-all-read")),
  ).toBe(true);

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});

test("R10.2: notifications panel shows empty state with no unread badge", async ({ page }) => {
  await installApiMocks(page, { unreadCount: 0, notifications: [] });

  await page.goto("/app");

  const bellButton = page.getByRole("button", { name: "Notifications" }).first();
  await expect(bellButton.locator(".icon-rail-badge")).toHaveCount(0);

  await bellButton.click();
  const dialog = page.getByRole("dialog", { name: "Notifications" });
  await expect(dialog.getByText("No notifications yet.")).toBeVisible();
});

test("R10.2: Discord notify toggle is hidden until Discord is connected, then submits with the task", async ({ page }) => {
  const { requests } = await installApiMocks(page, {
    connectionsPlatforms: [
      { id: "discord", label: "Discord", tokenEnvVar: "DISCORD_BOT_TOKEN", connected: false },
    ],
  });

  await page.goto("/app");

  const scheduledButton = page.getByRole("button", { name: "Scheduled" }).first();
  await scheduledButton.click();
  const dialog = page.getByRole("dialog", { name: "Scheduled Tasks" });
  await expect(dialog).toBeVisible();

  await expect(dialog.getByText("Notify me on Discord when this completes")).toHaveCount(0);
});

test("R10.2: Discord notify checkbox appears when connected and is included in create-task submission", async ({ page }) => {
  const { requests } = await installApiMocks(page, {
    connectionsPlatforms: [
      { id: "discord", label: "Discord", tokenEnvVar: "DISCORD_BOT_TOKEN", connected: true },
    ],
  });

  await page.goto("/app");

  const scheduledButton = page.getByRole("button", { name: "Scheduled" }).first();
  await scheduledButton.click();
  const dialog = page.getByRole("dialog", { name: "Scheduled Tasks" });
  await expect(dialog).toBeVisible();

  const notifyCheckbox = dialog.getByLabel("Notify me on Discord when this completes");
  await expect(notifyCheckbox).toBeVisible();
  await expect(notifyCheckbox).not.toBeChecked();
  await notifyCheckbox.check();

  await dialog.locator('input[placeholder^="Name"]').fill("Weekly digest");
  await dialog.locator('input[placeholder^="Schedule"]').fill("every 30m");
  await dialog.getByRole("button", { name: "New scheduled task" }).click();

  await expect.poll(() =>
    requests.some(
      (entry) =>
        entry.path === "/api/cron"
        && entry.method === "POST"
        && (entry.body as { notifyDiscord?: boolean })?.notifyDiscord === true,
    ),
  ).toBe(true);
});
