// Approval lifecycle state machine (R2.3). Mirrors tool-call-state-machine.ts.
//
// An approval is `requested` while a sensitive tool call waits on the user, then
// resolves to a terminal state: `approved`, `rejected`, `expired` (TTL lapsed),
// or `cancelled` (the run/tool was cancelled before resolution). Terminals are
// immutable — resolving again is a resolve-once no-op (replay-safe).

export type AioApprovalStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

/** Granular user choice captured on resolution (coarse status is derived). */
export type AioApprovalResolution = "approve" | "reject" | "edit";

export const APPROVAL_STATE_ERROR = {
  INVALID_TRANSITION: "INVALID_TRANSITION",
  ALREADY_TERMINAL: "ALREADY_TERMINAL",
} as const;

export type ApprovalStateErrorCode =
  (typeof APPROVAL_STATE_ERROR)[keyof typeof APPROVAL_STATE_ERROR];

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

export function transitionApproval(
  from: AioApprovalStatus,
  to: AioApprovalStatus,
): ApprovalStateResult {
  if (from === to) return { ok: true, status: from, changed: false };
  if (isTerminalApprovalStatus(from)) {
    return {
      ok: false,
      code: APPROVAL_STATE_ERROR.ALREADY_TERMINAL,
      message: `Approval is already terminal (${from})`,
    };
  }
  if (!canTransitionApproval(from, to)) {
    return {
      ok: false,
      code: APPROVAL_STATE_ERROR.INVALID_TRANSITION,
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
