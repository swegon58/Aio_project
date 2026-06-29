// Pure unit tests for the tool-call writer's deterministic helpers. The
// DB-backed recordToolCallEvent path is exercised by the live probe in
// scripts/r2-2-tool-call-probe.ts (against the real local stack).
import assert from "node:assert/strict";
import test from "node:test";
import type { AioRunEvent } from "@/lib/aio/runs/aio-run-events";
import {
  buildToolCallCreateInput,
  planToolCallTransition,
  resolveToolCallSnapshot,
  stableToolCallIds,
  toolCallTargetStatus,
} from "./tool-call-writer";

const ctx = { runId: "run-1", customerId: "user-1" };
const ts = () => new Date("2026-06-29T00:00:00.000Z").toISOString();

test("toolCallTargetStatus maps tool events and ignores everything else", () => {
  assert.equal(toolCallTargetStatus({ type: "tool.started", runId: "r", toolCallId: "t1", toolName: "web", createdAt: ts() }), "running");
  assert.equal(toolCallTargetStatus({ type: "tool.completed", runId: "r", toolCallId: "t1", toolName: "web", createdAt: ts() }), "completed");
  assert.equal(toolCallTargetStatus({ type: "tool.failed", runId: "r", toolCallId: "t1", toolName: "web", error: "boom", createdAt: ts() }), "failed");
  assert.equal(
    toolCallTargetStatus({ type: "message.delta", runId: "r", delta: "hi", createdAt: ts() }),
    null,
  );
  assert.equal(toolCallTargetStatus({ type: "run.created", runId: "r", status: "running", createdAt: ts() }), null);
});

test("stableToolCallIds is deterministic and separates product id from idempotency key", () => {
  const a = stableToolCallIds("run-1", "tc-1");
  const b = stableToolCallIds("run-1", "tc-1");
  assert.deepEqual(a, b);
  assert.equal(a.aioToolCallId, "run-1:tc-1");
  assert.equal(a.idempotencyKey, "create:run-1:tc-1");
  // different tool call -> different identities
  assert.notEqual(stableToolCallIds("run-1", "tc-2").aioToolCallId, a.aioToolCallId);
});

test("resolveToolCallSnapshot uses the manifest entry for known tools", () => {
  const web = resolveToolCallSnapshot("web");
  assert.equal(web.risk, "safe");
  assert.equal(web.manifestVersion, 1);
  assert.equal(web.label, "Web Search");
  assert.equal(web.approvalPolicy.defaultMode, "none");
});

test("resolveToolCallSnapshot is conservative for unknown tools", () => {
  const unknown = resolveToolCallSnapshot("not-a-real-tool");
  assert.equal(unknown.risk, "dangerous");
  assert.equal(unknown.approvalPolicy.defaultMode, "once");
  assert.equal(unknown.manifestVersion, 1);
});

test("buildToolCallCreateInput snapshots manifest policy and redactable input", () => {
  const started: AioRunEvent = {
    type: "tool.started",
    runId: ctx.runId,
    toolCallId: "tc-1",
    toolName: "browser",
    input: { url: "https://example.com", password: "hunter2" },
    createdAt: ts(),
  };
  const input = buildToolCallCreateInput(ctx, started as Extract<AioRunEvent, { type: "tool.started" }>);
  assert.equal(input.aioToolCallId, "run-1:tc-1");
  assert.equal(input.hermesToolCallId, "tc-1");
  assert.equal(input.toolName, "browser");
  assert.equal(input.risk, "dangerous");
  assert.equal(input.approvalPolicy.defaultMode, "once");
  assert.equal(input.manifestVersion, 1);
  assert.equal(input.toolLabel, "Browser Automation");
  // input is passed through; the repository redacts before persisting
  assert.deepEqual(input.redactedInput, { url: "https://example.com", password: "hunter2" });
});

test("buildToolCallCreateInput omits input for completed/failed events", () => {
  const completed: AioRunEvent = {
    type: "tool.completed",
    runId: ctx.runId,
    toolCallId: "tc-1",
    toolName: "web",
    output: { hits: 3 },
    createdAt: ts(),
  };
  const input = buildToolCallCreateInput(ctx, completed as Extract<AioRunEvent, { type: "tool.completed" }>);
  assert.equal(input.redactedInput, undefined);
});

test("planToolCallTransition maps each tool event to a status and patch", () => {
  const started = planToolCallTransition({
    type: "tool.started",
    runId: ctx.runId,
    toolCallId: "tc-1",
    toolName: "web",
    createdAt: ts(),
  } as Extract<AioRunEvent, { type: "tool.started" }>);
  assert.equal(started.to, "running");
  assert.equal(started.patch.hermesToolCallId, "tc-1");

  const completed = planToolCallTransition({
    type: "tool.completed",
    runId: ctx.runId,
    toolCallId: "tc-1",
    toolName: "web",
    output: { hits: 3 },
    createdAt: ts(),
  } as Extract<AioRunEvent, { type: "tool.completed" }>);
  assert.equal(completed.to, "completed");
  assert.deepEqual(completed.patch.redactedOutput, { hits: 3 });

  const failed = planToolCallTransition({
    type: "tool.failed",
    runId: ctx.runId,
    toolCallId: "tc-1",
    toolName: "web",
    error: "boom",
    createdAt: ts(),
  } as Extract<AioRunEvent, { type: "tool.failed" }>);
  assert.equal(failed.to, "failed");
  assert.equal(failed.patch.errorCode, "tool_error");
  assert.equal(failed.patch.errorMessageRedacted, "boom");
});
