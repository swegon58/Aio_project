import { ShieldQuestion } from "lucide-react";
import type { ApprovalRequestedEvent, ApprovalRespondedEvent } from "@/lib/aio/runs/aio-run-events";

type ApprovalEvent = ApprovalRequestedEvent | ApprovalRespondedEvent;

export function ApprovalCard({ event }: { event: ApprovalEvent }) {
  if (event.type === "approval.responded") {
    return (
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
        Approval {event.status}.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--accent-orange)]/35 bg-[var(--surface-elevated)] px-3 py-2">
      <div className="flex items-center gap-2">
        <ShieldQuestion className="h-3.5 w-3.5 text-[var(--accent-orange)]" />
        <div className="text-[13px] font-semibold text-[var(--text-primary)]">{event.title ?? "Approval requested"}</div>
      </div>
      {event.description && <p className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">{event.description}</p>}
      {event.command && (
        <code className="mt-2 block overflow-x-auto rounded-md bg-[var(--bg-primary)] px-2 py-1.5 text-[11.5px] text-[var(--text-secondary)]">
          {event.command}
        </code>
      )}
      {event.payload != null && (
        <p className="mt-2 line-clamp-3 break-words text-[11.5px] text-[var(--text-muted)]">{safePreview(event.payload)}</p>
      )}
      {event.actions && event.actions.length > 0 && (
        <div className="mt-2 flex gap-1.5">
          {event.actions.map((action) => (
            <button
              key={action}
              type="button"
              disabled
              className="rounded-md border border-[var(--border-color)] px-2 py-1 text-[11px] capitalize text-[var(--text-muted)]"
              title="Approval actions are handled by the existing approval card."
            >
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function safePreview(value: unknown): string {
  try {
    return JSON.stringify(value).slice(0, 300);
  } catch {
    return "Payload preview unavailable";
  }
}
