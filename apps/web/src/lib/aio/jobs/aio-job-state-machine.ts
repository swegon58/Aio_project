import type { AioJobStatus } from "./aio-job-contract";
import {
  STATE_ERROR_CODE,
  type StateErrorCode,
  type TransitionResult as BaseTransitionResult,
  createTransitionValidator,
} from "@/lib/aio/shared/state-machine";

const ALLOWED_TRANSITIONS: Record<AioJobStatus, readonly AioJobStatus[]> = {
  queued: ["claimed", "cancelled", "dead_lettered", "failed"],
  claimed: ["running", "retrying"],
  running: ["completed", "retrying", "cancelled", "dead_lettered", "failed"],
  retrying: ["queued"],
  completed: [],
  cancelled: [],
  dead_lettered: [],
  failed: [],
};

export const TERMINAL_JOB_STATES: ReadonlySet<AioJobStatus> = new Set([
  "completed",
  "cancelled",
  "dead_lettered",
  "failed",
]);

export const AIO_JOB_STATE_ERROR = STATE_ERROR_CODE;
export type AioJobStateErrorCode = StateErrorCode;

export type JobTransitionResult =
  | { ok: true; from: AioJobStatus; to: AioJobStatus; changed: boolean }
  | {
      ok: false;
      from: AioJobStatus;
      to: AioJobStatus;
      code: AioJobStateErrorCode;
      message: string;
    };

export function isTerminalJobStatus(status: AioJobStatus): boolean {
  return TERMINAL_JOB_STATES.has(status);
}

export function canTransitionJob(
  from: AioJobStatus,
  to: AioJobStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// Domain-specific transition validator with job-specific error messages
const validateTransition = createTransitionValidator(TERMINAL_JOB_STATES, ALLOWED_TRANSITIONS);

export function transitionJob(
  from: AioJobStatus,
  to: AioJobStatus,
): JobTransitionResult {
  if (from === to) {
    return { ok: true, from, to, changed: false };
  }
  const result = validateTransition(from, to);
  // Override with domain-specific error message
  if (!result.ok && result.code === STATE_ERROR_CODE.ALREADY_TERMINAL) {
    return {
      ...result,
      message: `Job is already terminal (${from})`,
    };
  }
  if (!result.ok && result.code === STATE_ERROR_CODE.INVALID_TRANSITION) {
    return {
      ...result,
      message: `Invalid job transition: ${from} -> ${to}`,
    };
  }
  return { ok: true, from: from, to: to, changed: true };
}
