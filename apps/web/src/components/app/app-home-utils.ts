import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BarChart3,
  Bell,
  Brain,
  Clock,
  Cog,
  Home,
  ListChecks,
  Plus,
  Users,
} from "lucide-react";
import { MarkdownMessage } from "@/components/app/MarkdownMessage";
import {
  mascotStateForTool,
  type HermesActivityData,
  type HermesApprovalData,
  type MascotImageState,
} from "@/lib/hermes/chat-types";
import { isRunTerminal } from "@/lib/aio/runs/run-client";
import type { AioRunEvent, AioRunStatus } from "@/lib/aio/runs/aio-run-events";
import type { AccentKey } from "@/components/app/SettingsModal";
import type {
  ImageAspectRatio,
  ImageResolution,
  MessageSegment,
  PlanQuestion,
  TodayCard,
} from "./app-home-types";

// Mirrors route.ts PLAN_MODE_INSTRUCTIONS' aio-question protocol: a
// clarifying turn is ONLY a ```aio-question fenced JSON block, nothing else.
// Returns null for a normal/final-plan turn so callers fall back to the
// existing Run/Adjust/Cancel plan card.
export function parsePlanQuestion(text: string): PlanQuestion | null {
  // Strip any fence language tag (aio-question, json, or none) — local
  // models don't reliably use the exact tag we ask for.
  const fenced = text.match(/```(?:[a-zA-Z-]+)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : text.trim();
  if (!candidate.startsWith("{") || !candidate.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(candidate);
    if (
      typeof parsed.question === "string" &&
      Array.isArray(parsed.choices) &&
      parsed.choices.every((c: unknown) => typeof c === "string")
    ) {
      return parsed as PlanQuestion;
    }
  } catch {
    // Malformed block — treat as a normal message, not a question card.
  }
  return null;
}

// Splits an assistant message into text/code segments so code blocks can be
// rendered as clickable chips in chat instead of inline (keeps chat bubbles
// short; full code lives in the workspace panel).
export function splitMessageSegments(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  // [^\n]* tolerates trailing junk on the fence line (e.g. "```js extra") —
  // a strict \n right after the lang token would otherwise drop the whole
  // block (literal backticks included) to plain text on malformed fences.
  const regex = /```([a-zA-Z0-9_-]*)[^\n]*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "code", lang: match[1] || "text", code: match[2].trimEnd() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    // Odd fence count in the remainder means an unterminated trailing fence
    // (still streaming) — treat it as a code segment now instead of waiting
    // for the closing ``` so the chat bubble doesn't jump height on close.
    const openMatch = /```([a-zA-Z0-9_-]*)[^\n]*\n([\s\S]*)$/.exec(rest);
    const fenceCount = (rest.match(/```/g) ?? []).length;
    if (openMatch && fenceCount % 2 === 1) {
      const before = rest.slice(0, openMatch.index);
      if (before) segments.push({ type: "text", value: before });
      segments.push({ type: "code", lang: openMatch[1] || "text", code: openMatch[2] });
    } else {
      segments.push({ type: "text", value: rest });
    }
  }
  return segments;
}

export function deriveMascotState(
  status: "submitted" | "streaming" | "ready" | "error",
  activity: HermesActivityData[],
  hasText: boolean,
): MascotImageState {
  const runningTool = activity.find((item) => item.kind === "tool" && item.status === "running");
  if (runningTool && runningTool.kind === "tool") return mascotStateForTool(runningTool.tool);
  if (status === "submitted" || (status === "streaming" && !hasText)) return "thinking";
  return "idle";
}

export function runEventKey(event: AioRunEvent): string {
  if ("toolCallId" in event) return `${event.type}:${event.toolCallId}`;
  if ("approvalId" in event) return `${event.type}:${event.approvalId}`;
  if ("artifactId" in event) return `${event.type}:${event.artifactId}`;
  if ("taskId" in event) return `${event.type}:${event.taskId}`;
  return `${event.type}:${event.runId}:${event.createdAt}`;
}

export function upsertRunEvent(events: AioRunEvent[], event: AioRunEvent): AioRunEvent[] {
  const key = runEventKey(event);
  const index = events.findIndex((item) => runEventKey(item) === key);
  const next = index === -1 ? [...events, event] : events.map((item, i) => (i === index ? event : item));
  return next.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function isPendingRunShellEvent(event: AioRunEvent): boolean {
  return event.type === "run.created" && event.runId.startsWith("pending:");
}

export function mergeDurableRunEvents(existing: AioRunEvent[], incoming: AioRunEvent[]): AioRunEvent[] {
  let next = existing.filter((event) => !isPendingRunShellEvent(event));
  for (const event of incoming) {
    next = upsertRunEvent(next, event);
  }
  return next;
}

export function pendingApprovalFromRunEvents(
  events: AioRunEvent[],
): Extract<HermesApprovalData, { kind: "request" }> | null {
  const pending = new Map<string, Extract<HermesApprovalData, { kind: "request" }>>();

  for (const event of events) {
    if (event.type === "approval.requested") {
      const requestId = event.requestId ?? event.approvalId;
      pending.set(requestId, {
        kind: "request",
        requestId,
        runId: event.runId,
        command: event.command,
        description: event.description,
        patternKey: event.patternKey,
        allowPermanent: event.allowPermanent ?? false,
        choices: event.choices ?? ["approve", "reject"],
        ts: event.ts ?? Date.parse(event.createdAt),
      });
      continue;
    }

    if (event.type === "approval.responded") {
      pending.delete(event.requestId ?? event.approvalId);
    }
  }

  const unresolved = Array.from(pending.values());
  return unresolved.length > 0 ? unresolved[unresolved.length - 1] : null;
}

export function badgeStateForRunStatus(
  status: AioRunStatus | null,
  options: {
    hydrating: boolean;
    syncError: boolean;
  },
): "ready" | "working" | "asking" | "success" | "error" | "confused" {
  if (options.hydrating) return "working";
  if (options.syncError && status && !isRunTerminal(status)) return "confused";
  switch (status) {
    case "queued":
    case "running":
    case "cancelling":
      return "working";
    case "waiting_approval":
      return "asking";
    case "completed":
    case "cancelled":
      return "success";
    case "failed":
      return "error";
    default:
      return "ready";
  }
}

export function labelForRunStatus(status: AioRunStatus | null): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "waiting_approval":
      return "Needs approval";
    case "cancelling":
      return "Stopping";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Ready";
  }
}

export const TODAY_CARDS: TodayCard[] = [
  {
    id: "continue-current-thread",
    kind: "continue",
    label: "Continue",
    title: "Pick up the current thread",
    reason: "Turn the latest context into a concrete next step.",
    source: "Recent chat",
    prompt: "Review our current conversation and suggest the most useful next step. Then help me execute it.",
  },
  {
    id: "review-context",
    kind: "review",
    label: "Review",
    title: "Find what needs attention",
    reason: "Scan memory, files, and open context for anything worth acting on.",
    source: "Workspace",
    prompt: "Review my current Aio context and tell me what deserves attention next, with a short prioritized list.",
  },
  {
    id: "create-artifact",
    kind: "create",
    label: "Create",
    title: "Make a useful artifact",
    reason: "Convert loose context into a plan, doc, table, or draft.",
    source: "Aio",
    prompt: "Based on my current context, propose one useful artifact to create and draft the first version.",
  },
  {
    id: "schedule-followup",
    kind: "schedule",
    label: "Schedule",
    title: "Set up a recurring follow-up",
    reason: "Convert repeated work into a scheduled check.",
    source: "Tasks",
    prompt: "Help me turn one recurring task from my current context into a scheduled Aio follow-up.",
  },
];

export const ICON_RAIL_ITEMS = [
  // Pinned first (R11.5b sidebar redesign, Kimo Option 1): always-visible
  // entry point for the chats card (recent chats + start new), so it's
  // reachable even when the conversations sidebar is collapsed.
  { key: "newChat", label: "Chats", icon: Plus, active: false, disabled: false },
  { key: "home", label: "Home", icon: Home, active: true, disabled: false },
  { key: "scheduled", label: "Scheduled", icon: Clock, active: false, disabled: false },
  { key: "notifications", label: "Notifications", icon: Bell, active: false, disabled: false },
  { key: "agents", label: "Agents", icon: Users, active: false, disabled: true },
  { key: "tasks", label: "Tasks", icon: ListChecks, active: false, disabled: true },
  { key: "knowledge", label: "Knowledge", icon: Brain, active: false, disabled: true },
  { key: "analytics", label: "Analytics", icon: BarChart3, active: false, disabled: true },
  { key: "settings", label: "Settings", icon: Cog, active: false, disabled: false },
] as const;

export const ACCENT_HEX: Record<AccentKey, string> = {
  purple: "#6c5ce7",
  green: "#00d2a0",
  blue: "#0081f2",
  pink: "#fd79a8",
  orange: "#ffa726",
  cyan: "#00cec9",
  red: "#ff6b6b",
};

export const BG_HEX: Record<"dark" | "light", string> = {
  dark: "#090909",
  light: "#f5f5fa",
};

const KEYWORDS = new Set([
  "function", "const", "let", "var", "return", "if", "else", "for", "while",
  "import", "export", "from", "default", "class", "extends", "new", "this",
  "async", "await", "try", "catch", "finally", "throw", "typeof", "interface",
  "type", "public", "private", "static", "void", "null", "undefined", "true",
  "false", "def", "self", "elif", "import", "as", "with", "lambda", "yield",
]);

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// Minimal regex tokenizer for the terminal's code blocks — covers
// comments/strings/numbers/keywords well enough to break up a wall of
// monochrome text, without pulling in a full highlighter dependency.
export function highlightCode(code: string): string {
  const tokenPattern = /(\/\/.*$|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_]\w*\b)/gm;
  let out = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(code)) !== null) {
    out += escapeHtml(code.slice(lastIndex, match.index));
    const [full, comment, str, num, word] = match;
    if (comment) out += `<span class="tok-com">${escapeHtml(comment)}</span>`;
    else if (str) out += `<span class="tok-str">${escapeHtml(str)}</span>`;
    else if (num) out += `<span class="tok-num">${escapeHtml(num)}</span>`;
    else if (word && KEYWORDS.has(word)) out += `<span class="tok-kw">${escapeHtml(word)}</span>`;
    else out += escapeHtml(full);
    lastIndex = match.index + full.length;
  }
  out += escapeHtml(code.slice(lastIndex));
  return out;
}

export const IMAGE_ASPECT_RATIOS: Array<{ value: ImageAspectRatio; label: string }> = [
  { value: "1:1", label: "Square" },
  { value: "16:9", label: "Landscape" },
  { value: "9:16", label: "Portrait" },
  { value: "4:3", label: "Classic" },
  { value: "3:4", label: "Tall" },
];

export const IMAGE_COST_USD: Record<ImageResolution, number> = {
  "1K": 0.03,
  "2K": 0.05,
  "4K": 0.08,
};

export function codeBlockFileName(lang: string): string {
  const ext = lang?.trim() ? lang.trim().toLowerCase() : "txt";
  return `snippet.${ext}`;
}

export function codeBlockSize(code: string): string {
  const bytes = new TextEncoder().encode(code).length;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

// R9.2: research report export. Both paths are client-only (no export
// API) since the report text is already fully available in the message.
export function reportFileBaseName(query: string): string {
  const slug = query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "research-report";
}

export function buildReportHtmlDocument(query: string, reportText: string): string {
  const escapedTitle = query.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const bodyHtml = renderToStaticMarkup(createElement(MarkdownMessage, { text: reportText }));
  return `<!DOCTYPE html><html><head><title>${escapedTitle || "Research report"}</title>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 720px; margin: 40px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.65; }
  h1.report-title { font-size: 20px; margin-bottom: 24px; }
  .markdown-message :is(h1, h2, h3) { margin-top: 24px; }
  .markdown-message a { color: #2563eb; }
  .markdown-message pre { background: #f4f4f5; padding: 12px; border-radius: 6px; overflow-x: auto; }
  .markdown-message code { background: #f4f4f5; padding: 1px 4px; border-radius: 3px; }
</style></head>
<body><h1 class="report-title">${escapedTitle}</h1>${bodyHtml}</body></html>`;
}

export function mixHex(hex: string, bgHex: string, ratio: number): string {
  const a = hex.replace("#", "");
  const b = bgHex.replace("#", "");
  const ar = parseInt(a.slice(0, 2), 16);
  const ag = parseInt(a.slice(2, 4), 16);
  const ab = parseInt(a.slice(4, 6), 16);
  const br = parseInt(b.slice(0, 2), 16);
  const bg = parseInt(b.slice(2, 4), 16);
  const bb = parseInt(b.slice(4, 6), 16);
  const r = Math.round(ar * ratio + br * (1 - ratio));
  const g = Math.round(ag * ratio + bg * (1 - ratio));
  const bl = Math.round(ab * ratio + bb * (1 - ratio));
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}
