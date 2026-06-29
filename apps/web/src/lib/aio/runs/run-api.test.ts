import assert from "node:assert/strict";
import test from "node:test";
import { parseBoundedInt, repoErrorResponse, serializeRun, serializeRunEvent } from "./run-api";
import { REPO_ERROR_CODE, type AioRunRow } from "./run-repository";
import type { AioRunEventRow } from "./run-event-repository";

test("parseBoundedInt returns defaults, accepts in-range integers, and rejects invalid input", () => {
  const options = { defaultValue: 25, min: 1, max: 100 };

  assert.equal(parseBoundedInt(null, options), 25);
  assert.equal(parseBoundedInt("", options), 25);
  assert.equal(parseBoundedInt("1", options), 1);
  assert.equal(parseBoundedInt("100", options), 100);
  assert.equal(parseBoundedInt("0", options), null);
  assert.equal(parseBoundedInt("101", options), null);
  assert.equal(parseBoundedInt("1.5", options), null);
  assert.equal(parseBoundedInt("12px", options), null);
  assert.equal(parseBoundedInt("nope", options), null);
});

test("repoErrorResponse maps repository errors to stable HTTP statuses and payloads", async () => {
  const badCursor = repoErrorResponse({
    ok: false,
    code: REPO_ERROR_CODE.BAD_CURSOR,
    message: "bad cursor",
  });
  assert.equal(badCursor.status, 400);
  assert.deepEqual(await badCursor.json(), {
    error: "bad_cursor",
    code: "BAD_CURSOR",
    message: "bad cursor",
  });

  const notFound = repoErrorResponse({
    ok: false,
    code: REPO_ERROR_CODE.RUN_NOT_FOUND,
    message: "missing",
  });
  assert.equal(notFound.status, 404);

  const terminal = repoErrorResponse({
    ok: false,
    code: REPO_ERROR_CODE.ALREADY_TERMINAL,
    message: "done",
  });
  assert.equal(terminal.status, 409);

  const dbError = repoErrorResponse({
    ok: false,
    code: REPO_ERROR_CODE.DB_ERROR,
    message: "boom",
  });
  assert.equal(dbError.status, 500);
});

test("serializeRun and serializeRunEvent return the public API shape", () => {
  const runRow: AioRunRow = {
    id: "run-1",
    customer_id: "cust-1",
    conversation_id: "conv-1",
    thread_id: "thread-1",
    status: "running",
    mode: "deep_research",
    input_summary: "hello",
    hermes_run_id: "hermes-run-1",
    hermes_session_id: "session-1",
    reserved_credits: 3,
    actual_credits: 2,
    error_code: null,
    error_message_redacted: null,
    created_at: "2026-06-28T00:00:00.000Z",
    started_at: "2026-06-28T00:00:01.000Z",
    updated_at: "2026-06-28T00:00:02.000Z",
    completed_at: null,
    cancel_requested_at: null,
    metadata: { mode: "deep_research" },
  };

  assert.deepEqual(serializeRun(runRow), {
    id: "run-1",
    customerId: "cust-1",
    conversationId: "conv-1",
    threadId: "thread-1",
    status: "running",
    mode: "deep_research",
    inputSummary: "hello",
    hermesRunId: "hermes-run-1",
    hermesSessionId: "session-1",
    reservedCredits: 3,
    actualCredits: 2,
    errorCode: null,
    errorMessageRedacted: null,
    createdAt: "2026-06-28T00:00:00.000Z",
    startedAt: "2026-06-28T00:00:01.000Z",
    updatedAt: "2026-06-28T00:00:02.000Z",
    completedAt: null,
    cancelRequestedAt: null,
    metadata: { mode: "deep_research" },
  });

  const eventRow: AioRunEventRow = {
    id: "evt-1",
    schema_version: 1,
    run_id: "run-1",
    customer_id: "cust-1",
    sequence: 7,
    type: "message.delta",
    occurred_at: "2026-06-28T00:00:03.000Z",
    received_at: "2026-06-28T00:00:04.000Z",
    source: "hermes",
    payload: {
      type: "message.delta",
      runId: "run-1",
      createdAt: "2026-06-28T00:00:03.000Z",
      ts: 1_719_532_803_000,
      delta: "hello",
    },
    hermes: { runId: "hermes-run-1", eventId: "source-1" },
  };

  assert.deepEqual(serializeRunEvent(eventRow), {
    id: "evt-1",
    schemaVersion: 1,
    runId: "run-1",
    customerId: "cust-1",
    sequence: 7,
    type: "message.delta",
    occurredAt: "2026-06-28T00:00:03.000Z",
    receivedAt: "2026-06-28T00:00:04.000Z",
    source: "hermes",
    payload: eventRow.payload,
    hermes: { runId: "hermes-run-1", eventId: "source-1" },
  });
});
