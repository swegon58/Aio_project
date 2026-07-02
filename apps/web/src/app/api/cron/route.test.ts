import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

interface Ctx {
  db: unknown;
  userId: string;
  planTier: string;
}

let ctxResult: { ok: true; ctx: Ctx } | { ok: false; response: Response } = {
  ok: true,
  ctx: { db: {}, userId: "user-cron-get-1", planTier: "business" },
};
let deniedResponse: Response | null = null;
let listResult: { ok: boolean; data?: unknown[]; code?: string; message?: string } = {
  ok: true,
  data: [],
};
let createResult: { ok: boolean; data?: unknown; code?: string; message?: string } = {
  ok: true,
  data: { id: "job-1" },
};

mock.module("@/lib/aio/schedules/schedule-api", {
  namedExports: {
    resolveScheduleApiContext: async () => ctxResult,
    requireCronAccess: () => deniedResponse,
    scheduleRepoErrorResponse: (error: { code: string; message: string }) =>
      Response.json({ error: error.code.toLowerCase(), message: error.message }, { status: 500 }),
  },
});
mock.module("@/lib/aio/schedules/schedule-repository", {
  namedExports: {
    listSchedulesForCustomer: async () => listResult,
    createSchedule: async () => createResult,
    serializeScheduleForUi: (job: unknown) => job,
  },
});
mock.module("@/lib/security/rate-limit", {
  namedExports: {
    checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
    rateLimitResponse: (retryAfterSeconds: number) =>
      Response.json({ error: "rate_limited", retryAfterSeconds }, { status: 429 }),
  },
});

let GET: typeof import("./route").GET;
let POST: typeof import("./route").POST;
before(async () => {
  ({ GET, POST } = await import("./route"));
});

function req(body: unknown) {
  return new Request("http://localhost/api/cron", {
    method: "POST",
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

test("GET /api/cron passes through the context error response when unauthenticated", async () => {
  ctxResult = { ok: false, response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const res = await GET();
  assert.equal(res.status, 401);
});

test("GET /api/cron returns a locked payload when the plan doesn't include cron access", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-cron-get-locked", planTier: "starter" } };
  deniedResponse = Response.json({ error: "plan_locked" }, { status: 403 });
  const res = await GET();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.locked, true);
  assert.deepEqual(body.jobs, []);
});

test("GET /api/cron returns the serialized job list when allowed", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-cron-get-ok", planTier: "business" } };
  deniedResponse = null;
  listResult = { ok: true, data: [{ id: "job-1" }, { id: "job-2" }] };
  const res = await GET();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.jobs, [{ id: "job-1" }, { id: "job-2" }]);
});

test("GET /api/cron surfaces a repository error", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-cron-get-fail", planTier: "business" } };
  deniedResponse = null;
  listResult = { ok: false, code: "UNKNOWN", message: "boom" };
  const res = await GET();
  assert.equal(res.status, 500);
});

test("POST /api/cron passes through the context error response when unauthenticated", async () => {
  ctxResult = { ok: false, response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const res = await POST(req({ name: "n", schedule: "* * * * *" }));
  assert.equal(res.status, 401);
});

test("POST /api/cron returns the plan-locked response as-is when denied", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-cron-post-locked", planTier: "starter" } };
  deniedResponse = Response.json({ error: "plan_locked" }, { status: 403 });
  const res = await POST(req({ name: "n", schedule: "* * * * *" }));
  assert.equal(res.status, 403);
});

test("POST /api/cron rejects invalid JSON", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-cron-post-badjson", planTier: "business" } };
  deniedResponse = null;
  const badReq = new Request("http://localhost/api/cron", {
    method: "POST",
    body: "not json",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
  const res = await POST(badReq);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "invalid_json");
});

test("POST /api/cron requires a name", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-cron-post-noname", planTier: "business" } };
  deniedResponse = null;
  const res = await POST(req({ schedule: "* * * * *" }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "missing_name");
});

test("POST /api/cron requires a schedule", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-cron-post-noschedule", planTier: "business" } };
  deniedResponse = null;
  const res = await POST(req({ name: "My job" }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "missing_schedule");
});

test("POST /api/cron creates the schedule and returns the serialized job", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-cron-post-ok", planTier: "business" } };
  deniedResponse = null;
  createResult = { ok: true, data: { id: "job-42", name: "My job" } };
  const res = await POST(req({ name: "My job", schedule: "* * * * *", prompt: "do the thing" }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.job, { id: "job-42", name: "My job" });
});

test("POST /api/cron surfaces a repository error on create failure", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-cron-post-fail", planTier: "business" } };
  deniedResponse = null;
  createResult = { ok: false, code: "INVALID_SCHEDULE", message: "bad cron expression" };
  const res = await POST(req({ name: "My job", schedule: "not-a-cron" }));
  assert.equal(res.status, 500);
});
