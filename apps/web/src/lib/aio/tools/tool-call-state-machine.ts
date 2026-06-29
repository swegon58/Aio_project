export type AioToolCallStatus =
  | "proposed"
  | "waiting_approval"
  | "approved"
  | "running"
  | "completed"
  | "denied"
  | "expired"
  | "cancelled"
  | "failed"
  | "timed_out";

export const TOOL_CALL_STATE_ERROR = {
  INVALID_TRANSITION: "INVALID_TRANSITION",
  ALREADY_TERMINAL: "ALREADY_TERMINAL",
} as const;

export type ToolCallStateErrorCode =
  (typeof TOOL_CALL_STATE_ERROR)[keyof typeof TOOL_CALL_STATE_ERROR];

export type ToolCallStateResult =
  | { ok: true; status: AioToolCallStatus; changed: boolean }
  | { ok: false; code: ToolCallStateErrorCode; message: string };

const TERMINAL = new Set<AioToolCallStatus>([
  "completed",
  "denied",
  "expired",
  "cancelled",
  "failed",
  "timed_out",
]);

const EDGES: Record<AioToolCallStatus, readonly AioToolCallStatus[]> = {
  proposed: ["waiting_approval", "approved", "running", "denied", "expired", "cancelled"],
  waiting_approval: ["approved", "denied", "expired", "cancelled"],
  approved: ["running", "cancelled"],
  running: ["completed", "failed", "timed_out", "cancelled"],
  completed: [],
  denied: [],
  expired: [],
  cancelled: [],
  failed: [],
  timed_out: [],
};

export function isTerminalToolCallStatus(status: AioToolCallStatus): boolean {
  return TERMINAL.has(status);
}

export function canTransitionToolCall(
  from: AioToolCallStatus,
  to: AioToolCallStatus,
): boolean {
  return EDGES[from].includes(to);
}

export function transitionToolCall(
  from: AioToolCallStatus,
  to: AioToolCallStatus,
): ToolCallStateResult {
  if (from === to) return { ok: true, status: from, changed: false };
  if (isTerminalToolCallStatus(from)) {
    return {
      ok: false,
      code: TOOL_CALL_STATE_ERROR.ALREADY_TERMINAL,
      message: `Tool call is already terminal (${from})`,
    };
  }
  if (!canTransitionToolCall(from, to)) {
    return {
      ok: false,
      code: TOOL_CALL_STATE_ERROR.INVALID_TRANSITION,
      message: `Invalid tool-call transition: ${from} -> ${to}`,
    };
  }
  return { ok: true, status: to, changed: true };
}

