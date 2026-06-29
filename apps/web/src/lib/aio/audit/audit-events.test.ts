import test from "node:test";
import assert from "node:assert/strict";
import {
  auditApprovalRequested,
  auditApprovalResolved,
  auditApprovalExpired,
  auditApprovalConflict,
  auditDangerousToolStarted,
  auditDangerousToolCompleted,
  auditMcpServerEnabled,
  auditMcpToolCall,
  auditCredentialAccessed,
  auditCredentialChanged,
} from "./audit-events";

const USER = "user-123";
const RUN = "run-abc";
const APPROVAL = "approval-xyz";
const TOOL_CALL = "tc-001";

test("auditApprovalRequested produces approval category entry with unknown outcome", () => {
  const e = auditApprovalRequested(USER, { runId: RUN, approvalId: APPROVAL, riskLevel: "dangerous" });
  assert.equal(e.category, "approval");
  assert.equal(e.eventType, "approval.requested");
  assert.equal(e.outcome, "unknown");
  assert.equal(e.approvalId, APPROVAL);
  assert.equal(e.runId, RUN);
  assert.equal(e.context?.riskLevel, "dangerous");
});

test("auditApprovalResolved maps resolution to correct outcome", () => {
  const approve = auditApprovalResolved(USER, { approvalId: APPROVAL, resolution: "approve", resolvedBy: USER });
  assert.equal(approve.outcome, "success");

  const reject = auditApprovalResolved(USER, { approvalId: APPROVAL, resolution: "reject", resolvedBy: USER });
  assert.equal(reject.outcome, "denied");

  const expire = auditApprovalResolved(USER, { approvalId: APPROVAL, resolution: "expire", resolvedBy: USER });
  assert.equal(expire.outcome, "expired");
});

test("auditApprovalExpired produces expired outcome", () => {
  const e = auditApprovalExpired(USER, { approvalId: APPROVAL, runId: RUN });
  assert.equal(e.outcome, "expired");
  assert.equal(e.eventType, "approval.expired");
});

test("auditApprovalConflict produces conflict outcome", () => {
  const e = auditApprovalConflict(USER, { approvalId: APPROVAL, attempted: "approve" });
  assert.equal(e.outcome, "conflict");
  assert.equal(e.context?.attempted, "approve");
});

test("auditDangerousToolStarted records tool_execution category", () => {
  const e = auditDangerousToolStarted(USER, {
    runId: RUN, toolCallId: TOOL_CALL, toolName: "file", approvalId: APPROVAL,
  });
  assert.equal(e.category, "tool_execution");
  assert.equal(e.context?.toolName, "file");
  assert.equal(e.approvalId, APPROVAL);
  assert.equal(e.outcome, "unknown");
});

test("auditDangerousToolCompleted records success/error outcome", () => {
  const ok = auditDangerousToolCompleted(USER, { runId: RUN, toolCallId: TOOL_CALL, toolName: "terminal", success: true });
  assert.equal(ok.outcome, "success");

  const fail = auditDangerousToolCompleted(USER, { runId: RUN, toolCallId: TOOL_CALL, toolName: "terminal", success: false });
  assert.equal(fail.outcome, "error");
});

test("auditMcpServerEnabled records mcp category", () => {
  const e = auditMcpServerEnabled(USER, { serverName: "filesystem" });
  assert.equal(e.category, "mcp");
  assert.equal(e.outcome, "success");
});

test("auditMcpToolCall records tool name and outcome", () => {
  const e = auditMcpToolCall(USER, { serverName: "filesystem", toolName: "read_file", outcome: "success" });
  assert.equal(e.context?.toolName, "read_file");
  assert.equal(e.outcome, "success");
});

test("auditCredentialAccessed records credential category with redacted ref", () => {
  const e = auditCredentialAccessed(USER, { credentialRef: "openai-key-ref", purpose: "model_call" });
  assert.equal(e.category, "credential");
  assert.equal(e.context?.credentialRef, "openai-key-ref");
  assert.equal(e.context?.purpose, "model_call");
});

test("auditCredentialChanged records create/update/delete actions", () => {
  for (const action of ["create", "update", "delete"] as const) {
    const e = auditCredentialChanged(USER, { credentialRef: "key-ref", action });
    assert.equal(e.category, "credential");
    assert.equal(e.context?.action, action);
  }
});

test("no audit entry builder leaks userId into context", () => {
  const e = auditApprovalRequested(USER, { runId: RUN, approvalId: APPROVAL });
  assert.equal(e.context?.userId, undefined);
  assert.equal(e.context?.user_id, undefined);
});
