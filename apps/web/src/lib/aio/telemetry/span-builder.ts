// R3.3 — Instrumentation helpers: named span constants and attribute builders.
//
// Named constants prevent typos in span/metric names across the codebase.
// All attribute keys follow the OpenTelemetry semantic convention format.

export const SPANS = {
  // Chat / run lifecycle
  CHAT_TURN: "aio.chat.turn",
  RUN_START: "aio.run.start",
  RUN_COMPLETE: "aio.run.complete",

  // Hermes integration
  HERMES_START: "hermes.session.start",
  HERMES_EVENT: "hermes.event.receive",
  HERMES_STOP: "hermes.session.stop",

  // Tool call lifecycle
  TOOL_CALL_PROPOSE: "aio.tool_call.propose",
  TOOL_CALL_APPROVE: "aio.tool_call.approve",
  TOOL_CALL_EXECUTE: "aio.tool_call.execute",

  // Approval lifecycle
  APPROVAL_CREATE: "aio.approval.create",
  APPROVAL_RESOLVE: "aio.approval.resolve",

  // Billing
  BILLING_CREDIT_CHECK: "aio.billing.credit_check",
  BILLING_SETTLE: "aio.billing.settle",

  // Knowledge / research (R4)
  RESEARCH_PLAN: "aio.research.plan",
  RESEARCH_DISCOVER: "aio.research.discover",
  RESEARCH_SYNTHESIZE: "aio.research.synthesize",
  KNOWLEDGE_INGEST: "aio.knowledge.ingest",
  KNOWLEDGE_EMBED: "aio.knowledge.embed",
  KNOWLEDGE_QUERY: "aio.knowledge.query",
} as const;

export const METRICS = {
  // Counters
  RUNS_STARTED: "aio.runs_started_total",
  RUNS_COMPLETED: "aio.runs_completed_total",
  RUNS_FAILED: "aio.runs_failed_total",
  APPROVALS_REQUESTED: "aio.approvals_requested_total",
  APPROVALS_GRANTED: "aio.approvals_granted_total",
  APPROVALS_DENIED: "aio.approvals_denied_total",
  TOOL_CALLS_TOTAL: "aio.tool_calls_total",
  TOOL_CALLS_FAILED: "aio.tool_calls_failed_total",
  HERMES_EVENTS: "aio.hermes_events_total",

  // Histograms
  CHAT_TURN_LATENCY_MS: "aio.chat_turn_latency_ms",
  HERMES_START_LATENCY_MS: "aio.hermes_start_latency_ms",
  TOOL_CALL_LATENCY_MS: "aio.tool_call_latency_ms",
  APPROVAL_RESOLVE_LATENCY_MS: "aio.approval_resolve_latency_ms",
  TOKENS_INPUT: "aio.tokens_input",
  TOKENS_OUTPUT: "aio.tokens_output",
  COST_MICRO_USD: "aio.cost_micro_usd",
} as const;

// ---------------------------------------------------------------------------
// Attribute builders — produce safe, non-PII span attributes
// ---------------------------------------------------------------------------

export interface RunAttrs {
  runId: string;
  userId?: string;
  conversationId?: string;
  modelName?: string;
  status?: string;
}

export function runAttrs(r: RunAttrs): Record<string, string> {
  const a: Record<string, string> = { "aio.run_id": r.runId };
  if (r.userId) a["aio.user_id"] = r.userId;
  if (r.conversationId) a["aio.conversation_id"] = r.conversationId;
  if (r.modelName) a["ai.model.name"] = r.modelName;
  if (r.status) a["aio.run.status"] = r.status;
  return a;
}

export interface ToolCallAttrs {
  toolCallId: string;
  runId?: string;
  toolName: string;
  riskLevel?: string;
  status?: string;
}

export function toolCallAttrs(t: ToolCallAttrs): Record<string, string> {
  const a: Record<string, string> = {
    "aio.tool_call_id": t.toolCallId,
    "aio.tool.name": t.toolName,
  };
  if (t.runId) a["aio.run_id"] = t.runId;
  if (t.riskLevel) a["aio.tool.risk_level"] = t.riskLevel;
  if (t.status) a["aio.tool_call.status"] = t.status;
  return a;
}

export interface ApprovalAttrs {
  approvalId: string;
  runId?: string;
  toolCallId?: string;
  riskLevel?: string;
  resolution?: string;
}

export function approvalAttrs(a: ApprovalAttrs): Record<string, string> {
  const out: Record<string, string> = { "aio.approval_id": a.approvalId };
  if (a.runId) out["aio.run_id"] = a.runId;
  if (a.toolCallId) out["aio.tool_call_id"] = a.toolCallId;
  if (a.riskLevel) out["aio.approval.risk_level"] = a.riskLevel;
  if (a.resolution) out["aio.approval.resolution"] = a.resolution;
  return out;
}

export interface TokenUsageAttrs {
  inputTokens: number;
  outputTokens: number;
  modelName: string;
}

/** Produce metric labels for a token usage observation — no PII. */
export function tokenUsageLabels(t: Pick<TokenUsageAttrs, "modelName">): Record<string, string> {
  return { "ai.model.name": t.modelName };
}

export interface HermesEventAttrs {
  hermesRunId: string;
  eventType: string;
  runId?: string;
}

export function hermesEventAttrs(h: HermesEventAttrs): Record<string, string> {
  const a: Record<string, string> = {
    "hermes.run_id": h.hermesRunId,
    "hermes.event.type": h.eventType,
  };
  if (h.runId) a["aio.run_id"] = h.runId;
  return a;
}
