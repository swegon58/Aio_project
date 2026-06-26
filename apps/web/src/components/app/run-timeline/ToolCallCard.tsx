import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { ToolCompletedEvent, ToolFailedEvent, ToolStartedEvent } from "@/lib/aio/runs/aio-run-events";
import { cn } from "@/lib/utils";

type ToolEvent = ToolStartedEvent | ToolCompletedEvent | ToolFailedEvent;

const RISK_LABEL = {
  safe: "Safe",
  medium: "Review",
  dangerous: "Dangerous",
} as const;

export function ToolCallCard({ event }: { event: ToolEvent }) {
  const status = event.type === "tool.started" ? "running" : event.type === "tool.failed" ? "failed" : "completed";
  const preview =
    event.type === "tool.started"
      ? event.preview ?? stringifyPreview(event.input)
      : event.type === "tool.completed"
        ? event.resultPreview ?? stringifyPreview(event.output)
        : event.error;

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-2">
      <div className="flex items-center gap-2">
        <StatusIcon status={status} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{event.toolName}</div>
          <div className="text-[11px] capitalize text-[var(--text-muted)]">{status}</div>
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
