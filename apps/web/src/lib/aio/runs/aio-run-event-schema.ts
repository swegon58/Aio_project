// R1.2 — Versioned event contract helpers: timestamp normalization, payload
// redaction, and envelope validation. Pure functions, safe to call from server
// and test code. The envelope type lives in aio-run-event-envelope.ts.
import type { AioRunEvent } from "./aio-run-events";

/** Current durable event contract version. Bump only with a breaking change. */
export const AIO_RUN_EVENT_SCHEMA_VERSION = 1 as const;

/** Where an envelope originated. Hermes/worker events are adapter input; Aio
 *  events are produced by the control plane itself. */
export type AioRunEventEnvelopeSource = "aio" | "hermes" | "worker";

/** A Unix-millis timestamp is always >= 10^10 (year 2286 in seconds). Below
 *  that, treat the value as seconds. Keeps replay robust to either unit. */
const SECONDS_THRESHOLD = 10_000_000_000;

/**
 * Normalize a timestamp expressed as seconds, milliseconds, or an ISO 8601
 * string into a canonical ISO 8601 string. Replays order by sequence, not
 * time, but persisted timestamps must be comparable and human-readable.
 * Returns the epoch string for unusable input rather than throwing.
 */
export function normalizeTimestampToIso(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") {
    return new Date(0).toISOString();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? new Date(0).toISOString() : new Date(parsed).toISOString();
  }
  const ms = value < SECONDS_THRESHOLD ? value * 1000 : value;
  return new Date(ms).toISOString();
}

/**
 * Normalize a timestamp to Unix milliseconds. Mirrors normalizeTimestampToIso
 * for callers (e.g. the legacy stream writer) that need a numeric `ts`.
 */
export function normalizeTimestampToMs(value: string | number | undefined | null): number {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value === undefined || value === null) {
    return 0;
  }
  return value < SECONDS_THRESHOLD ? value * 1000 : value;
}

const SECRET_KEY_PATTERN =
  /(secret|token|password|api[-_]?key|apikey|credential|private[-_]?key|access[-_]?key)/i;
const MAX_STRING_FIELD = 4000;

/**
 * Return a copy of an event payload with secret-shaped fields redacted and
 * oversized strings truncated, so it is safe to persist indefinitely. The
 * repository calls this before writing an envelope (ADR-001 retention rule).
 */
export function redactEventPayload(event: AioRunEvent): AioRunEvent {
  return redactValue(event) as AioRunEvent;
}

function redactValue(value: unknown, keyHint?: string): unknown {
  if (typeof value === "string") {
    if (keyHint && SECRET_KEY_PATTERN.test(keyHint)) return "[redacted]";
    return value.length > MAX_STRING_FIELD ? `${value.slice(0, MAX_STRING_FIELD)}…[truncated]` : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, keyHint));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = redactValue(item, key);
    }
    return out;
  }
  return value;
}

export type EnvelopeValidation = { ok: true } | { ok: false; errors: string[] };

export function isValidIso(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

/**
 * Validate the V1 envelope shape against a value of unknown origin. Used by
 * contract tests and, later, by the repository before persisting. Returns a
 * list of problems so callers can fail loudly instead of persisting garbage.
 */
export function validateEnvelopeShape(env: unknown): EnvelopeValidation {
  if (!env || typeof env !== "object") {
    return { ok: false, errors: ["envelope must be an object"] };
  }
  const e = env as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof e.id !== "string" || e.id.length === 0) errors.push("id must be a non-empty string");
  if (e.schemaVersion !== AIO_RUN_EVENT_SCHEMA_VERSION) errors.push(`schemaVersion must be ${AIO_RUN_EVENT_SCHEMA_VERSION}`);
  if (typeof e.runId !== "string" || e.runId.length === 0) errors.push("runId must be a non-empty string");
  if (typeof e.threadId !== "string" || e.threadId.length === 0) errors.push("threadId must be a non-empty string");
  if (typeof e.sequence !== "number" || !Number.isInteger(e.sequence) || e.sequence < 0) {
    errors.push("sequence must be a non-negative integer");
  }
  if (typeof e.type !== "string" || e.type.length === 0) errors.push("type must be a non-empty string");
  if (!isValidIso(e.occurredAt)) errors.push("occurredAt must be an ISO 8601 string");
  if (!isValidIso(e.receivedAt)) errors.push("receivedAt must be an ISO 8601 string");
  if (e.source !== "aio" && e.source !== "hermes" && e.source !== "worker") {
    errors.push("source must be one of aio | hermes | worker");
  }
  if (!e.payload || typeof e.payload !== "object") errors.push("payload must be an object");
  if (e.hermes !== undefined && (typeof e.hermes !== "object" || e.hermes === null)) {
    errors.push("hermes must be an object when present");
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
