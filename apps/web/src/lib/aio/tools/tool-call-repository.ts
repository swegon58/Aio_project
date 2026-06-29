import type { SupabaseClient } from "@supabase/supabase-js";
import {
  redactPersistedValue,
} from "@/lib/aio/runs/aio-run-event-schema";
import {
  REPO_ERROR_CODE,
  dbError,
  type RepoResult,
} from "@/lib/aio/runs/run-repository";
import type { AioToolRisk, AioToolApprovalPolicy } from "./tool-manifest";
import {
  transitionToolCall,
  type AioToolCallStatus,
} from "./tool-call-state-machine";

export interface AioToolCallRow {
  id: string;
  aio_tool_call_id: string;
  hermes_tool_call_id: string | null;
  run_id: string;
  customer_id: string;
  tool_name: string;
  tool_label: string | null;
  manifest_version: number;
  status: AioToolCallStatus;
  redacted_input: unknown;
  redacted_output: unknown;
  risk: AioToolRisk;
  approval_policy: AioToolApprovalPolicy;
  attempts: number;
  timeout_ms: number;
  error_code: string | null;
  error_message_redacted: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateToolCallInput {
  aioToolCallId: string;
  hermesToolCallId?: string | null;
  runId: string;
  customerId: string;
  toolName: string;
  toolLabel?: string | null;
  manifestVersion: number;
  redactedInput?: unknown;
  risk: AioToolRisk;
  approvalPolicy: AioToolApprovalPolicy;
  timeoutMs: number;
  idempotencyKey: string;
  attempts?: number;
}

export async function createToolCall(
  db: SupabaseClient,
  input: CreateToolCallInput,
): Promise<RepoResult<AioToolCallRow>> {
  const { data, error } = await db
    .from("aio_tool_calls")
    .insert({
      aio_tool_call_id: input.aioToolCallId,
      hermes_tool_call_id: input.hermesToolCallId ?? null,
      run_id: input.runId,
      customer_id: input.customerId,
      tool_name: input.toolName,
      tool_label: input.toolLabel ?? null,
      manifest_version: input.manifestVersion,
      status: "proposed",
      redacted_input: redactPersistedValue(input.redactedInput ?? null),
      risk: input.risk,
      approval_policy: input.approvalPolicy,
      timeout_ms: input.timeoutMs,
      idempotency_key: input.idempotencyKey,
      attempts: Math.max(1, Math.trunc(input.attempts ?? 1)),
    })
    .select("*")
    .single();

  if (!error) {
    return { ok: true, data: data as AioToolCallRow };
  }

  if (error.code === "23505") {
    return getToolCallByIdempotencyKey(db, input.idempotencyKey, input.customerId);
  }

  return dbError("Failed to create tool call", error.message);
}

export async function getToolCall(
  db: SupabaseClient,
  aioToolCallId: string,
  customerId: string,
): Promise<RepoResult<AioToolCallRow>> {
  const { data, error } = await db
    .from("aio_tool_calls")
    .select("*")
    .eq("aio_tool_call_id", aioToolCallId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) return dbError("Failed to fetch tool call", error.message);
  if (!data) {
    return {
      ok: false,
      code: REPO_ERROR_CODE.RUN_NOT_FOUND,
      message: `Tool call ${aioToolCallId} not found for this tenant.`,
    };
  }
  return { ok: true, data: data as AioToolCallRow };
}

export async function listToolCallsForRun(
  db: SupabaseClient,
  runId: string,
  customerId: string,
): Promise<RepoResult<AioToolCallRow[]>> {
  const { data, error } = await db
    .from("aio_tool_calls")
    .select("*")
    .eq("run_id", runId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });
  if (error) return dbError("Failed to list tool calls", error.message);
  return { ok: true, data: (data ?? []) as AioToolCallRow[] };
}

export async function transitionStoredToolCall(
  db: SupabaseClient,
  aioToolCallId: string,
  customerId: string,
  to: AioToolCallStatus,
  patch?: Partial<{
    hermesToolCallId: string | null;
    redactedOutput: unknown;
    errorCode: string | null;
    errorMessageRedacted: string | null;
    attempts: number;
  }>,
): Promise<RepoResult<AioToolCallRow>> {
  const current = await getToolCall(db, aioToolCallId, customerId);
  if (!current.ok) return current;

  const result = transitionToolCall(current.data.status, to);
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
  if (!result.changed) return current;

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: to,
    updated_at: now,
  };

  if (to === "running" && !current.data.started_at) {
    update.started_at = now;
  }
  if (
    to === "completed" ||
    to === "denied" ||
    to === "expired" ||
    to === "cancelled" ||
    to === "failed" ||
    to === "timed_out"
  ) {
    update.completed_at = now;
  }
  if (patch?.hermesToolCallId !== undefined) {
    update.hermes_tool_call_id = patch.hermesToolCallId;
  }
  if (patch?.redactedOutput !== undefined) {
    update.redacted_output = redactPersistedValue(patch.redactedOutput);
  }
  if (patch?.errorCode !== undefined) {
    update.error_code = patch.errorCode;
  }
  if (patch?.errorMessageRedacted !== undefined) {
    update.error_message_redacted = patch.errorMessageRedacted;
  }
  if (patch?.attempts !== undefined) {
    update.attempts = Math.max(1, Math.trunc(patch.attempts));
  }

  const { data, error } = await db
    .from("aio_tool_calls")
    .update(update)
    .eq("aio_tool_call_id", aioToolCallId)
    .eq("customer_id", customerId)
    .eq("status", current.data.status)
    .select("*");

  if (error) return dbError("Failed to transition tool call", error.message);
  if (!data || data.length === 0) {
    const reread = await getToolCall(db, aioToolCallId, customerId);
    if (!reread.ok) return reread;
    const replay = transitionToolCall(reread.data.status, to);
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
    return dbError("Concurrent tool-call transition race; retry");
  }

  return { ok: true, data: data[0] as AioToolCallRow };
}

async function getToolCallByIdempotencyKey(
  db: SupabaseClient,
  idempotencyKey: string,
  customerId: string,
): Promise<RepoResult<AioToolCallRow>> {
  const { data, error } = await db
    .from("aio_tool_calls")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) return dbError("Failed to fetch tool call by idempotency key", error.message);
  if (!data) {
    return dbError("Tool call unique conflict occurred but no row could be re-read");
  }
  return { ok: true, data: data as AioToolCallRow };
}

