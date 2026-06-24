import type { UIMessage } from "ai";

// Custom data part forwarded to the UI message stream as
// `data-hermes-activity`. The activity stream renders one row per item,
// keyed by `id` so a "running" row can be updated in place to "completed"
// (Vercel AI SDK data-part reconciliation).
//
// Wire source: hermes-agent's /v1/runs/{run_id}/events SSE stream emits
// `tool.started` / `tool.completed` (gateway/platforms/api_server.py
// _make_run_event_callback). route.ts assigns a synthetic `toolCallId`
// (no stable id on the wire) so running rows can be reconciled to
// completed in place.
export type HermesActivityData =
  | {
      kind: "tool";
      toolCallId: string;
      tool: string;
      emoji?: string;
      label?: string;
      status: "running" | "completed";
      durationS?: number;
      error?: boolean;
      resultPreview?: string;
      // Generated artifact (e.g. .pptx/.xlsx) surfaced by the gateway when a
      // skill script writes a deliverable — `filePath` is the gateway-side
      // path, fetched via /v1/runs/{run_id}/file?path=, not exposed to the
      // browser directly.
      filePath?: string;
      fileName?: string;
      ts: number;
    }
  | {
      kind: "approval";
      requestId?: string;
      cmd?: string;
      desc?: string;
      ts: number;
    };

// `data-hermes-approval` part — forwarded when hermes-agent's /v1/runs
// event stream emits `approval.request` (api_server.py
// _approval_notify / tools/approval.py _await_gateway_decision). `kind:
// "request"` renders the approval card; `kind: "resolved"` updates it once
// the user responds (or the run's `approval.responded` event arrives from
// another client/surface).
export type HermesApprovalData =
  | {
      kind: "request";
      requestId: string;
      runId: string;
      command?: string;
      description?: string;
      patternKey?: string;
      allowPermanent: boolean;
      choices: string[];
      ts: number;
    }
  | {
      kind: "resolved";
      requestId: string;
      runId: string;
      choice: string;
      ts: number;
    };

// `data-hermes-reasoning` part — forwarded when hermes-agent's /v1/runs
// event stream emits `reasoning.available` (api_server.py
// _make_run_event_callback). One part per chunk; the UI appends/shows the
// latest reasoning text near the activity stream.
export interface HermesReasoningData {
  text: string;
  ts: number;
}

// `data-hermes-run` — sent once at stream start so the client knows which
// /v1/runs run_id this turn corresponds to (needed for the approval POST).
// `threadId` lets the client learn the conversation id for a brand-new chat
// (no "New Chat" click, no prior `/api/conversations/:id` load) — without
// this, `activeConversationId` stays null and the reload-restore effect in
// AppHome.tsx has nothing to look up, dropping the whole turn on refresh.
export interface HermesRunData {
  runId: string;
  threadId: string;
}

// `data-hermes-compression` part (A3) — forwarded when hermes-agent's
// /v1/runs event stream emits `compression.started` / `compression.done`
// (agent/conversation_compression.py compress_context() ->
// agent.tool_progress_callback -> api_server.py _make_run_event_callback).
// Drives the "Compressing context..." badge while a mid-conversation
// compaction is in flight.
export interface HermesCompressionData {
  active: boolean;
  ts: number;
}

// `metadata.planMode` is stamped on the persisted assistant message
// (persistConversation in api/chat/route.ts) so a page refresh can restore
// the Plan Mode card without any extra server round-trip — derived straight
// from the last loaded message instead of separate session state.
//
// `metadata.artifacts` is stamped the same way for Q14 auto-attach: files
// surfaced by tool.completed during the turn, so the download card in the
// chat bubble survives a reload instead of only existing in the live
// `activity` stream.
export type HermesUIMessage = UIMessage<
  {
    planMode?: boolean;
    artifacts?: { filePath: string; fileName?: string }[];
    // Q12: showcase cards persisted with the message so they survive reload
    // (DB-backed, not session/RAM-only) — see route.ts persistConversation.
    showcases?: HermesShowcaseData[];
  },
  {
    "hermes-activity": HermesActivityData;
    "hermes-approval": HermesApprovalData;
    "hermes-reasoning": HermesReasoningData;
    "hermes-run": HermesRunData;
    "hermes-credits": HermesCreditsData;
    "hermes-compression": HermesCompressionData;
    "hermes-showcase": HermesShowcaseData;
  }
>;

// Mascot emotion states (BUILD_SPEC §10 Q18). Derived client-side from the
// activity stream + chat status — no dedicated SSE event for these exist
// yet beyond tool start/finish, approval.request, and stream errors.
export type MascotEmotion = "idle" | "thinking" | "working" | "done" | "error" | "needs-approval";

// Mascot image states — maps raw hermes-agent tool names (route.ts passes
// `evt.tool` through verbatim, exact casing unconfirmed without a live run)
// to one of 6 illustrated mascot states. "thinking" covers token streaming
// with no active tool; "idle" covers no active task.
export type MascotImageState = "idle" | "coding" | "reading" | "research" | "thinking" | "writing";

// Case-insensitive substring match against the raw tool name. Order matters:
// more specific patterns first.
export function mascotStateForTool(toolName: string): MascotImageState {
  const t = toolName.toLowerCase();
  if (t.includes("edit") || t.includes("bash") || t.includes("shell")) return "coding";
  if (t.includes("write")) return "writing";
  if (t.includes("websearch") || t.includes("web_search") || t.includes("search") && t.includes("web")) return "research";
  if (t.includes("read") || t.includes("grep")) return "reading";
  return "thinking";
}

// `data-hermes-showcase` part — agent capability showcase cards (grill-log
// agent-capability-showcase-cards-2026-06-24). Scope-locked to `code_exec`
// for now: harness infers a write-then-run script pattern (no model prompt
// changes) and emits this once at script-run start (`status: "running"`,
// chip disabled/spinner) and once at finish (`completed`/`error`). The
// results table is read from the script's own output file, never from
// model-printed text — see _track_codeexec_completed in api_server.py.
export type HermesShowcaseTaskType = "code_exec";

export interface HermesShowcaseData {
  taskId: string;
  taskType: HermesShowcaseTaskType;
  status: "running" | "completed" | "error";
  ts: number;
  taskData: {
    scriptPath?: string;
    code?: string;
    stdout?: string;
    resultsFile?: string;
    resultsTable?: Record<string, string>[];
  };
}

// `data-hermes-credits` part — credit balance surfaced to the client. Not
// part of the existing SSE-translation switch (route.ts never forwards
// balance on the success path) — emitted once at stream start alongside
// `data-hermes-run`.
//
// `usedPercent`/`resetAt` extend the original balance-only payload (A1):
// derived from the tier's `monthlyCredits` denominator (mirrors hermes-agent's
// own `CreditsState.used_fraction` / `AccountUsageSnapshot` shape, ported here
// since Aio's billing is its own Supabase ledger, not the hermes CLI credits
// header path) — see route.ts for the computation.
export interface HermesCreditsData {
  balance: number;
  usedPercent?: number;
  resetAt?: string;
  planTier?: string;
}
