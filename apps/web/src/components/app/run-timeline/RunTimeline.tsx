import type { AioRunEvent } from "@/lib/aio/runs/aio-run-events";
import { cn } from "@/lib/utils";
import { AgentStateBadge } from "./AgentStateBadge";
import type { ApprovalResolveHandler } from "./ApprovalCard";
import { getMascotStateFromRunEvents } from "./MascotStateMapper";
import { RunEventItem } from "./RunEventItem";

export type RunTimelineProps = {
  events: AioRunEvent[];
  compact?: boolean;
  onResolveApproval?: ApprovalResolveHandler;
};

export function RunTimeline({ events, compact = false, onResolveApproval }: RunTimelineProps) {
  const state = getMascotStateFromRunEvents(events);

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-3 text-[12px] text-[var(--text-muted)]">
        Agent activity will appear here.
      </div>
    );
  }

  return (
    <section className={cn("rounded-lg border border-[var(--border-color)] bg-[var(--surface-primary-opaque)]", compact ? "p-2" : "p-3")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--text-muted)]">Run Timeline</span>
        <AgentStateBadge state={state} />
      </div>
      <div className={cn("flex flex-col", compact ? "gap-1.5" : "gap-2")}>
        {events.map((event, index) => (
          <RunEventItem key={eventKey(event, index)} event={event} onResolve={onResolveApproval} />
        ))}
      </div>
    </section>
  );
}

function eventKey(event: AioRunEvent, index: number): string {
  if ("toolCallId" in event) return `${event.type}:${event.toolCallId}:${event.createdAt}`;
  if ("approvalId" in event) return `${event.type}:${event.approvalId}:${event.createdAt}`;
  if ("artifactId" in event) return `${event.type}:${event.artifactId}:${event.createdAt}`;
  if ("taskId" in event) return `${event.type}:${event.taskId}:${event.createdAt}`;
  return `${event.type}:${event.runId}:${event.createdAt}:${index}`;
}
