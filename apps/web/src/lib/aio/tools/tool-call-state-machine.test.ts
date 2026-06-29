import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionToolCall,
  isTerminalToolCallStatus,
  TOOL_CALL_STATE_ERROR,
  transitionToolCall,
  type AioToolCallStatus,
} from "./tool-call-state-machine";

test("tool-call state machine accepts the allowed edges", () => {
  const allowed: Array<[AioToolCallStatus, AioToolCallStatus]> = [
    ["proposed", "waiting_approval"],
    ["proposed", "approved"],
    ["proposed", "running"],
    ["proposed", "denied"],
    ["waiting_approval", "approved"],
    ["waiting_approval", "expired"],
    ["approved", "running"],
    ["running", "completed"],
    ["running", "failed"],
    ["running", "timed_out"],
  ];

  for (const [from, to] of allowed) {
    assert.equal(canTransitionToolCall(from, to), true, `${from} -> ${to}`);
    const result = transitionToolCall(from, to);
    assert.equal(result.ok, true, `${from} -> ${to}`);
  }
});

test("tool-call state machine rejects forbidden edges", () => {
  const result = transitionToolCall("approved", "completed");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, TOOL_CALL_STATE_ERROR.INVALID_TRANSITION);
  }
});

test("terminal tool-call states stay immutable", () => {
  assert.equal(isTerminalToolCallStatus("completed"), true);
  const result = transitionToolCall("completed", "failed");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, TOOL_CALL_STATE_ERROR.ALREADY_TERMINAL);
  }
});

