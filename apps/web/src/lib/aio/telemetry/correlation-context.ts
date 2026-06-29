// R3.2 — Correlation context: opaque IDs propagated through every Aio request.
//
// These IDs are safe to include in spans and structured logs (no PII, no secrets).
// They are extracted from incoming request headers or generated fresh for new
// request roots, then forwarded downstream on every outbound call.
//
// NEVER put raw prompt text, email, auth token, cookie, or session value here.
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

export interface AioCorrelationContext {
  /** Aio-generated per-HTTP-request ID. Never equal to a user ID or secret. */
  requestId: string;
  /** Stable user/tenant ID — opaque in spans, never a display name or email. */
  userId: string | null;
  /** Conversation/thread ID (null for image or one-shot requests). */
  conversationId: string | null;
  /** Aio run ID (null until a run is created). */
  runId: string | null;
  /** Hermes run/session ID (null until Hermes responds). */
  hermesRunId: string | null;
  /** Tool call ID (null outside a tool execution span). */
  toolCallId: string | null;
  /** Approval ID (null outside an approval span). */
  approvalId: string | null;
  /** Billing reservation/settlement ID (null outside billing spans). */
  billingId: string | null;
  /** Upstream provider request ID echoed back in response headers (if present). */
  providerRequestId: string | null;
}

/** Header names Aio reads/writes for correlation propagation. */
export const CORRELATION_HEADERS = {
  requestId: "x-aio-request-id",
  runId: "x-aio-run-id",
  hermesRunId: "x-hermes-run-id",
  conversationId: "x-aio-conversation-id",
} as const;

/**
 * Build a correlation context from an incoming Next.js request.
 * The requestId is echoed if already set upstream; otherwise a new one is minted.
 */
export function extractCorrelationContext(
  req: NextRequest,
  overrides: Partial<AioCorrelationContext> = {},
): AioCorrelationContext {
  return {
    requestId:
      req.headers.get(CORRELATION_HEADERS.requestId) ?? randomUUID(),
    userId: overrides.userId ?? null,
    conversationId:
      overrides.conversationId ??
      req.headers.get(CORRELATION_HEADERS.conversationId) ??
      null,
    runId:
      overrides.runId ?? req.headers.get(CORRELATION_HEADERS.runId) ?? null,
    hermesRunId:
      overrides.hermesRunId ??
      req.headers.get(CORRELATION_HEADERS.hermesRunId) ??
      null,
    toolCallId: overrides.toolCallId ?? null,
    approvalId: overrides.approvalId ?? null,
    billingId: overrides.billingId ?? null,
    providerRequestId: overrides.providerRequestId ?? null,
  };
}

/**
 * Build a fresh root context (e.g., for background workers or scheduled jobs
 * that have no incoming HTTP request).
 */
export function rootCorrelationContext(
  overrides: Partial<AioCorrelationContext> = {},
): AioCorrelationContext {
  return {
    requestId: overrides.requestId ?? randomUUID(),
    userId: overrides.userId ?? null,
    conversationId: overrides.conversationId ?? null,
    runId: overrides.runId ?? null,
    hermesRunId: overrides.hermesRunId ?? null,
    toolCallId: overrides.toolCallId ?? null,
    approvalId: overrides.approvalId ?? null,
    billingId: overrides.billingId ?? null,
    providerRequestId: overrides.providerRequestId ?? null,
  };
}

/** Return only the IDs that are non-null — for lean span attribute sets. */
export function correlationAttributes(
  ctx: AioCorrelationContext,
): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (ctx.requestId) attrs["aio.request_id"] = ctx.requestId;
  if (ctx.userId) attrs["aio.user_id"] = ctx.userId;
  if (ctx.conversationId) attrs["aio.conversation_id"] = ctx.conversationId;
  if (ctx.runId) attrs["aio.run_id"] = ctx.runId;
  if (ctx.hermesRunId) attrs["hermes.run_id"] = ctx.hermesRunId;
  if (ctx.toolCallId) attrs["aio.tool_call_id"] = ctx.toolCallId;
  if (ctx.approvalId) attrs["aio.approval_id"] = ctx.approvalId;
  if (ctx.billingId) attrs["aio.billing_id"] = ctx.billingId;
  if (ctx.providerRequestId) attrs["provider.request_id"] = ctx.providerRequestId;
  return attrs;
}

/** Attach correlation headers to an outbound fetch init. */
export function withCorrelationHeaders(
  ctx: AioCorrelationContext,
  init: RequestInit = {},
): RequestInit {
  const headers = new Headers(init.headers);
  headers.set(CORRELATION_HEADERS.requestId, ctx.requestId);
  if (ctx.runId) headers.set(CORRELATION_HEADERS.runId, ctx.runId);
  if (ctx.hermesRunId) headers.set(CORRELATION_HEADERS.hermesRunId, ctx.hermesRunId);
  if (ctx.conversationId) headers.set(CORRELATION_HEADERS.conversationId, ctx.conversationId);
  return { ...init, headers };
}
