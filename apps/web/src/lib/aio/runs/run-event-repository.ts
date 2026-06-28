// Server-only repository for aio_run_events (ADR-001 §4-5). Owns the durable
// event stream for a run: atomic, idempotent append (sequence assigned here, not
// by the producer), ordered list/replay, and run+events fetch.
//
// Sequence assignment and idempotent envelope-id dedupe happen in the
// `aio_append_run_event` RPC (migration 0011) — there is no client-side
// transaction in the Supabase JS client, so the append must be one server-side
// step. This function is the only writer of aio_run_events; it redacts every
// payload before persistence (ADR-001 retention rule).
//
// Producers never build a full envelope: they hand the repository the payload
// plus source/timestamp/hermes metadata, and the repository stamps sequence and
// schemaVersion. `createRunEventEnvelope` exists for in-memory/transport use and
// for tests where the sequence is already known.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AioRunEvent } from "./aio-run-events";
import type { AioRunEventType } from "./aio-run-event-envelope";
import {
  AIO_RUN_EVENT_SCHEMA_VERSION,
  normalizeTimestampToIso,
  redactEventPayload,
  type AioRunEventEnvelopeSource,
} from "./aio-run-event-schema";
import {
  dbError,
  getRun,
  REPO_ERROR_CODE,
  type AioRunRow,
  type RepoResult,
} from "./run-repository";

export interface AioRunEventRow {
  id: string;
  schema_version: number;
  run_id: string;
  customer_id: string;
  sequence: number;
  type: AioRunEventType;
  occurred_at: string;
  received_at: string;
  source: AioRunEventEnvelopeSource;
  payload: AioRunEvent;
  hermes: { runId?: string; eventId?: string } | null;
}

// ---- append ----

export interface AppendEventInput {
  /** Idempotency key. Globally unique; replaying the source yields the same id. */
  id: string;
  runId: string;
  customerId: string;
  source: AioRunEventEnvelopeSource;
  payload: AioRunEvent;
  /** When the event occurred at its source (seconds, ms, or ISO). */
  occurredAt: string | number;
  /** When Aio received it. Defaults to occurredAt. */
  receivedAt?: string | number;
  /** Adapter metadata only; never used as identity. */
  hermes?: { runId?: string; eventId?: string };
}

export interface AppendEventResult {
  /** The envelope id persisted (matches the input id). */
  id: string;
  /** The monotonic per-run sequence assigned to this envelope. */
  sequence: number;
  /** true if a new row was persisted this call; false if the id already existed (idempotent no-op). */
  inserted: boolean;
}

/**
 * Append one event, atomically and idempotently. Sequence is assigned by the
 * `aio_append_run_event` RPC. Replaying the same envelope id is a safe no-op
 * (returns the existing sequence with `inserted: false`); losing a concurrent
 * `(run_id, sequence)` race to a different envelope surfaces SEQUENCE_RACE so
 * the caller can retry. The payload is redacted before it is persisted.
 */
export async function appendEvent(
  db: SupabaseClient,
  input: AppendEventInput,
): Promise<RepoResult<AppendEventResult>> {
  const { data, error } = await db.rpc("aio_append_run_event", {
    p_id: input.id,
    p_schema_version: AIO_RUN_EVENT_SCHEMA_VERSION,
    p_run_id: input.runId,
    p_customer_id: input.customerId,
    p_type: input.payload.type,
    p_occurred_at: normalizeTimestampToIso(input.occurredAt),
    p_received_at: normalizeTimestampToIso(input.receivedAt ?? input.occurredAt),
    p_source: input.source,
    p_payload: redactEventPayload(input.payload),
    p_hermes: input.hermes ?? null,
  });

  if (error) return dbError("Failed to append run event", error.message);

  const row = (data ?? []) as Array<{
    out_id: string;
    out_sequence: number | null;
    out_inserted: boolean;
    out_conflict: string | null;
  }>;
  const result = row[0];
  if (!result) {
    return dbError("aio_append_run_event returned no row");
  }

  // Idempotent no-op: same envelope id already persisted.
  if (!result.out_inserted && result.out_conflict === "duplicate_id") {
    return {
      ok: true,
      data: {
        id: result.out_id,
        sequence: result.out_sequence as number,
        inserted: false,
      },
    };
  }

  // Lost a concurrent sequence race to a different envelope; caller retries.
  if (!result.out_inserted && result.out_conflict === "sequence_race") {
    return {
      ok: false,
      code: REPO_ERROR_CODE.SEQUENCE_RACE,
      message: `Lost sequence race appending event ${input.id}; retry.`,
    };
  }

  if (!result.out_inserted) {
    return dbError(
      "aio_append_run_event returned an unhandled conflict",
      result.out_conflict,
    );
  }

  return {
    ok: true,
    data: {
      id: result.out_id,
      sequence: result.out_sequence as number,
      inserted: true,
    },
  };
}

// ---- read ----

export interface ListEventsInput {
  runId: string;
  customerId: string;
  /** Return events with sequence strictly greater than this (replay cursor). */
  afterSequence?: number;
  limit?: number;
}

/**
 * Ordered event stream for a run. Without `afterSequence` this is the full
 * timeline; with it, only events after the cursor (ADR-001 §5 replay).
 */
export async function listEvents(
  db: SupabaseClient,
  input: ListEventsInput,
): Promise<RepoResult<AioRunEventRow[]>> {
  const limit = Math.max(1, Math.min(1000, Math.trunc(input.limit ?? 1000)));
  let query = db
    .from("aio_run_events")
    .select("*")
    .eq("run_id", input.runId)
    .eq("customer_id", input.customerId);
  if (typeof input.afterSequence === "number") {
    query = query.gt("sequence", input.afterSequence);
  }
  const { data, error } = await query
    .order("sequence", { ascending: true })
    .limit(limit);
  if (error) return dbError("Failed to list run events", error.message);
  return { ok: true, data: (data ?? []) as AioRunEventRow[] };
}

/** A run together with its ordered event stream (timeline hydration / replay). */
export interface RunWithEvents {
  run: AioRunRow;
  events: AioRunEventRow[];
}

export async function getRunWithEvents(
  db: SupabaseClient,
  runId: string,
  customerId: string,
): Promise<RepoResult<RunWithEvents>> {
  const run = await getRun(db, runId, customerId);
  if (!run.ok) return run;
  const events = await listEvents(db, { runId, customerId });
  if (!events.ok) return events;
  return { ok: true, data: { run: run.data, events: events.data } };
}
