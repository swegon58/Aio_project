// Server-only repository for aio_runs (ADR-001 §1-3, §6). Owns run lifecycle:
// create, attach Hermes identity, transition (validated by the state machine),
// mark terminal, request cancellation, list (cursor paginated), fetch.
//
// All functions take the service-role client (createServiceClient) and a
// customer_id, and scope every query by both id and customer_id so a wrong
// tenant reads/writes nothing. No route contains raw lifecycle SQL — routes and
// the orchestrator call these functions. Errors return stable codes (the
// contract the APIs map to HTTP); the functions never throw for domain errors.
//
// Tenant note: queries use `customer_id` (-> auth.users(id)), matching every
// existing multi-tenant table. A run that does not belong to the caller is
// reported as RUN_NOT_FOUND — existence is never leaked across tenants.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AioRunStatus } from "./aio-run-events";
import { requestCancel, transition } from "./run-state-machine";

/** Canonical run types stored in aio_runs.mode (chat / deep_research / image). */
export type AioRunMode = string;

export interface AioRunRow {
  id: string;
  customer_id: string;
  conversation_id: string | null;
  thread_id: string;
  status: AioRunStatus;
  mode: AioRunMode;
  input_summary: string | null;
  hermes_run_id: string | null;
  hermes_session_id: string | null;
  reserved_credits: number | null;
  actual_credits: number | null;
  error_code: string | null;
  error_message_redacted: string | null;
  created_at: string;
  started_at: string | null;
  updated_at: string;
  completed_at: string | null;
  cancel_requested_at: string | null;
  metadata: Record<string, unknown>;
}

// ---- shared repository error/result contract (re-used by run-event-repository) ----

export const REPO_ERROR_CODE = {
  /** Run does not exist for this tenant (covers wrong-tenant). */
  RUN_NOT_FOUND: "RUN_NOT_FOUND",
  /** The from -> to edge is not in the allowed set. */
  INVALID_TRANSITION: "INVALID_TRANSITION",
  /** The run is already terminal; no normal transition is allowed. */
  ALREADY_TERMINAL: "ALREADY_TERMINAL",
  /** Lost a concurrent sequence race appending an event; retry. */
  SEQUENCE_RACE: "SEQUENCE_RACE",
  /** The pagination cursor could not be decoded. */
  BAD_CURSOR: "BAD_CURSOR",
  /** An unexpected Supabase/Postgres error. */
  DB_ERROR: "DB_ERROR",
} as const;
export type RepoErrorCode =
  (typeof REPO_ERROR_CODE)[keyof typeof REPO_ERROR_CODE];

export type RepoError = { ok: false; code: RepoErrorCode; message: string };
export type RepoOk<T> = { ok: true; data: T };
export type RepoResult<T> = RepoOk<T> | RepoError;

export function dbError(message: string, detail?: unknown): RepoError {
  return {
    ok: false,
    code: REPO_ERROR_CODE.DB_ERROR,
    message: detail ? `${message}: ${JSON.stringify(detail)}` : message,
  };
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.trunc(n)));

// ---- cursor (keyset pagination over (created_at desc, id desc)) ----

export function encodeRunsCursor(createdAt: string, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt, id }),
    "utf8",
  ).toString("base64url");
}

export function decodeRunsCursor(
  cursor: string,
): { createdAt: string; id: string } | null {
  try {
    const obj = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as unknown;
    if (
      obj &&
      typeof obj === "object" &&
      typeof (obj as { createdAt?: unknown }).createdAt === "string" &&
      typeof (obj as { id?: unknown }).id === "string"
    ) {
      return obj as { createdAt: string; id: string };
    }
    return null;
  } catch {
    return null;
  }
}

// ---- create ----

export interface CreateRunInput {
  customerId: string;
  threadId: string;
  mode: AioRunMode;
  inputSummary?: string | null;
  conversationId?: string | null;
  reservedCredits?: number | null;
  metadata?: Record<string, unknown>;
}

/** Create a run in `queued` (ADR-001 §1: the row exists before Hermes starts). */
export async function createRun(
  db: SupabaseClient,
  input: CreateRunInput,
): Promise<RepoResult<AioRunRow>> {
  const { data, error } = await db
    .from("aio_runs")
    .insert({
      customer_id: input.customerId,
      thread_id: input.threadId,
      status: "queued",
      mode: input.mode,
      input_summary: input.inputSummary ?? null,
      conversation_id: input.conversationId ?? null,
      reserved_credits: input.reservedCredits ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) return dbError("Failed to create run", error.message);
  return { ok: true, data: data as AioRunRow };
}

// ---- read ----

export async function getRun(
  db: SupabaseClient,
  runId: string,
  customerId: string,
): Promise<RepoResult<AioRunRow>> {
  const { data, error } = await db
    .from("aio_runs")
    .select("*")
    .eq("id", runId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) return dbError("Failed to fetch run", error.message);
  if (!data) {
    return {
      ok: false,
      code: REPO_ERROR_CODE.RUN_NOT_FOUND,
      message: `Run ${runId} not found for this tenant.`,
    };
  }
  return { ok: true, data: data as AioRunRow };
}

export interface ListRunsInput {
  customerId: string;
  limit?: number;
  /** Opaque cursor from a previous ListRunsOutput.nextCursor. */
  cursor?: string;
}

export interface ListRunsOutput {
  runs: AioRunRow[];
  /** Set when another page exists; pass back as `cursor`. */
  nextCursor: string | null;
}

/** Keyset-paginated list of a tenant's runs, newest first. */
export async function listRuns(
  db: SupabaseClient,
  input: ListRunsInput,
): Promise<RepoResult<ListRunsOutput>> {
  const limit = clamp(input.limit ?? 50, 1, 100);
  let query = db
    .from("aio_runs")
    .select("*")
    .eq("customer_id", input.customerId);

  if (input.cursor) {
    const cur = decodeRunsCursor(input.cursor);
    if (!cur) {
      return {
        ok: false,
        code: REPO_ERROR_CODE.BAD_CURSOR,
        message: "Invalid runs pagination cursor.",
      };
    }
    // (created_at, id) strictly before the cursor, in the (created_at desc, id
    // desc) order established by the index.
    query = query.or(
      `created_at.lt.${cur.createdAt},and(created_at.eq.${cur.createdAt},id.lt.${cur.id})`,
    );
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (error) return dbError("Failed to list runs", error.message);

  const rows = (data ?? []) as AioRunRow[];
  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const last = rows[limit - 1];
    nextCursor = encodeRunsCursor(last.created_at, last.id);
    rows.length = limit;
  }
  return { ok: true, data: { runs: rows, nextCursor } };
}

// ---- Hermes identity (ADR-001 §2: adapter metadata, never the product id) ----

export async function attachHermesIdentity(
  db: SupabaseClient,
  runId: string,
  customerId: string,
  hermesRunId: string,
  hermesSessionId: string | null,
): Promise<RepoResult<AioRunRow>> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("aio_runs")
    .update({
      hermes_run_id: hermesRunId,
      hermes_session_id: hermesSessionId,
      updated_at: now,
    })
    .eq("id", runId)
    .eq("customer_id", customerId)
    .select("*");
  if (error) return dbError("Failed to attach Hermes identity", error.message);
  if (!data || data.length === 0) {
    return {
      ok: false,
      code: REPO_ERROR_CODE.RUN_NOT_FOUND,
      message: `Run ${runId} not found for this tenant.`,
    };
  }
  return { ok: true, data: data[0] as AioRunRow };
}

// ---- state transitions (ADR-001 §3) ----

/**
 * Move a run to `to`, validated by the state machine. Idempotent: if the run is
 * already in `to` this is a no-op success. Uses an optimistic guard on the
 * current status; a concurrent change is re-read and re-validated once.
 */
export async function transitionRun(
  db: SupabaseClient,
  runId: string,
  customerId: string,
  to: AioRunStatus,
  patch?: Partial<{
    actualCredits: number | null;
    errorCode: string | null;
    errorMessageRedacted: string | null;
    metadata: Record<string, unknown>;
  }>,
): Promise<RepoResult<AioRunRow>> {
  const current = await getRun(db, runId, customerId);
  if (!current.ok) return current;
  const from = current.data.status;

  // Idempotent: already in the target state.
  if (from === to) return { ok: true, data: current.data };

  const decision = transition(from, to);
  if (!decision.ok) {
    return { ok: false, code: decision.code, message: decision.message };
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: to,
    updated_at: now,
  };
  if (to === "running") update.started_at = now;
  if (to === "completed" || to === "failed") update.completed_at = now;
  if (patch?.actualCredits !== undefined)
    update.actual_credits = patch.actualCredits;
  if (patch?.errorCode !== undefined) update.error_code = patch.errorCode;
  if (patch?.errorMessageRedacted !== undefined)
    update.error_message_redacted = patch.errorMessageRedacted;
  if (patch?.metadata !== undefined) update.metadata = patch.metadata;

  const { data, error } = await db
    .from("aio_runs")
    .update(update)
    .eq("id", runId)
    .eq("customer_id", customerId)
    .eq("status", from) // optimistic: only if it has not changed under us
    .select("*");
  if (error) return dbError("Failed to transition run", error.message);

  if (!data || data.length === 0) {
    // The status changed concurrently. Re-read and re-validate once.
    const again = await getRun(db, runId, customerId);
    if (!again.ok) return again;
    if (again.data.status === to) return { ok: true, data: again.data };
    const retry = transition(again.data.status, to);
    if (!retry.ok) {
      return { ok: false, code: retry.code, message: retry.message };
    }
    // Validated; the caller can retry the write. Report current state honestly.
    return {
      ok: false,
      code: REPO_ERROR_CODE.INVALID_TRANSITION,
      message: `Run ${runId} changed to "${again.data.status}" during transition; retry.`,
    };
  }
  return { ok: true, data: data[0] as AioRunRow };
}

/**
 * Mark a run terminal (completed or failed). Stamps completed_at and accepts
 * settlement/error fields. `cancelled` is reached via the cancellation flow
 * (cancelling -> cancelled), not this helper.
 */
export async function markTerminal(
  db: SupabaseClient,
  runId: string,
  customerId: string,
  to: "completed" | "failed",
  fields?: {
    actualCredits?: number | null;
    errorCode?: string | null;
    errorMessageRedacted?: string | null;
  },
): Promise<RepoResult<AioRunRow>> {
  return transitionRun(db, runId, customerId, to, fields);
}

// ---- cancellation (ADR-001 §6: idempotent stop) ----

export interface RequestCancellationOutput {
  run: AioRunRow;
  /** true if the run was already cancelling (no state change written). */
  noop: boolean;
}

/**
 * Idempotent stop request: stoppable -> cancelling (stamps cancel_requested_at);
 * cancelling -> cancelling (no-op); terminal -> ALREADY_TERMINAL (safe to retry).
 * The caller then issues Hermes stop and, on confirmation, transitions
 * cancelling -> cancelled.
 */
export async function requestRunCancellation(
  db: SupabaseClient,
  runId: string,
  customerId: string,
): Promise<RepoResult<RequestCancellationOutput>> {
  const current = await getRun(db, runId, customerId);
  if (!current.ok) return current;

  const decision = requestCancel(current.data.status);
  if (!decision.ok) {
    return { ok: false, code: decision.code, message: decision.message };
  }
  if (decision.noop) {
    return { ok: true, data: { run: current.data, noop: true } };
  }

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("aio_runs")
    .update({
      status: "cancelling",
      cancel_requested_at: now,
      updated_at: now,
    })
    .eq("id", runId)
    .eq("customer_id", customerId)
    .eq("status", current.data.status)
    .select("*");
  if (error) return dbError("Failed to request cancellation", error.message);

  if (!data || data.length === 0) {
    // Concurrent change; re-evaluate idempotently.
    const again = await getRun(db, runId, customerId);
    if (!again.ok) return again;
    const retry = requestCancel(again.data.status);
    if (!retry.ok) {
      return { ok: false, code: retry.code, message: retry.message };
    }
    return { ok: true, data: { run: again.data, noop: retry.noop } };
  }
  return { ok: true, data: { run: data[0] as AioRunRow, noop: false } };
}
