import { expect, test, type Page, type Route } from "playwright/test";

// R15 C6-C9: batch clarifying-questions wizard (Next/Back/Review) -> single
// summary message -> plan-ready card -> Approve over the durable aio_approvals
// gate. Covers both plan mode and research mode, since both share the same
// PlanWizard/usePlanFlow code path (C9).

const streamHeaders = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  "x-vercel-ai-ui-message-stream": "v1",
};

function streamBody(parts: unknown[]): string {
  return `${parts.map((part) => `data: ${JSON.stringify(part)}\n\n`).join("")}data: [DONE]\n\n`;
}

function lastPromptText(body: unknown): string {
  const messages = (body as { messages?: Array<{ parts?: Array<{ type: string; text?: string }> }> })?.messages ?? [];
  return (
    messages
      .at(-1)
      ?.parts?.filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("") ?? ""
  );
}

async function installApiMocks(
  page: Page,
  handler: (input: { route: Route; path: string; method: string; body: unknown }) => Promise<boolean> | boolean,
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

    if (await handler({ route, path, method, body })) return;

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

const QUESTIONS_BLOCK = JSON.stringify({
  questions: [
    { question: "What's the target audience?", choices: ["Developers", "Marketers", "Students"], recommended: "Developers" },
    { question: "What tone should it use?", choices: ["Formal", "Casual", "Playful"] },
    { question: "How long should it be?", choices: ["Short", "Medium", "Long"], recommended: "Medium" },
  ],
});

function questionsResponse(runId: string) {
  return streamBody([
    { type: "data-aio-run", id: "run-part", data: { runId, threadId: "thread-plan-1" } },
    { type: "text-start", id: "text-1" },
    { type: "text-delta", id: "text-1", delta: "```aio-questions\n" + QUESTIONS_BLOCK + "\n```" },
    { type: "text-end", id: "text-1" },
  ]);
}

// R15 real-gap check: every /api/chat POST creates a brand-new aio_runs row
// and emits a fresh data-aio-run part each turn (run-orchestrator.ts createRun
// call) — the plan-ready/approve turns must carry a new runId too, or
// activeRunId (reset to null by primeOptimisticRun on every submit) would
// never repopulate before Approve is clicked.
function planReadyResponse(runId: string) {
  return streamBody([
    { type: "data-aio-run", id: "run-part-2", data: { runId, threadId: "thread-plan-1" } },
    { type: "text-start", id: "text-2" },
    { type: "text-delta", id: "text-2", delta: "Here's the plan:\n1. Draft the outline\n2. Write the sections" },
    { type: "text-end", id: "text-2" },
  ]);
}

function executedResponse(runId: string) {
  return streamBody([
    { type: "data-aio-run", id: "run-part-3", data: { runId, threadId: "thread-plan-1" } },
    { type: "text-start", id: "text-3" },
    { type: "text-delta", id: "text-3", delta: "Done — the plan has been executed." },
    { type: "text-end", id: "text-3" },
  ]);
}

test("plan mode: batch wizard (Next/Back/edit-via-Review) -> single summary -> approve -> executes", async ({ page }) => {
  const runId = "66666666-6666-4666-8666-666666666666";
  let chatTurn = 0;

  const { requests } = await installApiMocks(page, async ({ route, path, method, body }) => {
    if (path === "/api/chat" && method === "POST") {
      chatTurn += 1;
      if (chatTurn === 1) {
        await route.fulfill({ status: 200, headers: streamHeaders, body: questionsResponse(runId) });
      } else if (chatTurn === 2) {
        await route.fulfill({ status: 200, headers: streamHeaders, body: planReadyResponse(runId) });
      } else {
        await route.fulfill({ status: 200, headers: streamHeaders, body: executedResponse(runId) });
      }
      return true;
    }
    if (path === `/api/runs/${runId}/approvals` && method === "GET") {
      await route.fulfill({
        json: {
          approvals: [
            {
              id: "approval-row-1",
              aioApprovalId: "approval-1",
              runId,
              status: "requested",
              title: "Approve the plan",
              toolLabel: null,
              requestedInputRedacted: null,
              expiresAt: null,
            },
          ],
        },
      });
      return true;
    }
    if (path === `/api/runs/${runId}/approvals/approval-1/resolve` && method === "POST") {
      await route.fulfill({
        json: {
          approval: {
            id: "approval-row-1",
            aioApprovalId: "approval-1",
            runId,
            status: "approved",
            title: "Approve the plan",
            toolLabel: null,
            requestedInputRedacted: null,
            expiresAt: null,
          },
        },
      });
      return true;
    }
    return false;
  });

  await page.goto("/app");
  const composer = page.locator("textarea.message-input");
  await expect(composer).toBeVisible();

  await page.getByRole("button", { name: /Response mode:/ }).click();
  await page.getByRole("menuitemradio", { name: "Plan" }).click();
  await composer.fill("Write a blog post about robots");
  await page.getByRole("button", { name: "Send" }).click();

  // Wizard mounts on the first aio-questions block.
  await expect(page.getByText("Question 1 of 3")).toBeVisible();
  await expect(page.getByText("What's the target audience?")).toBeVisible();
  await page.getByRole("button", { name: /Marketers/ }).click();

  await expect(page.getByText("Question 2 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Casual" }).click();

  await expect(page.getByText("Question 3 of 3")).toBeVisible();
  // Back should return to Q2 with the prior answer still selected.
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByText("Question 2 of 3")).toBeVisible();
  await expect(page.getByRole("button", { name: "Casual" })).toHaveClass(/selected/);
  await page.getByRole("button", { name: "Casual" }).click();

  await expect(page.getByText("Question 3 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Short" }).click();

  // Review step lists all three Q+A pairs.
  await expect(page.getByText("Review your answers")).toBeVisible();
  await expect(page.getByText("Marketers")).toBeVisible();
  await expect(page.getByText("Casual")).toBeVisible();
  await expect(page.getByText("Short")).toBeVisible();

  // Edit an earlier answer from Review, then confirm it jumps back to Review.
  const reviewItems = page.locator(".plan-wizard-review-item");
  await reviewItems.filter({ hasText: "target audience" }).getByRole("button", { name: "Edit" }).click();
  await expect(page.getByText("Question 1 of 3")).toBeVisible();
  await page.getByRole("button", { name: /Developers/ }).click();
  await expect(page.getByText("Review your answers")).toBeVisible();
  await expect(page.getByText("Developers")).toBeVisible();

  await page.getByRole("button", { name: "Submit answers" }).click();

  // Exactly one summary message is sent for the whole wizard, not one per question.
  await expect.poll(() => requests.filter((r) => r.path === "/api/chat" && r.method === "POST").length).toBe(2);
  const summaryBody = requests.filter((r) => r.path === "/api/chat")[1].body;
  const summaryText = lastPromptText(summaryBody);
  expect(summaryText).toContain("target audience");
  expect(summaryText).toContain("Developers");
  expect(summaryText).toContain("tone");
  expect(summaryText).toContain("Casual");
  expect(summaryText).toContain("Short");

  // Plan-ready card with Approve/Edit/Cancel.
  await expect(page.getByText("Plan ready")).toBeVisible();
  await expect(page.getByText("Draft the outline")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();

  await expect.poll(() => requests.some((r) => r.path === `/api/runs/${runId}/approvals` && r.method === "GET")).toBe(
    true,
  );
  await expect.poll(() =>
    requests.some((r) => r.path === `/api/runs/${runId}/approvals/approval-1/resolve` && r.method === "POST"),
  ).toBe(true);

  await expect(page.getByText("Done — the plan has been executed.")).toBeVisible();
  expect(page.getByText("Plan ready")).toHaveCount(0);
});

test("research mode: wizard mounts and Approve triggers execution the same way as plan mode", async ({ page }) => {
  const runId = "77777777-7777-4777-8777-777777777777";
  let chatTurn = 0;

  await installApiMocks(page, async ({ route, path, method }) => {
    if (path === "/api/chat" && method === "POST") {
      chatTurn += 1;
      if (chatTurn === 1) {
        await route.fulfill({ status: 200, headers: streamHeaders, body: questionsResponse(runId) });
      } else if (chatTurn === 2) {
        await route.fulfill({
          status: 200,
          headers: streamHeaders,
          body: streamBody([
            { type: "data-aio-run", id: "run-part-2", data: { runId, threadId: "thread-research-1" } },
            { type: "text-start", id: "text-2" },
            {
              type: "text-delta",
              id: "text-2",
              delta: '```aio-research-plan\n{"title":"Research robots","steps":["Find sources","Summarize findings"]}\n```',
            },
            { type: "text-end", id: "text-2" },
          ]),
        });
      } else {
        await route.fulfill({ status: 200, headers: streamHeaders, body: executedResponse(runId) });
      }
      return true;
    }
    if (path === `/api/runs/${runId}/approvals` && method === "GET") {
      await route.fulfill({
        json: {
          approvals: [
            {
              id: "approval-row-1",
              aioApprovalId: "approval-1",
              runId,
              status: "requested",
              title: "Approve the research plan",
              toolLabel: null,
              requestedInputRedacted: null,
              expiresAt: null,
            },
          ],
        },
      });
      return true;
    }
    if (path === `/api/runs/${runId}/approvals/approval-1/resolve` && method === "POST") {
      await route.fulfill({
        json: {
          approval: {
            id: "approval-row-1",
            aioApprovalId: "approval-1",
            runId,
            status: "approved",
            title: "Approve the research plan",
            toolLabel: null,
            requestedInputRedacted: null,
            expiresAt: null,
          },
        },
      });
      return true;
    }
    return false;
  });

  await page.goto("/app");
  const composer = page.locator("textarea.message-input");
  await expect(composer).toBeVisible();

  await page.getByRole("button", { name: /Response mode:/ }).click();
  await page.getByRole("menuitemradio", { name: "Research" }).click();
  await composer.fill("Research household robots");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Question 1 of 3")).toBeVisible();
  await page.getByRole("button", { name: /Developers/ }).click();
  await page.getByRole("button", { name: "Casual" }).click();
  await page.getByRole("button", { name: "Short" }).click();
  await expect(page.getByText("Review your answers")).toBeVisible();
  await page.getByRole("button", { name: "Submit answers" }).click();

  const planReadyCard = page.getByRole("group", { name: "Plan ready" });
  await expect(planReadyCard).toBeVisible();
  await expect(page.getByText("Research robots")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByText("Done — the plan has been executed.")).toBeVisible();
});
