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
  // message.delta fires once per streamed text burst — showing each burst as
  // its own "Responding" row floods the timeline with word fragments. The
  // mascot state above still reads the full event list to detect "talking".
  const visibleEvents = events.filter((event) => event.type !== "message.delta");

  if (visibleEvents.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-3 text-[12px] text-[var(--text-muted)]">
        Agent activity will appear here.
      </div>
    );
  }

  return (
    // ponytail: no outer card chrome here (Kimo full-pass finding: nested
    // cards-within-cards) — each event already renders its own card
    // (ToolCallCard/ResearchProgressCard/ApprovalCard/ArtifactCard), so this
    // section is just a plain list + header, not a second card layer.
    <section
      className={cn("flex flex-col", compact ? "gap-1.5" : "gap-2")}
      aria-live="polite"
      aria-label="Run activity"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--text-muted)]">Run Timeline</span>
        <AgentStateBadge state={state} />
      </div>
      {visibleEvents.map((event, index) => (
        <RunEventItem key={eventKey(event, index)} event={event} onResolve={onResolveApproval} />
      ))}
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
