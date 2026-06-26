import { cn } from "@/lib/utils";

export type AgentDisplayState =
  | "idle"
  | "ready"
  | "talking"
  | "working"
  | "asking"
  | "confused"
  | "success"
  | "error";

const STATE_LABEL: Record<AgentDisplayState, string> = {
  idle: "Idle",
  ready: "Ready",
  talking: "Responding",
  working: "Working",
  asking: "Needs approval",
  confused: "Needs attention",
  success: "Completed",
  error: "Error",
};

const STATE_CLASS: Record<AgentDisplayState, string> = {
  idle: "border-[var(--border-color)] text-[var(--text-muted)]",
  ready: "border-[var(--border-color)] text-[var(--text-secondary)]",
  talking: "border-[var(--accent-primary)]/30 text-[var(--accent-primary)]",
  working: "border-[var(--aio-amber)]/30 text-[var(--aio-amber)]",
  asking: "border-[var(--accent-orange)]/35 text-[var(--accent-orange)]",
  confused: "border-[var(--aio-error)]/30 text-[var(--aio-error)]",
  success: "border-[var(--accent-green)]/35 text-[var(--accent-green)]",
  error: "border-[var(--aio-error)]/40 text-[var(--aio-error)]",
};

export function AgentStateBadge({ state, className }: { state: AgentDisplayState; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", STATE_CLASS[state], className)}>
      {STATE_LABEL[state]}
    </span>
  );
}
