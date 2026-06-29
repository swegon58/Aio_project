import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isProductionDeployment } from "@/lib/aio/config/production-guard.mjs";
import type {
  AioRunRow,
  RepoError,
  RepoResult,
} from "./run-repository";
import type { AioRunEventRow } from "./run-event-repository";
import type { AioApprovalRow } from "@/lib/aio/tools/approval-repository";

export interface RunApiContext {
  db: ReturnType<typeof createServiceClient>;
  userId: string;
}

const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function resolveRunApiContext(): Promise<
  { ok: true; ctx: RunApiContext } | { ok: false; response: Response }
> {
  if (isProductionDeployment() && DEV_BYPASS) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "unsafe_configuration",
          message:
            "Development auth bypass is disabled in production.",
        },
        { status: 500 },
      ),
    };
  }

  if (DEV_BYPASS) {
    return {
      ok: true,
      ctx: {
        db: createServiceClient(),
        userId: DEV_USER_ID,
      },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "unauthorized", message: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    ok: true,
    ctx: {
      db: createServiceClient(),
      userId: user.id,
    },
  };
}

export function parseBoundedInt(
  raw: string | null,
  options: { defaultValue: number; min: number; max: number },
): number | null {
  if (raw == null || raw === "") return options.defaultValue;
  if (!/^-?\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  const int = Math.trunc(parsed);
  if (int < options.min || int > options.max) return null;
  return int;
}

export function repoErrorResponse(error: RepoError): Response {
  const status =
    error.code === "RUN_NOT_FOUND"
      ? 404
      : error.code === "BAD_CURSOR"
        ? 400
        : error.code === "INVALID_TRANSITION" || error.code === "ALREADY_TERMINAL" || error.code === "SEQUENCE_RACE"
          ? 409
          : 500;

  return Response.json(
    {
      error: error.code.toLowerCase(),
      code: error.code,
      message: error.message,
    },
    { status },
  );
}

export function unwrapRepoResult<T>(result: RepoResult<T>): T | Response {
  return result.ok ? result.data : repoErrorResponse(result);
}

export function serializeRun(row: AioRunRow) {
  return {
    id: row.id,
    customerId: row.customer_id,
    conversationId: row.conversation_id,
    threadId: row.thread_id,
    status: row.status,
    mode: row.mode,
    inputSummary: row.input_summary,
    hermesRunId: row.hermes_run_id,
    hermesSessionId: row.hermes_session_id,
    reservedCredits: row.reserved_credits,
    actualCredits: row.actual_credits,
    errorCode: row.error_code,
    errorMessageRedacted: row.error_message_redacted,
    createdAt: row.created_at,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    cancelRequestedAt: row.cancel_requested_at,
    metadata: row.metadata,
  };
}

export function serializeRunEvent(row: AioRunEventRow) {
  return {
    id: row.id,
    schemaVersion: row.schema_version,
    runId: row.run_id,
    customerId: row.customer_id,
    sequence: row.sequence,
    type: row.type,
    occurredAt: row.occurred_at,
    receivedAt: row.received_at,
    source: row.source,
    payload: row.payload,
    hermes: row.hermes,
  };
}

/**
 * Public shape for an approval row. Omits internal idempotency keys. The
 * requested payload is already redacted at write time (redactPersistedValue).
 */
export function serializeApproval(row: AioApprovalRow) {
  return {
    id: row.id,
    aioApprovalId: row.aio_approval_id,
    runId: row.run_id,
    customerId: row.customer_id,
    aioToolCallId: row.aio_tool_call_id,
    toolName: row.tool_name,
    toolLabel: row.tool_label,
    risk: row.risk,
    approvalMode: row.approval_mode,
    status: row.status,
    title: row.title,
    requestedInputRedacted: row.requested_input_redacted,
    resolution: row.resolution,
    resolvedBy: row.resolved_by,
    requestedAt: row.requested_at,
    resolvedAt: row.resolved_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
