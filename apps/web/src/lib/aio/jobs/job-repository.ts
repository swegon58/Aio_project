import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAioJobEnvelope,
  type AioJobEnvelopeV1,
  type AioJobPayloadRef,
  type AioJobStatus,
  type AioJobType,
  type CreateAioJobEnvelopeInput,
} from "./aio-job-contract";
import {
  AIO_JOB_STATE_ERROR,
  transitionJob,
} from "./aio-job-state-machine";

export const JOB_REPO_ERROR_CODE = {
  JOB_NOT_FOUND: "JOB_NOT_FOUND",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  ALREADY_TERMINAL: "ALREADY_TERMINAL",
  LEASE_CONFLICT: "LEASE_CONFLICT",
  DB_ERROR: "DB_ERROR",
} as const;

export type JobRepoErrorCode =
  (typeof JOB_REPO_ERROR_CODE)[keyof typeof JOB_REPO_ERROR_CODE];

export type JobRepoError = {
  ok: false;
  code: JobRepoErrorCode;
  message: string;
};

export type JobRepoOk<T> = { ok: true; data: T };
export type JobRepoResult<T> = JobRepoOk<T> | JobRepoError;

export interface AioJobRow {
  id: string;
  aio_job_id: string;
  schema_version: number;
  job_type: AioJobType;
  status: AioJobStatus;
  customer_id: string;
  run_id: string | null;
  conversation_id: string | null;
  thread_id: string | null;
  idempotency_key: string;
  attempt: number;
  max_attempts: number;
  scheduled_for: string;
  deadline_at: string | null;
  payload_ref: AioJobPayloadRef | null;
  lease_owner: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
  last_heartbeat_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_error_code: string | null;
  last_error_message_redacted: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateJobInput = CreateAioJobEnvelopeInput;

export interface ClaimNextJobInput {
  workerId: string;
  leaseSeconds?: number;
  jobTypes?: AioJobType[];
}

export interface RetryJobInput {
  leaseToken: string;
  retryAt: string | number | Date;
  errorCode?: string | null;
  errorMessageRedacted?: string | null;
}

export interface FailJobInput {
  leaseToken: string;
  errorCode?: string | null;
  errorMessageRedacted?: string | null;
  deadLetter?: boolean;
}

function dbError(message: string, detail?: unknown): JobRepoError {
  return {
    ok: false,
    code: JOB_REPO_ERROR_CODE.DB_ERROR,
    message: detail ? `${message}: ${JSON.stringify(detail)}` : message,
  };
}

function normalizeTimestamp(value: string | number | Date): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    const millis = value < 1_000_000_000_000 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  throw new Error(`Invalid timestamp: ${String(value)}`);
}

export async function createJob(
  db: SupabaseClient,
  input: CreateJobInput,
): Promise<JobRepoResult<AioJobRow>> {
  const envelope = createAioJobEnvelope(input);
  const { data, error } = await db
    .from("aio_jobs")
    .insert({
      aio_job_id: envelope.id,
      schema_version: envelope.schemaVersion,
      job_type: envelope.type,
      status: envelope.status,
      customer_id: envelope.tenantId,
      run_id: envelope.runId,
      conversation_id: envelope.correlation.conversationId,
      thread_id: envelope.correlation.threadId,
      idempotency_key: envelope.idempotencyKey,
      attempt: envelope.attempt,
      max_attempts: envelope.maxAttempts,
      scheduled_for: envelope.scheduledFor,
      deadline_at: envelope.deadlineAt,
      payload_ref: envelope.payloadRef,
      created_at: envelope.createdAt,
      updated_at: envelope.createdAt,
    })
    .select("*")
    .single();

  if (!error) {
    return { ok: true, data: data as AioJobRow };
  }

  if (error.code === "23505") {
    return getJobByIdempotencyKey(db, envelope.idempotencyKey);
  }

  return dbError("Failed to create job", error.message);
}

export async function getJob(
  db: SupabaseClient,
  aioJobId: string,
): Promise<JobRepoResult<AioJobRow>> {
  const { data, error } = await db
    .from("aio_jobs")
    .select("*")
    .eq("aio_job_id", aioJobId)
    .maybeSingle();

  if (error) return dbError("Failed to fetch job", error.message);
  if (!data) {
    return {
      ok: false,
      code: JOB_REPO_ERROR_CODE.JOB_NOT_FOUND,
      message: `Job ${aioJobId} not found.`,
    };
  }
  return { ok: true, data: data as AioJobRow };
}

export async function getJobByIdempotencyKey(
  db: SupabaseClient,
  idempotencyKey: string,
): Promise<JobRepoResult<AioJobRow>> {
  const { data, error } = await db
    .from("aio_jobs")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) return dbError("Failed to fetch job by idempotency key", error.message);
  if (!data) {
    return {
      ok: false,
      code: JOB_REPO_ERROR_CODE.JOB_NOT_FOUND,
      message: `Job with idempotency key ${idempotencyKey} not found.`,
    };
  }
  return { ok: true, data: data as AioJobRow };
}

export async function listJobsForCustomer(
  db: SupabaseClient,
  customerId: string,
  statuses?: readonly AioJobStatus[],
): Promise<JobRepoResult<AioJobRow[]>> {
  let query = db
    .from("aio_jobs")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (statuses && statuses.length > 0) {
    query = query.in("status", [...statuses]);
  }

  const { data, error } = await query;
  if (error) return dbError("Failed to list jobs", error.message);
  return { ok: true, data: (data ?? []) as AioJobRow[] };
}

export async function releaseDueRetryingJobs(
  db: SupabaseClient,
): Promise<JobRepoResult<number>> {
  const { data, error } = await db.rpc("aio_release_due_retrying_jobs");
  if (error) return dbError("Failed to release retrying jobs", error.message);
  return { ok: true, data: Number(data ?? 0) };
}

export async function requeueExpiredJobLeases(
  db: SupabaseClient,
  retryDelaySeconds = 30,
): Promise<JobRepoResult<number>> {
  const { data, error } = await db.rpc("aio_requeue_expired_job_leases", {
    p_retry_delay_seconds: Math.max(1, Math.trunc(retryDelaySeconds)),
  });
  if (error) return dbError("Failed to requeue expired job leases", error.message);
  return { ok: true, data: Number(data ?? 0) };
}

export async function claimNextJob(
  db: SupabaseClient,
  input: ClaimNextJobInput,
): Promise<JobRepoResult<AioJobRow | null>> {
  const { data, error } = await db.rpc("aio_claim_next_job", {
    p_worker_id: input.workerId,
    p_lease_seconds: Math.max(15, Math.trunc(input.leaseSeconds ?? 60)),
    p_job_types: input.jobTypes?.length ? input.jobTypes : null,
  });

  if (error) return dbError("Failed to claim next job", error.message);
  const rows = (data ?? []) as AioJobRow[];
  return { ok: true, data: rows[0] ?? null };
}

function mapStateError(
  code: typeof AIO_JOB_STATE_ERROR[keyof typeof AIO_JOB_STATE_ERROR],
  message: string,
): JobRepoError {
  return {
    ok: false,
    code:
      code === AIO_JOB_STATE_ERROR.ALREADY_TERMINAL
        ? JOB_REPO_ERROR_CODE.ALREADY_TERMINAL
        : JOB_REPO_ERROR_CODE.INVALID_TRANSITION,
    message,
  };
}

async function updateWithLease(
  db: SupabaseClient,
  current: AioJobRow,
  leaseToken: string,
  to: AioJobStatus,
  patch: Record<string, unknown> = {},
): Promise<JobRepoResult<AioJobRow>> {
  if (current.lease_token !== leaseToken) {
    return {
      ok: false,
      code: JOB_REPO_ERROR_CODE.LEASE_CONFLICT,
      message: `Lease token mismatch for job ${current.aio_job_id}.`,
    };
  }

  const tx = transitionJob(current.status, to);
  if (!tx.ok) return mapStateError(tx.code, tx.message);
  if (!tx.changed) return { ok: true, data: current };

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: to,
    updated_at: now,
    ...patch,
  };

  const { data, error } = await db
    .from("aio_jobs")
    .update(update)
    .eq("aio_job_id", current.aio_job_id)
    .eq("lease_token", leaseToken)
    .eq("status", current.status)
    .select("*")
    .single();

  if (error) return dbError("Failed to update leased job", error.message);
  return { ok: true, data: data as AioJobRow };
}

export async function markJobRunning(
  db: SupabaseClient,
  aioJobId: string,
  leaseToken: string,
): Promise<JobRepoResult<AioJobRow>> {
  const current = await getJob(db, aioJobId);
  if (!current.ok) return current;

  const now = new Date().toISOString();
  return updateWithLease(db, current.data, leaseToken, "running", {
    started_at: current.data.started_at ?? now,
    attempt: current.data.attempt + 1,
  });
}

export async function heartbeatJobLease(
  db: SupabaseClient,
  aioJobId: string,
  leaseToken: string,
  leaseSeconds = 60,
): Promise<JobRepoResult<AioJobRow>> {
  const now = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + Math.max(15, Math.trunc(leaseSeconds)) * 1000,
  ).toISOString();

  const { data, error } = await db
    .from("aio_jobs")
    .update({
      lease_expires_at: expiresAt,
      last_heartbeat_at: now,
      updated_at: now,
    })
    .eq("aio_job_id", aioJobId)
    .eq("lease_token", leaseToken)
    .in("status", ["claimed", "running"])
    .select("*")
    .maybeSingle();

  if (error) return dbError("Failed to heartbeat job lease", error.message);
  if (!data) {
    return {
      ok: false,
      code: JOB_REPO_ERROR_CODE.LEASE_CONFLICT,
      message: `Lease heartbeat lost for job ${aioJobId}.`,
    };
  }
  return { ok: true, data: data as AioJobRow };
}

export async function completeJob(
  db: SupabaseClient,
  aioJobId: string,
  leaseToken: string,
): Promise<JobRepoResult<AioJobRow>> {
  const current = await getJob(db, aioJobId);
  if (!current.ok) return current;

  return updateWithLease(db, current.data, leaseToken, "completed", {
    completed_at: new Date().toISOString(),
    lease_owner: null,
    lease_token: null,
    lease_expires_at: null,
    last_heartbeat_at: null,
  });
}

export async function retryJob(
  db: SupabaseClient,
  aioJobId: string,
  input: RetryJobInput,
): Promise<JobRepoResult<AioJobRow>> {
  const current = await getJob(db, aioJobId);
  if (!current.ok) return current;

  return updateWithLease(db, current.data, input.leaseToken, "retrying", {
    scheduled_for: normalizeTimestamp(input.retryAt),
    lease_owner: null,
    lease_token: null,
    lease_expires_at: null,
    last_heartbeat_at: null,
    last_error_code: input.errorCode ?? null,
    last_error_message_redacted: input.errorMessageRedacted ?? null,
  });
}

export async function failJob(
  db: SupabaseClient,
  aioJobId: string,
  input: FailJobInput,
): Promise<JobRepoResult<AioJobRow>> {
  const current = await getJob(db, aioJobId);
  if (!current.ok) return current;

  const target: AioJobStatus = input.deadLetter ? "dead_lettered" : "failed";
  return updateWithLease(db, current.data, input.leaseToken, target, {
    completed_at: new Date().toISOString(),
    lease_owner: null,
    lease_token: null,
    lease_expires_at: null,
    last_heartbeat_at: null,
    last_error_code: input.errorCode ?? null,
    last_error_message_redacted: input.errorMessageRedacted ?? null,
  });
}

export async function cancelJob(
  db: SupabaseClient,
  aioJobId: string,
  leaseToken: string,
): Promise<JobRepoResult<AioJobRow>> {
  const current = await getJob(db, aioJobId);
  if (!current.ok) return current;

  return updateWithLease(db, current.data, leaseToken, "cancelled", {
    completed_at: new Date().toISOString(),
    lease_owner: null,
    lease_token: null,
    lease_expires_at: null,
    last_heartbeat_at: null,
  });
}

/**
 * R5.5 cancel propagation: best-effort force-cancel queued scheduled_task jobs
 * for a schedule, without a lease token (queued -> cancelled is state-machine
 * legal and queued jobs have no lease owner). Used when a schedule is deleted
 * or paused so the worker does not start an occurrence for a schedule the user
 * has removed or paused. Jobs already claimed/running are left alone: a
 * deleted schedule makes executeScheduledTaskJob throw via getSchedule
 * (NOT_FOUND) and dead-letter them, and pausing never aborts an in-flight run.
 * Per-job update failures are skipped so one bad row cannot strand the rest;
 * any orphaned queued job is still caught by the dead-letter safety net. Only
 * a failure to list jobs is surfaced. Returns the number of jobs actually
 * transitioned to cancelled.
 */
export async function cancelQueuedJobsForSchedule(
  db: SupabaseClient,
  customerId: string,
  aioScheduleId: string,
): Promise<JobRepoResult<number>> {
  const list = await listJobsForCustomer(db, customerId, ["queued"]);
  if (!list.ok) return list;

  let cancelled = 0;
  for (const job of list.data) {
    if (job.job_type !== "scheduled_task") continue;
    const preview = job.payload_ref?.preview;
    if (!preview || typeof preview !== "object") continue;
    if ((preview as { aioScheduleId?: unknown }).aioScheduleId !== aioScheduleId) {
      continue;
    }

    const now = new Date().toISOString();
    const { data, error } = await db
      .from("aio_jobs")
      .update({
        status: "cancelled",
        completed_at: now,
        updated_at: now,
        lease_owner: null,
        lease_token: null,
        lease_expires_at: null,
        last_heartbeat_at: null,
      })
      .eq("aio_job_id", job.aio_job_id)
      .eq("status", "queued")
      .select("aio_job_id");
    if (error) continue;
    if (data && data.length > 0) cancelled += 1;
  }
  return { ok: true, data: cancelled };
}

export function nextRetryAt(attempt: number, now = Date.now()): string {
  const delaySeconds = Math.min(300, Math.max(10, 10 * 2 ** Math.max(0, attempt)));
  return new Date(now + delaySeconds * 1000).toISOString();
}
