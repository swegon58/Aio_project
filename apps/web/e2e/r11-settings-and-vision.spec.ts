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
  const skills: Array<{ name: string; category: string; description: string; source: string; trust: string; enabled: boolean }> = [
    { name: "weather", category: "utility", description: "Look up current weather.", source: "hub", trust: "trusted", enabled: true },
  ];
  const mcpServers: Array<{ name: string; transport: string; enabled: boolean }> = [];

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

    if (path === "/api/integrations/skills" && method === "GET") {
      await route.fulfill({ json: { skills } });
      return;
    }
    if (path === "/api/integrations/skills" && method === "POST") {
      const { identifier } = body as { identifier?: string };
      if (identifier === "bad/skill") {
        await route.fulfill({ status: 400, json: { error: "install_failed", message: "blocked by scan" } });
        return;
      }
      skills.push({ name: identifier ?? "new-skill", category: "utility", description: "Freshly installed.", source: "hub", trust: "community", enabled: true });
      await route.fulfill({ json: { ok: true, identifier } });
      return;
    }
    if (path === "/api/integrations/skills" && method === "PATCH") {
      const { name, enabled } = body as { name: string; enabled: boolean };
      const skill = skills.find((s) => s.name === name);
      if (skill) skill.enabled = enabled;
      await route.fulfill({ json: { ok: true, name, enabled } });
      return;
    }

    if (path === "/api/integrations/mcp" && method === "GET") {
      await route.fulfill({ json: { servers: mcpServers } });
      return;
    }
    if (path === "/api/integrations/mcp" && method === "POST") {
      const { name, env } = body as { name?: string; env?: Record<string, string> };
      if (name === "n8n" && !env?.N8N_API_KEY) {
        await route.fulfill({ status: 400, json: { error: "install_failed", message: "N8N_API_KEY is required but no value was provided" } });
        return;
      }
      mcpServers.push({ name: name ?? "unknown", transport: name === "linear" ? "https://mcp.linear.app/mcp" : "stdio", enabled: true });
      await route.fulfill({ json: { ok: true, name } });
      return;
    }
    if (path === "/api/integrations/mcp" && method === "PATCH") {
      const { name, enabled } = body as { name: string; enabled: boolean };
      const server = mcpServers.find((s) => s.name === name);
      if (server) server.enabled = enabled;
      await route.fulfill({ json: { ok: true, name, enabled } });
      return;
    }
    if (path === "/api/integrations/mcp" && method === "DELETE") {
      const { name } = body as { name: string };
      const idx = mcpServers.findIndex((s) => s.name === name);
      if (idx >= 0) mcpServers.splice(idx, 1);
      await route.fulfill({ json: { ok: true, name } });
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

test("R11.1: Settings modal Account tab toggles the Discord master switch", async ({ page }) => {
  const { requests } = await installApiMocks(page);
  await page.goto("/app");

  if (await page.getByRole("button", { name: "Open nav" }).isVisible()) {
    await page.getByRole("button", { name: "Open nav" }).click();
  }
  await page.getByRole("button", { name: "Settings" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Account" }).click();
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

test("R11.1: Settings modal Account tab shows signed-in identity, read-only", async ({ page }) => {
  await installApiMocks(page);
  await page.goto("/app");

  if (await page.getByRole("button", { name: "Open nav" }).isVisible()) {
    await page.getByRole("button", { name: "Open nav" }).click();
  }
  await page.getByRole("button", { name: "Settings" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("button", { name: "Account" }).click();
  await expect(dialog.getByText("Profile")).toBeVisible();
});

test("R16-A5: Settings modal Skills tab lists installed skills and toggles enable/disable", async ({ page }) => {
  const { requests } = await installApiMocks(page);
  await page.goto("/app");

  if (await page.getByRole("button", { name: "Open nav" }).isVisible()) {
    await page.getByRole("button", { name: "Open nav" }).click();
  }
  await page.getByRole("button", { name: "Settings" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("button", { name: "Skills" }).click();

  await expect(dialog.getByText("weather", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Look up current weather.")).toBeVisible();
  await expect(dialog.getByText("trusted")).toBeVisible();

  const disableBtn = dialog.getByRole("button", { name: "Disable" });
  await disableBtn.click();
  await expect.poll(() =>
    requests.some(
      (r) => r.path === "/api/integrations/skills" && r.method === "PATCH" && (r.body as { enabled?: boolean })?.enabled === false,
    ),
  ).toBe(true);
  await expect(dialog.getByRole("button", { name: "Enable" })).toBeVisible();
});

test("R16-A5: Settings modal Skills tab installs a new skill and surfaces install failures", async ({ page }) => {
  const { requests } = await installApiMocks(page);
  await page.goto("/app");

  if (await page.getByRole("button", { name: "Open nav" }).isVisible()) {
    await page.getByRole("button", { name: "Open nav" }).click();
  }
  await page.getByRole("button", { name: "Settings" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("button", { name: "Skills" }).click();

  const input = dialog.getByPlaceholder("Skill identifier or SKILL.md URL");
  await input.fill("bad/skill");
  await dialog.getByRole("button", { name: "Install skill" }).click();
  await expect(dialog.getByText("blocked by scan")).toBeVisible();

  await input.fill("good/skill");
  await dialog.getByRole("button", { name: "Install skill" }).click();
  await expect.poll(() =>
    requests.some((r) => r.path === "/api/integrations/skills" && r.method === "POST" && (r.body as { identifier?: string })?.identifier === "good/skill"),
  ).toBe(true);
  await expect(dialog.getByText("good/skill", { exact: true })).toBeVisible();
});

test("R16-A6: Connected Apps tab connects n8n with a valid URL + API key", async ({ page }) => {
  const { requests } = await installApiMocks(page);
  await page.goto("/app");

  if (await page.getByRole("button", { name: "Open nav" }).isVisible()) {
    await page.getByRole("button", { name: "Open nav" }).click();
  }
  await page.getByRole("button", { name: "Settings" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("button", { name: "Connected Apps" }).click();

  await expect(dialog.getByText("Automation tools")).toBeVisible();
  await dialog.getByPlaceholder("n8n instance URL").fill("https://n8n.example.com");
  await dialog.getByPlaceholder("n8n API key (Settings → API in n8n)").fill("secret-key-123");
  await dialog.getByRole("button", { name: "Connect n8n" }).click();

  await expect.poll(() =>
    requests.some((r) => {
      if (r.path !== "/api/integrations/mcp" || r.method !== "POST") return false;
      const b = r.body as { name?: string; env?: Record<string, string> };
      return b.name === "n8n" && b.env?.N8N_BASE_URL === "https://n8n.example.com" && b.env?.N8N_API_KEY === "secret-key-123";
    }),
  ).toBe(true);
  await expect(dialog.getByText("Connected", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Disable" })).toBeVisible();
});

test("R16-A6: Connected Apps tab rejects an n8n submit with no API key, without calling the API", async ({ page }) => {
  const { requests } = await installApiMocks(page);
  await page.goto("/app");

  if (await page.getByRole("button", { name: "Open nav" }).isVisible()) {
    await page.getByRole("button", { name: "Open nav" }).click();
  }
  await page.getByRole("button", { name: "Settings" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("button", { name: "Connected Apps" }).click();

  await dialog.getByPlaceholder("n8n instance URL").fill("https://n8n.example.com");
  await dialog.getByRole("button", { name: "Connect n8n" }).click();

  await expect(dialog.getByText("API key is required.")).toBeVisible();
  expect(requests.some((r) => r.path === "/api/integrations/mcp" && r.method === "POST")).toBe(false);
});

test("R16-A6: Connected Apps tab rejects a malformed n8n URL, without calling the API", async ({ page }) => {
  const { requests } = await installApiMocks(page);
  await page.goto("/app");

  if (await page.getByRole("button", { name: "Open nav" }).isVisible()) {
    await page.getByRole("button", { name: "Open nav" }).click();
  }
  await page.getByRole("button", { name: "Settings" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("button", { name: "Connected Apps" }).click();

  await dialog.getByPlaceholder("n8n instance URL").fill("not-a-url");
  await dialog.getByPlaceholder("n8n API key (Settings → API in n8n)").fill("secret-key-123");
  await dialog.getByRole("button", { name: "Connect n8n" }).click();

  await expect(dialog.getByText("Enter a valid n8n URL (starting with http:// or https://).")).toBeVisible();
  expect(requests.some((r) => r.path === "/api/integrations/mcp" && r.method === "POST")).toBe(false);
});

test("R16-A6: Connected Apps tab Linear connect installs but honestly does not claim Connected", async ({ page }) => {
  const { requests } = await installApiMocks(page);
  await page.goto("/app");

  if (await page.getByRole("button", { name: "Open nav" }).isVisible()) {
    await page.getByRole("button", { name: "Open nav" }).click();
  }
  await page.getByRole("button", { name: "Settings" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("button", { name: "Connected Apps" }).click();

  await dialog.getByRole("button", { name: "Connect Linear" }).click();

  await expect.poll(() =>
    requests.some((r) => r.path === "/api/integrations/mcp" && r.method === "POST" && (r.body as { name?: string })?.name === "linear"),
  ).toBe(true);
  await expect(dialog.getByText("Added — sign-in still needed")).toBeVisible();
  await expect(dialog.getByText(/sign-in can't finish automatically/)).toBeVisible();
  // Reused enable/disable/remove controls appear once installed — no fake "Connected" status.
  await expect(dialog.getByRole("button", { name: "Disable" })).toBeVisible();
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

  // The sent image renders back in the transcript as a clickable thumbnail,
  // and clicking it opens the lightbox (previously the image just vanished).
  await expect(page.locator(".message.user .message-attachment-thumb")).toHaveCount(1);
  await page.locator(".message.user .message-attachment-thumb").click();
  await expect(page.locator(".lightbox-bare-img")).toBeVisible();
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

test("R15: Settings modal mobile drill-down — list -> tab -> back -> close", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "drill-down layout only applies below the 768px breakpoint");
  await installApiMocks(page);
  await page.goto("/app");

  if (await page.getByRole("button", { name: "Open nav" }).isVisible()) {
    await page.getByRole("button", { name: "Open nav" }).click();
  }
  await page.getByRole("button", { name: "Settings" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();

  // Plain open (no deep link): lands on the tab list, all 4 rows visible.
  await expect(dialog).not.toHaveClass(/mobile-tab-open/);
  await expect(dialog.getByRole("button", { name: "Account" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Personalization" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Connected Apps" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Data & Privacy" })).toBeVisible();

  // Tapping a row drills into that tab's full-screen content.
  await dialog.getByRole("button", { name: "Account" }).click();
  await expect(dialog).toHaveClass(/mobile-tab-open/);
  await expect(dialog.getByText("Profile")).toBeVisible();

  // Back returns to the list (doesn't close the modal).
  await dialog.getByRole("button", { name: "Back to settings list" }).click();
  await expect(dialog).not.toHaveClass(/mobile-tab-open/);
  await expect(dialog.getByRole("button", { name: "Account" })).toBeVisible();

  // The separate close control on a tab screen exits Settings entirely.
  await dialog.getByRole("button", { name: "Personalization" }).click();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test("R15: composer hides the saved-agent pill at narrow width, keeps the chat-mode pill", async ({ page }) => {
  await installApiMocks(page);
  // Registered after the catch-all so it wins (Playwright runs the most
  // recently registered matching route first).
  await page.route("**/api/saved-agents", (route) =>
    route.fulfill({ json: { savedAgents: [{ id: "agent-1", name: "Researcher" }] } }));
  await page.goto("/app");

  const chatModeTrigger = page.getByRole("button", { name: /Response mode:/ });
  const savedAgentTrigger = page.getByRole("button", { name: /Saved agent:/ });
  // Both configured project viewports (390px, 1440px) are above the 380px
  // hide-breakpoint, so the pill starts out present.
  await expect(savedAgentTrigger).toHaveCount(1);

  // Narrowing past the breakpoint sets display:none on the saved-agent pill,
  // which drops it from the accessibility tree entirely (not just visually
  // hidden) — assert it disappears from the role query, chat mode stays put.
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(savedAgentTrigger).toHaveCount(0);
  await expect(chatModeTrigger).toBeVisible();
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
