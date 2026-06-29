import assert from "node:assert/strict";
import test from "node:test";

import { JOB_REPO_ERROR_CODE } from "../jobs/job-repository";
import { parseScheduleInput } from "./aio-schedule-contract";
import {
  createScheduleMutationRuntime,
  SCHEDULE_REPO_ERROR_CODE,
  type AioScheduleRow,
} from "./schedule-repository";

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

function makeDb(options: {
  updateRow?: AioScheduleRow;
  onUpdate?: () => void;
  onDelete?: () => void;
}) {
  return {
    from(table: string) {
      assert.equal(table, "aio_schedules");
      return {
        update() {
          options.onUpdate?.();
          return {
            eq() {
              return {
                eq() {
                  return {
                    select() {
                      return {
                        async single() {
                          return {
                            data: options.updateRow ?? makeSchedule({ state: "paused" }),
                            error: null,
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
        delete() {
          options.onDelete?.();
          return {
            eq() {
              return {
                async eq() {
                  return { error: null };
                },
              };
            },
          };
        },
      };
    },
  } as never;
}

test("pauseSchedule best-effort cancels queued jobs before persisting the paused state", async () => {
  const order: string[] = [];
  const runtime = createScheduleMutationRuntime({
    getSchedule: async () => ok(makeSchedule()),
    cancelQueuedJobsForSchedule: async () => {
      order.push("cancel");
      return {
        ok: false as const,
        code: JOB_REPO_ERROR_CODE.DB_ERROR,
        message: "list failed",
      };
    },
  });
  const db = makeDb({
    updateRow: makeSchedule({
      enabled: false,
      state: "paused",
      paused_reason: "paused from test",
    }),
    onUpdate: () => {
      order.push("update");
    },
  });

  const result = await runtime.pauseSchedule(
    db,
    "schedule-1",
    "customer-1",
    "paused from test",
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.state, "paused");
  assert.deepEqual(order, ["cancel", "update"]);
});

test("pauseSchedule does not attempt cancellation when the schedule lookup fails", async () => {
  let cancelled = false;
  const runtime = createScheduleMutationRuntime({
    getSchedule: async () => ({
      ok: false as const,
      code: SCHEDULE_REPO_ERROR_CODE.SCHEDULE_NOT_FOUND,
      message: "missing",
    }),
    cancelQueuedJobsForSchedule: async () => {
      cancelled = true;
      return ok(0);
    },
  });

  const result = await runtime.pauseSchedule(
    makeDb({}),
    "schedule-1",
    "customer-1",
    "paused from test",
  );

  assert.equal(result.ok, false);
  assert.equal(cancelled, false);
});

test("deleteSchedule best-effort cancels queued jobs before removing the schedule row", async () => {
  const order: string[] = [];
  const runtime = createScheduleMutationRuntime({
    getSchedule: async () => ok(makeSchedule()),
    cancelQueuedJobsForSchedule: async () => {
      order.push("cancel");
      return {
        ok: false as const,
        code: JOB_REPO_ERROR_CODE.DB_ERROR,
        message: "list failed",
      };
    },
  });
  const db = makeDb({
    onDelete: () => {
      order.push("delete");
    },
  });

  const result = await runtime.deleteSchedule(db, "schedule-1", "customer-1");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data, { deleted: true });
  assert.deepEqual(order, ["cancel", "delete"]);
});
