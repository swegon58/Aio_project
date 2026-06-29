// Best-effort durable approval recording for the Aio run stream (R2.3).
//
// Maps AioRunEvent `approval.*` events into approval repository request/resolve
// calls so every approval in a run is persisted with a risk snapshot, redacted
// requested input, and a TTL — and so the durable approval state mirrors the
// shared Hermes event stream the UI already consumes. Idempotent across replay
// and best-effort (logs failures, never throws).
//
// Two events drive this writer:
//   - approval.requested  -> requestApproval (idempotent create, status requested)
//   - approval.responded  -> resolveApproval (resolve-once; safe even if the
//                            primary resolve already came through the API route)
//
// The API resolve route (R2.3) remains the canonical, user-driven resolution
// path; this writer guarantees durable state stays consistent with what Hermes
// reports, regardless of which channel carried the response. resolve-once makes
// the two paths race-safe.
//
// Durability contract matches `recordToolCallEvent` (R2.2) and `persistEvent`
// (R1.5): best-effort, logs and swallows repository errors so a persistence
// hiccup can never mask the run's primary outcome.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AioRunEvent, AioRiskLevel } from "@/lib/aio/runs/aio-run-events";
import type { AioToolRisk } from "./tool-manifest";
import {
  requestApproval,
  resolveApproval,
  type RequestApprovalInput,
} from "./approval-repository";
import type { AioApprovalResolution } from "./approval-state-machine";

export interface ApprovalContext {
  runId: string;
  customerId: string;
}

/** Default approval TTL: a requested approval expires after 5 minutes. */
export const DEFAULT_APPROVAL_TTL_MS = 5 * 60 * 1000;

/**
 * Map the Hermes event risk vocab (safe/medium/dangerous) to the durable
 * manifest risk vocab (safe/guarded/dangerous). Absent signal defaults to
 * `guarded`: an approval was requested (so not trivially safe), but without an
 * explicit dangerous signal we do not over-elevate.
 */
export function mapRiskLevelToRisk(riskLevel?: AioRiskLevel): AioToolRisk {
  switch (riskLevel) {
    case "safe":
      return "safe";
    case "dangerous":
      return "dangerous";
    case "medium":
    default:
      return "guarded";
  }
}

/** Map an approval.responded event to its granular resolution choice. */
export function approvalRespondedResolution(
  status: "approved" | "rejected" | "edited",
): AioApprovalResolution {
  switch (status) {
    case "approved":
      return "approve";
    case "rejected":
      return "reject";
    case "edited":
      return "edit";
  }
}

/**
 * Stable idempotency identity for a request, derived from the (runId, approvalId)
 * pair so a replayed approval.requested resolves to the exact same row.
 */
export function stableApprovalIds(runId: string, approvalId: string): {
  idempotencyKey: string;
} {
  const base = `${runId}:${approvalId}`;
  return { idempotencyKey: `request:${base}` };
}

/** Compute the expiry timestamp for a request from its occurred-at time. */
export function defaultApprovalExpiresAt(occurredAt: string): string {
  const base = Date.parse(occurredAt);
  const ts = Number.isNaN(base) ? Date.now() : base;
  return new Date(ts + DEFAULT_APPROVAL_TTL_MS).toISOString();
}

type ApprovalRequestedEvent = Extract<AioRunEvent, { type: "approval.requested" }>;

export function buildRequestApprovalInput(
  ctx: ApprovalContext,
  event: ApprovalRequestedEvent,
): RequestApprovalInput {
  const ids = stableApprovalIds(ctx.runId, event.approvalId);
  return {
    aioApprovalId: event.approvalId,
    runId: ctx.runId,
    customerId: ctx.customerId,
    aioToolCallId: event.toolCallId ?? null,
    risk: mapRiskLevelToRisk(event.riskLevel),
    approvalMode: "once",
    title: event.title ?? event.command ?? null,
    requestedInput: event.payload ?? event.command ?? null,
    expiresAt: defaultApprovalExpiresAt(event.createdAt),
    idempotencyKey: ids.idempotencyKey,
  };
}

/**
 * Record an `approval.*` event durably. No-op for non-approval events. Idempotent
 * across replay and best-effort (logs failures, never throws).
 */
export async function recordApprovalEvent(
  db: SupabaseClient,
  ctx: ApprovalContext,
  event: AioRunEvent,
): Promise<void> {
  if (event.type !== "approval.requested" && event.type !== "approval.responded") {
    return;
  }

  try {
    if (event.type === "approval.requested") {
      const input = buildRequestApprovalInput(ctx, event);
      const res = await requestApproval(db, input);
      if (!res.ok) {
        console.error(
          `recordApprovalEvent request (${event.approvalId}) for run ${ctx.runId}:`,
          res.message,
        );
      }
      return;
    }

    // approval.responded -> resolve-once. resolvedBy is the run owner (the user
    // whose Hermes stream echoed the response). If the request row was missed on
    // a partial replay, resolve reports RUN_NOT_FOUND and we log + move on.
    const resolution = approvalRespondedResolution(event.status);
    const res = await resolveApproval(db, event.approvalId, ctx.customerId, {
      resolution,
      resolvedBy: ctx.customerId,
    });
    if (!res.ok) {
      console.error(
        `recordApprovalEvent respond (${event.approvalId}) for run ${ctx.runId}:`,
        res.message,
      );
    }
  } catch (err) {
    console.error(
      `recordApprovalEvent threw for run ${ctx.runId}/${"approvalId" in event ? event.approvalId : "?"}:`,
      err,
    );
  }
}
