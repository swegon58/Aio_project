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
          { id: "openrouter", label: "OpenRouter API Key", envVar: "OPENROUTER_API_KEY", category: "language", set: false, masked: null },
          { id: "kie", label: "Kie.ai Image API Key", envVar: "KIE_API_KEY", category: "creative", set: true, masked: "****test" },
        ],
      },
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

    unexpectedPaths.push(`${method} ${path}`);
    await route.fulfill({ status: 501, json: { error: "Unexpected mocked API request" } });
  });

  return { requests, unexpectedPaths };
}

test("chat, research, approval, settings, and image controls work", async ({ page }) => {
  const { requests, unexpectedPaths } = await installApiMocks(page);
  await page.goto("/app");
  const composer = page.locator("textarea.message-input");
  await expect(composer).toBeVisible();
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
  await expect(page.locator(".approval-card-title").filter({ hasText: "Approval requested" }).first()).toBeVisible();
  await page.locator(".approval-card-actions .approval-btn.approve").click();
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
  await page.getByRole("menuitem", { name: /^Image / }).click();
  await expect(page.getByLabel("Image creation options")).toBeVisible();
  await expect(composer).toHaveAttribute("placeholder", /Describe/);
  expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
  expect(unexpectedPaths).toEqual([]);
});

test("restores the durable run timeline after a refresh", async ({ page }) => {
  const conversationId = "11111111-1111-4111-8111-111111111111";
  const runId = "22222222-2222-4222-8222-222222222222";
  const run = {
    id: runId,
    customerId: "00000000-0000-0000-0000-000000000001",
    conversationId,
    threadId: conversationId,
    status: "completed",
    mode: "deep_research",
    inputSummary: "Restore the timeline",
    hermesRunId: null,
    hermesSessionId: null,
    reservedCredits: 2,
    actualCredits: 1,
    errorCode: null,
    errorMessageRedacted: null,
    createdAt: "2026-06-28T10:00:00.000Z",
    startedAt: "2026-06-28T10:00:01.000Z",
    updatedAt: "2026-06-28T10:00:04.000Z",
    completedAt: "2026-06-28T10:00:04.000Z",
    cancelRequestedAt: null,
    metadata: { mode: "deep_research" },
  };
  const events = [
    {
      id: "evt-1",
      schemaVersion: 1,
      runId,
      customerId: run.customerId,
      sequence: 0,
      type: "run.created",
      occurredAt: "2026-06-28T10:00:00.000Z",
      receivedAt: "2026-06-28T10:00:00.500Z",
      source: "aio",
      payload: {
        type: "run.created",
        runId,
        threadId: conversationId,
        status: "running",
        createdAt: "2026-06-28T10:00:00.000Z",
        ts: Date.parse("2026-06-28T10:00:00.000Z"),
      },
      hermes: null,
    },
    {
      id: "evt-2",
      schemaVersion: 1,
      runId,
      customerId: run.customerId,
      sequence: 1,
      type: "tool.started",
      occurredAt: "2026-06-28T10:00:02.000Z",
      receivedAt: "2026-06-28T10:00:02.500Z",
      source: "hermes",
      payload: {
        type: "tool.started",
        runId,
        toolCallId: "tool-1",
        toolName: "web_search",
        label: "Collecting sources",
        createdAt: "2026-06-28T10:00:02.000Z",
        ts: Date.parse("2026-06-28T10:00:02.000Z"),
      },
      hermes: { runId: "hermes-run-1", eventId: "source-evt-2" },
    },
    {
      id: "evt-3",
      schemaVersion: 1,
      runId,
      customerId: run.customerId,
      sequence: 2,
      type: "run.completed",
      occurredAt: "2026-06-28T10:00:04.000Z",
      receivedAt: "2026-06-28T10:00:04.500Z",
      source: "aio",
      payload: {
        type: "run.completed",
        runId,
        status: "completed",
        createdAt: "2026-06-28T10:00:04.000Z",
        ts: Date.parse("2026-06-28T10:00:04.000Z"),
      },
      hermes: null,
    },
  ];

  const { requests, unexpectedPaths } = await installApiMocks(page, {
    handler: async ({ route, path, method, url }) => {
      if (path === `/api/conversations/${conversationId}` && method === "GET") {
        await route.fulfill({ json: { id: conversationId, title: "Restored run", messages: [] } });
        return true;
      }
      if (path === "/api/runs" && method === "GET" && url.searchParams.get("conversationId") === conversationId) {
        await route.fulfill({ json: { runs: [run], nextCursor: null } });
        return true;
      }
      if (path === `/api/runs/${runId}/events` && method === "GET") {
        await route.fulfill({ json: { events } });
        return true;
      }
      if (path === `/api/runs/${runId}` && method === "GET") {
        await route.fulfill({ json: { run } });
        return true;
      }
      return false;
    },
  });

  await page.addInitScript((id) => {
    window.localStorage.setItem("aio-active-conversation", id);
  }, conversationId);

  await page.goto("/app");
  // Current Run card removed (R15). The durable run timeline (RunTimeline in
  // the terminal/activity tab) still hydrates — assert the fetches fire.
  await expect.poll(
    () => requests.filter((entry) => entry.path === `/api/conversations/${conversationId}`).length,
  ).toBe(1);
  await expect.poll(
    () =>
      requests.filter(
        (entry) =>
          entry.path === "/api/runs"
          && entry.search.includes(`conversationId=${encodeURIComponent(conversationId)}`),
      ).length,
  ).toBe(1);
  await expect.poll(
    () => requests.filter((entry) => entry.path === `/api/runs/${runId}/events`).length,
  ).toBe(1);

  await page.reload();
  await expect.poll(
    () => requests.filter((entry) => entry.path === `/api/conversations/${conversationId}`).length,
  ).toBe(2);
  await expect.poll(
    () =>
      requests.filter(
        (entry) =>
          entry.path === "/api/runs"
          && entry.search.includes(`conversationId=${encodeURIComponent(conversationId)}`),
      ).length,
  ).toBe(2);
  await expect.poll(
    () => requests.filter((entry) => entry.path === `/api/runs/${runId}/events`).length,
  ).toBe(2);
  expect(unexpectedPaths).toEqual([]);
});
  // (R15) "Current Run" surface + stop-card test removed — feature deleted.

