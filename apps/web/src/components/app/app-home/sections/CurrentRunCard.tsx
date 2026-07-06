"use client";

import { CheckCircle2, CircleAlert, Clock, ListTree, Loader2, Pause } from "lucide-react";
import { PanelEmpty } from "@/components/ui/panel-state";
import { AgentStateBadge, RunTimeline, type AgentDisplayState } from "@/components/app/run-timeline";
import type { AioRunEvent, AioRunStatus } from "@/lib/aio/runs/aio-run-events";

interface CurrentRunCardProps {
  className?: string;
  currentRunBadgeState: AgentDisplayState;
  currentRunStatusLabel: string;
  currentRunNote: string;
  currentRunCanStop: boolean;
  runStopPending: boolean;
  handleDurableRunStop: () => Promise<void> | void;
  currentRunTone: "warning" | "working" | "approval" | "default";
  timelineHydrating: boolean;
  runStopError: string | null;
  timelineSyncError: string | null;
  persistedRunStatus: AioRunStatus | null;
  timelineEvents: AioRunEvent[];
  handleTimelineApprovalResolve: (approvalId: string, runId: string, choice: "approve" | "reject") => Promise<void>;
}

export function CurrentRunCard({
  className,
  currentRunBadgeState,
  currentRunStatusLabel,
  currentRunNote,
  currentRunCanStop,
  runStopPending,
  handleDurableRunStop,
  currentRunTone,
  timelineHydrating,
  runStopError,
  timelineSyncError,
  persistedRunStatus,
  timelineEvents,
  handleTimelineApprovalResolve,
}: CurrentRunCardProps) {
  return (
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
}
