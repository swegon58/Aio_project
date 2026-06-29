// Server-only repository for aio_approvals (R2.3). Owns the durable approval
// lifecycle: idempotent request, fetch, list (with lazy expiry sweep), and
// resolve-once transition. Mirrors tool-call-repository conventions.
//
// All functions take the service-role client (createServiceClient) and scope
// every query by both id and customer_id, so a wrong tenant reads/writes
// nothing. An approval that does not belong to the caller is reported as
// RUN_NOT_FOUND — existence is never leaked across tenants (same contract as
// aio_tool_calls). No route contains raw lifecycle SQL.

import type { SupabaseClient } from "@supabase/supabase-js";
import { redactPersistedValue } from "@/lib/aio/runs/aio-run-event-schema";
import {
  REPO_ERROR_CODE,
  dbError,
  type RepoResult,
} from "@/lib/aio/runs/run-repository";
import type { AioToolRisk, AioToolApprovalMode } from "./tool-manifest";
import {
  transitionApproval,
  resolutionToStatus,
  type AioApprovalStatus,
  type AioApprovalResolution,
} from "./approval-state-machine";

export interface AioApprovalRow {
  id: string;
  aio_approval_id: string;
  run_id: string;
  customer_id: string;
  aio_tool_call_id: string | null;
  tool_name: string | null;
  tool_label: string | null;
  risk: AioToolRisk;
  approval_mode: AioToolApprovalMode;
  status: AioApprovalStatus;
  title: string | null;
  requested_input_redacted: unknown;
  resolution: AioApprovalResolution | null;
  resolved_by: string | null;
  requested_at: string;
  resolved_at: string | null;
  expires_at: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface RequestApprovalInput {
  aioApprovalId: string;
  runId: string;
  customerId: string;
  aioToolCallId?: string | null;
  toolName?: string | null;
  toolLabel?: string | null;
  risk: AioToolRisk;
  approvalMode: AioToolApprovalMode;
  title?: string | null;
  /** Pre-redaction input; persisted through redactPersistedValue. */
  requestedInput?: unknown;
  /** ISO timestamp; required. Requested rows past this are expired. */
  expiresAt: string;
  idempotencyKey: string;
}

export interface ResolveApprovalInput {
  resolution: AioApprovalResolution;
  resolvedBy?: string | null;
}

export async function requestApproval(
  db: SupabaseClient,
  input: RequestApprovalInput,
): Promise<RepoResult<AioApprovalRow>> {
  const { data, error } = await db
    .from("aio_approvals")
    .insert({
      aio_approval_id: input.aioApprovalId,
      run_id: input.runId,
      customer_id: input.customerId,
      aio_tool_call_id: input.aioToolCallId ?? null,
      tool_name: input.toolName ?? null,
      tool_label: input.toolLabel ?? null,
      risk: input.risk,
      approval_mode: input.approvalMode,
      status: "requested",
      title: input.title ?? null,
      requested_input_redacted: redactPersistedValue(input.requestedInput ?? null),
      expires_at: input.expiresAt,
      idempotency_key: input.idempotencyKey,
    })
    .select("*")
    .single();

  if (!error) {
    return { ok: true, data: data as AioApprovalRow };
  }

  if (error.code === "23505") {
    return getApprovalByIdempotencyKey(db, input.idempotencyKey, input.customerId);
  }

  return dbError("Failed to request approval", error.message);
}

export async function getApproval(
  db: SupabaseClient,
  aioApprovalId: string,
  customerId: string,
): Promise<RepoResult<AioApprovalRow>> {
  const { data, error } = await db
    .from("aio_approvals")
    .select("*")
    .eq("aio_approval_id", aioApprovalId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) return dbError("Failed to fetch approval", error.message);
  if (!data) {
    return {
      ok: false,
      code: REPO_ERROR_CODE.RUN_NOT_FOUND,
      message: `Approval ${aioApprovalId} not found for this tenant.`,
    };
  }

  const row = data as AioApprovalRow;
  return lazyExpire(db, row);
}

export async function listApprovalsForRun(
  db: SupabaseClient,
  runId: string,
  customerId: string,
): Promise<RepoResult<AioApprovalRow[]>> {
  // Lazy expiry sweep scoped to this run+tenant before reading.
  await sweepExpiredApprovals(db, { runId, customerId });

  const { data, error } = await db
    .from("aio_approvals")
    .select("*")
    .eq("run_id", runId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });
  if (error) return dbError("Failed to list approvals", error.message);
  return { ok: true, data: (data ?? []) as AioApprovalRow[] };
}

export async function resolveApproval(
  db: SupabaseClient,
  aioApprovalId: string,
  customerId: string,
  input: ResolveApprovalInput,
): Promise<RepoResult<AioApprovalRow>> {
  const current = await getApproval(db, aioApprovalId, customerId);
  if (!current.ok) return current;

  // Authoritative expiry: even if the row is still `requested`, a resolve past
  // expires_at is rejected and the row is marked expired.
  if (
    current.data.status === "requested" &&
    Date.parse(current.data.expires_at) < Date.now()
  ) {
    await markExpired(db, current.data);
    return {
      ok: false,
      code: REPO_ERROR_CODE.ALREADY_TERMINAL,
      message: `Approval ${aioApprovalId} expired before resolution.`,
    };
  }

  const to = resolutionToStatus(input.resolution);
  const result = transitionApproval(current.data.status, to);
  if (!result.ok) {
    return {
      ok: false,
      code:
        result.code === "ALREADY_TERMINAL"
          ? REPO_ERROR_CODE.ALREADY_TERMINAL
          : REPO_ERROR_CODE.INVALID_TRANSITION,
      message: result.message,
    };
  }
  // Resolve-once: resolving to the status it already holds is a no-op replay.
  if (!result.changed) return current;

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: to,
    resolution: input.resolution,
    resolved_at: now,
    updated_at: now,
  };
  if (input.resolvedBy !== undefined) {
    update.resolved_by = input.resolvedBy ?? null;
  }

  const { data, error } = await db
    .from("aio_approvals")
    .update(update)
    .eq("aio_approval_id", aioApprovalId)
    .eq("customer_id", customerId)
    .eq("status", current.data.status)
    .select("*");

  if (error) return dbError("Failed to resolve approval", error.message);
  if (!data || data.length === 0) {
    const reread = await getApproval(db, aioApprovalId, customerId);
    if (!reread.ok) return reread;
    const replay = transitionApproval(reread.data.status, to);
    if (!replay.ok) {
      return {
        ok: false,
        code:
          replay.code === "ALREADY_TERMINAL"
            ? REPO_ERROR_CODE.ALREADY_TERMINAL
            : REPO_ERROR_CODE.INVALID_TRANSITION,
        message: replay.message,
      };
    }
    if (!replay.changed) return reread;
    return dbError("Concurrent approval resolution race; retry");
  }

  return { ok: true, data: data[0] as AioApprovalRow };
}

/**
 * Best-effort bulk expiry: flips `requested` rows past their expires_at to
 * `expired`, scoped to a run and/or tenant when given. Returns the count moved.
 */
export async function sweepExpiredApprovals(
  db: SupabaseClient,
  scope?: { runId?: string; customerId?: string },
): Promise<number> {
  const now = new Date().toISOString();
  let query = db
    .from("aio_approvals")
    .update({ status: "expired", updated_at: now })
    .eq("status", "requested")
    .lt("expires_at", now);
  if (scope?.runId) query = query.eq("run_id", scope.runId);
  if (scope?.customerId) query = query.eq("customer_id", scope.customerId);
  const { data, error } = await query.select("id");
  if (error) return 0;
  return data?.length ?? 0;
}

async function markExpired(
  db: SupabaseClient,
  row: AioApprovalRow,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .from("aio_approvals")
    .update({ status: "expired", updated_at: now })
    .eq("aio_approval_id", row.aio_approval_id)
    .eq("customer_id", row.customer_id)
    .eq("status", "requested");
}

/** Reflects a just-expired row back to the caller without a second select. */
async function lazyExpire(
  db: SupabaseClient,
  row: AioApprovalRow,
): Promise<RepoResult<AioApprovalRow>> {
  if (row.status === "requested" && Date.parse(row.expires_at) < Date.now()) {
    await markExpired(db, row);
    const now = new Date().toISOString();
    return { ok: true, data: { ...row, status: "expired", updated_at: now } };
  }
  return { ok: true, data: row };
}

async function getApprovalByIdempotencyKey(
  db: SupabaseClient,
  idempotencyKey: string,
  customerId: string,
): Promise<RepoResult<AioApprovalRow>> {
  const { data, error } = await db
    .from("aio_approvals")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) return dbError("Failed to fetch approval by idempotency key", error.message);
  if (!data) {
    return dbError("Approval unique conflict occurred but no row could be re-read");
  }
  return { ok: true, data: data as AioApprovalRow };
}
