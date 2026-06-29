import assert from "node:assert/strict";
import test from "node:test";

import type { AioJobRow } from "@/lib/aio/jobs/job-repository";

import { createAioJobWorkerRuntime } from "./aio-job-worker-runtime";

function ok<T>(data: T) {
  return { ok: true as const, data };
}

function makeJob(overrides: Partial<AioJobRow> = {}): AioJobRow {
  const now = "2026-06-29T10:00:00.000Z";
  return {
    id: "job-row-1",
    aio_job_id: "job-1",
    schema_version: 1,
    job_type: "scheduled_task",
    status: "claimed",
    customer_id: "customer-1",
    run_id: null,
    conversation_id: null,
    thread_id: "aio-schedule:schedule-1",
    idempotency_key: "scheduled_task:schedule-1:occurrence-1",
    attempt: 0,
    max_attempts: 1,
    scheduled_for: now,
    deadline_at: null,
    payload_ref: null,
    lease_owner: "worker-1",
    lease_token: "lease-1",
    lease_expires_at: now,
    last_heartbeat_at: now,
    started_at: null,
    completed_at: null,
    last_error_code: null,
    last_error_message_redacted: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeLogger() {
  return {
    logs: [] as string[],
    warns: [] as string[],
    errors: [] as string[],
    logger: {
      log: (...args: unknown[]) => {
        state.logs.push(args.join(" "));
      },
      warn: (...args: unknown[]) => {
        state.warns.push(args.join(" "));
      },
      error: (...args: unknown[]) => {
        state.errors.push(args.join(" "));
      },
    },
  };
}

const state = {
  logs: [] as string[],
  warns: [] as string[],
  errors: [] as string[],
};

function resetLoggerState() {
  state.logs.length = 0;
  state.warns.length = 0;
  state.errors.length = 0;
}

function createRuntime(overrides: Record<string, unknown> = {}) {
  resetLoggerState();
  const { logger } = makeLogger();
  return createAioJobWorkerRuntime({
    db: {} as never,
    pollIntervalMs: 5000,
    leaseSeconds: 60,
    retryLeaseDelaySeconds: 37,
    backendUnavailableRetryMs: 60_000,
    workerId: "worker-1",
    logger,
    sleep: async () => {},
    setIntervalFn: (() => 1) as unknown as typeof setInterval,
    clearIntervalFn: () => {},
    claimNextJob: async () => ok(null),
    completeJob: async () => ok(makeJob({ status: "completed", lease_token: null })),
    failJob: async () =>
      ok(makeJob({ status: "dead_lettered", completed_at: "2026-06-29T10:01:00.000Z" })),
    heartbeatJobLease: async () => ok(makeJob({ status: "running" })),
    markJobRunning: async (_db: unknown, _aioJobId: string, leaseToken: string) =>
      ok(
        makeJob({
          status: "running",
          attempt: 1,
          lease_token: leaseToken,
        }),
      ),
    nextRetryAt: () => "2026-06-29T10:02:00.000Z",
    releaseDueRetryingJobs: async () => ok(0),
    requeueExpiredJobLeases: async () => ok(0),
    retryJob: async () => ok(makeJob({ status: "retrying", lease_token: null })),
    enqueueDueSchedules: async () => ({
      enqueued: 0,
      skippedOverlap: 0,
      missedWindow: 0,
    }),
    executeScheduledTaskJob: async () => {},
    ...overrides,
  } as never);
}

test("processClaimedJob dead-letters a job when the final attempt fails", async () => {
  let retryCalled = false;
  let cleared = false;
  let deadLetter: boolean | undefined;
  let errorCode: string | null | undefined;
  const runtime = createRuntime({
    setIntervalFn: (() => 123) as unknown as typeof setInterval,
    clearIntervalFn: () => {
      cleared = true;
    },
    executeScheduledTaskJob: async () => {
      throw new Error("boom");
    },
    retryJob: async () => {
      retryCalled = true;
      return ok(makeJob({ status: "retrying" }));
    },
    failJob: async (
      _db: unknown,
      _aioJobId: string,
      input: { deadLetter?: boolean; errorCode?: string | null },
    ) => {
      deadLetter = input.deadLetter;
      errorCode = input.errorCode;
      return ok(makeJob({ status: "dead_lettered", lease_token: null }));
    },
  });

  await runtime.processClaimedJob(makeJob());

  assert.equal(retryCalled, false);
  assert.equal(cleared, true);
  assert.equal(deadLetter, true);
  assert.equal(errorCode, "JOB_FAILED");
});

test("sweepQueues requeues stale leased jobs with the configured recovery delay", async () => {
  let receivedDelay = 0;
  const runtime = createRuntime({
    requeueExpiredJobLeases: async (_db: unknown, retryDelaySeconds: number) => {
      receivedDelay = retryDelaySeconds;
      return ok(2);
    },
  });

  await runtime.sweepQueues();

  assert.equal(receivedDelay, 37);
  assert.match(
    state.warns.join("\n"),
    /requeued 2 stale leased job\(s\)/i,
  );
});
