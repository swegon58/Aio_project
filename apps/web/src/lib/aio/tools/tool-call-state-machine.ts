import {
  STATE_ERROR_CODE,
  type StateErrorCode,
  createTransitionValidator,
} from "@/lib/aio/shared/state-machine";

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

export const TOOL_CALL_STATE_ERROR = STATE_ERROR_CODE;
export type ToolCallStateErrorCode = StateErrorCode;

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

// Domain-specific transition validator with tool-call-specific error messages
const validateTransition = createTransitionValidator(TERMINAL, EDGES);

export function transitionToolCall(
  from: AioToolCallStatus,
  to: AioToolCallStatus,
): ToolCallStateResult {
  if (from === to) return { ok: true, status: from, changed: false };
  const result = validateTransition(from, to);
  // Override with domain-specific error messages
  if (!result.ok && result.code === STATE_ERROR_CODE.ALREADY_TERMINAL) {
    return {
      ok: false,
      code: result.code,
      message: `Tool call is already terminal (${from})`,
    };
  }
  if (!result.ok && result.code === STATE_ERROR_CODE.INVALID_TRANSITION) {
    return {
      ok: false,
      code: result.code,
      message: `Invalid tool-call transition: ${from} -> ${to}`,
    };
  }
  return { ok: true, status: to, changed: true };
}

