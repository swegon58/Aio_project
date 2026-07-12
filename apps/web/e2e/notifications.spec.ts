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

// R15 (owner critique 2026-07-11): the icon-rail "Notifications" bell was
// removed from the rail entirely (no replacement entry point wired yet), so
// the bell-click -> panel-open coverage that lived here no longer has a UI
// path to exercise. NotificationsPanel/useNotifications/unread-count backend
// wiring is untouched, just unreachable via UI for now — re-add this
// coverage once a new entry point ships.

test("R10.2: Discord notify toggle is hidden until Discord is connected, then submits with the task", async ({ page }) => {
  const { requests } = await installApiMocks(page, {
    connectionsPlatforms: [
      { id: "discord", label: "Discord", tokenEnvVar: "DISCORD_BOT_TOKEN", connected: false },
    ],
  });

  await page.goto("/app");

  if (await page.getByRole("button", { name: "Open nav" }).isVisible()) {
    await page.getByRole("button", { name: "Open nav" }).click();
  }
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

  if (await page.getByRole("button", { name: "Open nav" }).isVisible()) {
    await page.getByRole("button", { name: "Open nav" }).click();
  }
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
