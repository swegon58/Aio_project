import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Globe,
  HelpCircle,
  ImageIcon,
  Link2,
  ListChecks,
  Loader2,
  Plug,
  TerminalSquare,
  Users,
  Video,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ToolCompletedEvent, ToolFailedEvent, ToolStartedEvent } from "@/lib/aio/runs/aio-run-events";
import { getAioToolManifestEntry } from "@/lib/aio/tools/tool-manifest";
import { cn } from "@/lib/utils";

type ToolEvent = ToolStartedEvent | ToolCompletedEvent | ToolFailedEvent;

const RISK_LABEL = {
  safe: "Safe",
  medium: "Review",
  dangerous: "Dangerous",
} as const;

const STATUS_LABEL = {
  running: "Running…",
  completed: "Completed",
  failed: "Failed",
} as const;

// Icon per manifest canonicalName (apps/web/src/lib/aio/tools/tool-manifest.ts)
// — mirrors the friendly-label pattern already used for the task.codeexec
// special case in RunEventItem's genericEventMeta, extended to cover every
// tool the manifest knows about instead of just raw toolName text.
const TOOL_ICON: Record<string, LucideIcon> = {
  file: FileText,
  terminal: TerminalSquare,
  code_execution: TerminalSquare,
  clarify: HelpCircle,
  todo: ListChecks,
  web: Globe,
  browser: Globe,
  vision: Eye,
  memory: Brain,
  delegation: Users,
  image_gen: ImageIcon,
  video_gen: Video,
  cronjob: Clock,
  mcp: Plug,
  connected_apps: Link2,
};

export function toolDisplayMeta(toolName: string): { Icon: LucideIcon; label: string } {
  const entry = getAioToolManifestEntry(toolName);
  return {
    Icon: (entry && TOOL_ICON[entry.canonicalName]) ?? Wrench,
    label: entry?.displayLabel ?? humanizeToolName(toolName),
  };
}

export function humanizeToolName(toolName: string): string {
  return toolName
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || toolName;
}

export function ToolCallCard({ event }: { event: ToolEvent }) {
  const status = event.type === "tool.started" ? "running" : event.type === "tool.failed" ? "failed" : "completed";
  const preview =
    event.type === "tool.started"
      ? event.preview ?? stringifyPreview(event.input)
      : event.type === "tool.completed"
        ? event.resultPreview ?? stringifyPreview(event.output)
        : event.error;
  const { Icon: ToolIcon, label: toolLabel } = toolDisplayMeta(event.toolName);

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-2">
      <div className="flex items-center gap-2">
        <StatusIcon status={status} />
        <ToolIcon className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{toolLabel}</div>
          <div className="text-[11px] text-[var(--text-muted)]">{STATUS_LABEL[status]}</div>
        </div>
        {"riskLevel" in event && event.riskLevel && (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
              event.riskLevel === "dangerous"
                ? "border-[var(--aio-error)]/30 text-[var(--aio-error)]"
                : event.riskLevel === "safe"
                  ? "border-[var(--accent-green)]/30 text-[var(--accent-green)]"
                  : "border-[var(--aio-amber)]/30 text-[var(--aio-amber)]",
            )}
          >
            {RISK_LABEL[event.riskLevel]}
          </span>
        )}
      </div>
      {/* ponytail: no incremental/partial tool-output event exists in
          AioRunEvent (aio-run-events.ts) today — tool.started only carries a
          snapshot `preview` from call time, tool.completed only the final
          `resultPreview`. There's nothing to stream in between, so "running"
          shows a spinner + whatever preview is already known rather than a
          fabricated live feed. Upgrade path: once the orchestrator/Hermes
          mapper emits a real incremental stdout event (e.g. a repeated
          tool.progress/output-delta event), replace this static preview with
          an appended/growing text render keyed off that event. */}
      {status === "running" && !preview && (
        <p className="mt-2 text-[12px] italic leading-5 text-[var(--text-muted)]">Waiting for output…</p>
      )}
      {preview && (
        <p className="mt-2 line-clamp-3 break-words text-[12px] leading-5 text-[var(--text-secondary)]">{preview}</p>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: "running" | "completed" | "failed" }) {
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--aio-amber)]" />;
  if (status === "failed") return <AlertTriangle className="h-3.5 w-3.5 text-[var(--aio-error)]" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-green)]" />;
}

function stringifyPreview(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value.slice(0, 300);
  try {
    return JSON.stringify(value).slice(0, 300);
  } catch {
    return undefined;
  }
}
