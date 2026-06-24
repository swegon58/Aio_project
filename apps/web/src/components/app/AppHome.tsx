"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useChat } from "@ai-sdk/react";
import {
  ArrowRight,
  Bot,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Cog,
  Columns,
  Copy,
  Download,
  File,
  FileCode,
  Folder,
  HelpCircle,
  ImageIcon,
  ListChecks,
  Lock,
  Mic,
  Pause,
  Paperclip,
  PenLine,
  Play,
  Plus,
  Send,
  Server,
  SkipForward,
  SquareSplitHorizontal,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";
import { Mascot, MascotStatusBadge } from "@/components/app/Mascot";
import { MarkdownMessage } from "@/components/app/MarkdownMessage";
import { DotGrid } from "@/components/app/DotGrid";
import TextType from "@/components/app/TextType";
import { TASK_TEMPLATES } from "@/components/app/TemplateGallery";
import { ActivityStream } from "@/components/app/ActivityStream";
import type { McpServerStatus } from "@/app/api/integrations/mcp/route";
import { PanelEmpty, PanelLoading } from "@/components/ui/panel-state";
import { SettingsModal, type AccentKey } from "@/components/app/SettingsModal";
import { SwitchGroup } from "@/components/ui/switch-group";
import { brand } from "@/lib/brand.config";
import {
  mascotStateForTool,
  type HermesActivityData,
  type HermesApprovalData,
  type HermesCreditsData,
  type HermesUIMessage,
  type MascotImageState,
} from "@/lib/hermes/chat-types";
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

type PanelTab = "info" | "mcp" | "memory" | "activity";
type ActivitySubTab = "kanban" | "gallery" | "tasks" | "files";

// Aio Terminal: replaces the old empty Workspace panel. "small" renders
// inline below the panel tabs (old Workspace spot); "split" hides the
// sidebar and gives chat + terminal ~50/50 width. Toggle button cycles
// closed -> small -> split -> closed.
type TerminalScale = "small" | "split";
type TerminalTab = "code" | "preview";

// File the agent is actively touching right now, derived from the live
// activity stream (most recent tool entry that carries a filePath).
interface ActiveFile {
  filePath: string;
  fileName?: string;
}

const LIVE_PREVIEW_EXTS = new Set(["html", "htm", "js", "jsx", "ts", "tsx"]);
const PDF_EXTS = new Set(["pdf"]);
const DOC_EXTS = new Set(["doc", "docx"]);
const SHEET_EXTS = new Set(["xls", "xlsx", "csv"]);
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const MARKDOWN_EXTS = new Set(["md", "markdown"]);

// Preview-tab integration point: renders the live-edited file inline in the
// Aio Terminal panel, switching on extension.
function PreviewPane({ file }: { file: ActiveFile | null }) {
  if (!file) {
    return (
      <div className="terminal-preview-empty">
        Open or edit a file and its preview will show up here.
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
  const { data, error, loading } = useArtifactFetch(url, async (res) => {
    const XLSX = await import("xlsx");
    const buf = isCsv ? await res.text() : await res.arrayBuffer();
    const wb = isCsv ? XLSX.read(buf, { type: "string" }) : XLSX.read(buf, { type: "array" });
    const firstSheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_html(sheet);
  });

  if (loading) return <div className="terminal-preview-placeholder">Loading spreadsheet…</div>;
  if (error) return <div className="terminal-preview-placeholder">Couldn&apos;t load spreadsheet: {error}</div>;
  return (
    <div
      className="terminal-preview-sheet"
      dangerouslySetInnerHTML={{ __html: data ?? "" }}
    />
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

const CAPABILITIES = ["Web browsing", "Code execution", "File analysis", "Data extraction", "Image understanding", "Long-running tasks"];
const TOOLS_LIST = ["web_search", "browser_use", "code_execute", "file_read", "file_write", "shell_exec"];

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

  const { messages, sendMessage, status, setMessages, error: chatError, regenerate, clearError } = useChat<HermesUIMessage>({
    onData: (dataPart) => {
      if (dataPart.type === "data-hermes-run") {
        // Brand-new chat (sent before "New Chat" was ever clicked, so
        // activeConversationId is still null) — capture the server-assigned
        // thread id now, otherwise the reload-restore effect has no id to
        // look up and the whole turn vanishes on refresh.
        setActiveConversationId((prev) => prev ?? dataPart.data.threadId);
        return;
      }
      if (dataPart.type === "data-hermes-credits") {
        setCreditBalance(dataPart.data.balance);
        setCreditUsage(dataPart.data);
        return;
      }
      if (dataPart.type === "data-hermes-compression") {
        setIsCompressing(dataPart.data.active);
        return;
      }
      if (dataPart.type === "data-hermes-approval") {
        const incoming = dataPart.data;
        if (incoming.kind === "request") {
          setPendingApproval(incoming);
        } else {
          setPendingApproval((prev) => (prev?.requestId === incoming.requestId ? null : prev));
        }
        return;
      }
      if (dataPart.type !== "data-hermes-activity") return;
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
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("info");
  const [activitySubTab, setActivitySubTab] = useState<ActivitySubTab>("kanban");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalScale, setTerminalScale] = useState<TerminalScale>("small");
  const [terminalTab, setTerminalTab] = useState<TerminalTab>("code");
  // Toggle button cycle: closed -> small -> split -> closed.
  const cycleTerminal = () => {
    if (!terminalOpen) {
      setTerminalOpen(true);
      setTerminalScale("small");
    } else if (terminalScale === "small") {
      setTerminalScale("split");
    } else {
      setTerminalOpen(false);
      setTerminalScale("small");
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
  const [mcpServers, setMcpServers] = useState<McpServerStatus[] | null>(null);
  const [mcpError, setMcpError] = useState<string | null>(null);
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accent, setAccent] = useState<AccentKey>("blue");

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
  const [planMode, setPlanMode] = useState<"auto" | "plan">("auto");
  const [planOtherText, setPlanOtherText] = useState("");

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== "ready") return;
    setActivity([]);
    setPendingApproval(null);
    setPlanAwaitingAction(planMode === "plan");
    sendMessage({ text: input }, { body: { planMode: planMode === "plan" } });
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
    setPendingApproval(null);
    const last = data.messages?.[data.messages.length - 1];
    const awaitingPlan = Boolean(last?.role === "assistant" && last.metadata?.planMode);
    setPlanAwaitingAction(awaitingPlan);
    // Keep the composer toggle in sync — otherwise a reload mid-plan-mode
    // leaves the question/plan card on screen while the toggle silently
    // reset to "auto", so the next typed answer sends planMode:false.
    setPlanMode(awaitingPlan ? "plan" : "auto");
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

  const handleNewChat = async () => {
    try {
      const res = await fetch("/api/conversations", { method: "POST" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      loadConversationRequestRef.current = data.id;
      setActiveConversationId(data.id);
      setMessages([]);
      setActivity([]);
      setPendingApproval(null);
      setPlanAwaitingAction(false);
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
      if (id === activeConversationId) {
        loadConversationRequestRef.current = null;
        setActiveConversationId(null);
        setMessages([]);
        setActivity([]);
        setPendingApproval(null);
        setPlanAwaitingAction(false);
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
    if (panelTab === "activity" && kanban === null) {
      loadKanban();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelTab]);

  useEffect(() => {
    if (panelTab === "memory" && memorySnapshot === null) {
      loadMemorySnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelTab]);

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
    if (panelTab === "activity" && activitySubTab === "gallery" && galleryImages === null) {
      loadGallery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelTab, activitySubTab]);

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
    if (panelTab === "activity" && activitySubTab === "tasks" && cronJobs === null) {
      loadCronJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelTab, activitySubTab]);

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
    if (panelTab === "activity" && activitySubTab === "files" && fileTreeEntries === null) {
      loadFileTree(fileTreePath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelTab, activitySubTab]);

  useEffect(() => {
    if (panelTab !== "mcp" || mcpServers !== null) return;
    (async () => {
      try {
        const res = await fetch("/api/integrations/mcp");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `status ${res.status}`);
        setMcpServers(data.servers ?? []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setMcpError(msg);
        setMcpServers([]);
      }
    })();
  }, [panelTab, mcpServers]);

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

  // Plan-gate actions. Run = confirm and execute (next turn sent with
  // planMode off; the plan itself is already in conversation history, so the
  // agent picks it up). Adjust = hand focus to the composer so the user can
  // refine (a re-submit re-plans while the toggle stays on "plan"). Cancel =
  // dismiss the card; the plan stays in the transcript, nothing is sent.
  const handlePlanRun = () => {
    if (status !== "ready") return;
    setPlanAwaitingAction(false);
    setPlanMode("auto");
    setActivity([]);
    setPendingApproval(null);
    sendMessage(
      { text: "Proceed with the plan above, step by step." },
      { body: { planMode: false } },
    );
  };
  const handlePlanAdjust = () => {
    setPlanAwaitingAction(false);
    textareaRef.current?.focus();
  };
  const handlePlanCancel = () => {
    setPlanAwaitingAction(false);
    setPlanMode("auto");
  };

  // Multi-round clarify (grill-me style): answering a question or skipping
  // ahead is just a normal chat turn with planMode still on — the Q&A lives
  // in ordinary conversation_history, no extra session state to track.
  const handlePlanAnswer = (answer: string) => {
    if (status !== "ready" || !answer.trim()) return;
    setActivity([]);
    setPendingApproval(null);
    setPlanOtherText("");
    setPlanAwaitingAction(true);
    sendMessage({ text: answer.trim() }, { body: { planMode: true } });
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

  const toolCallCount = activity.filter((a) => a.kind === "tool").length;
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

  const openWorkspaceEntry = (messageId: string) => {
    setExpandedWorkspaceId(messageId);
    if (!isMobileViewport) setRightPanelCollapsed(false);
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
      {/* Blocking inline script: applies saved theme/accent to this element's
          attributes before the browser paints, so there's no flash of the
          SSR default before React hydrates and runs the read-effect above. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var el=document.currentScript.parentElement;var t=localStorage.getItem("aio-theme");if(t==="light")el.setAttribute("data-theme","light");var a=localStorage.getItem("aio-accent");if(a)el.setAttribute("data-accent",a);}catch(e){}})();`,
        }}
      />
      <div className="particles-bg" aria-hidden>
        <DotGrid
          key={theme}
          dotSize={3}
          gap={28}
          baseColor={mixHex(ACCENT_HEX[accent], BG_HEX[theme], 0.16)}
          activeColor={mixHex(ACCENT_HEX[accent], BG_HEX[theme], 0.32)}
          proximity={0}
          shockRadius={0}
          shockStrength={0}
        />
      </div>
      <div className="bottom-glow" aria-hidden />

      <div className={`app-container${terminalOpen && terminalScale === "split" ? " terminal-split" : ""}`}>
        {/* ===== LEFT SIDEBAR ===== */}
        {/* Aio Terminal's split scale force-hides the sidebar (mirrors
            sidebarCollapsed visuals) without touching sidebarCollapsed
            itself, so the user's prior sidebar state is restored when the
            terminal goes back to "small" or closes. */}
        <aside
          className={`sidebar${
            sidebarCollapsed || (terminalOpen && terminalScale === "split") ? " collapsed" : ""
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

          <div className="sidebar-footer">
            <div className="user-avatar">{userInitial}</div>
            <div className="user-info">
              <div className="user-name">{username}</div>
              <div className="user-plan">Pro Plan</div>
            </div>
            <button
              type="button"
              className="settings-btn"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
            >
              <Cog className="w-4.5 h-4.5" />
            </button>
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
                {messages.map((message) => {
                  const textParts = message.parts.filter(
                    (part) => part.type === "text" && part.text.length > 0,
                  );
                  if (message.role === "assistant" && textParts.length === 0) return null;
                  const isActiveAssistant =
                    message.role === "assistant" && isStreaming && message.id === lastAssistantMessage?.id;
                  const fullText = textParts.map((part) => (part.type === "text" ? part.text : "")).join("");
                  const messageQuestion = message.role === "assistant" ? parsePlanQuestion(fullText) : null;
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
                  return (
                    <div key={message.id} className={`message ${message.role === "user" ? "user" : "ai"}`}>
                      <div className="message-content">
                        <div className="message-bubble">
                          {isActiveAssistant && <MascotStatusBadge state={mascotState} />}
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

                {isStreaming && !hasText && (
                  <div className="message ai">
                    <div className="message-content">
                      <div className="message-bubble">
                        <MascotStatusBadge state={mascotState} />
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

              <form onSubmit={handleSubmit}>
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
                    placeholder="Describe a task for Aio..."
                    disabled={status !== "ready"}
                    rows={1}
                  />
                  <SwitchGroup name="plan-mode" value={planMode} onValueChange={(v) => setPlanMode(v as "auto" | "plan")}>
                    <SwitchGroup.Control label="Auto" value="auto" defaultChecked />
                    <SwitchGroup.Control label="Plan" value="plan" />
                  </SwitchGroup>
                  <button
                    type="submit"
                    className="send-btn"
                    disabled={status !== "ready" || !input.trim()}
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
            terminalOpen && terminalScale === "split" ? " terminal-split" : ""
          }`}
        >
          <div className="panel-header">
            <h3>
              {panelTab === "info"
                ? "Agent Info"
                : panelTab === "mcp"
                  ? "MCP Servers"
                  : panelTab === "memory"
                    ? "Memory"
                    : "Activity"}
            </h3>
            <div className="panel-header-actions">
              <button
                type="button"
                className={`panel-action-btn panel-action-btn--terminal${terminalOpen ? " active" : ""}`}
                onClick={cycleTerminal}
                aria-label={
                  !terminalOpen
                    ? "Open Aio Terminal"
                    : terminalScale === "small"
                      ? "Expand Aio Terminal to split view"
                      : "Close Aio Terminal"
                }
                aria-pressed={terminalOpen}
                title="Aio Terminal"
              >
                {terminalScale === "split" && terminalOpen ? (
                  <SquareSplitHorizontal className="w-3.5 h-3.5" />
                ) : (
                  <TerminalSquare className="w-3.5 h-3.5" />
                )}
                <span>{!terminalOpen ? "Open Terminal" : terminalScale === "small" ? "Expand" : "Close Terminal"}</span>
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

          <div className="panel-tabs">
            {(["info", "mcp", "memory", "activity"] as PanelTab[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`panel-tab${panelTab === t ? " active" : ""}`}
                onClick={() => setPanelTab(t)}
              >
                {t === "info" ? "Info" : t === "mcp" ? "MCP" : t === "memory" ? "Memory" : "Activity"}
              </button>
            ))}
          </div>

          <div className="panel-tab-content">
          {panelTab === "info" && (
            <div>
              <div className="panel-section">
                <div className="agent-info-card">
                  <div className="agent-info-avatar">
                    <Image src="/seo/icon.png" alt={brand.name} width={44} height={44} />
                  </div>
                  <div className="agent-info-details">
                    <h4>{brand.name}</h4>
                    <p>{brand.tagline}</p>
                  </div>
                </div>
                <div className="capability-tags">
                  {CAPABILITIES.map((c) => (
                    <span key={c} className="capability-tag">
                      <Check /> {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="panel-section">
                <div className="panel-section-title">Session Stats</div>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{messages.length}</div>
                    <div className="stat-label">Messages</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{toolCallCount}</div>
                    <div className="stat-label">Tool Calls</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{creditBalance ?? "—"}</div>
                    <div className="stat-label">Credits</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{isStreaming ? "Live" : "Idle"}</div>
                    <div className="stat-label">Status</div>
                  </div>
                </div>
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
            </div>
          )}

          {panelTab === "mcp" && (
            <div className="panel-section">
              {mcpServers === null && !mcpError && <PanelLoading />}

              {mcpServers && mcpServers.length === 0 && (
                <PanelEmpty icon={<Server className="w-5 h-5" />}>
                  No MCP servers configured yet.
                </PanelEmpty>
              )}

              {mcpServers?.map((server) => (
                <div key={server.name} className="mcp-server-item">
                  <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
                    <Server className="w-3.5 h-3.5" />
                  </div>
                  <div className="mcp-server-info">
                    <div className="mcp-server-name">{server.name}</div>
                    <div className="mcp-server-url">{server.transport}</div>
                  </div>
                  <div className={`mcp-server-status ${server.enabled ? "connected" : "disconnected"}`} />
                </div>
              ))}
              <button type="button" className="mcp-add-btn" disabled title="Custom MCP servers coming soon">
                <Server className="w-3.5 h-3.5" />
                Add MCP Server
              </button>

              <div className="panel-section-title" style={{ marginTop: 16 }}>
                MCP Tools
              </div>
              <div className="capability-tags">
                {TOOLS_LIST.map((t) => (
                  <span key={t} className="capability-tag">
                    <Check /> {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {panelTab === "memory" && (
            <div className="panel-section">
              {memoryError && (
                <div className="memory-text" style={{ color: "var(--accent-secondary)", marginBottom: 8 }}>
                  Failed to load: {memoryError}
                </div>
              )}
              {memorySnapshot === null && !memoryError && <PanelLoading />}
              {memorySnapshot && !memorySnapshot.available && (
                <div className="memory-text">
                  Memory unavailable{memorySnapshot.reason ? `: ${memorySnapshot.reason}` : ""}.
                </div>
              )}
              {memorySnapshot?.available && memorySnapshot.summary && (
                <div className="memory-text" style={{ marginBottom: 8 }}>
                  {memorySnapshot.summary}
                </div>
              )}
              {memorySnapshot?.available && !memorySnapshot.summary && (memorySnapshot.facts?.length ?? 0) > 0 && (
                <>
                  <div className="memory-text" style={{ opacity: 0.6, marginBottom: 4 }}>
                    recent memory
                  </div>
                  {memorySnapshot.facts!.map((fact, i) => (
                    <div key={i} className="memory-item">
                      <div className="memory-icon">
                        <PenLine className="w-2.5 h-2.5" />
                      </div>
                      <div className="memory-text">{fact}</div>
                    </div>
                  ))}
                </>
              )}
              {memorySnapshot?.available && !memorySnapshot.summary && (memorySnapshot.facts?.length ?? 0) === 0 && (
                <PanelEmpty icon={<Brain className="w-5 h-5" />}>No memory recorded yet.</PanelEmpty>
              )}
            </div>
          )}

          {panelTab === "activity" && (
            <div className="panel-section">
              <div className="panel-tabs panel-tabs--segmented" style={{ marginBottom: 12 }}>
                {(["kanban", "gallery", "tasks", "files"] as ActivitySubTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`panel-tab${activitySubTab === t ? " active" : ""}`}
                    onClick={() => setActivitySubTab(t)}
                  >
                    {t === "kanban" ? "Kanban" : t === "gallery" ? "Gallery" : t === "tasks" ? "Tasks" : "Files"}
                  </button>
                ))}
              </div>

              {activitySubTab === "kanban" && (
                <>
                  {kanbanError && (
                    <div className="memory-text" style={{ color: "var(--accent-secondary)", marginBottom: 8 }}>
                      Failed to load: {kanbanError}
                    </div>
                  )}
                  {kanban === null && !kanbanError && <PanelLoading />}
                  {kanban && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {kanban.statuses.map((status) => {
                        const tasks = kanban.columns[status] ?? [];
                        if (tasks.length === 0) return null;
                        return (
                          <div key={status}>
                            <div className="memory-text" style={{ opacity: 0.6, marginBottom: 4 }}>
                              {status} ({tasks.length})
                            </div>
                            {tasks.map((task) => (
                              <div key={task.id} className="mcp-server-item">
                                <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
                                  <Columns className="w-3.5 h-3.5" />
                                </div>
                                <div className="mcp-server-info">
                                  <div className="mcp-server-name">{task.title}</div>
                                  <div className="mcp-server-url">{task.id}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      {kanban.statuses.every((s) => (kanban.columns[s] ?? []).length === 0) && (
                        <PanelEmpty icon={<Columns className="w-5 h-5" />}>No tasks on the board.</PanelEmpty>
                      )}
                    </div>
                  )}
                </>
              )}

              {activitySubTab === "gallery" && (
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

              {activitySubTab === "tasks" && (
                <>
                  {cronLocked && (
                    <div className="mcp-server-item" style={{ opacity: 0.6 }}>
                      <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <div className="mcp-server-info">
                        <div className="mcp-server-name">Scheduled Tasks</div>
                        <div className="mcp-server-url">Requires the Business plan</div>
                      </div>
                      <button
                        type="button"
                        className="mcp-add-btn"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        disabled={upgrading}
                        onClick={handleUpgradeToBusiness}
                      >
                        {upgrading ? "Redirecting…" : "Upgrade"}
                      </button>
                    </div>
                  )}

                  {!cronLocked && cronError && (
                    <div className="memory-text" style={{ color: "var(--accent-secondary)", marginBottom: 8 }}>
                      Failed to load: {cronError}
                    </div>
                  )}

                  {!cronLocked && cronJobs === null && !cronError && <PanelLoading />}

                  {!cronLocked && cronJobs && cronJobs.length === 0 && !cronError && (
                    <PanelEmpty icon={<Clock className="w-5 h-5" />}>No scheduled tasks yet.</PanelEmpty>
                  )}

                  {!cronLocked && cronJobs && cronJobs.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {cronJobs.map((job) => (
                        <div key={job.id} className="mcp-server-item">
                          <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div className="mcp-server-info">
                            <div className="mcp-server-name">{job.name}</div>
                            <div className="mcp-server-url">{job.schedule}</div>
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              type="button"
                              className="mcp-add-btn"
                              style={{ padding: "4px 6px" }}
                              disabled={cronActionPending === job.id}
                              onClick={() =>
                                handleCronAction(job.id, job.enabled === false ? "resume" : "pause")
                              }
                              aria-label={job.enabled === false ? "Resume" : "Pause"}
                            >
                              {job.enabled === false ? (
                                <Play className="w-3.5 h-3.5" />
                              ) : (
                                <Pause className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              className="mcp-add-btn"
                              style={
                                confirmDeleteId === job.id
                                  ? { padding: "4px 6px", background: "rgba(226, 92, 92, 0.12)", color: "#e25c5c" }
                                  : { padding: "4px 6px" }
                              }
                              disabled={cronActionPending === job.id}
                              onClick={() => handleCronDelete(job.id)}
                              aria-label={confirmDeleteId === job.id ? "Confirm delete task" : "Delete task"}
                              title={confirmDeleteId === job.id ? "Click again to delete" : "Delete task"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!cronLocked && (
                    <>
                      <div className="panel-section-title" style={{ marginTop: 16 }}>
                        New Scheduled Task
                      </div>
                      <form
                        onSubmit={handleCronCreate}
                        style={{ display: "flex", flexDirection: "column", gap: 8 }}
                      >
                        <input
                          type="text"
                          value={cronName}
                          onChange={(e) => setCronName(e.target.value)}
                          placeholder="Task name"
                          className="message-input"
                          style={{ height: 32 }}
                        />
                        <input
                          type="text"
                          value={cronSchedule}
                          onChange={(e) => setCronSchedule(e.target.value)}
                          placeholder="Cron schedule (e.g. 0 9 * * *)"
                          className="message-input"
                          style={{ height: 32 }}
                        />
                        <textarea
                          value={cronPrompt}
                          onChange={(e) => setCronPrompt(e.target.value)}
                          placeholder="What should the agent do when this runs?"
                          className="message-input"
                          style={{ minHeight: 64, resize: "vertical", paddingTop: 6 }}
                        />
                        <button
                          type="submit"
                          className="mcp-add-btn"
                          disabled={cronCreating || !cronName.trim() || !cronSchedule.trim()}
                        >
                          {cronCreating ? "Creating…" : "Create Task"}
                        </button>
                        {cronCreateMessage && <div className="memory-text">{cronCreateMessage}</div>}
                      </form>
                    </>
                  )}
                </>
              )}

              {activitySubTab === "files" && (
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
          )}

          </div>

          {terminalOpen && (
            <div className="aio-terminal">
              <div className="aio-terminal-title">Aio Terminal</div>
              <div className="aio-terminal-tabs">
                <button
                  type="button"
                  className={`aio-terminal-tab${terminalTab === "code" ? " active" : ""}`}
                  onClick={() => setTerminalTab("code")}
                >
                  Code
                </button>
                <button
                  type="button"
                  className={`aio-terminal-tab${terminalTab === "preview" ? " active" : ""}`}
                  onClick={() => setTerminalTab("preview")}
                >
                  Preview
                </button>
              </div>

              {terminalTab === "code" ? (
                <div className="aio-terminal-body">
                  {workspaceEntries.length === 0 ? (
                    <div className="workspace-panel-empty">Code and tool activity will show up here.</div>
                  ) : (
                    workspaceEntries.map((entry, idx) => {
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
                              {isLive && <ActivityStream items={activity} />}
                              {entry.blocks.map((block, i) => (
                                <pre key={i} className="workspace-code-block">
                                  <code>{block.code}</code>
                                </pre>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="aio-terminal-body">
                  <PreviewPane file={activeFile} />
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
              {mobileWorkspaceIsLive && <ActivityStream items={activity} />}
              {mobileWorkspaceEntry.blocks.map((block, i) => (
                <pre key={i} className="workspace-code-block">
                  <code>{block.code}</code>
                </pre>
              ))}
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
