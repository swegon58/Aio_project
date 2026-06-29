import assert from "node:assert/strict";
import test from "node:test";

import {
  AIO_JOB_SCHEMA_VERSION,
  createAioJobEnvelope,
} from "./aio-job-contract";
import {
  AIO_JOB_STATE_ERROR,
  canTransitionJob,
  isTerminalJobStatus,
  transitionJob,
} from "./aio-job-state-machine";

test("createAioJobEnvelope builds a queued V1 envelope with normalized timestamps", () => {
  const envelope = createAioJobEnvelope({
    id: "job-1",
    type: "knowledge_ingest",
    tenantId: "tenant-1",
    runId: "run-1",
    scheduledFor: 1_719_696_000,
    deadlineAt: "2026-07-01T00:00:00.000Z",
    createdAt: "2026-06-29T09:00:00.000Z",
    payloadRef: {
      kind: "inline",
      redacted: true,
      preview: { filename: "report.pdf" },
    },
    correlation: {
      userId: "user-1",
      conversationId: "conversation-1",
      threadId: "thread-1",
    },
  });

  assert.equal(envelope.id, "job-1");
  assert.equal(envelope.schemaVersion, AIO_JOB_SCHEMA_VERSION);
  assert.equal(envelope.status, "queued");
  assert.equal(envelope.scheduledFor, "2024-06-29T21:20:00.000Z");
  assert.equal(envelope.deadlineAt, "2026-07-01T00:00:00.000Z");
  assert.equal(envelope.createdAt, "2026-06-29T09:00:00.000Z");
  assert.equal(envelope.correlation.runId, "run-1");
  assert.equal(envelope.correlation.userId, "user-1");
});

test("createAioJobEnvelope derives a stable default idempotency key", () => {
  const envelope = createAioJobEnvelope({
    id: "job-2",
    type: "scheduled_task",
    tenantId: "tenant-2",
    scheduledFor: "2026-06-29T10:00:00.000Z",
  });

  assert.equal(
    envelope.idempotencyKey,
    "scheduled_task:tenant-2:no-run:2026-06-29T10:00:00.000Z",
  );
});

test("canTransitionJob allows only the R5.2 queue edges", () => {
  assert.equal(canTransitionJob("queued", "claimed"), true);
  assert.equal(canTransitionJob("claimed", "running"), true);
  assert.equal(canTransitionJob("running", "retrying"), true);
  assert.equal(canTransitionJob("retrying", "queued"), true);
  assert.equal(canTransitionJob("queued", "running"), false);
  assert.equal(canTransitionJob("claimed", "completed"), false);
  assert.equal(canTransitionJob("completed", "queued"), false);
});

test("transitionJob returns changed=false for a replayed same-state write", () => {
  const result = transitionJob("queued", "queued");
  assert.deepEqual(result, {
    ok: true,
    from: "queued",
    to: "queued",
    changed: false,
  });
});

test("transitionJob rejects invalid edges with a stable error code", () => {
  const result = transitionJob("queued", "completed");
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, AIO_JOB_STATE_ERROR.INVALID_TRANSITION);
});

test("transitionJob rejects every edge out of terminal states", () => {
  for (const status of ["completed", "cancelled", "dead_lettered", "failed"] as const) {
    assert.equal(isTerminalJobStatus(status), true);
    const result = transitionJob(status, "queued");
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.code, AIO_JOB_STATE_ERROR.ALREADY_TERMINAL);
  }
});
