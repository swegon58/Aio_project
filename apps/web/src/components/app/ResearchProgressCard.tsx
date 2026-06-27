"use client";

import { Check, Circle, Loader2, PencilLine, Search, Square } from "lucide-react";
import type { AioResearchSummary } from "@/lib/aio/chat/chat-mode";
import { isWebResearchTool } from "@/lib/aio/chat/research-mode";
import type { AioRunEvent } from "@/lib/aio/runs/aio-run-events";
import { cn } from "@/lib/utils";

interface ResearchProgressCardProps {
  query: string;
  events: AioRunEvent[];
  summary?: AioResearchSummary;
  isRunning: boolean;
  hasReportText: boolean;
  onStopAndEdit?: () => void;
}

const STEP_LABELS = [
  "Define the research scope",
  "Search and inspect sources",
  "Cross-check the evidence",
  "Write the cited report",
];

export function ResearchProgressCard({
  query,
  events,
  summary,
  isRunning,
  hasReportText,
  onStopAndEdit,
}: ResearchProgressCardProps) {
  const startedTools = events.filter((event) => event.type === "tool.started");
  const liveSearchCount = new Set(
    startedTools
      .filter((event) => isWebResearchTool(event.toolName))
      .map((event) => event.toolCallId),
  ).size;
  const searchCount = summary?.searchCount ?? liveSearchCount;
  const toolCount = summary?.toolCount ?? new Set(startedTools.map((event) => event.toolCallId)).size;
  const runCompleted = summary?.status === "completed"
    || events.some((event) => event.type === "run.completed");
  const runInterrupted = summary?.status === "interrupted"
    || events.some((event) => event.type === "run.failed" || event.type === "run.cancelled");

  const activeStep = runCompleted
    ? STEP_LABELS.length
    : hasReportText
      ? 3
      : searchCount >= 2
        ? 2
        : toolCount > 0
          ? 1
          : 0;
  const progress = runCompleted ? 100 : [14, 38, 66, 86][activeStep];
  const displayQuery = query.trim() || "Deep research";

  return (
    <section className="research-progress-card" aria-label="Deep research progress">
      <div className="research-progress-head">
        <div className="research-progress-heading">
          <span className="research-progress-kicker">
            <Search className="w-3.5 h-3.5" />
            Deep research
          </span>
          <h3 title={displayQuery}>{displayQuery}</h3>
        </div>
        {isRunning && onStopAndEdit && (
          <button type="button" className="research-edit-btn" onClick={onStopAndEdit}>
            <PencilLine className="w-3.5 h-3.5" />
            Stop &amp; edit
          </button>
        )}
      </div>

      <div className="research-step-list">
        {STEP_LABELS.map((label, index) => {
          const completed = runCompleted || index < activeStep;
          const active = isRunning && index === activeStep;
          const interrupted = runInterrupted && index === activeStep;
          return (
            <div
              key={label}
              className={cn(
                "research-step",
                completed && "completed",
                active && "active",
                interrupted && "interrupted",
              )}
            >
              <span className="research-step-icon" aria-hidden>
                {completed ? (
                  <Check className="w-3 h-3" />
                ) : active ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
                ) : interrupted ? (
                  <Square className="w-3 h-3" />
                ) : (
                  <Circle className="w-3 h-3" />
                )}
              </span>
              <span>{label}</span>
            </div>
          );
        })}
      </div>

      <div className="research-progress-footer">
        <div>
          <span className="research-progress-status">
            {runCompleted
              ? "Research complete"
              : runInterrupted
                ? "Research stopped"
                : activeStep === 0
                  ? "Preparing the research plan"
                  : activeStep === 1
                    ? "Searching and reading sources"
                    : activeStep === 2
                      ? "Comparing findings across sources"
                      : "Writing the report"}
          </span>
          <span className="research-search-count">
            {searchCount} {searchCount === 1 ? "search" : "searches"}
          </span>
        </div>
        <span>{progress}%</span>
      </div>
      <div className="research-progress-track" aria-hidden>
        <span style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}
