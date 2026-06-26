"use client";

import { useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Bot, Brain, FlaskConical, GitBranch, Hammer, Search } from "lucide-react";
import type { AioRunEvent } from "@/lib/aio/runs/aio-run-events";
import { cn } from "@/lib/utils";

type WorkspaceModule = "tools" | "knowledge" | "agent" | "research" | "workflow";

interface WorkspaceModulesProps {
  events: AioRunEvent[];
  memoryLine: string;
  activeFileName?: string;
}

const MODULES: Array<{ id: WorkspaceModule; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "tools", label: "Tools", icon: Hammer },
  { id: "knowledge", label: "Knowledge", icon: Brain },
  { id: "agent", label: "Agent", icon: Bot },
  { id: "research", label: "Research", icon: Search },
  { id: "workflow", label: "Canvas", icon: GitBranch },
];

export function WorkspaceModules({ events, memoryLine, activeFileName }: WorkspaceModulesProps) {
  const [active, setActive] = useState<WorkspaceModule>("tools");
  const toolEvents = useMemo(
    () => events.filter((event) => event.type === "tool.started" || event.type === "tool.completed" || event.type === "tool.failed"),
    [events],
  );
  const artifacts = useMemo(() => events.filter((event) => event.type === "artifact.created"), [events]);
  const approvals = useMemo(() => events.filter((event) => event.type === "approval.requested"), [events]);

  return (
    <section className="workspace-modules">
      <div className="workspace-module-tabs" role="tablist" aria-label="Workspace modules">
        {MODULES.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.id}
              type="button"
              className={cn("workspace-module-tab", active === module.id && "active")}
              onClick={() => setActive(module.id)}
              aria-selected={active === module.id}
              role="tab"
              title={module.label}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{module.label}</span>
            </button>
          );
        })}
      </div>

      <div className="workspace-module-body">
        {active === "tools" && (
          <ModuleList
            empty="No tool calls yet."
            rows={toolEvents.slice(-4).reverse().map((event) => ({
              key: `${event.type}:${event.toolCallId}:${event.createdAt}`,
              title: "toolName" in event ? event.toolName : "Tool",
              meta: event.type === "tool.started" ? "Running" : event.type === "tool.failed" ? "Failed" : "Completed",
            }))}
          />
        )}

        {active === "knowledge" && (
          <ModuleList
            empty="No knowledge context yet."
            rows={[
              { key: "memory", title: "Memory", meta: memoryLine },
              ...(activeFileName ? [{ key: "active-file", title: "Active file", meta: activeFileName }] : []),
            ]}
          />
        )}

        {active === "agent" && (
          <ModuleList
            empty="No agent configuration changes."
            rows={[
              { key: "mode", title: "Mode", meta: "Auto / Plan" },
              { key: "approvals", title: "Approval queue", meta: approvals.length > 0 ? `${approvals.length} pending` : "Clear" },
            ]}
          />
        )}

        {active === "research" && (
          <ModuleList
            empty="No research run yet."
            rows={[
              { key: "sources", title: "Sources", meta: "Ready" },
              { key: "artifacts", title: "Artifacts", meta: artifacts.length > 0 ? `${artifacts.length} created` : "None" },
            ]}
            icon={<FlaskConical className="w-3.5 h-3.5" />}
          />
        )}

        {active === "workflow" && (
          <ModuleList
            empty="No workflow steps yet."
            rows={[
              { key: "trigger", title: "Trigger", meta: events.length > 0 ? "Current run" : "Idle" },
              { key: "steps", title: "Steps", meta: `${toolEvents.length} tool events` },
              { key: "outputs", title: "Outputs", meta: `${artifacts.length} artifacts` },
            ]}
          />
        )}
      </div>
    </section>
  );
}

function ModuleList({
  rows,
  empty,
  icon,
}: {
  rows: Array<{ key: string; title: string; meta: string }>;
  empty: string;
  icon?: ReactNode;
}) {
  if (rows.length === 0) return <div className="workspace-module-empty">{empty}</div>;

  return (
    <div className="workspace-module-list">
      {rows.map((row) => (
        <div key={row.key} className="workspace-module-row">
          <span className="workspace-module-row-icon">{icon ?? <span aria-hidden />}</span>
          <div className="workspace-module-row-copy">
            <span>{row.title}</span>
            <small>{row.meta}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
