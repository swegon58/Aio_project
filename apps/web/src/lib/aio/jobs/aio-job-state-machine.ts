import type { AioJobStatus } from "./aio-job-contract";

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

export const AIO_JOB_STATE_ERROR = {
  INVALID_TRANSITION: "INVALID_TRANSITION",
  ALREADY_TERMINAL: "ALREADY_TERMINAL",
} as const;

export type AioJobStateErrorCode =
  (typeof AIO_JOB_STATE_ERROR)[keyof typeof AIO_JOB_STATE_ERROR];

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

export function transitionJob(
  from: AioJobStatus,
  to: AioJobStatus,
): JobTransitionResult {
  if (from === to) {
    return { ok: true, from, to, changed: false };
  }
  if (isTerminalJobStatus(from)) {
    return {
      ok: false,
      from,
      to,
      code: AIO_JOB_STATE_ERROR.ALREADY_TERMINAL,
      message: `Job is already terminal (${from})`,
    };
  }
  if (!canTransitionJob(from, to)) {
    return {
      ok: false,
      from,
      to,
      code: AIO_JOB_STATE_ERROR.INVALID_TRANSITION,
      message: `Invalid job transition: ${from} -> ${to}`,
    };
  }
  return { ok: true, from, to, changed: true };
}
