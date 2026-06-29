import assert from "node:assert/strict";
import test from "node:test";
import type { AioRunStatus } from "./aio-run-events";
import {
  RUN_STATE_ERROR_CODE,
  canTransition,
  isStoppable,
  isTerminal,
  requestCancel,
  transition,
} from "./run-state-machine";

const ALL_STATUSES: AioRunStatus[] = [
  "queued",
  "running",
  "waiting_approval",
  "cancelling",
  "completed",
  "failed",
  "cancelled",
];

// ADR-001 §3 — the complete set of legal edges.
const ALLOWED: Array<[AioRunStatus, AioRunStatus]> = [
  ["queued", "running"],
  ["queued", "cancelling"],
  ["queued", "failed"],
  ["running", "waiting_approval"],
  ["running", "cancelling"],
  ["running", "failed"],
  ["running", "completed"],
  ["waiting_approval", "running"],
  ["waiting_approval", "cancelling"],
  ["waiting_approval", "failed"],
  ["cancelling", "cancelled"],
];

test("canTransition matches ADR-001 §3 exactly", () => {
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const expected = ALLOWED.some(
        ([f, t]) => f === from && t === to,
      );
      assert.equal(
        canTransition(from, to),
        expected,
        `canTransition(${from}, ${to})`,
      );
    }
  }
});

test("transition succeeds for every allowed edge", () => {
  for (const [from, to] of ALLOWED) {
    const result = transition(from, to);
    assert.equal(result.ok, true, `${from} -> ${to} should be allowed`);
    if (result.ok) {
      assert.equal(result.from, from);
      assert.equal(result.to, to);
    }
  }
});

test("transition rejects forbidden non-terminal edges with INVALID_TRANSITION", () => {
  // queued cannot skip to completed or waiting_approval (must pass through running)
  const skipped = transition("queued", "completed");
  assert.equal(skipped.ok, false);
  if (!skipped.ok) {
    assert.equal(skipped.code, RUN_STATE_ERROR_CODE.INVALID_TRANSITION);
  }

  // cancelling may only become cancelled
  const stray = transition("cancelling", "completed");
  assert.equal(stray.ok, false);
  if (!stray.ok) {
    assert.equal(stray.code, RUN_STATE_ERROR_CODE.INVALID_TRANSITION);
  }

  // cannot go backward running -> queued
  const backward = transition("running", "queued");
  assert.equal(backward.ok, false);
  if (!backward.ok) {
    assert.equal(backward.code, RUN_STATE_ERROR_CODE.INVALID_TRANSITION);
  }
});

test("transition rejects every edge out of a terminal state with ALREADY_TERMINAL", () => {
  const terminal: AioRunStatus[] = ["completed", "failed", "cancelled"];
  for (const from of terminal) {
    for (const to of ALL_STATUSES) {
      const result = transition(from, to);
      assert.equal(result.ok, false, `${from} -> ${to}`);
      if (!result.ok) {
        assert.equal(result.code, RUN_STATE_ERROR_CODE.ALREADY_TERMINAL);
      }
    }
  }
});

test("isTerminal and isStoppable classify states correctly", () => {
  for (const s of ["completed", "failed", "cancelled"] as AioRunStatus[]) {
    assert.equal(isTerminal(s), true);
    assert.equal(isStoppable(s), false);
  }
  for (const s of ["queued", "running", "waiting_approval"] as AioRunStatus[]) {
    assert.equal(isTerminal(s), false);
    assert.equal(isStoppable(s), true);
  }
  assert.equal(isTerminal("cancelling"), false);
  assert.equal(isStoppable("cancelling"), false);
});

test("requestCancel moves stoppable states to cancelling", () => {
  for (const from of ["queued", "running", "waiting_approval"] as AioRunStatus[]) {
    const result = requestCancel(from);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.to, "cancelling");
      assert.equal(result.noop, false);
    }
  }
});

test("requestCancel is idempotent: cancelling -> cancelling (noop)", () => {
  const result = requestCancel("cancelling");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.to, "cancelling");
    assert.equal(result.noop, true);
  }
});

test("requestCancel returns ALREADY_TERMINAL for terminal states", () => {
  for (const from of ["completed", "failed", "cancelled"] as AioRunStatus[]) {
    const result = requestCancel(from);
    assert.equal(result.ok, false, from);
    if (!result.ok) {
      assert.equal(result.code, RUN_STATE_ERROR_CODE.ALREADY_TERMINAL);
    }
  }
});
