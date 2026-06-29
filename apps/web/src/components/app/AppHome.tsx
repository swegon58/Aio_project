"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useChat } from "@ai-sdk/react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock,
  Cog,
  Columns,
  Copy,
  Download,
  Eye,
  File,
  FileCode,
  Folder,
  HelpCircle,
  Home,
  ImageIcon,
  ListChecks,
  ListTree,
  Loader2,
  Lock,
  Maximize2,
  Menu,
  Mic,
  Minimize2,
  Pause,
  Paperclip,
  PenLine,
  Play,
  Plus,
  Send,
  SkipForward,
  TerminalSquare,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Mascot, MascotStatusBadge } from "@/components/app/Mascot";
import { MarkdownMessage } from "@/components/app/MarkdownMessage";
import { DotGrid } from "@/components/app/DotGrid";
import TextType from "@/components/app/TextType";
import { TASK_TEMPLATES } from "@/components/app/TemplateGallery";
import { AgentStateBadge, RunTimeline, legacyFrontendEventsToAioRunEvents } from "@/components/app/run-timeline";
import { ResearchProgressCard } from "@/components/app/ResearchProgressCard";
import { ChatModeMenu } from "@/components/app/ChatModeMenu";
import {
  GeneratedImageCard,
  ImageGenerationProgress,
} from "@/components/app/GeneratedImageCard";
import { PanelEmpty, PanelLoading } from "@/components/ui/panel-state";
import { SettingsModal, type AccentKey } from "@/components/app/SettingsModal";
import { brand } from "@/lib/brand.config";
import type { AioChatMode } from "@/lib/aio/chat/chat-mode";
import {
  fetchConversationRuns,
  fetchRun,
  fetchRunEvents,
  isRunTerminal,
  isRunStoppable,
  requestRunStop,
} from "@/lib/aio/runs/run-client";
import {
  mascotStateForTool,
  type AioGeneratedImage,
  type HermesActivityData,
  type HermesApprovalData,
  type HermesCreditsData,
  type HermesShowcaseData,
  type HermesUIMessage,
  type MascotImageState,
} from "@/lib/hermes/chat-types";
import type { AioRunEvent, AioRunStatus } from "@/lib/aio/runs/aio-run-events";
import "@/app/(app)/app/mockup.css";

// Mirrors route.ts PLAN_MODE_INSTRUCTIONS' aio-question protocol: a
// clarifying turn is ONLY a ```aio-question fenced JSON block, nothing else.
// Returns null for a normal/final-plan turn so callers fall back to the
// existing Run/Adjust/Cancel plan card.
interface PlanQuestion {
  question: string;
  choices: string[];
  recommended?: number;
}

function parsePlanQuestion(text: string): PlanQuestion | null {
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

type MessageSegment =
  | { type: "text"; value: string }
  | { type: "code"; lang: string; code: string };

// Splits an assistant message into text/code segments so code blocks can be
// rendered as clickable chips in chat instead of inline (keeps chat bubbles
// short; full code lives in the workspace panel).
function splitMessageSegments(text: string): MessageSegment[] {
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

function deriveMascotState(
  status: "submitted" | "streaming" | "ready" | "error",
  activity: HermesActivityData[],
  hasText: boolean,
): MascotImageState {
  const runningTool = activity.find((item) => item.kind === "tool" && item.status === "running");
  if (runningTool && runningTool.kind === "tool") return mascotStateForTool(runningTool.tool);
  if (status === "submitted" || (status === "streaming" && !hasText)) return "thinking";
  return "idle";
}

function runEventKey(event: AioRunEvent): string {
  if ("toolCallId" in event) return `${event.type}:${event.toolCallId}`;
  if ("approvalId" in event) return `${event.type}:${event.approvalId}`;
  if ("artifactId" in event) return `${event.type}:${event.artifactId}`;
  if ("taskId" in event) return `${event.type}:${event.taskId}`;
  return `${event.type}:${event.runId}:${event.createdAt}`;
}

function upsertRunEvent(events: AioRunEvent[], event: AioRunEvent): AioRunEvent[] {
  const key = runEventKey(event);
  const index = events.findIndex((item) => runEventKey(item) === key);
  const next = index === -1 ? [...events, event] : events.map((item, i) => (i === index ? event : item));
  return next.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function isPendingRunShellEvent(event: AioRunEvent): boolean {
  return event.type === "run.created" && event.runId.startsWith("pending:");
}

function mergeDurableRunEvents(existing: AioRunEvent[], incoming: AioRunEvent[]): AioRunEvent[] {
  let next = existing.filter((event) => !isPendingRunShellEvent(event));
  for (const event of incoming) {
    next = upsertRunEvent(next, event);
  }
  return next;
}

function pendingApprovalFromRunEvents(
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

function badgeStateForRunStatus(
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

function labelForRunStatus(status: AioRunStatus | null): string {
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

type FilesSubTab = "gallery" | "files";
type TodayAction = "plan" | "run" | "schedule" | "ignore";

interface TodayCard {
  id: string;
  kind: "continue" | "review" | "create" | "schedule";
  label: string;
  title: string;
  reason: string;
  source: string;
  prompt: string;
}

interface MetaLogEntry {
  id: string;
  text: string;
  ts: number;
}

// Aio Output is a human-facing inspector for the current task. Compact
// keeps the chat primary; focus gives previews more room without turning
// the product into a developer terminal.
type TerminalScale = "compact" | "focus";
type TerminalTab = "activity" | "preview";

// File the agent is actively touching right now, derived from the live
// activity stream (most recent tool entry that carries a filePath).
interface ActiveFile {
  filePath: string;
  fileName?: string;
}

const LIVE_PREVIEW_EXTS = new Set(["html", "htm", "js", "jsx", "ts", "tsx"]);
const PDF_EXTS = new Set(["pdf"]);
const DOC_EXTS = new Set(["doc", "docx"]);
const SHEET_EXTS = new Set(["xlsx", "csv"]);
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const MARKDOWN_EXTS = new Set(["md", "markdown"]);

const KEYWORDS = new Set([
  "function", "const", "let", "var", "return", "if", "else", "for", "while",
  "import", "export", "from", "default", "class", "extends", "new", "this",
  "async", "await", "try", "catch", "finally", "throw", "typeof", "interface",
  "type", "public", "private", "static", "void", "null", "undefined", "true",
  "false", "def", "self", "elif", "import", "as", "with", "lambda", "yield",
]);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// Minimal regex tokenizer for the terminal's code blocks — covers
// comments/strings/numbers/keywords well enough to break up a wall of
// monochrome text, without pulling in a full highlighter dependency.
function highlightCode(code: string): string {
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

// Q11: error chip shows a short line + an expand toggle for the full
// stdout/traceback, instead of dumping it inline.
function ShowcaseErrorDetail({ stdout }: { stdout?: string }) {
  const [open, setOpen] = useState(false);
  if (!stdout) return null;
  const firstLine = stdout.trim().split("\n").pop() ?? stdout;
  return (
    <div className="showcase-chip-log" style={{ fontSize: 11.5, color: "var(--aio-error, #e25c5c)", marginTop: 2 }}>
      <span className="truncate">{firstLine}</span>
      <button type="button" className="showcase-chip-log-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide log" : "View full log"}
      </button>
      {open && <pre className="workspace-code-block">{stdout}</pre>}
    </div>
  );
}

// Preview-tab integration point: renders the live-edited file inline in the
// Aio Terminal panel, switching on extension.
function PreviewPane({ file }: { file: ActiveFile | null }) {
  if (!file) {
    return (
      <div className="terminal-preview-empty">
        No preview available yet.
      </div>
    );
  }

  const name = file.fileName ?? file.filePath;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  let body: React.ReactNode;
  if (LIVE_PREVIEW_EXTS.has(ext)) {
    body = <LiveAppPreview />;
  } else if (PDF_EXTS.has(ext)) {
    body = <PdfPreview url={file.filePath} />;
  } else if (DOC_EXTS.has(ext)) {
    body = <DocPreview url={file.filePath} />;
  } else if (SHEET_EXTS.has(ext)) {
    body = <SheetPreview url={file.filePath} isCsv={ext === "csv"} />;
  } else if (IMAGE_EXTS.has(ext)) {
    body = (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary proxied artifact URL, not a static asset
      <img src={file.filePath} alt={name} className="terminal-preview-image" />
    );
  } else if (MARKDOWN_EXTS.has(ext)) {
    body = <MarkdownPreview url={file.filePath} />;
  } else {
    body = <div className="terminal-preview-placeholder">Preview for this file type will render here.</div>;
  }

  return (
    <div className="terminal-preview-pane">
      <div className="terminal-preview-filename">{name}</div>
      {body}
    </div>
  );
}

// Fetches text/JSON content from the existing artifact-fetch URL
// (/api/chat/artifact?runId=...&path=...) shared by all non-image preview
// branches.
function useArtifactFetch<T>(
  url: string,
  parse: (res: Response) => Promise<T>,
): { data: T | null; error: string | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setLoading(true);
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
        return parse(res);
      })
      .then((parsed) => {
        if (!cancelled) setData(parsed);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parse is a stable inline fn per call site
  }, [url]);

  return { data, error, loading };
}

function PdfPreview({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const docRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPageNum(1);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.2 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageNum, numPages]);

  if (error) return <div className="terminal-preview-placeholder">Couldn&apos;t load PDF: {error}</div>;

  return (
    <div className="terminal-preview-pdf">
      <canvas ref={canvasRef} className="terminal-preview-pdf-canvas" />
      {numPages > 1 && (
        <div className="terminal-preview-pdf-nav">
          <button
            type="button"
            disabled={pageNum <= 1}
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span>
            {pageNum} / {numPages}
          </span>
          <button
            type="button"
            disabled={pageNum >= numPages}
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function DocPreview({ url }: { url: string }) {
  const { data, error, loading } = useArtifactFetch(url, async (res) => {
    const mammoth = await import("mammoth");
    const arrayBuffer = await res.arrayBuffer();
    const { value } = await mammoth.convertToHtml({ arrayBuffer });
    return value;
  });

  if (loading) return <div className="terminal-preview-placeholder">Loading document…</div>;
  if (error) return <div className="terminal-preview-placeholder">Couldn&apos;t load document: {error}</div>;
  return (
    <div
      className="terminal-preview-doc"
      dangerouslySetInnerHTML={{ __html: data ?? "" }}
    />
  );
}

function SheetPreview({ url, isCsv }: { url: string; isCsv: boolean }) {
  type SheetCell = string | number | boolean | Date | null;
  type SheetRows = SheetCell[][];

  const { data, error, loading } = useArtifactFetch<SheetRows>(url, async (res) => {
    if (isCsv) {
      const Papa = (await import("papaparse")).default;
      const result = Papa.parse<SheetCell[]>(await res.text(), { skipEmptyLines: true });
      if (result.errors.length > 0) throw new Error(result.errors[0].message);
      return result.data;
    }

    const { readSheet } = await import("read-excel-file/browser");
    return readSheet(await res.arrayBuffer()) as Promise<SheetRows>;
  });

  if (loading) return <div className="terminal-preview-placeholder">Loading spreadsheet…</div>;
  if (error) return <div className="terminal-preview-placeholder">Couldn&apos;t load spreadsheet: {error}</div>;
  return (
    <div className="terminal-preview-sheet">
      <table>
        <tbody>
          {(data ?? []).map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>
                  {cell instanceof Date ? cell.toLocaleString() : String(cell ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownPreview({ url }: { url: string }) {
  const { data, error, loading } = useArtifactFetch(url, (res) => res.text());

  if (loading) return <div className="terminal-preview-placeholder">Loading…</div>;
  if (error) return <div className="terminal-preview-placeholder">Couldn&apos;t load file: {error}</div>;
  return (
    <div className="terminal-preview-markdown">
      <MarkdownMessage text={data ?? ""} />
    </div>
  );
}

// Live app preview (html/js/jsx/ts/tsx): asks the gateway for this session's
// host workspace dir, starts (or reuses) a Docker preview for it, then loads
// the resulting same-origin proxy URL in a sandboxed iframe.
function LiveAppPreview() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<{ reason: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/preview/start", { method: "POST" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw { reason: body.error ?? "preview_failed", message: body.message ?? "Failed to start preview" };
        return body as { previewUrl: string };
      })
      .then((body) => {
        if (!cancelled) setPreviewUrl(body.previewUrl);
      })
      .catch((err: { reason?: string; message?: string }) => {
        if (!cancelled) {
          setError({
            reason: err.reason ?? "preview_failed",
            message: err.message ?? "Failed to start preview",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="terminal-preview-placeholder">Starting live preview…</div>;
  if (error?.reason === "remote_environment") {
    return (
      <div className="terminal-preview-placeholder">
        Live preview needs a local workspace; this session is running remote.
      </div>
    );
  }
  if (error) {
    return <div className="terminal-preview-placeholder">Couldn&apos;t start live preview: {error.message}</div>;
  }
  if (!previewUrl) return null;

  return (
    <iframe
      src={previewUrl}
      className="terminal-preview-iframe"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      title="Live app preview"
    />
  );
}

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  enabled?: boolean;
  next_run?: string | null;
  last_run?: string | null;
}

interface GalleryImage {
  id: string;
  sessionId: string | null;
  caption: string | null;
  createdAt: string;
  url: string | null;
}

type ImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
type ImageResolution = "1K" | "2K" | "4K";
type ImageGenerationStatus = "preparing" | "generating" | "saving";

const IMAGE_ASPECT_RATIOS: Array<{ value: ImageAspectRatio; label: string }> = [
  { value: "1:1", label: "Square" },
  { value: "16:9", label: "Landscape" },
  { value: "9:16", label: "Portrait" },
  { value: "4:3", label: "Classic" },
  { value: "3:4", label: "Tall" },
];

const IMAGE_COST_USD: Record<ImageResolution, number> = {
  "1K": 0.03,
  "2K": 0.05,
  "4K": 0.08,
};

interface ConnectionStatus {
  id: string;
  label: string;
  tokenEnvVar: string;
  connected: boolean;
}

interface CredentialStatus {
  id: string;
  label: string;
  envVar: string;
  set: boolean;
  masked: string | null;
}

interface KnowledgeFile {
  id: string;
  filename: string;
  status: string;
  chunkCount: number;
  error: string | null;
  createdAt: string;
}

type KanbanStatus = "todo" | "ready" | "running" | "scheduled" | "blocked" | "done" | "archived";

interface KanbanTask {
  id: string;
  title: string;
  status: string;
  assignee: string | null;
}

interface KanbanBoard {
  statuses: KanbanStatus[];
  columns: Record<string, KanbanTask[]>;
}

interface FileTreeEntry {
  name: string;
  type: "dir" | "file";
  size: number | null;
  mtime: number;
}

interface MemorySnapshot {
  available: boolean;
  summary?: string | null;
  facts?: string[];
  error?: string;
  reason?: string;
}

const TODAY_CARDS: TodayCard[] = [
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

// ponytail: nav targets beyond Home are placeholders, no routes yet — boss said he'll wire them up later
const ICON_RAIL_ITEMS = [
  { key: "home", label: "Home", icon: Home, active: true },
  { key: "scheduled", label: "Scheduled", icon: Clock, active: false },
  { key: "agents", label: "Agents", icon: Users, active: false },
  { key: "tasks", label: "Tasks", icon: ListChecks, active: false },
  { key: "knowledge", label: "Knowledge", icon: Brain, active: false },
  { key: "analytics", label: "Analytics", icon: BarChart3, active: false },
  { key: "settings", label: "Settings", icon: Cog, active: false },
] as const;

const ACCENT_HEX: Record<AccentKey, string> = {
  purple: "#6c5ce7",
  green: "#00d2a0",
  blue: "#0081f2",
  pink: "#fd79a8",
  orange: "#ffa726",
  cyan: "#00cec9",
  red: "#ff6b6b",
};

const BG_HEX: Record<"dark" | "light", string> = {
  dark: "#090909",
  light: "#f5f5fa",
};

function mixHex(hex: string, bgHex: string, ratio: number): string {
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

interface AppHomeProps {
  email: string;
}

export function AppHome({ email }: AppHomeProps) {
  const [activity, setActivity] = useState<HermesActivityData[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runEvents, setRunEvents] = useState<AioRunEvent[]>([]);
  const [persistedRunStatus, setPersistedRunStatus] = useState<AioRunStatus | null>(null);
  const [persistedEventSequence, setPersistedEventSequence] = useState(-1);
  const [timelineHydrating, setTimelineHydrating] = useState(false);
  const [timelineSyncError, setTimelineSyncError] = useState<string | null>(null);
  const [runStopPending, setRunStopPending] = useState(false);
  const [runStopError, setRunStopError] = useState<string | null>(null);
  // code_exec showcase cards (grill-log agent-capability-showcase-cards
  // Q2/Q4/Q8): one task in flight per turn (scope-locked), live updates land
  // here; `activeShowcaseTaskId` drives both the chat-chip lookup and the
  // auto-switch of the right panel to the "showcase" tab while running.
  const [showcases, setShowcases] = useState<HermesShowcaseData[]>([]);
  // Which showcase task is shown in the right panel / mobile sheet. Holds the
  // full data (not just an id) so a click on a *persisted* (reload-restored)
  // chip works without re-searching the live `showcases` array.
  const [openShowcase, setOpenShowcase] = useState<HermesShowcaseData | null>(null);
  const [mobileShowcaseOpen, setMobileShowcaseOpen] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<
    Extract<HermesApprovalData, { kind: "request" }> | null
  >(null);
  // Plan mode (stateless plan-gate): flipped true when the user submits with
  // the Auto/Plan toggle on "plan". When that turn finishes (status → ready),
  // the Run/Adjust/Cancel card renders under the assistant message. Any action
  // (or the next submit) clears it.
  const [planAwaitingAction, setPlanAwaitingAction] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditUsage, setCreditUsage] = useState<HermesCreditsData | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const { messages, sendMessage, status, setMessages, stop, error: chatError, regenerate, clearError } = useChat<HermesUIMessage>({
    onData: (dataPart) => {
      if (dataPart.type === "data-aio-event") {
        setRunEvents((prev) => mergeDurableRunEvents(prev, [dataPart.data]));
        if (dataPart.data.type === "run.created") setPersistedRunStatus(dataPart.data.status);
        if (dataPart.data.type === "approval.requested") setPersistedRunStatus("waiting_approval");
        if (dataPart.data.type === "run.completed") setPersistedRunStatus("completed");
        if (dataPart.data.type === "run.failed") setPersistedRunStatus("failed");
        if (dataPart.data.type === "run.cancelled") setPersistedRunStatus("cancelled");
        return;
      }
      if (dataPart.type === "data-aio-run" || dataPart.type === "data-hermes-run") {
        // Brand-new chat (sent before "New Chat" was ever clicked, so
        // activeConversationId is still null) — capture the server-assigned
        // thread id now, otherwise the reload-restore effect has no id to
        // look up and the whole turn vanishes on refresh.
        setActiveConversationId((prev) => prev ?? dataPart.data.threadId);
        setActiveRunId(dataPart.data.runId);
        setTimelineSyncError(null);
        setRunEvents((prev) => prev.filter((event) => !isPendingRunShellEvent(event)));
        return;
      }
      if (dataPart.type === "data-aio-credits" || dataPart.type === "data-hermes-credits") {
        setCreditBalance(dataPart.data.balance);
        setCreditUsage(dataPart.data);
        return;
      }
      if (dataPart.type === "data-aio-compression" || dataPart.type === "data-hermes-compression") {
        setIsCompressing(dataPart.data.active);
        return;
      }
      if (dataPart.type === "data-aio-approval" || dataPart.type === "data-hermes-approval") {
        const incoming = dataPart.data;
        if (incoming.kind === "request") {
          setPendingApproval(incoming);
        } else {
          setPendingApproval((prev) => (prev?.requestId === incoming.requestId ? null : prev));
        }
        return;
      }
      if (dataPart.type === "data-aio-showcase" || dataPart.type === "data-hermes-showcase") {
        const incoming = dataPart.data;
        setShowcases((prev) => {
          const index = prev.findIndex((item) => item.taskId === incoming.taskId);
          if (index === -1) return [...prev, incoming];
          const next = [...prev];
          next[index] = incoming;
          return next;
        });
        // Q4: auto-switch the right panel to follow the task live, not just
        // on chip click (chip itself stays disabled while running — Q8).
        setOpenShowcase(incoming);
        if (!isMobileViewport) setRightPanelCollapsed(false);
        return;
      }
      if (dataPart.type !== "data-aio-activity" && dataPart.type !== "data-hermes-activity") return;
      const incoming = dataPart.data;
      setActivity((prev) => {
        if (incoming.kind === "tool") {
          const index = prev.findIndex((item) => item.kind === "tool" && item.toolCallId === incoming.toolCallId);
          if (index === -1) return [...prev, incoming];
          const next = [...prev];
          next[index] = incoming;
          return next;
        }
        return [...prev, incoming];
      });
    },
  });

  const [input, setInput] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmDeleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadConversationRequestRef = useRef<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [iconRailMobileOpen, setIconRailMobileOpen] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [filesSubTab, setFilesSubTab] = useState<FilesSubTab>("gallery");
  const [metaLog, setMetaLog] = useState<MetaLogEntry[]>([]);
  const logMeta = (text: string) =>
    setMetaLog((prev) => [{ id: `${Date.now()}-${Math.random()}`, text, ts: Date.now() }, ...prev].slice(0, 20));
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalScale, setTerminalScale] = useState<TerminalScale>("compact");
  const [terminalTab, setTerminalTab] = useState<TerminalTab>("activity");
  const cycleTerminal = () => {
    if (!terminalOpen) {
      setTerminalOpen(true);
      setTerminalScale("compact");
    } else {
      setTerminalOpen(false);
      setTerminalScale("compact");
    }
  };
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(null);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [tokenPlatform, setTokenPlatform] = useState("");
  const [tokenValue, setTokenValue] = useState("");
  const [tokenSubmitting, setTokenSubmitting] = useState(false);
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const [kanban, setKanban] = useState<KanbanBoard | null>(null);
  const [kanbanError, setKanbanError] = useState<string | null>(null);
  const [memorySnapshot, setMemorySnapshot] = useState<MemorySnapshot | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[] | null>(null);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[] | null>(null);
  const [cronError, setCronError] = useState<string | null>(null);
  const [cronLocked, setCronLocked] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgradeToBusiness = async () => {
    setUpgrading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "plan", planTier: "business" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const session = await res.json();
      window.location.href = session.url;
    } catch (err) {
      console.error("Upgrade checkout failed:", err);
      setUpgrading(false);
    }
  };
  const [cronActionPending, setCronActionPending] = useState<string | null>(null);
  const [cronName, setCronName] = useState("");
  const [cronSchedule, setCronSchedule] = useState("");
  const [cronPrompt, setCronPrompt] = useState("");
  const [cronCreating, setCronCreating] = useState(false);
  const [cronCreateMessage, setCronCreateMessage] = useState<string | null>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const [fileTreePath, setFileTreePath] = useState(".");
  const [fileTreeEntries, setFileTreeEntries] = useState<FileTreeEntry[] | null>(null);
  const [fileTreeError, setFileTreeError] = useState<string | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);
  const [credentials, setCredentials] = useState<CredentialStatus[] | null>(null);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [credentialId, setCredentialId] = useState("");
  const [credentialValue, setCredentialValue] = useState("");
  const [credentialSubmitting, setCredentialSubmitting] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState<string | null>(null);
  const [conversations, setConversations] = useState<
    { id: string; title: string; updatedAt: string }[] | null
  >(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[] | null>(null);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [knowledgeUploading, setKnowledgeUploading] = useState(false);
  const knowledgeFileInputRef = useRef<HTMLInputElement>(null);
  const [ignoredTodayCards, setIgnoredTodayCards] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accent, setAccent] = useState<AccentKey>("blue");
  const resetRunTimeline = () => {
    setActiveRunId(null);
    setRunEvents([]);
    setPersistedRunStatus(null);
    setPersistedEventSequence(-1);
    setTimelineSyncError(null);
    setRunStopPending(false);
    setRunStopError(null);
  };
  const primeOptimisticRun = () => {
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    setActiveRunId(null);
    setPersistedRunStatus("queued");
    setPersistedEventSequence(-1);
    setTimelineSyncError(null);
    setRunStopPending(false);
    setRunStopError(null);
    setRunEvents([
      {
        type: "run.created",
        runId: `pending:${now}`,
        threadId: activeConversationId ?? "pending-thread",
        status: "queued",
        createdAt,
        ts: now,
      },
    ]);
  };

  // Read persisted prefs only after mount — reading localStorage during the
  // useState initializer makes the client's first render diverge from SSR
  // output (server always sees "dark"/"blue"), which React reports as a
  // hydration mismatch.
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  useEffect(() => {
    const storedTheme = localStorage.getItem("aio-theme");
    if (storedTheme === "light") setTheme("light");
    const storedAccent = localStorage.getItem("aio-accent") as AccentKey | null;
    if (storedAccent) setAccent(storedAccent);
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (window.innerWidth <= 768) setSidebarCollapsed(true);
  }, []);

  // Initial usage-meter read — without this, balance/usedPercent stay null
  // until the user sends a first chat message (data-hermes-credits only
  // arrives mid-stream). A later data-hermes-credits event still overwrites
  // this once a run actually settles.
  useEffect(() => {
    fetch("/api/credits")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: HermesCreditsData | null) => {
        if (!data) return;
        setCreditBalance(data.balance);
        setCreditUsage(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (prefsHydrated) localStorage.setItem("aio-theme", theme);
  }, [theme, prefsHydrated]);

  useEffect(() => {
    if (prefsHydrated) localStorage.setItem("aio-accent", accent);
  }, [accent, prefsHydrated]);

  const [inputFocused, setInputFocused] = useState(false);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const [inputMultiline, setInputMultiline] = useState(false);
  const [chatMode, setChatMode] = useState<AioChatMode>("auto");
  const [lastRunMode, setLastRunMode] = useState<AioChatMode>("auto");
  const [activeResearchQuery, setActiveResearchQuery] = useState("");
  const [planOtherText, setPlanOtherText] = useState("");
  const [imageComposerActive, setImageComposerActive] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<ImageAspectRatio>("1:1");
  const [imageResolution, setImageResolution] = useState<ImageResolution>("1K");
  const [imageReference, setImageReference] = useState<AioGeneratedImage | null>(null);
  const [imageGenerationStatus, setImageGenerationStatus] =
    useState<ImageGenerationStatus | null>(null);
  const [imageGenerationError, setImageGenerationError] = useState<string | null>(null);
  const [imageLastPrompt, setImageLastPrompt] = useState("");
  const imageGenerationAbortRef = useRef<AbortController | null>(null);

  const composerMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!composerMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (!composerMenuRef.current?.contains(e.target as Node)) {
        setComposerMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setComposerMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [composerMenuOpen]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const handleChatScroll = () => {
    const el = chatAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 200);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId((current) => (current === id ? null : current)), 1500);
    });
  };

  const codeBlockFileName = (lang: string) => {
    const ext = lang?.trim() ? lang.trim().toLowerCase() : "txt";
    return `snippet.${ext}`;
  };

  const codeBlockSize = (code: string) => {
    const bytes = new TextEncoder().encode(code).length;
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  };

  const handleDownloadCodeBlock = (lang: string, code: string) => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = codeBlockFileName(lang);
    a.click();
    URL.revokeObjectURL(url);
  };

  const activateImageComposer = (reference: AioGeneratedImage | null = null) => {
    setImageComposerActive(true);
    setImageReference(reference);
    setImageGenerationError(null);
    setComposerMenuOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleGeneratedImageOpen = (image: AioGeneratedImage) => {
    setLightboxImage({
      id: image.id,
      sessionId: null,
      caption: image.prompt,
      createdAt: image.createdAt,
      url: image.url,
    });
  };

  const handleGeneratedImageEdit = (image: AioGeneratedImage) => {
    activateImageComposer(image);
    setInput("Edit this image: ");
  };

  const handleGeneratedImageVariation = (image: AioGeneratedImage) => {
    activateImageComposer(image);
    setInput("Create a new variation with ");
  };

  const cancelImageGeneration = () => {
    imageGenerationAbortRef.current?.abort();
    imageGenerationAbortRef.current = null;
    setImageGenerationStatus(null);
  };

  const submitImageGeneration = async (prompt: string) => {
    setImageLastPrompt(prompt);
    const userMessage: HermesUIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: prompt }],
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setImageGenerationError(null);
    setImageGenerationStatus("preparing");
    setActivity([]);
    resetRunTimeline();
    setPlanAwaitingAction(false);

    const controller = new AbortController();
    imageGenerationAbortRef.current = controller;

    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          aspectRatio: imageAspectRatio,
          resolution: imageResolution,
          referenceImageId: imageReference?.id ?? null,
          messages: nextMessages,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? `Image generation failed (${response.status}).`);
      }
      if (!response.body) throw new Error("Image generation returned no response stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let resultImage: AioGeneratedImage | null = null;
      let resultThreadId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: "status" | "result" | "error";
            status?: ImageGenerationStatus;
            image?: AioGeneratedImage;
            threadId?: string;
            message?: string;
          };
          if (event.type === "status" && event.status) {
            setImageGenerationStatus(event.status);
          } else if (event.type === "error") {
            throw new Error(event.message || "Image generation failed.");
          } else if (event.type === "result" && event.image) {
            resultImage = event.image;
            resultThreadId = event.threadId ?? null;
          }
        }
        if (done) break;
      }

      if (!resultImage) throw new Error("Image generation finished without an image.");
      const assistantMessage: HermesUIMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [{ type: "text", text: "Your image is ready." }],
        metadata: { mode: "auto", images: [resultImage] },
      };
      setMessages([...nextMessages, assistantMessage]);
      setActiveConversationId((current) => current ?? resultThreadId);
      setGalleryImages((current) => {
        const galleryImage: GalleryImage = {
          id: resultImage.id,
          sessionId: null,
          caption: resultImage.prompt,
          createdAt: resultImage.createdAt,
          url: resultImage.url,
        };
        return current ? [galleryImage, ...current.filter((item) => item.id !== resultImage.id)] : [galleryImage];
      });
      setImageReference(null);
      logMeta(`Created a ${resultImage.resolution} image and saved it to Gallery`);
      void loadConversations();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (error) {
      if (controller.signal.aborted) {
        setImageGenerationError("Image generation cancelled.");
      } else {
        setImageGenerationError(error instanceof Error ? error.message : "Image generation failed.");
      }
    } finally {
      if (imageGenerationAbortRef.current === controller) imageGenerationAbortRef.current = null;
      setImageGenerationStatus(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== "ready" || imageGenerationStatus) return;
    const submittedText = input.trim();
    if (imageComposerActive) {
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      setInputMultiline(false);
      void submitImageGeneration(submittedText);
      return;
    }
    setActivity([]);
    primeOptimisticRun();
    setShowcases([]);
    setPendingApproval(null);
    setPlanAwaitingAction(chatMode === "plan");
    setLastRunMode(chatMode);
    if (chatMode === "research") setActiveResearchQuery(submittedText);
    sendMessage({ text: submittedText }, { body: { mode: chatMode } });
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setInputMultiline(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    setInputMultiline(el.scrollHeight > 40);
  };

  const focusComposer = () => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleResearchStopAndEdit = (query: string) => {
    if (status !== "ready") void stop();
    setChatMode("research");
    setInput(query);
    focusComposer();
  };

  const handleDurableRunStop = async () => {
    if (!activeRunId || !persistedRunStatus || !isRunStoppable(persistedRunStatus) || runStopPending) return;
    setRunStopPending(true);
    setRunStopError(null);
    try {
      const result = await requestRunStop(activeRunId);
      setPersistedRunStatus(result.run.status);
      if (status !== "ready") void stop();
      if (result.message && !result.ok) {
        setRunStopError(result.message);
      }
    } catch (error) {
      setRunStopError(error instanceof Error ? error.message : "Failed to stop the current run.");
    } finally {
      setRunStopPending(false);
    }
  };

  const handleTodayAction = (card: TodayCard, action: TodayAction) => {
    if (action === "ignore") {
      setIgnoredTodayCards((prev) => {
        const next = new Set(prev);
        next.add(card.id);
        return next;
      });
      return;
    }

    if (action === "plan") {
      setChatMode("plan");
      setInput(card.prompt);
      focusComposer();
      return;
    }

    if (action === "schedule") {
      setChatMode("plan");
      setInput(`Set up a scheduled Aio follow-up for this: ${card.prompt}`);
      focusComposer();
      return;
    }

    if (status !== "ready") {
      setInput(card.prompt);
      focusComposer();
      return;
    }

    setActivity([]);
    primeOptimisticRun();
    setShowcases([]);
    setPendingApproval(null);
    setPlanAwaitingAction(false);
    setLastRunMode("auto");
    sendMessage({ text: card.prompt }, { body: { mode: "auto" } });
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleRailItemClick = (key: (typeof ICON_RAIL_ITEMS)[number]["key"]) => {
    if (key === "settings") {
      setSettingsOpen(true);
      return;
    }
    if (key === "scheduled") {
      setChatMode("plan");
      setInput("Review my recurring work and help me set up one useful scheduled Aio follow-up.");
      setRightPanelCollapsed(false);
      focusComposer();
    }
  };

  const loadConnections = async () => {
    setConnectionsError(null);
    try {
      const res = await fetch("/api/connections");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setConnections(data.platforms);
      if (!tokenPlatform && data.platforms?.[0]) {
        setTokenPlatform(data.platforms[0].id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setConnectionsError(msg);
    }
  };

  useEffect(() => {
    if (settingsOpen && connections === null) {
      loadConnections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

  const loadConversations = async () => {
    setConversationsError(null);
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setConversations(data.conversations);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setConversationsError(msg);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Refresh the sidebar list once a turn finishes (creates the row, or
  // bumps updated_at / sets the title for the first time).
  useEffect(() => {
    if (status === "ready") loadConversations();
  }, [status]);

  // Shared by the sidebar click handler and the refresh-restore effect below
  // — derives planAwaitingAction straight from the last loaded message's
  // metadata instead of relying on transient session state.
  const applyConversationData = (data: { id: string; messages: HermesUIMessage[] }) => {
    setActiveConversationId(data.id);
    setMessages(data.messages ?? []);
    setActivity([]);
    resetRunTimeline();
    setShowcases([]);
    setPendingApproval(null);
    const last = data.messages?.[data.messages.length - 1];
    const lastMode = last?.metadata?.mode ?? (last?.metadata?.planMode ? "plan" : "auto");
    const awaitingPlan = Boolean(last?.role === "assistant" && lastMode === "plan");
    const latestUserMessage = data.messages?.findLast((message) => message.role === "user");
    const latestUserText = latestUserMessage?.parts
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("") ?? "";
    setPlanAwaitingAction(awaitingPlan);
    // Keep the composer toggle in sync — otherwise a reload mid-plan-mode
    // leaves the question/plan card on screen while the toggle silently
    // reset to "auto", so the next typed answer sends planMode:false.
    setChatMode(lastMode);
    setLastRunMode(lastMode);
    setActiveResearchQuery(lastMode === "research" ? latestUserText : "");
  };

  // Restore the last-active conversation (and its Plan Mode card) on a hard
  // page refresh — activeConversationId otherwise resets to null on mount.
  useEffect(() => {
    const storedId = localStorage.getItem("aio-active-conversation");
    if (!storedId) return;
    loadConversationRequestRef.current = storedId;
    (async () => {
      try {
        const res = await fetch(`/api/conversations/${storedId}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (loadConversationRequestRef.current !== storedId) return;
        applyConversationData(data);
      } catch {
        if (loadConversationRequestRef.current === storedId) loadConversationRequestRef.current = null;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeConversationId) localStorage.setItem("aio-active-conversation", activeConversationId);
    else localStorage.removeItem("aio-active-conversation");
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || status === "submitted" || status === "streaming") return;

    let cancelled = false;
    setTimelineHydrating(true);
    setTimelineSyncError(null);

    (async () => {
      try {
        const runs = await fetchConversationRuns(activeConversationId, 1);
        if (cancelled) return;

        const latestRun = runs[0];
        if (!latestRun) {
          setActiveRunId(null);
          setPersistedRunStatus(null);
          setPersistedEventSequence(-1);
          setRunEvents([]);
          return;
        }

        setActiveRunId(latestRun.id);
        setPersistedRunStatus(latestRun.status);

        const envelopes = await fetchRunEvents(latestRun.id, { limit: 1000 });
        if (cancelled) return;

        setPersistedEventSequence(
          envelopes.length > 0 ? envelopes[envelopes.length - 1].sequence : -1,
        );
        setRunEvents((prev) =>
          mergeDurableRunEvents(
            prev,
            envelopes.map((event) => event.payload),
          ),
        );
      } catch {
        if (!cancelled) {
          setTimelineSyncError("Could not restore the latest saved run. Try re-opening this conversation.");
        }
      } finally {
        if (!cancelled) setTimelineHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, status]);

  useEffect(() => {
    if (
      !activeRunId ||
      !persistedRunStatus ||
      isRunTerminal(persistedRunStatus) ||
      status === "submitted" ||
      status === "streaming" ||
      timelineHydrating
    ) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const [run, envelopes] = await Promise.all([
          fetchRun(activeRunId),
          fetchRunEvents(activeRunId, {
            afterSequence: persistedEventSequence >= 0 ? persistedEventSequence : undefined,
            limit: 1000,
          }),
        ]);
        if (cancelled) return;

        setPersistedRunStatus(run.status);
        setTimelineSyncError(null);
        if (envelopes.length > 0) {
          setPersistedEventSequence(envelopes[envelopes.length - 1].sequence);
          setRunEvents((prev) =>
            mergeDurableRunEvents(
              prev,
              envelopes.map((event) => event.payload),
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setTimelineSyncError("Live updates disconnected. Aio is retrying the saved timeline automatically.");
        }
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeRunId, persistedEventSequence, persistedRunStatus, status, timelineHydrating]);

  useEffect(() => {
    if (status === "submitted" || status === "streaming") return;
    const durableEvents = runEvents.filter((event) => !isPendingRunShellEvent(event));
    if (durableEvents.length === 0) return;
    setPendingApproval(pendingApprovalFromRunEvents(durableEvents));
  }, [runEvents, status]);

  useEffect(() => {
    if (status !== "ready" || activeRunId) return;
    if (!runEvents.some((event) => isPendingRunShellEvent(event))) return;
    setRunEvents((prev) => prev.filter((event) => !isPendingRunShellEvent(event)));
    setPersistedRunStatus(null);
  }, [activeRunId, runEvents, status]);

  const handleNewChat = async () => {
    try {
      const res = await fetch("/api/conversations", { method: "POST" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      loadConversationRequestRef.current = data.id;
      setActiveConversationId(data.id);
      setMessages([]);
      setActivity([]);
      resetRunTimeline();
      setShowcases([]);
      setPendingApproval(null);
      setPlanAwaitingAction(false);
      setLastRunMode("auto");
      setActiveResearchQuery("");
      loadConversations();
      if (window.innerWidth <= 768) setSidebarCollapsed(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setConversationsError(msg);
    }
  };

  const handleLoadConversation = async (id: string) => {
    if (id === activeConversationId) {
      if (window.innerWidth <= 768) setSidebarCollapsed(true);
      return;
    }
    loadConversationRequestRef.current = id;
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      if (loadConversationRequestRef.current !== id) return;
      applyConversationData(data);
      if (window.innerWidth <= 768) setSidebarCollapsed(true);
    } catch (err) {
      if (loadConversationRequestRef.current !== id) return;
      const msg = err instanceof Error ? err.message : String(err);
      setConversationsError(msg);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
      confirmDeleteTimeoutRef.current = setTimeout(() => setConfirmDeleteId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setConversations((prev) => (prev ?? []).filter((c) => c.id !== id));
      logMeta("Deleted a conversation");
      if (id === activeConversationId) {
        loadConversationRequestRef.current = null;
        setActiveConversationId(null);
        setMessages([]);
        setActivity([]);
        resetRunTimeline();
        setShowcases([]);
        setPendingApproval(null);
        setPlanAwaitingAction(false);
        setLastRunMode("auto");
        setActiveResearchQuery("");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setConversationsError(msg);
    }
  };

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingConversationId(id);
    setRenameValue(currentTitle);
  };

  const handleRenameConversation = async (id: string) => {
    const title = renameValue.trim();
    setRenamingConversationId(null);
    if (!title) return;
    const prevTitle = conversations?.find((c) => c.id === id)?.title;
    if (title === prevTitle) return;
    setConversations((prev) => (prev ?? []).map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      logMeta(`Renamed a conversation to "${title}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setConversationsError(msg);
      if (prevTitle !== undefined) {
        setConversations((prev) => (prev ?? []).map((c) => (c.id === id ? { ...c, title: prevTitle } : c)));
      }
    }
  };

  const loadCredentials = async () => {
    setCredentialsError(null);
    try {
      const res = await fetch("/api/credentials");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setCredentials(data.credentials);
      if (!credentialId && data.credentials?.[0]) {
        setCredentialId(data.credentials[0].id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCredentialsError(msg);
    }
  };

  useEffect(() => {
    if (settingsOpen && credentials === null) {
      loadCredentials();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

  const loadKnowledgeFiles = async () => {
    setKnowledgeError(null);
    try {
      const res = await fetch("/api/knowledge");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setKnowledgeFiles(data.files);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setKnowledgeError(msg);
    }
  };

  useEffect(() => {
    if (settingsOpen && knowledgeFiles === null) {
      loadKnowledgeFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

  const handleKnowledgeFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setKnowledgeUploading(true);
    setKnowledgeError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/knowledge", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `status ${res.status}`);
      await loadKnowledgeFiles();
      logMeta(`Uploaded knowledge file "${file.name}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setKnowledgeError(msg);
    } finally {
      setKnowledgeUploading(false);
    }
  };

  const handleKnowledgeDelete = async (id: string) => {
    setKnowledgeFiles((prev) => prev?.filter((f) => f.id !== id) ?? prev);
    try {
      const res = await fetch(`/api/knowledge?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      logMeta("Deleted a knowledge file");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setKnowledgeError(msg);
      await loadKnowledgeFiles();
    }
  };

  const loadKanban = async () => {
    setKanbanError(null);
    try {
      const res = await fetch("/api/kanban");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setKanban(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setKanbanError(msg);
    }
  };

  const loadMemorySnapshot = async () => {
    setMemoryError(null);
    try {
      const res = await fetch("/api/memory");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setMemorySnapshot(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMemoryError(msg);
    }
  };

  useEffect(() => {
    if (kanban === null) {
      loadKanban();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (memorySnapshot === null) {
      loadMemorySnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previousMemoryRunStatus = useRef(status);
  useEffect(() => {
    const wasRunning =
      previousMemoryRunStatus.current === "submitted"
      || previousMemoryRunStatus.current === "streaming";
    previousMemoryRunStatus.current = status;
    if (!wasRunning || status !== "ready") return;

    const refreshTimer = window.setTimeout(() => {
      void loadMemorySnapshot();
    }, 2000);
    return () => window.clearTimeout(refreshTimer);
  }, [status]);

  const loadGallery = async () => {
    setGalleryError(null);
    try {
      const res = await fetch("/api/gallery");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setGalleryImages(data.images);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGalleryError(msg);
    }
  };

  useEffect(() => {
    if (filesSubTab === "gallery" && galleryImages === null) {
      loadGallery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesSubTab]);

  const loadCronJobs = async () => {
    setCronError(null);
    setCronLocked(false);
    try {
      const res = await fetch("/api/cron");
      if (res.status === 403) {
        setCronLocked(true);
        setCronJobs([]);
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      if (data.locked) {
        setCronLocked(true);
        setCronJobs([]);
        return;
      }
      setCronJobs(Array.isArray(data) ? data : data.jobs ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCronError(msg);
    }
  };

  const handleCronAction = async (jobId: string, action: "pause" | "resume" | "run") => {
    setCronActionPending(jobId);
    try {
      const res = await fetch(`/api/cron/${encodeURIComponent(jobId)}?action=${action}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await loadCronJobs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCronError(msg);
    } finally {
      setCronActionPending(null);
    }
  };

  const handleCronDelete = async (jobId: string) => {
    if (confirmDeleteId !== jobId) {
      setConfirmDeleteId(jobId);
      if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
      confirmDeleteTimeoutRef.current = setTimeout(
        () => setConfirmDeleteId((cur) => (cur === jobId ? null : cur)),
        3000,
      );
      return;
    }
    if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
    setConfirmDeleteId(null);
    setCronActionPending(jobId);
    try {
      const res = await fetch(`/api/cron/${encodeURIComponent(jobId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setCronJobs((prev) => prev?.filter((j) => j.id !== jobId) ?? prev);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCronError(msg);
    } finally {
      setCronActionPending(null);
    }
  };

  const handleCronCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cronName.trim() || !cronSchedule.trim()) return;
    setCronCreating(true);
    setCronCreateMessage(null);
    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cronName.trim(),
          schedule: cronSchedule.trim(),
          prompt: cronPrompt.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCronCreateMessage(data.error ?? "Failed to create task");
      } else {
        setCronName("");
        setCronSchedule("");
        setCronPrompt("");
        await loadCronJobs();
      }
    } catch (err) {
      setCronCreateMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setCronCreating(false);
    }
  };

  useEffect(() => {
    if (cronJobs === null) {
      loadCronJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFileTree = async (path: string) => {
    setFileTreeLoading(true);
    setFileTreeError(null);
    try {
      const res = await fetch(`/api/workspace/tree?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (res.status === 409) {
        setFileTreeEntries([]);
        setFileTreeError("no_workspace");
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? `status ${res.status}`);
      setFileTreeEntries(data.entries ?? []);
      setFileTreePath(data.path ?? path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFileTreeError(msg);
    } finally {
      setFileTreeLoading(false);
    }
  };

  useEffect(() => {
    if (filesSubTab === "files" && fileTreeEntries === null) {
      loadFileTree(fileTreePath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesSubTab]);

  const handleGalleryFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setGalleryUploading(true);
    setGalleryError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/gallery", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `status ${res.status}`);
      await loadGallery();
      logMeta(`Saved image "${file.name}" to gallery`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGalleryError(msg);
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleGalleryDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
      confirmDeleteTimeoutRef.current = setTimeout(
        () => setConfirmDeleteId((cur) => (cur === id ? null : cur)),
        3000,
      );
      return;
    }
    if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
    setConfirmDeleteId(null);
    setGalleryImages((prev) => prev?.filter((img) => img.id !== id) ?? prev);
    setLightboxImage((prev) => (prev?.id === id ? null : prev));
    try {
      const res = await fetch(`/api/gallery?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGalleryError(msg);
      await loadGallery();
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenPlatform || !tokenValue.trim()) return;
    setTokenSubmitting(true);
    setTokenMessage(null);
    try {
      const res = await fetch("/api/connections/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: tokenPlatform, token: tokenValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTokenMessage(data.message ?? "Failed to save token");
      } else {
        setTokenValue("");
        setTokenMessage("Saved. Restart the gateway for it to take effect.");
        logMeta(`Saved ${tokenPlatform} connection token`);
        await loadConnections();
      }
    } catch (err) {
      setTokenMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setTokenSubmitting(false);
    }
  };

  const handleTokenRemove = async (platformId: string) => {
    setTokenSubmitting(true);
    setTokenMessage(null);
    try {
      const res = await fetch("/api/connections/token", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platformId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTokenMessage(data.message ?? "Failed to remove token");
      } else {
        setTokenMessage("Removed. Restart the gateway for it to take effect.");
        logMeta(`Removed ${platformId} connection token`);
        await loadConnections();
      }
    } catch (err) {
      setTokenMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setTokenSubmitting(false);
    }
  };

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialId || !credentialValue.trim()) return;
    setCredentialSubmitting(true);
    setCredentialMessage(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: credentialId, value: credentialValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCredentialMessage(data.message ?? "Failed to save credential");
      } else {
        setCredentialValue("");
        setCredentialMessage("Saved. Restart the gateway for it to take effect.");
        logMeta(`Saved credential "${credentialId}"`);
        await loadCredentials();
      }
    } catch (err) {
      setCredentialMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setCredentialSubmitting(false);
    }
  };

  const handleApprovalRespond = async (requestId: string, targetRunId: string, choice: "session" | "deny") => {
    try {
      const res = await fetch("/api/chat/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: targetRunId, choice }),
      });
      if (res.ok) {
        setPendingApproval((prev) => (prev?.requestId === requestId ? null : prev));
      }
    } catch {
      // Network failure — leave the card open so the user can retry.
    }
  };

  // Timeline approval resolve: called from ApprovalCard inside RunTimeline.
  // Maps "approve"→"session" and "reject"→"deny" for the Hermes gateway, then
  // clears the floating input-area approval card if it matches by runId.
  const handleTimelineApprovalResolve = async (approvalId: string, runId: string, choice: "approve" | "reject") => {
    const hermesChoice = choice === "approve" ? "session" : "deny";
    const res = await fetch("/api/chat/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId, choice: hermesChoice }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { message?: string }).message ?? `Request failed: ${res.status}`);
    }
    setPendingApproval((prev) =>
      prev && (prev.requestId === approvalId || prev.runId === runId) ? null : prev,
    );
  };

  // Plan-gate actions. Run = confirm and execute (next turn sent with
  // planMode off; the plan itself is already in conversation history, so the
  // agent picks it up). Adjust = hand focus to the composer so the user can
  // refine (a re-submit re-plans while the toggle stays on "plan"). Cancel =
  // dismiss the card; the plan stays in the transcript, nothing is sent.
  const handlePlanRun = () => {
    if (status !== "ready") return;
    setPlanAwaitingAction(false);
    setChatMode("auto");
    setLastRunMode("auto");
    setActivity([]);
    primeOptimisticRun();
    setShowcases([]);
    setPendingApproval(null);
    sendMessage(
      { text: "Proceed with the plan above, step by step." },
      { body: { mode: "auto" } },
    );
  };
  const handlePlanAdjust = () => {
    setPlanAwaitingAction(false);
    textareaRef.current?.focus();
  };
  const handlePlanCancel = () => {
    setPlanAwaitingAction(false);
    setChatMode("auto");
  };

  // Multi-round clarify (grill-me style): answering a question or skipping
  // ahead is just a normal chat turn with planMode still on — the Q&A lives
  // in ordinary conversation_history, no extra session state to track.
  const handlePlanAnswer = (answer: string) => {
    if (status !== "ready" || !answer.trim()) return;
    setActivity([]);
    primeOptimisticRun();
    setShowcases([]);
    setPendingApproval(null);
    setPlanOtherText("");
    setPlanAwaitingAction(true);
    setLastRunMode("plan");
    sendMessage({ text: answer.trim() }, { body: { mode: "plan" } });
  };
  const handlePlanSkipToPlan = () =>
    handlePlanAnswer("Skip the remaining questions and write the final plan now, using your best judgment for anything still unclear.");

  const lastAssistantMessage = messages.findLast((m) => m.role === "assistant");
  const hasText = Boolean(
    lastAssistantMessage?.parts.some((p) => p.type === "text" && p.text.length > 0),
  );
  const lastAssistantText = lastAssistantMessage?.parts
    .filter((p) => p.type === "text")
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("") ?? "";
  const planQuestion = useMemo(
    () => (planAwaitingAction && hasText ? parsePlanQuestion(lastAssistantText) : null),
    [planAwaitingAction, hasText, lastAssistantText],
  );
  const mascotState = deriveMascotState(status, activity, hasText);
  const isStreaming = status === "submitted" || status === "streaming";

  // A3 — safety net: clear the badge once a run finishes even if a
  // compression.done event was dropped (network hiccup, stream cut short).
  useEffect(() => {
    if (status === "ready" || status === "error") setIsCompressing(false);
  }, [status]);

  const runningTool = activity.findLast((a): a is Extract<HermesActivityData, { kind: "tool" }> =>
    a.kind === "tool" && a.status === "running",
  );
  const lastCompletedTool = activity.findLast(
    (a): a is Extract<HermesActivityData, { kind: "tool" }> => a.kind === "tool",
  );
  const liveStatusText = runningTool
    ? `${brand.name} is using ${runningTool.label ?? runningTool.tool}…`
    : isStreaming
      ? `${brand.name} is thinking…`
      : timelineHydrating
        ? `${brand.name} is restoring the latest run…`
        : persistedRunStatus && !isRunTerminal(persistedRunStatus)
          ? `${brand.name} is reconnecting to the current run…`
      : lastCompletedTool
        ? `${brand.name} last ran ${lastCompletedTool.label ?? lastCompletedTool.tool}`
        : `${brand.name} is ready`;
  const recentActivityCount = activity.length + metaLog.length;
  const memoryLine = memorySnapshot?.available
    ? (memorySnapshot.facts?.length ?? 0) > 0
      ? `${memorySnapshot.facts!.length} memory note${memorySnapshot.facts!.length === 1 ? "" : "s"} available`
      : memorySnapshot.summary
        ? "Memory summary available"
        : "No memory recorded yet"
    : memoryError
      ? "Memory failed to load"
      : "Memory not available";
  const activityLine =
    recentActivityCount > 0
      ? `${recentActivityCount} recent signal${recentActivityCount === 1 ? "" : "s"}`
      : "No recent activity";
  const timelineEvents = useMemo(
    () =>
      runEvents.length > 0
        ? runEvents
        : legacyFrontendEventsToAioRunEvents({
            activity,
            approvals: pendingApproval ? [pendingApproval] : [],
            showcases,
            runId: activeRunId ?? activeConversationId ?? "current-run",
          }),
    [activity, activeConversationId, activeRunId, pendingApproval, runEvents, showcases],
  );
  const durableRunVisible =
    timelineHydrating
    || Boolean(activeRunId)
    || Boolean(persistedRunStatus)
    || timelineEvents.length > 0;
  const currentRunStatusLabel = labelForRunStatus(persistedRunStatus);
  const currentRunBadgeState = badgeStateForRunStatus(persistedRunStatus, {
    hydrating: timelineHydrating,
    syncError: Boolean(timelineSyncError),
  });
  const currentRunNote = timelineHydrating
    ? "Restoring the latest saved run after reload."
    : runStopPending
      ? "Sending a durable stop request to the current run."
      : runStopError
        ? runStopError
        : timelineSyncError
          ? timelineSyncError
          : persistedRunStatus === "cancelling"
            ? "Stop requested. Waiting for the worker to confirm cancellation."
            : persistedRunStatus === "waiting_approval"
              ? "This run is paused until you respond to the approval request."
              : persistedRunStatus && !isRunTerminal(persistedRunStatus)
                ? "This view stays in sync with the persisted run history."
                : timelineEvents.length > 0
                  ? "Latest saved activity is ready to review."
                  : "Start a task to create a durable run.";
  const currentRunTone = runStopError || timelineSyncError
    ? "warning"
    : timelineHydrating || runStopPending
      ? "working"
      : persistedRunStatus === "waiting_approval"
        ? "approval"
        : "default";
  const currentRunCanStop =
    Boolean(activeRunId)
    && Boolean(persistedRunStatus)
    && persistedRunStatus !== null
    && isRunStoppable(persistedRunStatus)
    && !runStopPending;
  const renderCurrentRunCard = (className?: string) => (
    <section className={`current-run-card${className ? ` ${className}` : ""}`} aria-label="Current run">
      <div className="current-run-card-topline">
        <span className="current-run-label">Current Run</span>
        <AgentStateBadge state={currentRunBadgeState} />
      </div>
      <div className="current-run-head">
        <div>
          <h4>{currentRunStatusLabel}</h4>
          <p>{currentRunNote}</p>
        </div>
        {currentRunCanStop && (
          <button
            type="button"
            className="approval-btn deny current-run-stop-btn"
            onClick={() => void handleDurableRunStop()}
            disabled={runStopPending}
          >
            {runStopPending ? <Loader2 className="w-3.5 h-3.5 icon-spin" /> : <Pause className="w-3.5 h-3.5" />}
            {runStopPending ? "Stopping…" : "Stop run"}
          </button>
        )}
      </div>
      <div className={`current-run-banner current-run-banner--${currentRunTone}`}>
        {timelineHydrating || runStopPending ? (
          <Loader2 className="w-3.5 h-3.5 icon-spin" />
        ) : timelineSyncError || runStopError ? (
          <CircleAlert className="w-3.5 h-3.5" />
        ) : persistedRunStatus === "waiting_approval" ? (
          <Clock className="w-3.5 h-3.5" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5" />
        )}
        <span>{currentRunNote}</span>
      </div>
      {timelineEvents.length > 0 ? (
        <div className="current-run-timeline">
          <RunTimeline events={timelineEvents} compact onResolveApproval={handleTimelineApprovalResolve} />
        </div>
      ) : (
        <PanelEmpty icon={<ListTree className="w-5 h-5" />}>
          Durable run activity will appear here.
        </PanelEmpty>
      )}
    </section>
  );
  const activeTodayCards = TODAY_CARDS.filter((card) => !ignoredTodayCards.has(card.id));
  const renderTodayCard = (card: TodayCard) => (
    <button
      key={card.id}
      type="button"
      className={`today-card today-card--${card.kind}`}
      onClick={() => handleTodayAction(card, "plan")}
    >
      <div className="today-card-topline">
        <span className="today-card-label">{card.label}</span>
        <span className="today-card-source">{card.source}</span>
      </div>
      <div className="today-card-title">{card.title}</div>
      <div className="today-card-reason">{card.reason}</div>
    </button>
  );
  const username = email.split("@")[0];
  const userInitial = email.charAt(0).toUpperCase();
  const greetingLines = useMemo(
    () => [
      `Hello, ${username}! 👋`,
      "What can I do for you?",
      "Ready when you are.",
      "Let's get something done.",
    ],
    [username],
  );

  const usedPercentLabel =
    creditUsage?.usedPercent !== undefined ? `${Math.round(creditUsage.usedPercent)}%` : null;
  const resetDateLabel = creditUsage?.resetAt
    ? new Date(creditUsage.resetAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;
  const usagePercentValue = creditUsage?.usedPercent ?? 0;
  const usageLevel =
    usagePercentValue >= 95 ? "critical" : usagePercentValue >= 80 ? "warning" : "normal";

  // Workspace panel: one accordion entry per assistant message that contains
  // code. The live entry auto-expands while streaming and auto-collapses
  // once the turn finishes, making room for the next live entry.
  interface WorkspaceEntry {
    id: string;
    blocks: { lang: string; code: string }[];
  }
  const workspaceEntries = useMemo<WorkspaceEntry[]>(() => {
    const entries: WorkspaceEntry[] = [];
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      const text = message.parts
        .filter((p) => p.type === "text")
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("");
      if (parsePlanQuestion(text)) continue;
      const blocks = splitMessageSegments(text).filter(
        (seg): seg is { type: "code"; lang: string; code: string } => seg.type === "code",
      );
      if (blocks.length === 0) continue;
      entries.push({ id: message.id, blocks: blocks.map((b) => ({ lang: b.lang, code: b.code })) });
    }
    return entries;
  }, [messages]);

  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(null);
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if ((status === "streaming" || status === "submitted") && lastAssistantMessage) {
      setExpandedWorkspaceId(lastAssistantMessage.id);
    } else if (status === "ready" && prevStatusRef.current !== "ready") {
      setExpandedWorkspaceId(null);
    }
    prevStatusRef.current = status;
  }, [status, lastAssistantMessage]);

  // The right panel is hidden outright by CSS at <=1024px (mockup.css), so
  // setRightPanelCollapsed(false) has no visual effect there — track the
  // breakpoint in React state and route to a full-screen modal instead.
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1024px)");
    setIsMobileViewport(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Aio Terminal Preview tab auto-follows whichever file the agent is
  // currently touching: prefer the most recent running tool call that
  // carries a filePath, falling back to the most recent completed one so
  // the preview doesn't go blank the instant a tool finishes.
  const activeFile = useMemo<ActiveFile | null>(() => {
    const withFile = activity.filter(
      (item): item is Extract<HermesActivityData, { kind: "tool" }> & { filePath: string } =>
        item.kind === "tool" && typeof item.filePath === "string",
    );
    if (withFile.length === 0) return null;
    const reversed = [...withFile].reverse();
    const target = reversed.find((item) => item.status === "running") ?? reversed[0];
    return { filePath: target.filePath, fileName: target.fileName };
  }, [activity]);

  // Results tab fallback when no tool-touched file is active: render the
  // most recent code block the agent produced inline in chat (the common
  // case — "Aio code xong" with no file-tool activity at all).
  const latestCodeBlock = useMemo(() => {
    for (let i = workspaceEntries.length - 1; i >= 0; i--) {
      const blocks = workspaceEntries[i].blocks;
      if (blocks.length > 0) return blocks[blocks.length - 1];
    }
    return null;
  }, [workspaceEntries]);

  const openWorkspaceEntry = (messageId: string) => {
    setExpandedWorkspaceId(messageId);
    if (!isMobileViewport) setRightPanelCollapsed(false);
  };

  // Q8: chip is only clickable once finished, so this never opens a
  // still-running/empty panel. Mirrors openWorkspaceEntry's
  // mobile-modal-vs-right-panel split (Q5).
  const openShowcasePanel = (showcase: HermesShowcaseData) => {
    setOpenShowcase(showcase);
    if (isMobileViewport) setMobileShowcaseOpen(true);
    else setRightPanelCollapsed(false);
  };

  const mobileWorkspaceEntry = isMobileViewport
    ? workspaceEntries.find((entry) => entry.id === expandedWorkspaceId) ?? null
    : null;
  const mobileWorkspaceIsLive = isStreaming && mobileWorkspaceEntry?.id === lastAssistantMessage?.id;

  const workspaceModalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobileWorkspaceEntry) return;
    const modal = workspaceModalRef.current;
    const closeBtn = modal?.querySelector<HTMLElement>(".workspace-mobile-modal-close");
    closeBtn?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpandedWorkspaceId(null);
        return;
      }
      if (e.key !== "Tab" || !modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileWorkspaceEntry]);

  return (
    <div className="aio-mockup" data-theme={theme} data-accent={accent} suppressHydrationWarning>
      <div className="particles-bg" aria-hidden>
        <DotGrid
          key={theme}
          dotSize={3}
          gap={28}
          baseColor={mixHex(ACCENT_HEX[accent], BG_HEX[theme], 0.1)}
          activeColor={mixHex(ACCENT_HEX[accent], BG_HEX[theme], 0.22)}
          proximity={0}
          shockRadius={0}
          shockStrength={0}
        />
      </div>
      <div className="bottom-glow" aria-hidden />

      <button
        type="button"
        className="icon-rail-mobile-toggle"
        style={iconRailMobileOpen ? { display: "none" } : undefined}
        onClick={() => setIconRailMobileOpen(true)}
        aria-label="Open nav"
      >
        <Menu className="w-4.5 h-4.5" />
      </button>

      <div className={`icon-rail-mobile-sheet${iconRailMobileOpen ? " open" : ""}`}>
        <div
          className="icon-rail-mobile-sheet-backdrop"
          onClick={() => setIconRailMobileOpen(false)}
        />
        <nav className="icon-rail" style={{ width: "80vw", maxWidth: 320 }}>
          {ICON_RAIL_ITEMS.map(({ key, label, icon: Icon, active }) => (
            <button
              key={key}
              type="button"
              className={`icon-rail-item${active ? " active" : ""}`}
              onClick={() => {
                setIconRailMobileOpen(false);
                handleRailItemClick(key);
              }}
            >
              <Icon className="w-5.5 h-5.5" />
              <span className="icon-rail-label" style={{ opacity: 1 }}>{label}</span>
            </button>
          ))}
          <div className="icon-rail-footer">
            <div className="icon-rail-footer-avatar">{userInitial}</div>
            <span className="icon-rail-label" style={{ opacity: 1 }}>{username}</span>
          </div>
        </nav>
      </div>

      <div className={`app-container${terminalOpen && terminalScale === "focus" ? " output-focus" : ""}`}>
        <div className="icon-rail-slot">
          <nav className="icon-rail icon-rail--compact">
            <div className="icon-rail-main">
              {ICON_RAIL_ITEMS.map(({ key, label, icon: Icon, active }) => (
                <button
                  key={key}
                  type="button"
                  className={`icon-rail-item icon-rail-item--compact${active ? " active" : ""}`}
                  onClick={() => handleRailItemClick(key)}
                  aria-label={label}
                >
                  <Icon className="w-6 h-6" />
                  <span className="icon-rail-label">{label}</span>
                </button>
              ))}
            </div>
            <div className="icon-rail-footer">
              <div className="icon-rail-footer-avatar" title={`${username} · Pro Plan`}>{userInitial}</div>
              <div className="icon-rail-footer-info">
                <div className="icon-rail-footer-name">{username}</div>
                <div className="icon-rail-footer-plan">Pro Plan</div>
              </div>
            </div>
          </nav>
        </div>

        {/* ===== LEFT SIDEBAR ===== */}
        {/* Aio Output's focus scale force-hides the sidebar (mirrors
            sidebarCollapsed visuals) without touching sidebarCollapsed
            itself, so the user's prior sidebar state is restored when the
            output goes back to compact or closes. */}
        <aside
          className={`sidebar${
            sidebarCollapsed || (terminalOpen && terminalScale === "focus") ? " collapsed" : ""
          }`}
        >
          <div className="sidebar-header">
            <div className="logo-container">
              <Image src="/seo/icon.png" alt={brand.name} width={38} height={38} priority />
            </div>
            <div className="logo-text">
              <h1>{brand.name}</h1>
              <span>{brand.tagline} v2.0</span>
            </div>
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button type="button" className="new-chat-btn" onClick={handleNewChat}>
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Recent Chats</div>
          </div>
          <div className="chat-list">
            {conversationsError && (
              <div className="chat-item-time" style={{ padding: "6px 4px" }}>
                Failed to load history
              </div>
            )}
            {conversations !== null && conversations.length === 0 && !conversationsError && (
              <div className="chat-item-time" style={{ padding: "6px 4px" }}>
                No conversations yet
              </div>
            )}
            {(conversations ?? []).map((c) => (
              <div
                key={c.id}
                className={`chat-item${c.id === activeConversationId ? " active" : ""}`}
                onClick={() => handleLoadConversation(c.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleLoadConversation(c.id);
                  }
                }}
              >
                <div className="chat-item-icon">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="chat-item-info">
                  {renamingConversationId === c.id ? (
                    <input
                      autoFocus
                      className="chat-item-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => handleRenameConversation(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleRenameConversation(c.id);
                        } else if (e.key === "Escape") {
                          setRenamingConversationId(null);
                        }
                      }}
                    />
                  ) : (
                    <div className="chat-item-title">{c.title}</div>
                  )}
                  <div className="chat-item-time">
                    {new Date(c.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
                <button
                  type="button"
                  className="chat-item-delete"
                  onClick={(e) => handleStartRename(c.id, c.title, e)}
                  aria-label="Rename conversation"
                  title="Rename conversation"
                >
                  <PenLine className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className={`chat-item-delete${confirmDeleteId === c.id ? " confirming" : ""}`}
                  onClick={(e) => handleDeleteConversation(c.id, e)}
                  aria-label={confirmDeleteId === c.id ? "Confirm delete conversation" : "Delete conversation"}
                  title={confirmDeleteId === c.id ? "Click again to delete" : "Delete conversation"}
                >
                  {confirmDeleteId === c.id ? <Trash2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>

        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main className="main-content">
          <div className="top-bar">
            <button
              type="button"
              className="toggle-btn"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label="Toggle sidebar"
            >
              <Columns className="w-4.5 h-4.5" />
            </button>

            <div className="current-agent">
              <div className="current-agent-avatar">
                <Image src="/seo/icon.png" alt={brand.name} width={30} height={30} />
              </div>
              <div className="current-agent-info">
                <h2>{brand.name}</h2>
              </div>
            </div>

            <div className="top-bar-actions">
              {isCompressing && (
                <span className="compression-badge">Compressing context…</span>
              )}
              {creditBalance !== null && (
                <span className={`credit-badge${usageLevel !== "normal" ? ` credit-badge--${usageLevel}` : ""}`}>
                  {creditBalance} credits
                </span>
              )}
              <button
                type="button"
                className="toggle-btn toggle-btn--right-panel"
                onClick={() => setRightPanelCollapsed((c) => !c)}
                aria-label="Toggle panel"
              >
                <Columns className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          <div className="chat-area" ref={chatAreaRef} onScroll={handleChatScroll}>
            {messages.length === 0 ? (
              <div className="welcome-screen">
                <div className="mascot-container">
                  <Mascot state={mascotState} />
                </div>
                <TextType
                  as="h2"
                  className="welcome-title"
                  text={greetingLines}
                  typingSpeed={55}
                  pauseDuration={2200}
                  deletingSpeed={25}
                  loop
                  showCursor
                  cursorCharacter="|"
                />
                {isMobileViewport && (activeTodayCards.length > 0 || durableRunVisible) && (
                  <section className="mobile-today-panel" aria-label="Today">
                    <div className="mobile-today-heading">Today</div>
                    {durableRunVisible && renderCurrentRunCard("current-run-card--mobile")}
                    {activeTodayCards.length > 0 && (
                      <div className="mobile-today-strip">
                        {activeTodayCards.map(renderTodayCard)}
                      </div>
                    )}
                  </section>
                )}
                <div className="quick-actions">
                  {TASK_TEMPLATES.slice(0, 4).map((template) => {
                    const Icon = template.icon;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        className="quick-action"
                        onClick={() => setInput(template.prompt)}
                      >
                        <span
                          className="quick-action-icon"
                          style={{ background: "var(--accent-glow)", color: "var(--accent-secondary)" }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="quick-action-text">
                          <h3>{template.title}</h3>
                          <p>{template.description}</p>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, messageIndex) => {
                  const textParts = message.parts.filter(
                    (part) => part.type === "text" && part.text.length > 0,
                  );
                  if (message.role === "assistant" && textParts.length === 0) return null;
                  const isLatestAssistant =
                    message.role === "assistant" && message.id === lastAssistantMessage?.id;
                  const isActiveAssistant =
                    isLatestAssistant && isStreaming;
                  const fullText = textParts.map((part) => (part.type === "text" ? part.text : "")).join("");
                  const messageImages = message.role === "assistant"
                    ? message.metadata?.images ?? []
                    : [];
                  const messageQuestion = message.role === "assistant" ? parsePlanQuestion(fullText) : null;
                  const precedingUserMessage = message.role === "assistant"
                    ? messages.slice(0, messageIndex).findLast((item) => item.role === "user")
                    : null;
                  const precedingUserText = precedingUserMessage?.parts
                    .filter((part) => part.type === "text")
                    .map((part) => (part.type === "text" ? part.text : ""))
                    .join("") ?? "";
                  const isResearchMessage = message.role === "assistant"
                    && (
                      message.metadata?.mode === "research"
                      || (isLatestAssistant && lastRunMode === "research")
                    );
                  const researchQuery = precedingUserText || activeResearchQuery;
                  // Q14 auto-attach: persisted artifacts (metadata.artifacts) survive
                  // reload; the live turn instead reads straight off the in-memory
                  // `activity` stream since persistence only happens once the turn ends.
                  const messageArtifacts =
                    message.role === "assistant"
                      ? message.metadata?.artifacts ??
                        (isActiveAssistant
                          ? activity
                              .filter(
                                (item): item is HermesActivityData & { kind: "tool"; filePath: string } =>
                                  item.kind === "tool" && item.status === "completed" && !item.error && Boolean(item.filePath),
                              )
                              .map((item) => ({ filePath: item.filePath, fileName: item.fileName }))
                          : [])
                      : [];
                  // Same persisted-vs-live split as messageArtifacts, for the
                  // code_exec showcase chip (Q12 reload survival).
                  const messageShowcases: HermesShowcaseData[] =
                    message.role === "assistant"
                      ? message.metadata?.showcases ?? (isActiveAssistant ? showcases : [])
                      : [];
                  return (
                    <div key={message.id} className={`message ${message.role === "user" ? "user" : "ai"}`}>
                      <div className="message-content">
                        <div
                          className={`message-bubble${isResearchMessage ? " research-message-bubble" : ""}${
                            messageImages.length ? " generated-image-message" : ""
                          }`}
                        >
                          {isResearchMessage && (
                            <ResearchProgressCard
                              query={researchQuery}
                              events={isLatestAssistant ? timelineEvents : []}
                              summary={message.metadata?.research}
                              isRunning={isActiveAssistant}
                              hasReportText={fullText.length > 0}
                              onStopAndEdit={
                                isActiveAssistant
                                  ? () => handleResearchStopAndEdit(researchQuery)
                                  : undefined
                              }
                            />
                          )}
                          {isActiveAssistant && !isResearchMessage && <MascotStatusBadge state={mascotState} />}
                          {message.role === "assistant" ? (
                            messageQuestion ? (
                              <p className="plan-question-recap">
                                <HelpCircle className="w-3.5 h-3.5" /> {messageQuestion.question}
                              </p>
                            ) : (
                              splitMessageSegments(fullText).map((seg, i) =>
                                seg.type === "code" ? (
                                  <button
                                    key={i}
                                    type="button"
                                    className="code-chip"
                                    onClick={() => openWorkspaceEntry(message.id)}
                                  >
                                    <FileCode className="w-3.5 h-3.5" />
                                    {seg.lang || "code"} — view in panel
                                  </button>
                                ) : (
                                  seg.value.trim() && <MarkdownMessage key={i} text={seg.value} />
                                ),
                              )
                            )
                          ) : (
                            textParts.map((part, i) => (
                              <span key={i} className="whitespace-pre-wrap">
                                {part.type === "text" ? part.text : null}
                              </span>
                            ))
                          )}
                          {messageImages.map((image) => (
                            <GeneratedImageCard
                              key={image.id}
                              image={image}
                              onEdit={handleGeneratedImageEdit}
                              onVariation={handleGeneratedImageVariation}
                              onOpen={handleGeneratedImageOpen}
                            />
                          ))}
                          {messageArtifacts.length > 0 && (
                            <div className="message-artifacts">
                              {messageArtifacts.map((artifact, i) => (
                                <a
                                  key={i}
                                  href={artifact.filePath}
                                  download={artifact.fileName}
                                  className="message-artifact-card"
                                >
                                  <Download className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--aio-subtle)" }} aria-hidden />
                                  <span className="truncate">{artifact.fileName ?? "Download file"}</span>
                                </a>
                              ))}
                            </div>
                          )}
                          {messageShowcases.map((showcase) => {
                            const running = showcase.status === "running";
                            const errored = showcase.status === "error";
                            const scriptName = showcase.taskData.scriptPath?.split("/").pop() ?? "script";
                            return (
                              <div key={showcase.taskId}>
                                <button
                                  type="button"
                                  className={`showcase-chip${errored ? " error" : ""}`}
                                  disabled={running}
                                  onClick={() => openShowcasePanel(showcase)}
                                >
                                  {running ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
                                  ) : errored ? (
                                    <CircleAlert className="w-3.5 h-3.5" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  )}
                                  <span>Code Execution</span>
                                  {!isMobileViewport && (
                                    <span className="truncate">
                                      {errored ? "Run failed for " : "Created & ran "}
                                      {scriptName}
                                    </span>
                                  )}
                                </button>
                                {errored && (
                                  <ShowcaseErrorDetail stdout={showcase.taskData.stdout} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {message.role === "assistant" && !isActiveAssistant && (
                          <div className="message-meta">
                            <button
                              type="button"
                              className="copy-btn"
                              onClick={() => handleCopyMessage(message.id, fullText)}
                              aria-label="Copy message"
                            >
                              {copiedMessageId === message.id ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {imageGenerationStatus && (
                  <div className="message ai">
                    <div className="message-content">
                      <div className="message-bubble generated-image-message">
                        <ImageGenerationProgress
                          status={imageGenerationStatus}
                          onCancel={cancelImageGeneration}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {isStreaming && !hasText && (
                  <div className="message ai">
                    <div className="message-content">
                      <div className={`message-bubble${lastRunMode === "research" ? " research-message-bubble" : ""}`}>
                        {lastRunMode === "research" ? (
                          <ResearchProgressCard
                            query={activeResearchQuery}
                            events={timelineEvents}
                            isRunning
                            hasReportText={false}
                            onStopAndEdit={() => handleResearchStopAndEdit(activeResearchQuery)}
                          />
                        ) : (
                          <MascotStatusBadge state={mascotState} />
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {showScrollToBottom && (
                  <button
                    type="button"
                    className="scroll-to-bottom-btn"
                    onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                    aria-label="Scroll to latest message"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div className="input-area">
            <div className="input-container">
              {pendingApproval && (
                <div style={{ marginBottom: 10 }}>
                  <div className="approval-card">
                    <div className="approval-card-head">
                      <Check className="w-4 h-4" />
                      <span className="approval-card-title">Approval requested</span>
                    </div>
                    {pendingApproval.description && (
                      <p className="approval-card-desc">{pendingApproval.description}</p>
                    )}
                    {pendingApproval.command && (
                      <code className="approval-card-cmd">{pendingApproval.command}</code>
                    )}
                    <div className="approval-card-actions">
                      <button
                        type="button"
                        className="approval-btn approve"
                        onClick={() => handleApprovalRespond(pendingApproval.requestId, pendingApproval.runId, "session")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="approval-btn deny"
                        onClick={() => handleApprovalRespond(pendingApproval.requestId, pendingApproval.runId, "deny")}
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {planQuestion && status === "ready" && (
                <div style={{ marginBottom: 10 }}>
                  <div className="plan-question-card" role="group" aria-label="Clarifying question">
                    <div className="plan-card-head">
                      <HelpCircle className="w-4 h-4" />
                      <span className="plan-card-title">Quick question</span>
                    </div>
                    <p className="plan-card-desc">{planQuestion.question}</p>
                    <div className="plan-question-options">
                      {planQuestion.choices.slice(0, 3).map((choice, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`plan-question-option${planQuestion.recommended === i ? " recommended" : ""}`}
                          onClick={() => handlePlanAnswer(choice)}
                        >
                          {choice}
                          {planQuestion.recommended === i && <span className="plan-question-badge">Recommended</span>}
                        </button>
                      ))}
                      <div className="plan-question-other">
                        <input
                          type="text"
                          value={planOtherText}
                          onChange={(e) => setPlanOtherText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handlePlanAnswer(planOtherText);
                            }
                          }}
                          placeholder="Other — type your own answer"
                          className="plan-question-other-input"
                        />
                        <button
                          type="button"
                          className="plan-btn adjust"
                          disabled={!planOtherText.trim()}
                          onClick={() => handlePlanAnswer(planOtherText)}
                        >
                          <ArrowRight className="w-3.5 h-3.5" /> Next
                        </button>
                      </div>
                    </div>
                    <button type="button" className="plan-question-skip" onClick={handlePlanSkipToPlan}>
                      <SkipForward className="w-3.5 h-3.5" /> Skip to plan
                    </button>
                  </div>
                </div>
              )}

              {planAwaitingAction && !planQuestion && status === "ready" && hasText && (
                <div style={{ marginBottom: 10 }}>
                  <div className="plan-card" role="group" aria-label="Plan ready">
                    <div className="plan-card-head">
                      <ListChecks className="w-4 h-4" />
                      <span className="plan-card-title">Plan ready</span>
                    </div>
                    <p className="plan-card-desc">Review the plan above, then choose how to proceed.</p>
                    <div className="plan-card-actions">
                      <button type="button" className="plan-btn run" onClick={handlePlanRun}>
                        <Play className="w-3.5 h-3.5" /> Run plan
                      </button>
                      <button type="button" className="plan-btn adjust" onClick={handlePlanAdjust}>
                        <PenLine className="w-3.5 h-3.5" /> Adjust
                      </button>
                      <button type="button" className="plan-btn cancel" onClick={handlePlanCancel}>
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {chatError && (
                <div
                  className="memory-text"
                  style={{ color: "var(--accent-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span>{chatError.message || "Something went wrong sending that message."}</span>
                  <button
                    type="button"
                    className="approval-btn approve"
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => {
                      clearError();
                      regenerate();
                    }}
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    className="approval-btn deny"
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => clearError()}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {imageGenerationError && (
                <div className="image-generation-error" role="alert">
                  <CircleAlert className="w-4 h-4" />
                  <span>{imageGenerationError}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setInput(imageLastPrompt);
                      setImageGenerationError(null);
                      focusComposer();
                    }}
                  >
                    Edit prompt
                  </button>
                  <button
                    type="button"
                    className="icon-only"
                    onClick={() => setImageGenerationError(null)}
                    aria-label="Dismiss image generation error"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {imageComposerActive && (
                  <div className="image-composer-toolbar" aria-label="Image creation options">
                    <div className="image-composer-mode">
                      <ImageIcon className="w-4 h-4" />
                      <span>{imageReference ? "Edit image" : "Create image"}</span>
                    </div>
                    {imageReference && (
                      <button
                        type="button"
                        className="image-reference-chip"
                        onClick={() => handleGeneratedImageOpen(imageReference)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageReference.url} alt="" />
                        <span>Reference</span>
                      </button>
                    )}
                    <label className="image-composer-select">
                      <span className="sr-only">Aspect ratio</span>
                      <select
                        value={imageAspectRatio}
                        onChange={(event) => setImageAspectRatio(event.target.value as ImageAspectRatio)}
                        disabled={Boolean(imageGenerationStatus)}
                      >
                        {IMAGE_ASPECT_RATIOS.map((aspect) => (
                          <option
                            key={aspect.value}
                            value={aspect.value}
                            disabled={imageResolution === "4K" && aspect.value === "1:1"}
                          >
                            {aspect.label} · {aspect.value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="image-resolution-control" role="group" aria-label="Resolution">
                      {(["1K", "2K", "4K"] as ImageResolution[]).map((resolution) => (
                        <button
                          key={resolution}
                          type="button"
                          className={imageResolution === resolution ? "active" : ""}
                          disabled={Boolean(imageGenerationStatus)}
                          onClick={() => {
                            setImageResolution(resolution);
                            if (resolution === "4K" && imageAspectRatio === "1:1") {
                              setImageAspectRatio("16:9");
                            }
                          }}
                        >
                          {resolution}
                        </button>
                      ))}
                    </div>
                    <span className="image-cost">
                      ${IMAGE_COST_USD[imageResolution].toFixed(2)} est.
                    </span>
                    <button
                      type="button"
                      className="image-composer-close"
                      disabled={Boolean(imageGenerationStatus)}
                      onClick={() => {
                        setImageComposerActive(false);
                        setImageReference(null);
                        setImageGenerationError(null);
                      }}
                      aria-label="Close image creation"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div
                  className={`input-wrapper${inputFocused ? " focused" : ""}${inputMultiline ? " multiline" : ""}`}
                >
                  <div className="input-tools composer-plus-wrapper" ref={composerMenuRef}>
                    <button
                      type="button"
                      className="input-tool-btn"
                      aria-label="More options"
                      aria-haspopup="menu"
                      aria-expanded={composerMenuOpen}
                      onClick={() => setComposerMenuOpen((open) => !open)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    {composerMenuOpen && (
                      <div className="composer-plus-menu" role="menu">
                        <button
                          type="button"
                          className="composer-plus-menu-item"
                          role="menuitem"
                          onClick={() => activateImageComposer()}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Create image</span>
                        </button>
                        <button type="button" className="composer-plus-menu-item" role="menuitem" disabled>
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>Attach</span>
                          <span className="composer-plus-menu-tag">Soon</span>
                        </button>
                        <button type="button" className="composer-plus-menu-item" role="menuitem" disabled>
                          <Mic className="w-3.5 h-3.5" />
                          <span>Voice</span>
                          <span className="composer-plus-menu-tag">Soon</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <textarea
                    ref={textareaRef}
                    className="message-input"
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      setInputFocused(true);
                      setComposerMenuOpen(false);
                    }}
                    onBlur={() => setInputFocused(false)}
                    placeholder={
                      imageComposerActive
                        ? isMobileViewport
                          ? "Describe your image..."
                          : "Describe the image you want to create..."
                        : "Describe a task for Aio..."
                    }
                    disabled={status !== "ready" || Boolean(imageGenerationStatus)}
                    rows={1}
                  />
                  {imageComposerActive ? (
                    <span className="image-mode-indicator">Image</span>
                  ) : (
                    <ChatModeMenu value={chatMode} onValueChange={setChatMode} />
                  )}
                  <button
                    type="submit"
                    className="send-btn"
                    disabled={status !== "ready" || Boolean(imageGenerationStatus) || !input.trim()}
                    aria-label="Send"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>

        {/* ===== RIGHT PANEL ===== */}
        <aside
          className={`right-panel${rightPanelCollapsed ? " collapsed" : ""}${
            terminalOpen ? ` output-${terminalScale}` : ""
          }`}
        >
          <div className="panel-header">
            <h3>{terminalOpen ? "Aio Output" : "Workspace"}</h3>
            <div className="panel-header-actions">
              <button
                type="button"
                className={`panel-action-btn panel-action-btn--terminal${terminalOpen ? " active" : ""}`}
                onClick={cycleTerminal}
                aria-label={!terminalOpen ? "Open Aio Output" : "Close Aio Output"}
                aria-pressed={terminalOpen}
                title={!terminalOpen ? "Open Aio Output" : "Close Aio Output"}
              >
                <TerminalSquare className="w-4 h-4" />
                <span>Output</span>
              </button>
              <button
                type="button"
                className="panel-action-btn"
                onClick={() => setRightPanelCollapsed(true)}
                aria-label="Collapse"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {!terminalOpen && (
          <div className="panel-tab-content">
          <div>
              <div className="panel-section-heading">Aio</div>
              <div className="panel-section panel-section--aio">
                <div className="agent-info-card">
                  <div className="agent-info-avatar">
                    <Image src="/seo/icon.png" alt={brand.name} width={44} height={44} />
                  </div>
                  <div className="agent-info-details">
                    <h4>{brand.name}</h4>
                    <p>{liveStatusText}</p>
                  </div>
                </div>
                <div className="aio-signal-list">
                  <div className="aio-signal-row">
                    <Brain className="w-3.5 h-3.5" />
                    <span>{memoryLine}</span>
                  </div>
                  <div className="aio-signal-row">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{activityLine}</span>
                  </div>
                </div>
                {durableRunVisible && renderCurrentRunCard()}
                {usedPercentLabel && (
                  <div className={`usage-meter${usageLevel !== "normal" ? ` usage-meter--${usageLevel}` : ""}`}>
                    <div className="usage-meter-bar">
                      <div
                        className="usage-meter-fill"
                        style={{ width: `${Math.min(100, usagePercentValue)}%` }}
                      />
                    </div>
                    <div className="usage-meter-label">
                      <span>{usedPercentLabel} used</span>
                      {resetDateLabel && <span>Resets {resetDateLabel}</span>}
                    </div>
                    {usageLevel === "critical" && (
                      <div className="usage-meter-warning">Almost out of credits — resets {resetDateLabel ?? "soon"}.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="panel-section panel-section--today">
                <div className="panel-section-heading panel-section-heading--inline">Today</div>
                <div className="today-card-grid">
                  {activeTodayCards.map(renderTodayCard)}
                  {activeTodayCards.length === 0 && (
                    <PanelEmpty icon={<CheckCircle2 className="w-5 h-5" />}>Today is clear.</PanelEmpty>
                  )}
                </div>
              </div>

            </div>

          {openShowcase && (
            <div className="panel-section">
              <div className="panel-section-heading">Code Execution</div>
              <div className="panel-section-title">
                {openShowcase.taskData.scriptPath?.split("/").pop() ?? "script"}
              </div>
              <pre className="workspace-code-block">
                <code>{openShowcase.taskData.code ?? "No source captured."}</code>
              </pre>
              {openShowcase.status === "error" && (
                <ShowcaseErrorDetail stdout={openShowcase.taskData.stdout} />
              )}
              <div className="panel-section-title" style={{ marginTop: 14 }}>
                Results
              </div>
              {openShowcase.taskData.resultsTable && openShowcase.taskData.resultsTable.length > 0 ? (
                <table className="showcase-results-table">
                  <thead>
                    <tr>
                      {Object.keys(openShowcase.taskData.resultsTable[0]).map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {openShowcase.taskData.resultsTable.map((row, i) => (
                      <tr key={i}>
                        {Object.keys(openShowcase.taskData.resultsTable![0]).map((col) => (
                          <td key={col}>{row[col]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <PanelEmpty icon={<FileCode className="w-5 h-5" />}>No results table yet.</PanelEmpty>
              )}
              {openShowcase.taskData.resultsFile && (
                <a
                  href={openShowcase.taskData.resultsFile}
                  download
                  className="message-artifact-card"
                  style={{ marginTop: 8 }}
                >
                  <Download className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--aio-subtle)" }} aria-hidden />
                  <span className="truncate">Download results file</span>
                </a>
              )}
            </div>
          )}

          <div className="panel-section panel-section--files">
              <div className="panel-section-heading">Files</div>
              <div className="panel-tabs panel-tabs--segmented" style={{ marginBottom: 12 }}>
                {(["gallery", "files"] as FilesSubTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`panel-tab${filesSubTab === t ? " active" : ""}`}
                    onClick={() => setFilesSubTab(t)}
                  >
                    {t === "gallery" ? "Gallery" : "Files"}
                  </button>
                ))}
              </div>

              {filesSubTab === "gallery" && (
                <>
                  <input
                    ref={galleryFileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleGalleryFileSelected}
                  />
                  <button
                    type="button"
                    className="mcp-add-btn"
                    disabled={galleryUploading}
                    onClick={() => galleryFileInputRef.current?.click()}
                    style={{ marginBottom: 12 }}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    {galleryUploading ? "Uploading…" : "Save Image to Gallery"}
                  </button>

                  {galleryError && (
                    <div className="memory-text" style={{ color: "var(--accent-secondary)", marginBottom: 8 }}>
                      Failed to load: {galleryError}
                    </div>
                  )}

                  {galleryImages === null && !galleryError && <PanelLoading />}

                  {galleryImages?.length === 0 && (
                    <PanelEmpty icon={<ImageIcon className="w-5 h-5" />}>
                      No saved images yet. Save an image from chat to keep it here across sessions.
                    </PanelEmpty>
                  )}

                  {galleryImages && galleryImages.length > 0 && (
                    <div className="gallery-grid">
                      {galleryImages.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          className="gallery-thumb"
                          onClick={() => setLightboxImage(img)}
                          aria-label={img.caption ?? "Saved image"}
                        >
                          {img.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img.url} alt={img.caption ?? "Saved image"} />
                          ) : (
                            <div className="gallery-thumb-fallback">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                </>
              )}

              {filesSubTab === "files" && (
                <>
                  {fileTreePath !== "." && (
                    <button
                      type="button"
                      className="mcp-add-btn"
                      style={{ marginBottom: 8 }}
                      onClick={() => {
                        const parent = fileTreePath.split("/").slice(0, -1).join("/") || ".";
                        setFileTreeEntries(null);
                        loadFileTree(parent);
                      }}
                    >
                      ← Up
                    </button>
                  )}

                  <div className="memory-text" style={{ marginBottom: 8, opacity: 0.7 }}>
                    {fileTreePath}
                  </div>

                  {fileTreeError && fileTreeError !== "no_workspace" && (
                    <div className="memory-text" style={{ color: "var(--accent-secondary)", marginBottom: 8 }}>
                      Failed to load: {fileTreeError}
                    </div>
                  )}

                  {fileTreeLoading && fileTreeEntries === null && <PanelLoading />}

                  {!fileTreeLoading && fileTreeEntries && fileTreeEntries.length === 0 && fileTreeError === "no_workspace" && (
                    <PanelEmpty icon={<Folder className="w-5 h-5" />}>
                      Send a message first to start a workspace.
                    </PanelEmpty>
                  )}

                  {!fileTreeLoading && fileTreeEntries && fileTreeEntries.length === 0 && !fileTreeError && (
                    <PanelEmpty icon={<Folder className="w-5 h-5" />}>Empty directory.</PanelEmpty>
                  )}

                  {fileTreeEntries && fileTreeEntries.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {fileTreeEntries.map((entry) => (
                        <button
                          key={entry.name}
                          type="button"
                          className="mcp-server-item"
                          disabled={entry.type !== "dir"}
                          style={entry.type !== "dir" ? { cursor: "default" } : undefined}
                          onClick={() => {
                            if (entry.type !== "dir") return;
                            const next = fileTreePath === "." ? entry.name : `${fileTreePath}/${entry.name}`;
                            setFileTreeEntries(null);
                            loadFileTree(next);
                          }}
                        >
                          <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
                            {entry.type === "dir" ? (
                              <Folder className="w-3.5 h-3.5" />
                            ) : (
                              <File className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="mcp-server-info">
                            <div className="mcp-server-name">{entry.name}</div>
                            <div className="mcp-server-url">
                              {entry.type === "dir" ? "Directory" : `${entry.size ?? 0} bytes`}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
          )}

          {terminalOpen && (
            <div className={`aio-terminal aio-terminal--${terminalScale}`}>
              <div className="aio-terminal-tabs" role="tablist" aria-label="Aio Output views">
                <button
                  type="button"
                  className={`aio-terminal-tab${terminalTab === "activity" ? " active" : ""}`}
                  onClick={() => setTerminalTab("activity")}
                  role="tab"
                  aria-selected={terminalTab === "activity"}
                >
                  <ListTree className="w-4 h-4" />
                  Activity
                </button>
                <button
                  type="button"
                  className={`aio-terminal-tab${terminalTab === "preview" ? " active" : ""}`}
                  onClick={() => setTerminalTab("preview")}
                  role="tab"
                  aria-selected={terminalTab === "preview"}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  type="button"
                  className="aio-terminal-tab-expand"
                  onClick={() => setTerminalScale(terminalScale === "focus" ? "compact" : "focus")}
                  aria-label={terminalScale === "focus" ? "Use compact output view" : "Focus output"}
                  title={terminalScale === "focus" ? "Compact view" : "Focus view"}
                >
                  {terminalScale === "focus"
                    ? <Minimize2 className="w-4 h-4" />
                    : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>

              {terminalTab === "activity" ? (
                <div className="aio-terminal-body">
                  {workspaceEntries.length === 0 && timelineEvents.length === 0 ? (
                    <div className="output-empty-state">
                      <div className="output-empty-icon"><ListTree className="w-5 h-5" /></div>
                      <h4>No activity yet</h4>
                      <p>Current task activity will appear here.</p>
                    </div>
                  ) : (
                    <>
                      {timelineEvents.length > 0 && <RunTimeline events={timelineEvents} compact onResolveApproval={handleTimelineApprovalResolve} />}
                      {workspaceEntries.map((entry, idx) => {
                        const isLive = isStreaming && entry.id === lastAssistantMessage?.id;
                        const isOpen = expandedWorkspaceId === entry.id;
                        return (
                          <div key={entry.id} className={`workspace-entry${isOpen ? " open" : ""}`}>
                            <button
                              type="button"
                              className="workspace-entry-header"
                              onClick={() => setExpandedWorkspaceId(isOpen ? null : entry.id)}
                            >
                              <ChevronRight className={`w-3.5 h-3.5 workspace-entry-chevron${isOpen ? " open" : ""}`} />
                              <span>{isLive ? "Live" : `Turn ${idx + 1}`}</span>
                              {isLive && <span className="workspace-entry-live-dot" aria-hidden />}
                            </button>
                            {isOpen && (
                              <div className="workspace-entry-body">
                                {entry.blocks.map((block, i) => {
                                  const blockId = `${entry.id}-${i}`;
                                  return (
                                    <div key={i} className="code-file-card">
                                      <div className="code-file-card-header">
                                        <FileCode className="w-4 h-4 code-file-card-icon" />
                                        <div className="code-file-card-meta">
                                          <span className="code-file-card-name">{codeBlockFileName(block.lang)}</span>
                                          <span className="code-file-card-size">{codeBlockSize(block.code)}</span>
                                        </div>
                                        <button
                                          type="button"
                                          className="code-file-card-copy"
                                          onClick={() => handleCopyMessage(blockId, block.code)}
                                        >
                                          <Copy className="w-3 h-3" />
                                          {copiedMessageId === blockId ? "Copied" : "Copy"}
                                        </button>
                                        <button
                                          type="button"
                                          className="code-file-card-download"
                                          onClick={() => handleDownloadCodeBlock(block.lang, block.code)}
                                        >
                                          <Download className="w-3 h-3" />
                                          Download
                                        </button>
                                      </div>
                                      <pre className="workspace-code-block">
                                        <code dangerouslySetInnerHTML={{ __html: highlightCode(block.code) }} />
                                      </pre>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              ) : (
                <div className="aio-terminal-body">
                  {activeFile ? (
                    <PreviewPane file={activeFile} />
                  ) : latestCodeBlock && ["html", "htm"].includes(latestCodeBlock.lang.toLowerCase()) ? (
                    <iframe
                      srcDoc={latestCodeBlock.code}
                      className="terminal-results-iframe"
                      sandbox="allow-scripts"
                      title="Preview"
                    />
                  ) : latestCodeBlock ? (
                    <div className="terminal-preview-pane">
                      <div className="terminal-preview-filename">{codeBlockFileName(latestCodeBlock.lang)}</div>
                      <pre className="workspace-code-block">
                        <code dangerouslySetInnerHTML={{ __html: highlightCode(latestCodeBlock.code) }} />
                      </pre>
                    </div>
                  ) : (
                    <PreviewPane file={activeFile} />
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {mobileWorkspaceEntry && (
        <div
          className="workspace-mobile-modal-overlay"
          onClick={() => setExpandedWorkspaceId(null)}
        >
          <div
            className="workspace-mobile-modal"
            role="dialog"
            aria-modal="true"
            aria-label={mobileWorkspaceIsLive ? "Live" : "Workspace"}
            ref={workspaceModalRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="workspace-mobile-modal-header">
              <span>{mobileWorkspaceIsLive ? "Live" : "Workspace"}</span>
              <button
                type="button"
                className="workspace-mobile-modal-close"
                onClick={() => setExpandedWorkspaceId(null)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="workspace-entry-body">
              {mobileWorkspaceIsLive && <RunTimeline events={timelineEvents} compact onResolveApproval={handleTimelineApprovalResolve} />}
              {mobileWorkspaceEntry.blocks.map((block, i) => (
                <pre key={i} className="workspace-code-block">
                  <code>{block.code}</code>
                </pre>
              ))}
            </div>
          </div>
        </div>
      )}

      {mobileShowcaseOpen && openShowcase && (
        <div
          className="workspace-mobile-modal-overlay"
          onClick={() => setMobileShowcaseOpen(false)}
        >
          <div
            className="workspace-mobile-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Code Execution"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="workspace-mobile-modal-header">
              <span>Code Execution</span>
              <button
                type="button"
                className="workspace-mobile-modal-close"
                onClick={() => setMobileShowcaseOpen(false)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="workspace-entry-body">
              <pre className="workspace-code-block">
                <code>{openShowcase.taskData.code ?? "No source captured."}</code>
              </pre>
              {openShowcase.status === "error" && (
                <ShowcaseErrorDetail stdout={openShowcase.taskData.stdout} />
              )}
              {openShowcase.taskData.resultsTable && openShowcase.taskData.resultsTable.length > 0 && (
                <table className="showcase-results-table">
                  <thead>
                    <tr>
                      {Object.keys(openShowcase.taskData.resultsTable[0]).map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {openShowcase.taskData.resultsTable.map((row, i) => (
                      <tr key={i}>
                        {Object.keys(openShowcase.taskData.resultsTable![0]).map((col) => (
                          <td key={col}>{row[col]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {openShowcase.taskData.resultsFile && (
                <a
                  href={openShowcase.taskData.resultsFile}
                  download
                  className="message-artifact-card"
                  style={{ marginTop: 8 }}
                >
                  <Download className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--aio-subtle)" }} aria-hidden />
                  <span className="truncate">Download results file</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {lightboxImage && (
        <div className="modal-overlay" onClick={() => setLightboxImage(null)}>
          <div className="modal gallery-lightbox" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{lightboxImage.caption ?? "Saved image"}</h2>
              <button type="button" className="modal-close" onClick={() => setLightboxImage(null)} aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            {lightboxImage.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightboxImage.url} alt={lightboxImage.caption ?? "Saved image"} className="gallery-lightbox-img" />
            )}
            <button
              type="button"
              className="mcp-add-btn"
              style={
                confirmDeleteId === lightboxImage.id
                  ? { marginTop: 14, background: "rgba(226, 92, 92, 0.12)", color: "#e25c5c" }
                  : { marginTop: 14 }
              }
              onClick={() => handleGalleryDelete(lightboxImage.id)}
            >
              {confirmDeleteId === lightboxImage.id ? "Click again to confirm" : "Delete from Gallery"}
            </button>
          </div>
        </div>
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        accent={accent}
        onAccentChange={setAccent}
        connections={connections}
        connectionsError={connectionsError}
        tokenPlatform={tokenPlatform}
        onTokenPlatformChange={setTokenPlatform}
        tokenValue={tokenValue}
        onTokenValueChange={setTokenValue}
        tokenSubmitting={tokenSubmitting}
        onTokenRemove={handleTokenRemove}
        tokenMessage={tokenMessage}
        onTokenSubmit={handleTokenSubmit}
        credentials={credentials}
        credentialsError={credentialsError}
        credentialId={credentialId}
        onCredentialIdChange={setCredentialId}
        credentialValue={credentialValue}
        onCredentialValueChange={setCredentialValue}
        credentialSubmitting={credentialSubmitting}
        credentialMessage={credentialMessage}
        onCredentialSubmit={handleCredentialSubmit}
        knowledgeFiles={knowledgeFiles}
        knowledgeError={knowledgeError}
        knowledgeUploading={knowledgeUploading}
        onKnowledgeUploadClick={() => knowledgeFileInputRef.current?.click()}
        onKnowledgeDelete={handleKnowledgeDelete}
        currentPlanTier={creditUsage?.planTier ?? null}
      />
      <input
        ref={knowledgeFileInputRef}
        type="file"
        accept=".txt,.md,.markdown,.csv,text/plain,text/markdown,text/csv"
        style={{ display: "none" }}
        onChange={handleKnowledgeFileSelected}
      />
    </div>
  );
}
