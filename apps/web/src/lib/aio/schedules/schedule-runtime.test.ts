import assert from "node:assert/strict";
import test from "node:test";

import type { AioJobRow } from "@/lib/aio/jobs/job-repository";
import { parseScheduleInput } from "@/lib/aio/schedules/aio-schedule-contract";
import {
  SCHEDULE_REPO_ERROR_CODE,
  type AioScheduleRow,
  type AioScheduleRunRow,
} from "@/lib/aio/schedules/schedule-repository";

import {
  AIO_SCHEDULE_THREAD_PREFIX,
  createScheduleRuntime,
  type ScheduleRuntimeDeps,
} from "./schedule-runtime";

function ok<T>(data: T) {
  return { ok: true as const, data };
}

function makeSchedule(overrides: Partial<AioScheduleRow> = {}): AioScheduleRow {
  const now = "2026-06-29T10:00:00.000Z";
  return {
    id: "schedule-row-1",
    aio_schedule_id: "schedule-1",
    customer_id: "customer-1",
    name: "Daily brief",
    prompt: "Send the update",
    schedule_text: "every 15m",
    schedule_kind: "interval",
    schedule_def: parseScheduleInput("every 15m"),
    schedule_display: "every 15m",
    enabled: true,
    state: "scheduled",
    paused_at: null,
    paused_reason: null,
    next_run_at: now,
    last_run_at: null,
    last_status: null,
    last_error_message_redacted: null,
    repeat_limit: null,
    repeat_completed: 0,
    concurrency_policy: "forbid_overlap",
    catch_up_policy: "coalesce_once",
    task_payload: {},
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeScheduleRun(overrides: Partial<AioScheduleRunRow> = {}): AioScheduleRunRow {
  const now = "2026-06-29T10:00:00.000Z";
  return {
    id: "schedule-run-row-1",
    aio_schedule_run_id: "schedule-run-1",
    schedule_id: "schedule-row-1",
    customer_id: "customer-1",
    occurrence_key: "schedule-1:2026-06-29T10:00:00.000Z",
    trigger_kind: "scheduled",
    status: "queued",
    occurrence_at: now,
    aio_job_id: "job-1",
    aio_run_id: null,
    started_at: null,
    completed_at: null,
    error_code: null,
    error_message_redacted: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
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
    thread_id: `${AIO_SCHEDULE_THREAD_PREFIX}schedule-1`,
    idempotency_key: "scheduled_task:schedule-1:schedule-1:2026-06-29T10:00:00.000Z",
    attempt: 0,
    max_attempts: 1,
    scheduled_for: now,
    deadline_at: null,
    payload_ref: {
      kind: "inline",
      redacted: true,
      preview: {
        aioScheduleId: "schedule-1",
        aioScheduleRunId: "schedule-run-1",
        occurrenceKey: "schedule-1:2026-06-29T10:00:00.000Z",
        occurrenceAt: now,
        threadId: `${AIO_SCHEDULE_THREAD_PREFIX}schedule-1`,
      },
    },
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

function unexpected(name: string) {
  return async () => {
    throw new Error(`unexpected call: ${name}`);
  };
}

function makeDeps(overrides: Partial<ScheduleRuntimeDeps> = {}): ScheduleRuntimeDeps {
  return {
    serviceDb: () => ({}) as never,
    createJob: unexpected("createJob") as ScheduleRuntimeDeps["createJob"],
    getRun: unexpected("getRun") as ScheduleRuntimeDeps["getRun"],
    bindScheduleRunAioRun: unexpected("bindScheduleRunAioRun") as ScheduleRuntimeDeps["bindScheduleRunAioRun"],
    bindScheduleRunJob: unexpected("bindScheduleRunJob") as ScheduleRuntimeDeps["bindScheduleRunJob"],
    createScheduleRun: unexpected("createScheduleRun") as ScheduleRuntimeDeps["createScheduleRun"],
    getSchedule: unexpected("getSchedule") as ScheduleRuntimeDeps["getSchedule"],
    getScheduleRun: unexpected("getScheduleRun") as ScheduleRuntimeDeps["getScheduleRun"],
    listActiveScheduleRuns: unexpected("listActiveScheduleRuns") as ScheduleRuntimeDeps["listActiveScheduleRuns"],
    listDueSchedules: unexpected("listDueSchedules") as ScheduleRuntimeDeps["listDueSchedules"],
    markScheduleRunCompleted: unexpected("markScheduleRunCompleted") as ScheduleRuntimeDeps["markScheduleRunCompleted"],
    markScheduleRunFailed: unexpected("markScheduleRunFailed") as ScheduleRuntimeDeps["markScheduleRunFailed"],
    markScheduleRunRunning: unexpected("markScheduleRunRunning") as ScheduleRuntimeDeps["markScheduleRunRunning"],
    setScheduleExecutionState: unexpected("setScheduleExecutionState") as ScheduleRuntimeDeps["setScheduleExecutionState"],
    updateScheduleAfterOccurrence:
      unexpected("updateScheduleAfterOccurrence") as ScheduleRuntimeDeps["updateScheduleAfterOccurrence"],
    resolveHermesBackgroundContext:
      unexpected("resolveHermesBackgroundContext") as ScheduleRuntimeDeps["resolveHermesBackgroundContext"],
    orchestrateAioChatRun:
      unexpected("orchestrateAioChatRun") as ScheduleRuntimeDeps["orchestrateAioChatRun"],
    ...overrides,
  };
}

test("enqueueDueSchedules treats duplicate run creation as a no-op and does not create a job", async () => {
  let createJobCalled = false;
  const runtime = createScheduleRuntime(
    makeDeps({
      listDueSchedules: async () => ok([makeSchedule()]),
      listActiveScheduleRuns: async () => ok([]),
      createScheduleRun: async () => ({
        ok: false as const,
        code: SCHEDULE_REPO_ERROR_CODE.DUPLICATE_RUN,
        message: "duplicate occurrence",
      }),
      createJob: async () => {
        createJobCalled = true;
        return ok(makeJob());
      },
    }),
  );

  const result = await runtime.enqueueDueSchedules({
    now: new Date("2026-06-29T10:00:00.000Z"),
    limit: 10,
  });

  assert.deepEqual(result, {
    enqueued: 0,
    skippedOverlap: 0,
    missedWindow: 0,
  });
  assert.equal(createJobCalled, false);
});

test("executeScheduledTaskJob returns after syncing an already-completed bound run", async () => {
  let orchestrated = false;
  let completedMarked = false;
  const runtime = createScheduleRuntime(
    makeDeps({
      getSchedule: async () => ok(makeSchedule()),
      getScheduleRun: async () => ok(makeScheduleRun({ aio_run_id: "run-1" })),
      getRun: async () =>
        ok({
          status: "completed",
          error_code: null,
          error_message_redacted: null,
        } as never),
      markScheduleRunCompleted: async () => {
        completedMarked = true;
        return ok(makeScheduleRun({ status: "completed", aio_run_id: "run-1" }));
      },
      setScheduleExecutionState: async () => ok(makeSchedule()),
      orchestrateAioChatRun: async () => {
        orchestrated = true;
        throw new Error("should not orchestrate a duplicate run");
      },
    }),
  );

  await runtime.executeScheduledTaskJob(makeJob());

  assert.equal(completedMarked, true);
  assert.equal(orchestrated, false);
});

test("executeScheduledTaskJob dead-letters an unbound running occurrence instead of starting a duplicate run", async () => {
  let failureCode: string | null = null;
  let orchestrated = false;
  const runtime = createScheduleRuntime(
    makeDeps({
      getSchedule: async () => ok(makeSchedule()),
      getScheduleRun: async () => ok(makeScheduleRun({ status: "running", aio_job_id: null })),
      markScheduleRunFailed: async (_db, _runId, _customerId, code) => {
        failureCode = code;
        return ok(
          makeScheduleRun({
            status: "failed",
            aio_job_id: null,
            error_code: code,
          }),
        );
      },
      setScheduleExecutionState: async () => ok(makeSchedule({ last_status: "failed" })),
      orchestrateAioChatRun: async () => {
        orchestrated = true;
        throw new Error("should not orchestrate a duplicate run");
      },
    }),
  );

  await assert.rejects(
    () => runtime.executeScheduledTaskJob(makeJob()),
    /cannot be \(re\)started; skipping to prevent duplicate execution/i,
  );

  assert.equal(failureCode, "SCHEDULED_RUN_UNBOUND_CRASH");
  assert.equal(orchestrated, false);
});
