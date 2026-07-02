import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

interface Ctx {
  db: unknown;
  userId: string;
  planTier: string;
}

let ctxResult: { ok: true; ctx: Ctx } | { ok: false; response: Response } = {
  ok: true,
  ctx: { db: {}, userId: "user-jobid-1", planTier: "business" },
};
let deniedResponse: Response | null = null;
let updateResult: { ok: boolean; data?: unknown; code?: string; message?: string } = {
  ok: true,
  data: { id: "job-1" },
};
let deleteResult: { ok: boolean; code?: string; message?: string } = { ok: true };
const pauseResult: { ok: boolean; data?: unknown; code?: string; message?: string } = {
  ok: true,
  data: { id: "job-1", status: "paused" },
};
const resumeResult: { ok: boolean; data?: unknown; code?: string; message?: string } = {
  ok: true,
  data: { id: "job-1", status: "active" },
};
let triggerResult: { ok: boolean; data?: unknown; code?: string; message?: string } = {
  ok: true,
  data: { id: "job-1", status: "active" },
};

const updateCalls: Array<{ jobId: string; userId: string; patch: unknown }> = [];
const deleteCalls: Array<{ jobId: string; userId: string }> = [];
const pauseCalls: Array<{ jobId: string; userId: string }> = [];
const resumeCalls: Array<{ jobId: string; userId: string }> = [];
const triggerCalls: Array<{ jobId: string; userId: string }> = [];

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
    updateSchedule: async (_db: unknown, jobId: string, userId: string, patch: unknown) => {
      updateCalls.push({ jobId, userId, patch });
      return updateResult;
    },
    deleteSchedule: async (_db: unknown, jobId: string, userId: string) => {
      deleteCalls.push({ jobId, userId });
      return deleteResult;
    },
    pauseSchedule: async (_db: unknown, jobId: string, userId: string) => {
      pauseCalls.push({ jobId, userId });
      return pauseResult;
    },
    resumeSchedule: async (_db: unknown, jobId: string, userId: string) => {
      resumeCalls.push({ jobId, userId });
      return resumeResult;
    },
    triggerScheduleNow: async (_db: unknown, jobId: string, userId: string) => {
      triggerCalls.push({ jobId, userId });
      return triggerResult;
    },
    serializeScheduleForUi: (job: unknown) => job,
  },
});

let PATCH: typeof import("./route").PATCH;
let DELETE: typeof import("./route").DELETE;
let POST: typeof import("./route").POST;
before(async () => {
  ({ PATCH, DELETE, POST } = await import("./route"));
});

function req(method: string, body?: unknown, url = "http://localhost/api/cron/job-1") {
  return new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

function jobParams(jobId = "job-1") {
  return { params: Promise.resolve({ jobId }) };
}

test("PATCH /api/cron/:jobId passes through the context error response", async () => {
  ctxResult = { ok: false, response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const res = await PATCH(req("PATCH", { name: "n" }), jobParams());
  assert.equal(res.status, 401);
});

test("PATCH /api/cron/:jobId returns the denied response as-is", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-jobid-patch-locked", planTier: "starter" } };
  deniedResponse = Response.json({ error: "plan_locked" }, { status: 403 });
  const res = await PATCH(req("PATCH", { name: "n" }), jobParams());
  assert.equal(res.status, 403);
});

test("PATCH /api/cron/:jobId rejects invalid JSON", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-jobid-patch-badjson", planTier: "business" } };
  deniedResponse = null;
  const badReq = new Request("http://localhost/api/cron/job-1", {
    method: "PATCH",
    body: "not json",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
  const res = await PATCH(badReq, jobParams());
  assert.equal(res.status, 400);
});

test("PATCH /api/cron/:jobId trims and forwards the update to the repository", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-jobid-patch-ok", planTier: "business" } };
  deniedResponse = null;
  updateResult = { ok: true, data: { id: "job-9", name: "Renamed" } };
  updateCalls.length = 0;
  const res = await PATCH(req("PATCH", { name: "  Renamed  " }), jobParams("job-9"));
  assert.equal(res.status, 200);
  assert.equal(updateCalls[0]?.jobId, "job-9");
  assert.equal(updateCalls[0]?.userId, "user-jobid-patch-ok");
  assert.equal((updateCalls[0]?.patch as { name?: string }).name, "Renamed");
  const body = await res.json();
  assert.deepEqual(body.job, { id: "job-9", name: "Renamed" });
});

test("PATCH /api/cron/:jobId surfaces a repository error", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-jobid-patch-fail", planTier: "business" } };
  deniedResponse = null;
  updateResult = { ok: false, code: "SCHEDULE_NOT_FOUND", message: "no such job" };
  const res = await PATCH(req("PATCH", { name: "n" }), jobParams("missing-job"));
  assert.equal(res.status, 500);
});

test("DELETE /api/cron/:jobId passes through the context error response", async () => {
  ctxResult = { ok: false, response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const res = await DELETE(req("DELETE"), jobParams());
  assert.equal(res.status, 401);
});

test("DELETE /api/cron/:jobId returns the denied response as-is", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-jobid-delete-locked", planTier: "starter" } };
  deniedResponse = Response.json({ error: "plan_locked" }, { status: 403 });
  const res = await DELETE(req("DELETE"), jobParams());
  assert.equal(res.status, 403);
});

test("DELETE /api/cron/:jobId deletes the job", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-jobid-delete-ok", planTier: "business" } };
  deniedResponse = null;
  deleteResult = { ok: true };
  deleteCalls.length = 0;
  const res = await DELETE(req("DELETE"), jobParams("job-7"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(deleteCalls[0]?.jobId, "job-7");
});

test("DELETE /api/cron/:jobId surfaces a repository error", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-jobid-delete-fail", planTier: "business" } };
  deniedResponse = null;
  deleteResult = { ok: false, code: "SCHEDULE_NOT_FOUND", message: "no such job" };
  const res = await DELETE(req("DELETE"), jobParams("missing-job"));
  assert.equal(res.status, 500);
});

test("POST /api/cron/:jobId passes through the context error response", async () => {
  ctxResult = { ok: false, response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const res = await POST(req("POST", undefined, "http://localhost/api/cron/job-1?action=pause"), jobParams());
  assert.equal(res.status, 401);
});

test("POST /api/cron/:jobId returns the denied response as-is", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-jobid-post-locked", planTier: "starter" } };
  deniedResponse = Response.json({ error: "plan_locked" }, { status: 403 });
  const res = await POST(req("POST", undefined, "http://localhost/api/cron/job-1?action=pause"), jobParams());
  assert.equal(res.status, 403);
});

test("POST /api/cron/:jobId rejects an unrecognized action", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-jobid-post-badaction", planTier: "business" } };
  deniedResponse = null;
  const res = await POST(
    req("POST", undefined, "http://localhost/api/cron/job-1?action=nope"),
    jobParams(),
  );
  assert.equal(res.status, 400);
});

test("POST /api/cron/:jobId?action=pause pauses the job", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-jobid-post-pause", planTier: "business" } };
  deniedResponse = null;
  pauseCalls.length = 0;
  const res = await POST(
    req("POST", undefined, "http://localhost/api/cron/job-1?action=pause"),
    jobParams("job-1"),
  );
  assert.equal(res.status, 200);
  assert.equal(pauseCalls[0]?.jobId, "job-1");
});

test("POST /api/cron/:jobId?action=resume resumes the job", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-jobid-post-resume", planTier: "business" } };
  deniedResponse = null;
  resumeCalls.length = 0;
  const res = await POST(
    req("POST", undefined, "http://localhost/api/cron/job-2?action=resume"),
    jobParams("job-2"),
  );
  assert.equal(res.status, 200);
  assert.equal(resumeCalls[0]?.jobId, "job-2");
});

test("POST /api/cron/:jobId?action=run triggers the job now", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-jobid-post-run", planTier: "business" } };
  deniedResponse = null;
  triggerCalls.length = 0;
  const res = await POST(
    req("POST", undefined, "http://localhost/api/cron/job-3?action=run"),
    jobParams("job-3"),
  );
  assert.equal(res.status, 200);
  assert.equal(triggerCalls[0]?.jobId, "job-3");
});

test("POST /api/cron/:jobId surfaces a repository error", async () => {
  ctxResult = { ok: true, ctx: { db: {}, userId: "user-jobid-post-fail", planTier: "business" } };
  deniedResponse = null;
  triggerResult = { ok: false, code: "SCHEDULE_NOT_FOUND", message: "no such job" };
  const res = await POST(
    req("POST", undefined, "http://localhost/api/cron/missing-job?action=run"),
    jobParams("missing-job"),
  );
  assert.equal(res.status, 500);
});
