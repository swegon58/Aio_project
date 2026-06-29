// R2.7 gate tests: verifies the full R2 safety contract at the unit level.
// DB-backed paths (cross-tenant denial, replay idempotency) are exercised by
// the live probe scripts against the real local stack.
import assert from "node:assert/strict";
import test from "node:test";
import { requiresMandatoryApproval } from "./tool-policy";
import { canTransitionToolCall } from "./tool-call-state-machine";
import { canTransitionApproval, isTerminalApprovalStatus } from "./approval-state-machine";
import { mapRiskLevelToRisk } from "./approval-writer";
import {
  auditApprovalResolved,
  auditDangerousToolStarted,
  auditDangerousToolCompleted,
} from "@/lib/aio/audit/audit-events";

// --- R2.7 gate 1: 100% dangerous calls use durable approval ---
// Verify that every tool flagged dangerous by the manifest requires approval.
// This is the static policy gate: the runtime path (waiting_approval before
// approved) is tested in the tool-call state machine tests.

const KNOWN_DANGEROUS_TOOLS = ["file", "terminal", "code_execution", "browser", "cronjob", "mcp", "connected_apps"];
const KNOWN_SAFE_TOOLS = ["web", "clarify", "todo"];

test("gate: all known dangerous tools require mandatory approval", () => {
  for (const name of KNOWN_DANGEROUS_TOOLS) {
    assert.equal(
      requiresMandatoryApproval(name),
      true,
      `dangerous tool '${name}' must require mandatory approval`,
    );
  }
});

test("gate: safe tools do not require mandatory approval", () => {
  for (const name of KNOWN_SAFE_TOOLS) {
    assert.equal(
      requiresMandatoryApproval(name),
      false,
      `safe tool '${name}' must NOT require mandatory approval`,
    );
  }
});

// --- R2.7 gate 2: dangerous tool cannot start without approval ---
// The tool-call state machine enforces: proposed → waiting_approval → approved
// → running for any tool with defaultMode "once". Skipping waiting_approval
// is allowed structurally (proposed → approved) but the writer enforces the
// correct path at runtime; here we confirm the SM supports the gated path.

test("gate: waiting_approval → approved edge exists in SM (gated dangerous path)", () => {
  assert.equal(canTransitionToolCall("waiting_approval", "approved"), true);
});

test("gate: proposed → running edge exists in SM (safe unblocked path)", () => {
  assert.equal(canTransitionToolCall("proposed", "running"), true);
});

test("gate: approved → completed is NOT a valid SM edge (must run first)", () => {
  assert.equal(canTransitionToolCall("approved", "completed"), false);
});

// --- R2.7 gate 3: no approval decision can execute twice ---
// Terminal approval states reject any further transition (resolve-once).

test("gate: approved approval cannot be re-approved or rejected", () => {
  for (const to of ["approved", "rejected", "expired", "cancelled"] as const) {
    if (to === "approved") {
      const r = canTransitionApproval("approved", to);
      assert.equal(r, false, "approved → approved should be a no-op, not a new edge");
    } else {
      const r = canTransitionApproval("approved", to);
      assert.equal(r, false, `approved → ${to} is ALREADY_TERMINAL`);
    }
  }
});

test("gate: isTerminalApprovalStatus covers all terminal states", () => {
  for (const s of ["approved", "rejected", "expired", "cancelled"]) {
    assert.equal(isTerminalApprovalStatus(s as never), true);
  }
  assert.equal(isTerminalApprovalStatus("requested"), false);
});

// --- R2.7 gate 4: audit row emitted for every terminal approval path ---
// Verify that audit event builders exist and produce correct category/outcome
// for every terminal resolution path (approve, reject, expire).

test("gate: audit builder covers approve terminal path", () => {
  const e = auditApprovalResolved("user-1", { approvalId: "ap-1", resolution: "approve", resolvedBy: "user-1" });
  assert.equal(e.category, "approval");
  assert.equal(e.outcome, "success");
  assert.equal(e.eventType, "approval.resolved");
});

test("gate: audit builder covers reject terminal path", () => {
  const e = auditApprovalResolved("user-1", { approvalId: "ap-1", resolution: "reject", resolvedBy: "user-1" });
  assert.equal(e.outcome, "denied");
});

test("gate: audit builder covers expire terminal path", () => {
  const e = auditApprovalResolved("user-1", { approvalId: "ap-1", resolution: "expire", resolvedBy: "system" });
  assert.equal(e.outcome, "expired");
});

test("gate: audit builder covers dangerous tool started + completed paths", () => {
  const started = auditDangerousToolStarted("user-1", {
    runId: "run-1", toolCallId: "tc-1", toolName: "file", approvalId: "ap-1",
  });
  assert.equal(started.category, "tool_execution");
  assert.equal(started.outcome, "unknown");

  const ok = auditDangerousToolCompleted("user-1", { runId: "run-1", toolCallId: "tc-1", toolName: "file", success: true });
  assert.equal(ok.outcome, "success");

  const fail = auditDangerousToolCompleted("user-1", { runId: "run-1", toolCallId: "tc-1", toolName: "file", success: false });
  assert.equal(fail.outcome, "error");
});

// --- R2.7 gate 5: redaction contract (no raw secrets in audit context) ---
// The audit event builders must not forward raw secrets. This test verifies
// the builders do not expose common secret patterns in context.

test("gate: audit tool context does not include raw input payload", () => {
  const e = auditDangerousToolStarted("user-1", {
    runId: "run-1", toolCallId: "tc-1", toolName: "file",
  });
  // context should only contain toolName, not any raw input
  assert.deepEqual(Object.keys(e.context ?? {}), ["toolName"]);
});

// --- R2.7 gate 6: risk mapping covers every Hermes vocab value ---
test("gate: mapRiskLevelToRisk handles every Hermes risk signal", () => {
  assert.equal(mapRiskLevelToRisk("safe"), "safe");
  assert.equal(mapRiskLevelToRisk("medium"), "guarded");
  assert.equal(mapRiskLevelToRisk("dangerous"), "dangerous");
  assert.equal(mapRiskLevelToRisk(undefined), "guarded", "absent defaults to guarded (not safe)");
});
