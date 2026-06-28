// R1.2 — The versioned, durable wrapper around an AioRunEvent. The envelope is
// the persisted and replayed contract; the existing AioRunEvent union (now the
// payload) is unchanged so live stream and UI consumers keep working.
//
// Per ADR-001: sequence is assigned by the run-event repository at append time,
// not by the producer. createRunEventEnvelope takes sequence as input so the
// repository can stamp it transactionally; tests pass it directly.
import type { AioRunEvent } from "./aio-run-events";
import {
  AIO_RUN_EVENT_SCHEMA_VERSION,
  normalizeTimestampToIso,
  type AioRunEventEnvelopeSource,
} from "./aio-run-event-schema";

export { AIO_RUN_EVENT_SCHEMA_VERSION };

/** Discriminator values for an envelope, derived from the payload union. */
export type AioRunEventType = AioRunEvent["type"];

export interface AioRunEventEnvelopeV1 {
  /** Globally unique envelope id (UUID). */
  id: string;
  schemaVersion: typeof AIO_RUN_EVENT_SCHEMA_VERSION;
  /** Aio run id. Primary product identity; never the Hermes run id. */
  runId: string;
  /** Conversation/thread the run belongs to. Populated on every envelope. */
  threadId: string;
  /** Monotonic per-run order, assigned by the repository at append time. */
  sequence: number;
  type: AioRunEventType;
  /** When the event occurred at its source (Hermes/Aio/worker). ISO 8601. */
  occurredAt: string;
  /** When Aio persisted the envelope. ISO 8601. */
  receivedAt: string;
  source: AioRunEventEnvelopeSource;
  /** The full typed product event. Redacted before persistence. */
  payload: AioRunEvent;
  /** Adapter metadata only. Never used as identity. */
  hermes?: {
    runId?: string;
    eventId?: string;
  };
}

export type AioRunEventEnvelope = AioRunEventEnvelopeV1;

export interface CreateEnvelopeInput {
  runId: string;
  threadId: string;
  sequence: number;
  source: AioRunEventEnvelopeSource;
  /** Seconds, milliseconds, or ISO string from the source. */
  occurredAt: string | number;
  /** Defaults to occurredAt when omitted. */
  receivedAt?: string | number;
  /** Omit to generate a UUID. */
  id?: string;
  hermes?: {
    runId?: string;
    eventId?: string;
  };
}

/**
 * Build a V1 envelope around a product event. Normalizes both timestamps to
 * ISO 8601. Does not redact the payload; the repository calls
 * redactEventPayload before persistence.
 */
export function createRunEventEnvelope(
  payload: AioRunEvent,
  input: CreateEnvelopeInput,
): AioRunEventEnvelopeV1 {
  const occurredAt = normalizeTimestampToIso(input.occurredAt);
  const receivedAt = normalizeTimestampToIso(input.receivedAt ?? input.occurredAt);

  const envelope: AioRunEventEnvelopeV1 = {
    id: input.id ?? crypto.randomUUID(),
    schemaVersion: AIO_RUN_EVENT_SCHEMA_VERSION,
    runId: input.runId,
    threadId: input.threadId,
    sequence: input.sequence,
    type: payload.type,
    occurredAt,
    receivedAt,
    source: input.source,
    payload,
  };

  if (input.hermes) {
    envelope.hermes = input.hermes;
  }

  return envelope;
}
