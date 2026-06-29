// Pure unit tests for the approval lifecycle state machine (R2.3). The
// DB-backed resolve path is exercised by the live probe in
// scripts/r2-3-approval-probe.ts against the real local stack.
import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVAL_STATE_ERROR,
  canTransitionApproval,
  isTerminalApprovalStatus,
  resolutionToStatus,
  transitionApproval,
} from "./approval-state-machine";

test("transitionApproval resolves requested to every terminal", () => {
  for (const to of ["approved", "rejected", "expired", "cancelled"] as const) {
    const r = transitionApproval("requested", to);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.status, to);
      assert.equal(r.changed, true);
    }
  }
});

test("transitionApproval same status is a resolve-once no-op (changed:false)", () => {
  for (const s of ["requested", "approved", "rejected", "expired", "cancelled"] as const) {
    const r = transitionApproval(s, s);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.status, s);
      assert.equal(r.changed, false, `${s}->${s} must be a no-op`);
    }
  }
});

test("transitionApproval from a terminal status is rejected as ALREADY_TERMINAL", () => {
  for (const terminal of ["approved", "rejected", "expired", "cancelled"] as const) {
    for (const to of ["requested", "approved", "rejected", "expired", "cancelled"] as const) {
      if (to === terminal) continue; // same-status no-op handled above
      const r = transitionApproval(terminal, to);
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, APPROVAL_STATE_ERROR.ALREADY_TERMINAL);
    }
  }
});

test("canTransitionApproval and isTerminalApprovalStatus agree with the edges", () => {
  assert.equal(isTerminalApprovalStatus("requested"), false);
  for (const terminal of ["approved", "rejected", "expired", "cancelled"]) {
    assert.equal(isTerminalApprovalStatus(terminal as never), true);
  }
  // requested can reach each terminal; terminals reach nothing new
  for (const to of ["approved", "rejected", "expired", "cancelled"] as const) {
    assert.equal(canTransitionApproval("requested", to), true);
  }
  assert.equal(canTransitionApproval("approved", "rejected"), false);
});

test("resolutionToStatus maps the granular choice to the coarse status", () => {
  assert.equal(resolutionToStatus("approve"), "approved");
  assert.equal(resolutionToStatus("reject"), "rejected");
  // edit proceeds as approved; the granular choice is preserved on the row
  assert.equal(resolutionToStatus("edit"), "approved");
});
