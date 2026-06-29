import type { UIMessage } from "ai";

import { orchestrateAioChatRun } from "@/lib/aio/chat/run-orchestrator";
import type { AioJobRow } from "@/lib/aio/jobs/job-repository";
import { createJob } from "@/lib/aio/jobs/job-repository";
import { getRun } from "@/lib/aio/runs/run-repository";
import {
  computeCatchUpRunAt,
  computeNextScheduleRunAt,
  type AioScheduleRunStatus,
} from "@/lib/aio/schedules/aio-schedule-contract";
import {
  bindScheduleRunAioRun,
  bindScheduleRunJob,
  createScheduleRun,
  getSchedule,
  getScheduleRun,
  listActiveScheduleRuns,
  listDueSchedules,
  markScheduleRunCompleted,
  markScheduleRunFailed,
  markScheduleRunRunning,
  setScheduleExecutionState,
  SCHEDULE_REPO_ERROR_CODE,
  updateScheduleAfterOccurrence,
  type AioScheduleRow,
} from "@/lib/aio/schedules/schedule-repository";
import { resolveHermesBackgroundContext } from "@/lib/hermes/background-context";
import { serviceDb } from "@/lib/hermes/registry";

export const AIO_SCHEDULE_THREAD_PREFIX = "aio-schedule:";

export interface ScheduleRuntimeDeps {
  serviceDb: typeof serviceDb;
  createJob: typeof createJob;
  getRun: typeof getRun;
  bindScheduleRunAioRun: typeof bindScheduleRunAioRun;
  bindScheduleRunJob: typeof bindScheduleRunJob;
  createScheduleRun: typeof createScheduleRun;
  getSchedule: typeof getSchedule;
  getScheduleRun: typeof getScheduleRun;
  listActiveScheduleRuns: typeof listActiveScheduleRuns;
  listDueSchedules: typeof listDueSchedules;
  markScheduleRunCompleted: typeof markScheduleRunCompleted;
  markScheduleRunFailed: typeof markScheduleRunFailed;
  markScheduleRunRunning: typeof markScheduleRunRunning;
  setScheduleExecutionState: typeof setScheduleExecutionState;
  updateScheduleAfterOccurrence: typeof updateScheduleAfterOccurrence;
  resolveHermesBackgroundContext: typeof resolveHermesBackgroundContext;
  orchestrateAioChatRun: typeof orchestrateAioChatRun;
}

const DEFAULT_SCHEDULE_RUNTIME_DEPS: ScheduleRuntimeDeps = {
  serviceDb,
  createJob,
  getRun,
  bindScheduleRunAioRun,
  bindScheduleRunJob,
  createScheduleRun,
  getSchedule,
  getScheduleRun,
  listActiveScheduleRuns,
  listDueSchedules,
  markScheduleRunCompleted,
  markScheduleRunFailed,
  markScheduleRunRunning,
  setScheduleExecutionState,
  updateScheduleAfterOccurrence,
  resolveHermesBackgroundContext,
  orchestrateAioChatRun,
};

interface ScheduledTaskPayload extends Record<string, unknown> {
  aioScheduleId: string;
  aioScheduleRunId: string;
  occurrenceKey: string;
  occurrenceAt: string;
  threadId: string;
}

function scheduleThreadId(aioScheduleId: string): string {
  return `${AIO_SCHEDULE_THREAD_PREFIX}${aioScheduleId}`;
}

function occurrenceKeyFor(schedule: AioScheduleRow, occurrenceAt: string): string {
  return `${schedule.aio_schedule_id}:${occurrenceAt}`;
}

function scheduledTaskPayloadRef(payload: ScheduledTaskPayload) {
  return {
    kind: "inline" as const,
    redacted: true,
    preview: payload,
  };
}

function nextRunAtAfterOccurrence(
  schedule: AioScheduleRow,
  effectiveRunAt: string,
  now: Date,
): { nextRunAt: string | null; repeatCompleted: number } {
  const repeatCompleted = schedule.repeat_completed + 1;
  if (schedule.repeat_limit != null && repeatCompleted >= schedule.repeat_limit) {
    return { nextRunAt: null, repeatCompleted };
  }

  return {
    nextRunAt: computeNextScheduleRunAt(schedule.schedule_def, {
      lastRunAt: effectiveRunAt,
      now,
    }),
    repeatCompleted,
  };
}

function createRecordScheduleOutcome(deps: ScheduleRuntimeDeps) {
  return async function recordScheduleOutcome(
    schedule: AioScheduleRow,
    input: {
      occurrenceAt: string;
      effectiveRunAt: string;
      status: AioScheduleRunStatus;
      errorMessageRedacted?: string | null;
    },
  ) {
    const db = deps.serviceDb();
    const { nextRunAt, repeatCompleted } = nextRunAtAfterOccurrence(
      schedule,
      input.effectiveRunAt,
      new Date(input.effectiveRunAt),
    );

    return deps.updateScheduleAfterOccurrence(db, schedule, {
      nextRunAt,
      lastRunAt: input.occurrenceAt,
      lastStatus: input.status,
      repeatCompleted,
      lastErrorMessageRedacted: input.errorMessageRedacted ?? null,
    });
  };
}

function scheduledTaskPayloadFor(job: AioJobRow): ScheduledTaskPayload {
  const preview = job.payload_ref?.preview;
  if (!preview || typeof preview !== "object") {
    throw new Error(`scheduled_task job ${job.aio_job_id} is missing payload preview`);
  }

  const payload = preview as Record<string, unknown>;
  const aioScheduleId =
    typeof payload.aioScheduleId === "string" ? payload.aioScheduleId : null;
  const aioScheduleRunId =
    typeof payload.aioScheduleRunId === "string" ? payload.aioScheduleRunId : null;
  const occurrenceKey =
    typeof payload.occurrenceKey === "string" ? payload.occurrenceKey : null;
  const occurrenceAt =
    typeof payload.occurrenceAt === "string" ? payload.occurrenceAt : null;
  const threadId =
    typeof payload.threadId === "string" ? payload.threadId : null;

  if (!aioScheduleId || !aioScheduleRunId || !occurrenceKey || !occurrenceAt || !threadId) {
    throw new Error(`scheduled_task job ${job.aio_job_id} has an invalid payload preview`);
  }

  return {
    aioScheduleId,
    aioScheduleRunId,
    occurrenceKey,
    occurrenceAt,
    threadId,
  };
}

function createSyncScheduleRunFromRunState(deps: ScheduleRuntimeDeps) {
  return async function syncScheduleRunFromRunState(input: {
    aioScheduleId: string;
    aioScheduleRunId: string;
    customerId: string;
    occurrenceAt: string;
    runId: string;
  }) {
    const db = deps.serviceDb();
    const run = await deps.getRun(db, input.runId, input.customerId);
    if (!run.ok) {
      throw new Error(run.message);
    }

    if (run.data.status === "completed") {
      const completed = await deps.markScheduleRunCompleted(
        db,
        input.aioScheduleRunId,
        input.customerId,
      );
      if (!completed.ok) throw new Error(completed.message);
      const updated = await deps.setScheduleExecutionState(
        db,
        input.aioScheduleId,
        input.customerId,
        {
          lastStatus: "completed",
          lastRunAt: input.occurrenceAt,
        },
      );
      if (!updated.ok) throw new Error(updated.message);
      return "completed" as const;
    }

    if (run.data.status === "running" || run.data.status === "queued") {
      const running = await deps.markScheduleRunRunning(
        db,
        input.aioScheduleRunId,
        input.customerId,
      );
      if (!running.ok) throw new Error(running.message);
      const updated = await deps.setScheduleExecutionState(
        db,
        input.aioScheduleId,
        input.customerId,
        {
          lastStatus: "running",
          lastRunAt: input.occurrenceAt,
        },
      );
      if (!updated.ok) throw new Error(updated.message);
      return "running" as const;
    }

    const message = run.data.error_message_redacted ?? "Scheduled run failed.";
    const failed = await deps.markScheduleRunFailed(
      db,
      input.aioScheduleRunId,
      input.customerId,
      run.data.error_code ?? "SCHEDULED_RUN_FAILED",
      message,
    );
    if (!failed.ok) throw new Error(failed.message);
    const updated = await deps.setScheduleExecutionState(
      db,
      input.aioScheduleId,
      input.customerId,
      {
        lastStatus: "failed",
        lastRunAt: input.occurrenceAt,
        lastErrorMessageRedacted: message,
      },
    );
    if (!updated.ok) throw new Error(updated.message);
    return "failed" as const;
  };
}

const NO_OP_WRITER = {
  write() {},
};

export function createScheduleRuntime(overrides: Partial<ScheduleRuntimeDeps> = {}) {
  const deps: ScheduleRuntimeDeps = {
    ...DEFAULT_SCHEDULE_RUNTIME_DEPS,
    ...overrides,
  };
  const recordScheduleOutcome = createRecordScheduleOutcome(deps);
  const syncScheduleRunFromRunState = createSyncScheduleRunFromRunState(deps);

  return {
    async enqueueDueSchedules(input: {
      now?: Date;
      limit?: number;
    } = {}): Promise<{
      enqueued: number;
      skippedOverlap: number;
      missedWindow: number;
    }> {
      const db = deps.serviceDb();
      const now = input.now ?? new Date();
      const due = await deps.listDueSchedules(db, now.toISOString(), input.limit ?? 25);
      if (!due.ok) {
        throw new Error(due.message);
      }

      let enqueued = 0;
      let skippedOverlap = 0;
      let missedWindow = 0;

      for (const schedule of due.data) {
        if (!schedule.next_run_at) continue;

        const catchUpTarget = computeCatchUpRunAt(
          schedule.schedule_def,
          schedule.next_run_at,
          now,
        );
        const occurrenceAt = schedule.next_run_at;
        const occurrenceKey = occurrenceKeyFor(schedule, occurrenceAt);

        if (!catchUpTarget) {
          const missed = await deps.createScheduleRun(db, {
            customerId: schedule.customer_id,
            aioScheduleId: schedule.aio_schedule_id,
            triggerKind: "scheduled",
            occurrenceAt,
            occurrenceKey,
            status: "failed",
          });
          if (!missed.ok && missed.code !== SCHEDULE_REPO_ERROR_CODE.DUPLICATE_RUN) {
            throw new Error(missed.message);
          }
          await recordScheduleOutcome(schedule, {
            occurrenceAt,
            effectiveRunAt: now.toISOString(),
            status: "failed",
            errorMessageRedacted: "Scheduled occurrence missed its grace window.",
          });
          missedWindow += 1;
          continue;
        }

        const active = await deps.listActiveScheduleRuns(db, schedule.id);
        if (!active.ok) {
          throw new Error(active.message);
        }
        const effectiveRunAt =
          catchUpTarget === occurrenceAt ? occurrenceAt : now.toISOString();
        const triggerKind = catchUpTarget === occurrenceAt ? "scheduled" : "catch_up";

        if (active.data.length > 0) {
          const skipped = await deps.createScheduleRun(db, {
            customerId: schedule.customer_id,
            aioScheduleId: schedule.aio_schedule_id,
            triggerKind,
            occurrenceAt,
            occurrenceKey,
            status: "skipped_overlap",
          });
          if (!skipped.ok && skipped.code !== SCHEDULE_REPO_ERROR_CODE.DUPLICATE_RUN) {
            throw new Error(skipped.message);
          }
          await recordScheduleOutcome(schedule, {
            occurrenceAt,
            effectiveRunAt,
            status: "skipped_overlap",
          });
          skippedOverlap += 1;
          continue;
        }

        const createdRun = await deps.createScheduleRun(db, {
          customerId: schedule.customer_id,
          aioScheduleId: schedule.aio_schedule_id,
          triggerKind,
          occurrenceAt,
          occurrenceKey,
          status: "queued",
        });
        if (!createdRun.ok) {
          if (createdRun.code === SCHEDULE_REPO_ERROR_CODE.DUPLICATE_RUN) {
            continue;
          }
          throw new Error(createdRun.message);
        }

        const threadId = scheduleThreadId(schedule.aio_schedule_id);
        const payload: ScheduledTaskPayload = {
          aioScheduleId: schedule.aio_schedule_id,
          aioScheduleRunId: createdRun.data.aio_schedule_run_id,
          occurrenceKey,
          occurrenceAt,
          threadId,
        };
        const job = await deps.createJob(db, {
          type: "scheduled_task",
          tenantId: schedule.customer_id,
          scheduledFor: effectiveRunAt,
          maxAttempts: 1,
          idempotencyKey: `scheduled_task:${schedule.aio_schedule_id}:${occurrenceKey}`,
          payloadRef: scheduledTaskPayloadRef(payload),
          correlation: {
            userId: schedule.customer_id,
            threadId,
            conversationId: null,
          },
        });
        if (!job.ok) {
          throw new Error(job.message);
        }

        const bound = await deps.bindScheduleRunJob(
          db,
          createdRun.data.aio_schedule_run_id,
          schedule.customer_id,
          job.data.aio_job_id,
        );
        if (!bound.ok) {
          throw new Error(bound.message);
        }

        const advanced = await deps.updateScheduleAfterOccurrence(db, schedule, {
          nextRunAt: nextRunAtAfterOccurrence(schedule, effectiveRunAt, now).nextRunAt,
          lastRunAt: occurrenceAt,
          lastStatus: "queued",
          repeatCompleted: schedule.repeat_completed + 1,
          lastErrorMessageRedacted: null,
        });
        if (!advanced.ok) {
          throw new Error(advanced.message);
        }

        enqueued += 1;
      }

      return { enqueued, skippedOverlap, missedWindow };
    },

    async executeScheduledTaskJob(job: AioJobRow): Promise<void> {
      const db = deps.serviceDb();
      const payload = scheduledTaskPayloadFor(job);

      const schedule = await deps.getSchedule(db, payload.aioScheduleId, job.customer_id);
      if (!schedule.ok) {
        throw new Error(schedule.message);
      }
      const scheduleRun = await deps.getScheduleRun(
        db,
        payload.aioScheduleRunId,
        job.customer_id,
      );
      if (!scheduleRun.ok) {
        throw new Error(scheduleRun.message);
      }

      if (scheduleRun.data.status === "completed") {
        return;
      }

      if (scheduleRun.data.aio_run_id) {
        const synced = await syncScheduleRunFromRunState({
          aioScheduleId: payload.aioScheduleId,
          aioScheduleRunId: payload.aioScheduleRunId,
          customerId: job.customer_id,
          occurrenceAt: payload.occurrenceAt,
          runId: scheduleRun.data.aio_run_id,
        });
        if (synced === "completed") {
          return;
        }
        throw new Error(
          `Scheduled occurrence ${payload.aioScheduleRunId} already started and cannot be resumed safely yet.`,
        );
      }

      // R5.5 at-most-once: only a "queued" run may begin executing. A "running"
      // run with no bound aio_run means a prior attempt crashed in the window
      // between markScheduleRunRunning and bindScheduleRunAioRun (the orchestrator
      // creates the run and starts Hermes inside that window). On lease-expiry
      // re-claim we must NOT start a duplicate run: fail this occurrence and let
      // the job dead-letter, matching the scheduled_task max_attempts=1
      // at-most-once contract. Any other non-"queued" status is already terminal
      // for this occurrence, so it is also skipped rather than re-executed.
      if (scheduleRun.data.status !== "queued") {
        if (scheduleRun.data.status === "running") {
          const unboundMessage =
            "Scheduled run started but did not bind a run; re-execution skipped to prevent duplicates.";
          const failed = await deps.markScheduleRunFailed(
            db,
            payload.aioScheduleRunId,
            job.customer_id,
            "SCHEDULED_RUN_UNBOUND_CRASH",
            unboundMessage,
          );
          if (!failed.ok) throw new Error(failed.message);
          const updated = await deps.setScheduleExecutionState(
            db,
            payload.aioScheduleId,
            job.customer_id,
            {
              lastStatus: "failed",
              lastRunAt: payload.occurrenceAt,
              lastErrorMessageRedacted: unboundMessage,
            },
          );
          if (!updated.ok) throw new Error(updated.message);
        }
        throw new Error(
          `Scheduled occurrence ${payload.aioScheduleRunId} is in status "${scheduleRun.data.status}" and cannot be (re)started; skipping to prevent duplicate execution.`,
        );
      }

      const prompt = schedule.data.prompt.trim();
      if (!prompt) {
        const failed = await deps.markScheduleRunFailed(
          db,
          payload.aioScheduleRunId,
          job.customer_id,
          "EMPTY_SCHEDULE_PROMPT",
          "Scheduled task prompt is empty.",
        );
        if (!failed.ok) throw new Error(failed.message);
        const updated = await deps.setScheduleExecutionState(
          db,
          payload.aioScheduleId,
          job.customer_id,
          {
            lastStatus: "failed",
            lastRunAt: payload.occurrenceAt,
            lastErrorMessageRedacted: "Scheduled task prompt is empty.",
          },
        );
        if (!updated.ok) throw new Error(updated.message);
        throw new Error("Scheduled task prompt is empty.");
      }

      const runtimeContext = await deps.resolveHermesBackgroundContext({
        customerId: job.customer_id,
        threadId: payload.threadId,
      });

      const queued = await deps.setScheduleExecutionState(
        db,
        payload.aioScheduleId,
        job.customer_id,
        {
          lastStatus: "running",
          lastRunAt: payload.occurrenceAt,
          lastErrorMessageRedacted: null,
        },
      );
      if (!queued.ok) throw new Error(queued.message);
      const running = await deps.markScheduleRunRunning(
        db,
        payload.aioScheduleRunId,
        job.customer_id,
      );
      if (!running.ok) throw new Error(running.message);

      const messages: UIMessage[] = [
        {
          id: crypto.randomUUID(),
          role: "user",
          parts: [{ type: "text", text: prompt }],
        },
      ];

      const abortController = new AbortController();
      const result = await deps.orchestrateAioChatRun({
        clientSignal: abortController.signal,
        messages,
        mode: "auto",
        planMode: false,
        contextOverride: runtimeContext,
      });

      if (!result.ok) {
        const message = await result.response.text();
        const failed = await deps.markScheduleRunFailed(
          db,
          payload.aioScheduleRunId,
          job.customer_id,
          "SCHEDULED_RUN_START_FAILED",
          message || "Scheduled task could not start.",
        );
        if (!failed.ok) throw new Error(failed.message);
        const updated = await deps.setScheduleExecutionState(
          db,
          payload.aioScheduleId,
          job.customer_id,
          {
            lastStatus: "failed",
            lastRunAt: payload.occurrenceAt,
            lastErrorMessageRedacted: message || "Scheduled task could not start.",
          },
        );
        if (!updated.ok) throw new Error(updated.message);
        throw new Error(message || "Scheduled task could not start.");
      }

      const boundRun = await deps.bindScheduleRunAioRun(
        db,
        payload.aioScheduleRunId,
        job.customer_id,
        result.runId,
      );
      if (!boundRun.ok) throw new Error(boundRun.message);

      await result.execute({ writer: NO_OP_WRITER as never });
      const finalStatus = await syncScheduleRunFromRunState({
        aioScheduleId: payload.aioScheduleId,
        aioScheduleRunId: payload.aioScheduleRunId,
        customerId: job.customer_id,
        occurrenceAt: payload.occurrenceAt,
        runId: result.runId,
      });
      if (finalStatus !== "completed") {
        throw new Error(`Scheduled task finished with run status ${finalStatus}.`);
      }
    },
  };
}

const DEFAULT_SCHEDULE_RUNTIME = createScheduleRuntime();

export async function enqueueDueSchedules(input: {
  now?: Date;
  limit?: number;
} = {}) {
  return DEFAULT_SCHEDULE_RUNTIME.enqueueDueSchedules(input);
}

export async function executeScheduledTaskJob(job: AioJobRow): Promise<void> {
  return DEFAULT_SCHEDULE_RUNTIME.executeScheduledTaskJob(job);
}
