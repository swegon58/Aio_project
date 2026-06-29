import assert from "node:assert/strict";
import test from "node:test";
import type { AioRunEvent } from "./aio-run-events";
import {
  AIO_RUN_EVENT_SCHEMA_VERSION,
  createRunEventEnvelope,
} from "./aio-run-event-envelope";
import {
  normalizeTimestampToIso,
  normalizeTimestampToMs,
  redactEventPayload,
  validateEnvelopeShape,
} from "./aio-run-event-schema";

const runCreated: AioRunEvent = {
  type: "run.created",
  runId: "run-1",
  threadId: "thread-1",
  status: "running",
  createdAt: "2024-01-01T00:00:00.000Z",
  ts: 1,
};

test("createRunEventEnvelope wraps an event into a valid V1 envelope", () => {
  const env = createRunEventEnvelope(runCreated, {
    runId: "run-1",
    threadId: "thread-1",
    sequence: 0,
    source: "aio",
    occurredAt: 1_700_000_000,
  });

  assert.equal(env.schemaVersion, AIO_RUN_EVENT_SCHEMA_VERSION);
  assert.equal(typeof env.id, "string");
  assert.ok(env.id.length > 0);
  assert.equal(env.runId, "run-1");
  assert.equal(env.threadId, "thread-1");
  assert.equal(env.sequence, 0);
  assert.equal(env.type, "run.created");
  assert.equal(env.occurredAt, "2023-11-14T22:13:20.000Z");
  // receivedAt defaults to occurredAt when omitted.
  assert.equal(env.receivedAt, env.occurredAt);
  assert.equal(env.source, "aio");
  assert.equal(env.hermes, undefined);
  assert.deepEqual(validateEnvelopeShape(env), { ok: true });
});

test("createRunEventEnvelope is deterministic when an id is supplied", () => {
  const a = createRunEventEnvelope(runCreated, {
    runId: "run-1",
    threadId: "thread-1",
    sequence: 3,
    source: "hermes",
    occurredAt: 1_700_000_000,
    id: "env-fixed",
    hermes: { runId: "hermes-run-1", eventId: "e-1" },
  });
  const b = createRunEventEnvelope(runCreated, {
    runId: "run-1",
    threadId: "thread-1",
    sequence: 3,
    source: "hermes",
    occurredAt: 1_700_000_000,
    id: "env-fixed",
    hermes: { runId: "hermes-run-1", eventId: "e-1" },
  });

  assert.deepEqual(a, b);
  assert.equal(a.id, "env-fixed");
  assert.equal(a.hermes?.runId, "hermes-run-1");
});

test("normalizeTimestampToIso handles seconds, milliseconds, ISO strings, and junk", () => {
  assert.equal(normalizeTimestampToIso(1_700_000_000), "2023-11-14T22:13:20.000Z"); // seconds
  assert.equal(normalizeTimestampToIso(1_700_000_000_000), "2023-11-14T22:13:20.000Z"); // ms
  assert.equal(normalizeTimestampToIso("2024-01-01T00:00:00.000Z"), "2024-01-01T00:00:00.000Z");
  // Unusable input falls back to epoch, never throws.
  assert.equal(normalizeTimestampToIso(undefined), new Date(0).toISOString());
  assert.equal(normalizeTimestampToIso("not-a-date"), new Date(0).toISOString());
});

test("normalizeTimestampToMs mirrors the seconds/millis rule", () => {
  assert.equal(normalizeTimestampToMs(1_700_000_000), 1_700_000_000_000);
  assert.equal(normalizeTimestampToMs(1_700_000_000_000), 1_700_000_000_000);
  assert.equal(normalizeTimestampToMs("2023-11-14T22:13:20.000Z"), 1_700_000_000_000);
});

test("redactEventPayload redacts secret-shaped keys and truncates oversized strings", () => {
  const payload: AioRunEvent = {
    type: "tool.started",
    runId: "run-2",
    toolCallId: "call-1",
    toolName: "bash",
    createdAt: "2024-01-01T00:00:00.000Z",
    riskLevel: "dangerous",
    input: {
      api_key: "sk-super-secret",
      password: "hunter2",
      command: "x".repeat(5000),
      safe: "ok",
    },
  };

  const redacted = redactEventPayload(payload) as typeof payload;
  const input = redacted.input as Record<string, unknown>;

  assert.equal(input.api_key, "[redacted]");
  assert.equal(input.password, "[redacted]");
  assert.ok(typeof input.command === "string");
  assert.ok((input.command as string).length < 5000);
  assert.ok((input.command as string).endsWith("[truncated]"));
  assert.equal(input.safe, "ok");
});

test("validateEnvelopeShape reports problems for malformed envelopes", () => {
  const env = createRunEventEnvelope(runCreated, {
    runId: "run-1",
    threadId: "thread-1",
    sequence: 0,
    source: "aio",
    occurredAt: 1_700_000_000,
  });

  const broken = { ...env, sequence: -1, occurredAt: "not-a-date" } as unknown;
  const result = validateEnvelopeShape(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("sequence")));
  assert.ok(result.errors.some((e) => e.includes("occurredAt")));
});

test("validateEnvelopeShape rejects non-objects", () => {
  assert.equal(validateEnvelopeShape(null).ok, false);
  assert.equal(validateEnvelopeShape("nope").ok, false);
});
