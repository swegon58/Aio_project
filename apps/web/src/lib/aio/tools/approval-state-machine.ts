// Approval lifecycle state machine (R2.3). Mirrors tool-call-state-machine.ts.
//
// An approval is `requested` while a sensitive tool call waits on the user, then
// resolves to a terminal state: `approved`, `rejected`, `expired` (TTL lapsed),
// or `cancelled` (the run/tool was cancelled before resolution). Terminals are
// immutable — resolving again is a resolve-once no-op (replay-safe).

import {
  STATE_ERROR_CODE,
  type StateErrorCode,
  createTransitionValidator,
} from "@/lib/aio/shared/state-machine";

export type AioApprovalStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

/** Granular user choice captured on resolution (coarse status is derived). */
export type AioApprovalResolution = "approve" | "reject" | "edit";

export const APPROVAL_STATE_ERROR = STATE_ERROR_CODE;
export type ApprovalStateErrorCode = StateErrorCode;

export type ApprovalStateResult =
  | { ok: true; status: AioApprovalStatus; changed: boolean }
  | { ok: false; code: ApprovalStateErrorCode; message: string };

const TERMINAL = new Set<AioApprovalStatus>([
  "approved",
  "rejected",
  "expired",
  "cancelled",
]);

const EDGES: Record<AioApprovalStatus, readonly AioApprovalStatus[]> = {
  requested: ["approved", "rejected", "expired", "cancelled"],
  approved: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

export function isTerminalApprovalStatus(status: AioApprovalStatus): boolean {
  return TERMINAL.has(status);
}

export function canTransitionApproval(
  from: AioApprovalStatus,
  to: AioApprovalStatus,
): boolean {
  return EDGES[from].includes(to);
}

// Domain-specific transition validator with approval-specific error messages
const validateTransition = createTransitionValidator(TERMINAL, EDGES);

export function transitionApproval(
  from: AioApprovalStatus,
  to: AioApprovalStatus,
): ApprovalStateResult {
  if (from === to) return { ok: true, status: from, changed: false };
  const result = validateTransition(from, to);
  // Override with domain-specific error messages
  if (!result.ok && result.code === STATE_ERROR_CODE.ALREADY_TERMINAL) {
    return {
      ok: false,
      code: result.code,
      message: `Approval is already terminal (${from})`,
    };
  }
  if (!result.ok && result.code === STATE_ERROR_CODE.INVALID_TRANSITION) {
    return {
      ok: false,
      code: result.code,
      message: `Invalid approval transition: ${from} -> ${to}`,
    };
  }
  return { ok: true, status: to, changed: true };
}

/**
 * Map a granular resolution to the coarse durable status. "edit" proceeds (the
 * user altered the action then allowed it), so it records as approved with the
 * granular `edit` choice preserved on the row.
 */
export function resolutionToStatus(
  resolution: AioApprovalResolution,
): "approved" | "rejected" {
  return resolution === "reject" ? "rejected" : "approved";
}
