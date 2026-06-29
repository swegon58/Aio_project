import { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck, ShieldQuestion, XCircle } from "lucide-react";
import type { ApprovalRequestedEvent, ApprovalRespondedEvent, AioRiskLevel } from "@/lib/aio/runs/aio-run-events";
import { cn } from "@/lib/utils";

type ApprovalEvent = ApprovalRequestedEvent | ApprovalRespondedEvent;

export type ApprovalResolveHandler = (
  approvalId: string,
  runId: string,
  choice: "approve" | "reject",
) => Promise<void>;

type Props = {
  event: ApprovalEvent;
  onResolve?: ApprovalResolveHandler;
};

export function ApprovalCard({ event, onResolve }: Props) {
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [resolved, setResolved] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (event.type === "approval.responded") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
        {event.status === "approved" ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--accent-green,#34c759)]" />
        ) : (
          <XCircle className="h-3.5 w-3.5 shrink-0 text-[var(--accent-red,#ff3b30)]" />
        )}
        Approval {event.status}.
      </div>
    );
  }

  const riskLevel: AioRiskLevel = event.riskLevel ?? "safe";
  const isInteractive = !!onResolve && !resolved;

  const handleClick = async (choice: "approve" | "reject") => {
    if (!onResolve || pending) return;
    setPending(choice);
    setError(null);
    try {
      await onResolve(event.approvalId, event.runId, choice);
      setResolved(choice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve approval.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        riskLevel === "dangerous"
          ? "border-[var(--accent-red,#ff3b30)]/40 bg-[var(--surface-elevated)]"
          : riskLevel === "medium"
            ? "border-[var(--accent-orange)]/35 bg-[var(--surface-elevated)]"
            : "border-[var(--border-color)] bg-[var(--surface-elevated)]",
      )}
    >
      <div className="flex items-center gap-2">
        <RiskIcon riskLevel={riskLevel} />
        <div className="text-[13px] font-semibold text-[var(--text-primary)]">
          {event.title ?? "Approval requested"}
        </div>
        {riskLevel !== "safe" && <RiskBadge riskLevel={riskLevel} />}
      </div>

      {event.description && (
        <p className="mt-1.5 text-[12px] leading-5 text-[var(--text-secondary)]">{event.description}</p>
      )}

      {event.command && (
        <code className="mt-2 block overflow-x-auto rounded-md bg-[var(--bg-primary)] px-2 py-1.5 text-[11.5px] text-[var(--text-secondary)]">
          {event.command}
        </code>
      )}

      {event.payload != null && !event.command && (
        <p className="mt-1.5 line-clamp-3 break-words text-[11.5px] text-[var(--text-muted)]">
          {safePreview(event.payload)}
        </p>
      )}

      {resolved ? (
        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
          {resolved === "approve" ? (
            <CheckCircle2 className="h-3 w-3 text-[var(--accent-green,#34c759)]" />
          ) : (
            <XCircle className="h-3 w-3 text-[var(--accent-red,#ff3b30)]" />
          )}
          {resolved === "approve" ? "Approved" : "Denied"}
        </div>
      ) : isInteractive ? (
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            disabled={!!pending}
            onClick={() => handleClick("approve")}
            className={cn(
              "rounded-md border border-[var(--accent-green,#34c759)]/40 px-2.5 py-1 text-[11.5px] font-medium text-[var(--accent-green,#34c759)] transition-opacity",
              pending ? "cursor-not-allowed opacity-50" : "hover:bg-[var(--accent-green,#34c759)]/10",
            )}
          >
            {pending === "approve" ? "Approving…" : "Approve once"}
          </button>
          <button
            type="button"
            disabled={!!pending}
            onClick={() => handleClick("reject")}
            className={cn(
              "rounded-md border border-[var(--border-color)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--text-secondary)] transition-opacity",
              pending ? "cursor-not-allowed opacity-50" : "hover:bg-[var(--surface-primary-opaque)]",
            )}
          >
            {pending === "reject" ? "Denying…" : "Deny"}
          </button>
        </div>
      ) : event.actions && event.actions.length > 0 ? (
        <div className="mt-2 flex gap-1.5">
          {event.actions.map((action) => (
            <span
              key={action}
              className="rounded-md border border-[var(--border-color)] px-2 py-1 text-[11px] capitalize text-[var(--text-muted)]"
            >
              {action === "approve" ? "Approve once" : action}
            </span>
          ))}
        </div>
      ) : null}

      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[var(--accent-red,#ff3b30)]">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

function RiskIcon({ riskLevel }: { riskLevel: AioRiskLevel }) {
  if (riskLevel === "dangerous")
    return <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[var(--accent-red,#ff3b30)]" />;
  if (riskLevel === "medium")
    return <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--accent-orange)]" />;
  return <ShieldQuestion className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />;
}

function RiskBadge({ riskLevel }: { riskLevel: Exclude<AioRiskLevel, "safe"> }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        riskLevel === "dangerous"
          ? "bg-[var(--accent-red,#ff3b30)]/15 text-[var(--accent-red,#ff3b30)]"
          : "bg-[var(--accent-orange)]/15 text-[var(--accent-orange)]",
      )}
    >
      {riskLevel}
    </span>
  );
}

function safePreview(value: unknown): string {
  try {
    return JSON.stringify(value).slice(0, 300);
  } catch {
    return "Payload preview unavailable";
  }
}
