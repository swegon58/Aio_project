import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AIO_SCHEDULE_CATCH_UP_POLICY,
  AIO_SCHEDULE_CONCURRENCY_POLICY,
  computeNextScheduleRunAt,
  parseScheduleInput,
  type AioScheduleDefinition,
  type AioScheduleRunStatus,
  type AioScheduleState,
  type AioScheduleTriggerKind,
} from "./aio-schedule-contract";

export const SCHEDULE_REPO_ERROR_CODE = {
  SCHEDULE_NOT_FOUND: "SCHEDULE_NOT_FOUND",
  DUPLICATE_RUN: "DUPLICATE_RUN",
  INVALID_SCHEDULE: "INVALID_SCHEDULE",
  DB_ERROR: "DB_ERROR",
} as const;

export type ScheduleRepoErrorCode =
  (typeof SCHEDULE_REPO_ERROR_CODE)[keyof typeof SCHEDULE_REPO_ERROR_CODE];

export type ScheduleRepoError = {
  ok: false;
  code: ScheduleRepoErrorCode;
  message: string;
};

export type ScheduleRepoOk<T> = { ok: true; data: T };
export type ScheduleRepoResult<T> = ScheduleRepoOk<T> | ScheduleRepoError;

export interface AioScheduleRow {
  id: string;
  aio_schedule_id: string;
  customer_id: string;
  name: string;
  prompt: string;
  schedule_text: string;
  schedule_kind: "once" | "interval" | "cron";
  schedule_def: AioScheduleDefinition;
  schedule_display: string;
  enabled: boolean;
  state: AioScheduleState;
  paused_at: string | null;
  paused_reason: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: AioScheduleRunStatus | null;
  last_error_message_redacted: string | null;
  repeat_limit: number | null;
  repeat_completed: number;
  concurrency_policy: typeof AIO_SCHEDULE_CONCURRENCY_POLICY;
  catch_up_policy: typeof AIO_SCHEDULE_CATCH_UP_POLICY;
  task_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AioScheduleRunRow {
  id: string;
  aio_schedule_run_id: string;
  schedule_id: string;
  customer_id: string;
  occurrence_key: string;
  trigger_kind: AioScheduleTriggerKind;
  status: AioScheduleRunStatus;
  occurrence_at: string;
  aio_job_id: string | null;
  aio_run_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message_redacted: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleInput {
  customerId: string;
  name: string;
  schedule: string;
  prompt?: string;
  repeatLimit?: number | null;
  taskPayload?: Record<string, unknown>;
}

export interface UpdateScheduleInput {
  name?: string;
  schedule?: string;
  prompt?: string;
  repeatLimit?: number | null;
  taskPayload?: Record<string, unknown>;
}

export interface CreateScheduleRunInput {
  customerId: string;
  aioScheduleId: string;
  triggerKind: AioScheduleTriggerKind;
  occurrenceAt: string;
  occurrenceKey: string;
  status?: AioScheduleRunStatus;
  aioJobId?: string | null;
  aioRunId?: string | null;
}

function dbError(message: string, detail?: unknown): ScheduleRepoError {
  return {
    ok: false,
    code: SCHEDULE_REPO_ERROR_CODE.DB_ERROR,
    message: detail ? `${message}: ${JSON.stringify(detail)}` : message,
  };
}

function invalidSchedule(message: string): ScheduleRepoError {
  return {
    ok: false,
    code: SCHEDULE_REPO_ERROR_CODE.INVALID_SCHEDULE,
    message,
  };
}

function normalizeRepeatLimit(value: number | null | undefined): number | null {
  if (value == null) return null;
  const int = Math.trunc(value);
  return int > 0 ? int : null;
}

export async function createSchedule(
  db: SupabaseClient,
  input: CreateScheduleInput,
): Promise<ScheduleRepoResult<AioScheduleRow>> {
  let parsed: AioScheduleDefinition;
  try {
    parsed = parseScheduleInput(input.schedule);
  } catch (error) {
    return invalidSchedule(error instanceof Error ? error.message : String(error));
  }

  const createdAt = new Date().toISOString();
  const nextRunAt = computeNextScheduleRunAt(parsed);
  const state: AioScheduleState = nextRunAt ? "scheduled" : "completed";
  const aioScheduleId = crypto.randomUUID();

  const { data, error } = await db
    .from("aio_schedules")
    .insert({
      aio_schedule_id: aioScheduleId,
      customer_id: input.customerId,
      name: input.name,
      prompt: input.prompt ?? "",
      schedule_text: input.schedule,
      schedule_kind: parsed.kind,
      schedule_def: parsed,
      schedule_display: parsed.display,
      enabled: state === "scheduled",
      state,
      next_run_at: nextRunAt,
      repeat_limit: normalizeRepeatLimit(input.repeatLimit),
      repeat_completed: 0,
      concurrency_policy: AIO_SCHEDULE_CONCURRENCY_POLICY,
      catch_up_policy: AIO_SCHEDULE_CATCH_UP_POLICY,
      task_payload: input.taskPayload ?? {},
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select("*")
    .single();

  if (error) return dbError("Failed to create schedule", error.message);
  return { ok: true, data: data as AioScheduleRow };
}

export async function getSchedule(
  db: SupabaseClient,
  aioScheduleId: string,
  customerId: string,
): Promise<ScheduleRepoResult<AioScheduleRow>> {
  const { data, error } = await db
    .from("aio_schedules")
    .select("*")
    .eq("aio_schedule_id", aioScheduleId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) return dbError("Failed to fetch schedule", error.message);
  if (!data) {
    return {
      ok: false,
      code: SCHEDULE_REPO_ERROR_CODE.SCHEDULE_NOT_FOUND,
      message: `Schedule ${aioScheduleId} not found.`,
    };
  }
  return { ok: true, data: data as AioScheduleRow };
}

export async function listSchedulesForCustomer(
  db: SupabaseClient,
  customerId: string,
): Promise<ScheduleRepoResult<AioScheduleRow[]>> {
  const { data, error } = await db
    .from("aio_schedules")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) return dbError("Failed to list schedules", error.message);
  return { ok: true, data: (data ?? []) as AioScheduleRow[] };
}

export async function updateSchedule(
  db: SupabaseClient,
  aioScheduleId: string,
  customerId: string,
  input: UpdateScheduleInput,
): Promise<ScheduleRepoResult<AioScheduleRow>> {
  const current = await getSchedule(db, aioScheduleId, customerId);
  if (!current.ok) return current;

  let parsed = current.data.schedule_def;
  let scheduleText = current.data.schedule_text;
  let scheduleDisplay = current.data.schedule_display;

  if (typeof input.schedule === "string") {
    try {
      parsed = parseScheduleInput(input.schedule);
    } catch (error) {
      return invalidSchedule(error instanceof Error ? error.message : String(error));
    }
    scheduleText = input.schedule;
    scheduleDisplay = parsed.display;
  }

  const now = new Date().toISOString();
  const state =
    current.data.state === "paused"
      ? "paused"
      : (computeNextScheduleRunAt(parsed) ? "scheduled" : "completed");
  const nextRunAt =
    state === "paused"
      ? current.data.next_run_at
      : computeNextScheduleRunAt(parsed, {
          lastRunAt: current.data.last_run_at,
        });

  const { data, error } = await db
    .from("aio_schedules")
    .update({
      name: input.name ?? current.data.name,
      prompt: input.prompt ?? current.data.prompt,
      schedule_text: scheduleText,
      schedule_kind: parsed.kind,
      schedule_def: parsed,
      schedule_display: scheduleDisplay,
      next_run_at: nextRunAt,
      state,
      repeat_limit:
        input.repeatLimit === undefined
          ? current.data.repeat_limit
          : normalizeRepeatLimit(input.repeatLimit),
      task_payload: input.taskPayload ?? current.data.task_payload,
      updated_at: now,
    })
    .eq("aio_schedule_id", aioScheduleId)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  if (error) return dbError("Failed to update schedule", error.message);
  return { ok: true, data: data as AioScheduleRow };
}

export async function pauseSchedule(
  db: SupabaseClient,
  aioScheduleId: string,
  customerId: string,
  reason?: string,
): Promise<ScheduleRepoResult<AioScheduleRow>> {
  const current = await getSchedule(db, aioScheduleId, customerId);
  if (!current.ok) return current;

  const { data, error } = await db
    .from("aio_schedules")
    .update({
      enabled: false,
      state: "paused",
      paused_at: new Date().toISOString(),
      paused_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("aio_schedule_id", aioScheduleId)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  if (error) return dbError("Failed to pause schedule", error.message);
  return { ok: true, data: data as AioScheduleRow };
}

export async function resumeSchedule(
  db: SupabaseClient,
  aioScheduleId: string,
  customerId: string,
): Promise<ScheduleRepoResult<AioScheduleRow>> {
  const current = await getSchedule(db, aioScheduleId, customerId);
  if (!current.ok) return current;

  const nextRunAt = computeNextScheduleRunAt(current.data.schedule_def);
  const state: AioScheduleState = nextRunAt ? "scheduled" : "completed";

  const { data, error } = await db
    .from("aio_schedules")
    .update({
      enabled: state === "scheduled",
      state,
      paused_at: null,
      paused_reason: null,
      next_run_at: nextRunAt,
      updated_at: new Date().toISOString(),
    })
    .eq("aio_schedule_id", aioScheduleId)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  if (error) return dbError("Failed to resume schedule", error.message);
  return { ok: true, data: data as AioScheduleRow };
}

export async function triggerScheduleNow(
  db: SupabaseClient,
  aioScheduleId: string,
  customerId: string,
): Promise<ScheduleRepoResult<AioScheduleRow>> {
  const current = await getSchedule(db, aioScheduleId, customerId);
  if (!current.ok) return current;

  const { data, error } = await db
    .from("aio_schedules")
    .update({
      enabled: true,
      state: "scheduled",
      paused_at: null,
      paused_reason: null,
      next_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("aio_schedule_id", aioScheduleId)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  if (error) return dbError("Failed to trigger schedule", error.message);
  return { ok: true, data: data as AioScheduleRow };
}

export async function deleteSchedule(
  db: SupabaseClient,
  aioScheduleId: string,
  customerId: string,
): Promise<ScheduleRepoResult<{ deleted: true }>> {
  const { error } = await db
    .from("aio_schedules")
    .delete()
    .eq("aio_schedule_id", aioScheduleId)
    .eq("customer_id", customerId);

  if (error) return dbError("Failed to delete schedule", error.message);
  return { ok: true, data: { deleted: true } };
}

export async function createScheduleRun(
  db: SupabaseClient,
  input: CreateScheduleRunInput,
): Promise<ScheduleRepoResult<AioScheduleRunRow>> {
  const schedule = await getSchedule(db, input.aioScheduleId, input.customerId);
  if (!schedule.ok) return schedule;

  const createdAt = new Date().toISOString();
  const { data, error } = await db
    .from("aio_schedule_runs")
    .insert({
      aio_schedule_run_id: crypto.randomUUID(),
      schedule_id: schedule.data.id,
      customer_id: input.customerId,
      occurrence_key: input.occurrenceKey,
      trigger_kind: input.triggerKind,
      status: input.status ?? "queued",
      occurrence_at: input.occurrenceAt,
      aio_job_id: input.aioJobId ?? null,
      aio_run_id: input.aioRunId ?? null,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select("*")
    .single();

  if (!error) return { ok: true, data: data as AioScheduleRunRow };
  if (error.code === "23505") {
    return {
      ok: false,
      code: SCHEDULE_REPO_ERROR_CODE.DUPLICATE_RUN,
      message: `Duplicate schedule occurrence ${input.occurrenceKey}.`,
    };
  }
  return dbError("Failed to create schedule run", error.message);
}

export async function getScheduleRun(
  db: SupabaseClient,
  aioScheduleRunId: string,
  customerId: string,
): Promise<ScheduleRepoResult<AioScheduleRunRow>> {
  const { data, error } = await db
    .from("aio_schedule_runs")
    .select("*")
    .eq("aio_schedule_run_id", aioScheduleRunId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) return dbError("Failed to fetch schedule run", error.message);
  if (!data) {
    return {
      ok: false,
      code: SCHEDULE_REPO_ERROR_CODE.SCHEDULE_NOT_FOUND,
      message: `Schedule run ${aioScheduleRunId} not found.`,
    };
  }

  return { ok: true, data: data as AioScheduleRunRow };
}

export async function listDueSchedules(
  db: SupabaseClient,
  now = new Date().toISOString(),
  limit = 25,
): Promise<ScheduleRepoResult<AioScheduleRow[]>> {
  const { data, error } = await db
    .from("aio_schedules")
    .select("*")
    .eq("enabled", true)
    .eq("state", "scheduled")
    .not("next_run_at", "is", null)
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(Math.max(1, Math.trunc(limit)));

  if (error) return dbError("Failed to list due schedules", error.message);
  return { ok: true, data: (data ?? []) as AioScheduleRow[] };
}

export async function listActiveScheduleRuns(
  db: SupabaseClient,
  scheduleId: string,
): Promise<ScheduleRepoResult<AioScheduleRunRow[]>> {
  const { data, error } = await db
    .from("aio_schedule_runs")
    .select("*")
    .eq("schedule_id", scheduleId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false });

  if (error) return dbError("Failed to list active schedule runs", error.message);
  return { ok: true, data: (data ?? []) as AioScheduleRunRow[] };
}

export async function bindScheduleRunJob(
  db: SupabaseClient,
  aioScheduleRunId: string,
  customerId: string,
  aioJobId: string,
): Promise<ScheduleRepoResult<AioScheduleRunRow>> {
  const { data, error } = await db
    .from("aio_schedule_runs")
    .update({
      aio_job_id: aioJobId,
      updated_at: new Date().toISOString(),
    })
    .eq("aio_schedule_run_id", aioScheduleRunId)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  if (error) return dbError("Failed to bind schedule run job", error.message);
  return { ok: true, data: data as AioScheduleRunRow };
}

export async function bindScheduleRunAioRun(
  db: SupabaseClient,
  aioScheduleRunId: string,
  customerId: string,
  aioRunId: string,
): Promise<ScheduleRepoResult<AioScheduleRunRow>> {
  const { data, error } = await db
    .from("aio_schedule_runs")
    .update({
      aio_run_id: aioRunId,
      updated_at: new Date().toISOString(),
    })
    .eq("aio_schedule_run_id", aioScheduleRunId)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  if (error) return dbError("Failed to bind schedule run durable run", error.message);
  return { ok: true, data: data as AioScheduleRunRow };
}

export async function markScheduleRunRunning(
  db: SupabaseClient,
  aioScheduleRunId: string,
  customerId: string,
): Promise<ScheduleRepoResult<AioScheduleRunRow>> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("aio_schedule_runs")
    .update({
      status: "running",
      started_at: now,
      error_code: null,
      error_message_redacted: null,
      updated_at: now,
    })
    .eq("aio_schedule_run_id", aioScheduleRunId)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  if (error) return dbError("Failed to mark schedule run running", error.message);
  return { ok: true, data: data as AioScheduleRunRow };
}

export async function markScheduleRunCompleted(
  db: SupabaseClient,
  aioScheduleRunId: string,
  customerId: string,
): Promise<ScheduleRepoResult<AioScheduleRunRow>> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("aio_schedule_runs")
    .update({
      status: "completed",
      completed_at: now,
      error_code: null,
      error_message_redacted: null,
      updated_at: now,
    })
    .eq("aio_schedule_run_id", aioScheduleRunId)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  if (error) return dbError("Failed to mark schedule run completed", error.message);
  return { ok: true, data: data as AioScheduleRunRow };
}

export async function markScheduleRunFailed(
  db: SupabaseClient,
  aioScheduleRunId: string,
  customerId: string,
  errorCode: string,
  errorMessageRedacted: string,
): Promise<ScheduleRepoResult<AioScheduleRunRow>> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("aio_schedule_runs")
    .update({
      status: "failed",
      completed_at: now,
      error_code: errorCode,
      error_message_redacted: errorMessageRedacted,
      updated_at: now,
    })
    .eq("aio_schedule_run_id", aioScheduleRunId)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  if (error) return dbError("Failed to mark schedule run failed", error.message);
  return { ok: true, data: data as AioScheduleRunRow };
}

export async function updateScheduleAfterOccurrence(
  db: SupabaseClient,
  schedule: AioScheduleRow,
  input: {
    nextRunAt: string | null;
    lastRunAt: string;
    lastStatus: AioScheduleRunStatus;
    repeatCompleted: number;
    lastErrorMessageRedacted?: string | null;
  },
): Promise<ScheduleRepoResult<AioScheduleRow>> {
  const state: AioScheduleState =
    input.nextRunAt == null
      ? "completed"
      : schedule.state === "paused"
        ? "paused"
        : "scheduled";

  const { data, error } = await db
    .from("aio_schedules")
    .update({
      enabled: state === "scheduled",
      state,
      next_run_at: input.nextRunAt,
      last_run_at: input.lastRunAt,
      last_status: input.lastStatus,
      last_error_message_redacted: input.lastErrorMessageRedacted ?? null,
      repeat_completed: input.repeatCompleted,
      updated_at: new Date().toISOString(),
    })
    .eq("aio_schedule_id", schedule.aio_schedule_id)
    .eq("customer_id", schedule.customer_id)
    .select("*")
    .single();

  if (error) return dbError("Failed to update schedule after occurrence", error.message);
  return { ok: true, data: data as AioScheduleRow };
}

export async function setScheduleExecutionState(
  db: SupabaseClient,
  aioScheduleId: string,
  customerId: string,
  input: {
    lastStatus: AioScheduleRunStatus;
    lastRunAt?: string | null;
    lastErrorMessageRedacted?: string | null;
  },
): Promise<ScheduleRepoResult<AioScheduleRow>> {
  const { data, error } = await db
    .from("aio_schedules")
    .update({
      last_status: input.lastStatus,
      last_run_at: input.lastRunAt ?? null,
      last_error_message_redacted: input.lastErrorMessageRedacted ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("aio_schedule_id", aioScheduleId)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  if (error) return dbError("Failed to update schedule execution state", error.message);
  return { ok: true, data: data as AioScheduleRow };
}

export function serializeScheduleForUi(row: AioScheduleRow) {
  return {
    id: row.aio_schedule_id,
    name: row.name,
    schedule: row.schedule_display,
    prompt: row.prompt,
    enabled: row.enabled,
    next_run: row.next_run_at,
    last_run: row.last_run_at,
  };
}
