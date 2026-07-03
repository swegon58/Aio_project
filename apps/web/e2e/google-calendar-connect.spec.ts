import { expect, test, type Page, type Route } from "playwright/test";

async function installApiMocks(
  page: Page,
  options?: {
    googleCalendar?: {
      configured: boolean;
      connected: boolean;
      googleEmail: string | null;
    };
    handler?: (input: {
      route: Route;
      path: string;
      method: string;
      body: unknown;
    }) => Promise<boolean> | boolean;
  },
) {
  const requests: Array<{ path: string; method: string; body: unknown }> = [];

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

    const handled = await options?.handler?.({ route, path, method, body });
    if (handled) return;

    if (path === "/api/connections/google" && method === "GET") {
      const status = options?.googleCalendar ?? { configured: true, connected: false, googleEmail: null };
      await route.fulfill({
        json: {
          configured: status.configured,
          connected: status.connected,
          googleEmail: status.googleEmail,
          grantedScopes: status.connected ? ["https://www.googleapis.com/auth/calendar"] : [],
          connectedAt: status.connected ? "2026-07-03T00:00:00.000Z" : null,
        },
      });
      return;
    }

    if (path === "/api/connections/google/disconnect" && method === "POST") {
      await route.fulfill({ json: { ok: true } });
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
    };
    if (Object.hasOwn(responses, path)) {
      await route.fulfill({ json: responses[path] });
      return;
    }

    await route.fulfill({ status: 501, json: { error: "Unexpected mocked API request" } });
  });

  return { requests };
}

async function openConnectedAppsTab(page: Page) {
  const settingsButton = page.getByRole("button", { name: "Settings" }).first();
  await settingsButton.click();
  const dialog = page.getByRole("dialog").filter({ has: page.locator("#settings-dialog-title") });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Connected Apps" }).click();
  return dialog;
}

test("R10.1: Google Calendar card shows Connect link when not connected", async ({ page }) => {
  await installApiMocks(page, {
    googleCalendar: { configured: true, connected: false, googleEmail: null },
  });

  await page.goto("/app");
  const dialog = await openConnectedAppsTab(page);

  await expect(dialog.locator(".mcp-server-name").getByText("Google Calendar")).toBeVisible();
  await expect(dialog.getByText("Aio can create and check events on your calendar")).toBeVisible();

  const connectLink = dialog.getByRole("link", { name: "Connect" });
  await expect(connectLink).toBeVisible();
  await expect(connectLink).toHaveAttribute("href", "/api/connections/google/start");
});

test("R10.1: Google Calendar Connect link is disabled when not configured", async ({ page }) => {
  await installApiMocks(page, {
    googleCalendar: { configured: false, connected: false, googleEmail: null },
  });

  await page.goto("/app");
  const dialog = await openConnectedAppsTab(page);

  await expect(dialog.getByText("Not available yet")).toBeVisible();
  const connectLink = dialog.getByRole("link", { name: "Connect" });
  await expect(connectLink).toHaveCSS("pointer-events", "none");
});

test("R10.1: Google Calendar card shows connected email and disconnects with two-click confirm", async ({ page }) => {
  const { requests } = await installApiMocks(page, {
    googleCalendar: { configured: true, connected: true, googleEmail: "swegon58@gmail.com" },
  });

  await page.goto("/app");
  const dialog = await openConnectedAppsTab(page);

  await expect(dialog.getByText("swegon58@gmail.com")).toBeVisible();

  const disconnectButton = dialog.getByRole("button", { name: "Disconnect" });
  await expect(disconnectButton).toBeVisible();

  await disconnectButton.click();
  await expect(dialog.getByRole("button", { name: "Confirm?" })).toBeVisible();

  await dialog.getByRole("button", { name: "Confirm?" }).click();
  await expect.poll(() =>
    requests.some((entry) => entry.path === "/api/connections/google/disconnect" && entry.method === "POST"),
  ).toBe(true);
});

test("R10.1: OAuth callback redirect reopens Settings on Connected Apps tab", async ({ page }) => {
  await installApiMocks(page, {
    googleCalendar: { configured: true, connected: true, googleEmail: "swegon58@gmail.com" },
  });

  await page.goto("/app?google_calendar=connected");

  const dialog = page.getByRole("dialog").filter({ has: page.locator("#settings-dialog-title") });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("swegon58@gmail.com")).toBeVisible();

  await expect(page).toHaveURL(/\/app$/);
});
