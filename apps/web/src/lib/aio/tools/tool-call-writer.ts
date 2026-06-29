// Best-effort durable tool-call recording for the Aio run stream (R2.2).
//
// Maps AioRunEvent `tool.*` events into tool-call repository create/transition
// calls so every tool invocation in a run is persisted with a manifest risk /
// approval-policy snapshot and redacted I/O. Idempotent: replaying the same
// event yields the same row and is a no-op transition (safe on reconnect).
//
// Approval gating (`proposed -> waiting_approval -> approved`) is deferred to
// R2.3/R2.5. Until enforcement lands, the recorded lifecycle is the truthful
// record of current Hermes execution: `proposed -> running -> completed|failed`.
// The snapshot's approval policy is stored now so R2.5 can later decide whether
// a dangerous tool call ever received a durable approval row.
//
// Durability contract matches `persistEvent` in R1.5: best-effort, logs and
// swallows repository errors so a persistence hiccup can never mask the run's
// primary outcome.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AioRunEvent } from "@/lib/aio/runs/aio-run-events";
import {
  AIO_TOOL_MANIFEST_VERSION,
  getAioToolManifestEntry,
  type AioToolApprovalPolicy,
  type AioToolRisk,
} from "./tool-manifest";
import {
  createToolCall,
  transitionStoredToolCall,
  type CreateToolCallInput,
} from "./tool-call-repository";

export type ToolCallEventStatus = "running" | "completed" | "failed";

/** Unknown tools are recorded conservatively so R2.5/R2.6 can flag the gap. */
const UNKNOWN_TOOL_FALLBACK_POLICY: AioToolApprovalPolicy = {
  defaultMode: "once",
  sessionScopeAllowed: false,
  alwaysScopeAllowed: false,
  rationale: "Unknown tool — conservative gating pending manifest coverage.",
};

export interface ToolCallContext {
  runId: string;
  customerId: string;
}

export interface ToolCallSnapshot {
  risk: AioToolRisk;
  approvalPolicy: AioToolApprovalPolicy;
  timeoutMs: number;
  manifestVersion: number;
  label: string | null;
}

type ToolLifecycleEvent = Extract<
  AioRunEvent,
  { type: "tool.started" | "tool.completed" | "tool.failed" }
>;

export function toolCallTargetStatus(event: AioRunEvent): ToolCallEventStatus | null {
  switch (event.type) {
    case "tool.started":
      return "running";
    case "tool.completed":
      return "completed";
    case "tool.failed":
      return "failed";
    default:
      return null;
  }
}

export function resolveToolCallSnapshot(toolName: string): ToolCallSnapshot {
  const entry = getAioToolManifestEntry(toolName);
  if (!entry) {
    return {
      risk: "dangerous",
      approvalPolicy: UNKNOWN_TOOL_FALLBACK_POLICY,
      timeoutMs: 60_000,
      manifestVersion: AIO_TOOL_MANIFEST_VERSION,
      label: null,
    };
  }
  return {
    risk: entry.risk,
    approvalPolicy: entry.approvalPolicy,
    timeoutMs: entry.timeoutMs,
    manifestVersion: entry.version,
    label: entry.displayLabel,
  };
}

/**
 * Stable product + idempotency identities derived from the (runId, Hermes tool
 * call id) pair, so a replayed event resolves to the exact same row instead of
 * creating a duplicate.
 */
export function stableToolCallIds(runId: string, hermesToolCallId: string): {
  aioToolCallId: string;
  idempotencyKey: string;
} {
  const base = `${runId}:${hermesToolCallId}`;
  return { aioToolCallId: base, idempotencyKey: `create:${base}` };
}

export function buildToolCallCreateInput(
  ctx: ToolCallContext,
  event: ToolLifecycleEvent,
): CreateToolCallInput {
  const snap = resolveToolCallSnapshot(event.toolName);
  const ids = stableToolCallIds(ctx.runId, event.toolCallId);
  const fallbackLabel = event.type === "tool.started" ? event.label ?? null : null;
  return {
    aioToolCallId: ids.aioToolCallId,
    hermesToolCallId: event.toolCallId,
    runId: ctx.runId,
    customerId: ctx.customerId,
    toolName: event.toolName,
    toolLabel: snap.label ?? fallbackLabel,
    manifestVersion: snap.manifestVersion,
    redactedInput: event.type === "tool.started" ? event.input : undefined,
    risk: snap.risk,
    approvalPolicy: snap.approvalPolicy,
    timeoutMs: snap.timeoutMs,
    idempotencyKey: ids.idempotencyKey,
  };
}

export interface ToolCallTransitionPlan {
  to: ToolCallEventStatus;
  patch: {
    hermesToolCallId?: string | null;
    redactedOutput?: unknown;
    errorCode?: string | null;
    errorMessageRedacted?: string | null;
  };
}

export function planToolCallTransition(event: ToolLifecycleEvent): ToolCallTransitionPlan {
  switch (event.type) {
    case "tool.started":
      return { to: "running", patch: { hermesToolCallId: event.toolCallId } };
    case "tool.completed":
      return { to: "completed", patch: { redactedOutput: event.output } };
    case "tool.failed":
      return {
        to: "failed",
        patch: {
          errorCode: "tool_error",
          errorMessageRedacted: (event.errorText ?? event.error ?? "").slice(0, 500) || null,
        },
      };
  }
}

/**
 * Record a `tool.*` event durably. No-op for non-tool events. Idempotent across
 * replay and best-effort (logs failures, never throws).
 */
export async function recordToolCallEvent(
  db: SupabaseClient,
  ctx: ToolCallContext,
  event: AioRunEvent,
): Promise<void> {
  const target = toolCallTargetStatus(event);
  if (!target) return;

  const toolEvent = event as ToolLifecycleEvent;
  const createInput = buildToolCallCreateInput(ctx, toolEvent);
  const plan = planToolCallTransition(toolEvent);

  try {
    const ensured = await createToolCall(db, createInput);
    if (!ensured.ok) {
      console.error(
        `recordToolCallEvent create (${event.type}) for run ${ctx.runId}/${toolEvent.toolCallId}:`,
        ensured.message,
      );
      return;
    }

    // If a terminal event arrives while the row is still `proposed` (its
    // `tool.started` was missed on a partial replay), step through `running`
    // first so the state-machine edge stays valid (proposed -> running -> terminal).
    if (ensured.data.status === "proposed" && target !== "running") {
      const toRunning = await transitionStoredToolCall(
        db,
        createInput.aioToolCallId,
        ctx.customerId,
        "running",
        { hermesToolCallId: toolEvent.toolCallId },
      );
      if (!toRunning.ok) {
        console.error(
          `recordToolCallEvent proposed->running for ${createInput.aioToolCallId}:`,
          toRunning.message,
        );
        return;
      }
    }

    const transitioned = await transitionStoredToolCall(
      db,
      createInput.aioToolCallId,
      ctx.customerId,
      plan.to,
      plan.patch,
    );
    if (!transitioned.ok) {
      console.error(
        `recordToolCallEvent transition ->${plan.to} for ${createInput.aioToolCallId}:`,
        transitioned.message,
      );
    }
  } catch (err) {
    console.error(
      `recordToolCallEvent threw for run ${ctx.runId}/${toolEvent.toolCallId}:`,
      err,
    );
  }
}
