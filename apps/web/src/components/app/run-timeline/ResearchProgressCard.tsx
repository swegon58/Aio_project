// R4.4 — Research progress frame rendered in the run timeline.
//
// Shows the current stage name, a 7-step progress bar, and optional source/claim counts.
// Rendered in RunEventItem when the event type is "research.stage".

import { BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResearchStage, ResearchStageEvent } from "@/lib/aio/runs/aio-run-events";

const STAGE_LABELS: Record<ResearchStage, string> = {
  understand: "Understanding",
  plan: "Planning",
  discover: "Discovering",
  inspect: "Reading",
  synthesize: "Synthesizing",
  verify: "Verifying",
  report: "Writing report",
};

export function ResearchProgressCard({ event }: { event: ResearchStageEvent }) {
  const { stage, stageIndex, totalStages, sourceCount, claimCount, label } = event;
  const isComplete = stage === "report";
  const progressPct = Math.round((stageIndex / totalStages) * 100);

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-3">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          isComplete ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400",
        )}>
          {isComplete
            ? <CheckCircle2 className="h-3.5 w-3.5" />
            : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
            {label ?? STAGE_LABELS[stage] ?? stage}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            Stage {stageIndex} of {totalStages}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[var(--text-muted)]">
          <BookOpen className="h-3.5 w-3.5 opacity-60" />
          <span className="text-[11px]">Research</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-[var(--border-color)] overflow-hidden mb-2">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isComplete ? "bg-emerald-500" : "bg-blue-500",
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Stage pills */}
      <div className="flex gap-1 flex-wrap">
        {(["understand", "plan", "discover", "inspect", "synthesize", "verify", "report"] as ResearchStage[]).map(
          (s, i) => {
            const idx = i + 1;
            const done = idx < stageIndex;
            const active = idx === stageIndex;
            return (
              <span
                key={s}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                  done && "bg-emerald-500/15 text-emerald-400",
                  active && "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40",
                  !done && !active && "bg-[var(--surface-elevated)] text-[var(--text-muted)] opacity-50",
                )}
              >
                {STAGE_LABELS[s]}
              </span>
            );
          },
        )}
      </div>

      {/* Stat row */}
      {(sourceCount !== undefined || claimCount !== undefined) && (
        <div className="mt-2 flex gap-3 text-[11px] text-[var(--text-muted)]">
          {sourceCount !== undefined && (
            <span><span className="font-semibold text-[var(--text-primary)]">{sourceCount}</span> sources</span>
          )}
          {claimCount !== undefined && (
            <span><span className="font-semibold text-[var(--text-primary)]">{claimCount}</span> claims</span>
          )}
        </div>
      )}
    </div>
  );
}
