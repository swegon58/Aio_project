// Aio run state machine — the single source of truth for which lifecycle
// transitions are legal. Encodes ADR-001 §3. This module is pure logic: it
// takes a status and a desired transition and returns whether it is allowed.
// The R1.4 repositories call these functions before persisting any status
// change, so `aio_runs.status` in Postgres never reaches an illegal state.
//
// `aio_runs.status` is the source of truth (ADR-001 §3). The `status` field
// embedded in a run/terminal event is only an informational projection; no
// transition is ever implied by UI state alone.
//
// Terminal states (completed / failed / cancelled) are immutable except by
// administrative repair, which must write an explicit audit record. This module
// rejects every transition out of a terminal state with ALREADY_TERMINAL; the
// administrative repair path lives in the repository and is not modeled here.

import type { AioRunStatus } from "./aio-run-events";
import {
  STATE_ERROR_CODE,
  type StateErrorCode,
  type TransitionResult as BaseTransitionResult,
  createTransitionValidator,
} from "@/lib/aio/shared/state-machine";

/** States that can be reached from `from`. The only legal edges (ADR-001 §3). */
const ALLOWED_TRANSITIONS: Record<AioRunStatus, readonly AioRunStatus[]> = {
  queued: ["running", "cancelling", "failed"],
  running: ["waiting_approval", "cancelling", "failed", "completed"],
  waiting_approval: ["running", "cancelling", "failed"],
  cancelling: ["cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

/** Terminal states: immutable except administrative repair with an audit record. */
export const TERMINAL_STATES: ReadonlySet<AioRunStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

/** States from which a user `stop` request is accepted (ADR-001 §6). */
export const STOPPABLE_STATES: ReadonlySet<AioRunStatus> = new Set([
  "queued",
  "running",
  "waiting_approval",
]);

/**
 * Stable internal codes for run-state errors. These are the contract the
 * repositories and APIs surface; messages are informational only.
 */
export const RUN_STATE_ERROR_CODE = STATE_ERROR_CODE;
export type RunStateErrorCode = StateErrorCode;

export function isTerminal(status: AioRunStatus): boolean {
  return TERMINAL_STATES.has(status);
}

export function isStoppable(status: AioRunStatus): boolean {
  return STOPPABLE_STATES.has(status);
}

/** Whether the `from -> to` edge is legal. Terminal `from` always returns false. */
export function canTransition(
  from: AioRunStatus,
  to: AioRunStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export type TransitionResult = BaseTransitionResult<AioRunStatus>;

// Domain-specific transition validator with run-specific error messages
const validateTransition = createTransitionValidator(TERMINAL_STATES, ALLOWED_TRANSITIONS);

/**
 * Validate a normal `from -> to` lifecycle transition. Never allows leaving a
 * terminal state (returns ALREADY_TERMINAL). Returns the resolved target on
 * success or a stable error code otherwise.
 */
export function transition(
  from: AioRunStatus,
  to: AioRunStatus,
): TransitionResult {
  const result = validateTransition(from, to);
  // Override with domain-specific error message for terminal states
  if (!result.ok && result.code === STATE_ERROR_CODE.ALREADY_TERMINAL) {
    return {
      ...result,
      message: `Run is in terminal state "${from}"; no transition allowed except administrative repair with an audit record.`,
    };
  }
  return result;
}

export type CancelResult =
  | { ok: true; from: AioRunStatus; to: "cancelling"; noop: boolean }
  | { ok: false; from: AioRunStatus; code: RunStateErrorCode; message: string };

/**
 * Resolve a user `stop` request. Idempotent (ADR-001 §6):
 * - stoppable (queued / running / waiting_approval) -> cancelling
 * - cancelling already -> cancelling (no-op, not an error)
 * - terminal -> ALREADY_TERMINAL (safe to retry)
 */
export function requestCancel(from: AioRunStatus): CancelResult {
  if (isTerminal(from)) {
    return {
      ok: false,
      from,
      code: RUN_STATE_ERROR_CODE.ALREADY_TERMINAL,
      message: `Run already terminal ("${from}"); stop is a no-op.`,
    };
  }
  if (from === "cancelling") {
    return { ok: true, from, to: "cancelling", noop: true };
  }
  return { ok: true, from, to: "cancelling", noop: false };
}
