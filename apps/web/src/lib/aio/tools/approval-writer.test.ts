// Pure unit tests for the approval writer's deterministic helpers. The
// DB-backed recordApprovalEvent path is exercised by the live probe in
// scripts/r2-3-approval-probe.ts (against the real local stack).
import assert from "node:assert/strict";
import test from "node:test";
import type { AioRunEvent } from "@/lib/aio/runs/aio-run-events";
import {
  DEFAULT_APPROVAL_TTL_MS,
  approvalRespondedResolution,
  buildRequestApprovalInput,
  defaultApprovalExpiresAt,
  mapRiskLevelToRisk,
  stableApprovalIds,
} from "./approval-writer";

const ctx = { runId: "run-1", customerId: "user-1" };
const ts = () => new Date("2026-06-29T00:00:00.000Z").toISOString();

test("mapRiskLevelToRisk normalizes the Hermes vocab to the durable vocab", () => {
  assert.equal(mapRiskLevelToRisk("safe"), "safe");
  assert.equal(mapRiskLevelToRisk("dangerous"), "dangerous");
  assert.equal(mapRiskLevelToRisk("medium"), "guarded");
  assert.equal(mapRiskLevelToRisk(undefined), "guarded", "absent signal defaults to guarded");
});

test("approvalRespondedResolution maps each responded status to a resolution", () => {
  assert.equal(approvalRespondedResolution("approved"), "approve");
  assert.equal(approvalRespondedResolution("rejected"), "reject");
  assert.equal(approvalRespondedResolution("edited"), "edit");
});

test("stableApprovalIds is deterministic and scoped to the request identity", () => {
  const a = stableApprovalIds("run-1", "ap-1");
  const b = stableApprovalIds("run-1", "ap-1");
  assert.deepEqual(a, b);
  assert.equal(a.idempotencyKey, "request:run-1:ap-1");
  assert.notEqual(stableApprovalIds("run-1", "ap-2").idempotencyKey, a.idempotencyKey);
});

test("defaultApprovalExpiresAt adds the TTL to the occurred-at time", () => {
  const occurred = ts();
  const expires = defaultApprovalExpiresAt(occurred);
  const delta = Date.parse(expires) - Date.parse(occurred);
  assert.equal(delta, DEFAULT_APPROVAL_TTL_MS);
});

test("buildRequestApprovalInput snapshots risk, redactable input, title, and TTL", () => {
  const requested: AioRunEvent = {
    type: "approval.requested",
    runId: ctx.runId,
    approvalId: "ap-1",
    toolCallId: "run-1:tc-1",
    title: "Run shell command",
    command: "rm -rf /tmp/cache",
    payload: { cwd: "/tmp", token: "sk-live-abc" },
    riskLevel: "dangerous",
    createdAt: ts(),
  };
  const input = buildRequestApprovalInput(
    ctx,
    requested as Extract<AioRunEvent, { type: "approval.requested" }>,
  );
  assert.equal(input.aioApprovalId, "ap-1");
  assert.equal(input.aioToolCallId, "run-1:tc-1");
  assert.equal(input.risk, "dangerous");
  assert.equal(input.approvalMode, "once");
  assert.equal(input.title, "Run shell command", "title wins over command");
  assert.equal(input.idempotencyKey, "request:run-1:ap-1");
  assert.equal(
    Date.parse(input.expiresAt) - Date.parse(ts()),
    DEFAULT_APPROVAL_TTL_MS,
  );
  // payload is forwarded; the repository redacts before persisting
  assert.deepEqual(input.requestedInput, { cwd: "/tmp", token: "sk-live-abc" });
});

test("buildRequestApprovalInput falls back to command for title/input and defaults risk", () => {
  const requested: AioRunEvent = {
    type: "approval.requested",
    runId: ctx.runId,
    approvalId: "ap-2",
    command: "git push",
    createdAt: ts(),
  };
  const input = buildRequestApprovalInput(
    ctx,
    requested as Extract<AioRunEvent, { type: "approval.requested" }>,
  );
  assert.equal(input.title, "git push", "command used as title when title absent");
  assert.equal(input.requestedInput, "git push", "command used as input when payload absent");
  assert.equal(input.risk, "guarded", "absent riskLevel defaults to guarded");
  assert.equal(input.aioToolCallId, null);
});
