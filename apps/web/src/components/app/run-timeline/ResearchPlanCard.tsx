// R13.3 item 3 — upfront question-specific plan card (title + step list).
//
// Informational only (no confirm gate, no interactive checkboxes): shows the
// plan the agent formed before/alongside the live ResearchProgressCard.
// Rendered whenever the latest research.stage event carries a `plan`.

import { ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResearchPlanPayload } from "@/lib/aio/runs/aio-run-events";

export function ResearchPlanCard({
  plan,
  bare,
}: {
  plan: ResearchPlanPayload;
  // Same bare precedent as ResearchProgressCard: skip border/bg/padding when
  // nested inside ResearchCardShell so the two cards don't double up.
  bare?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg",
        bare ? "mt-3" : "border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-3",
      )}
    >
      <div className="research-plan-heading flex items-center gap-1.5 mb-2">
        <ListChecks className="h-3 w-3 shrink-0" />
        <div className="research-plan-title min-w-0 flex-1">{plan.title}</div>
      </div>
      <ol className="flex list-decimal list-outside flex-col gap-1 pl-8">
        {plan.steps.map((step, i) => (
          <li key={i} className="text-[11.5px] text-[var(--text-muted)] marker:text-[var(--text-muted)]">
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
