import { Bot, Brain, CheckCircle2, Circle, CircleAlert, Clock, MessageSquareText } from "lucide-react";
import type { AioRunEvent } from "@/lib/aio/runs/aio-run-events";
import { ApprovalCard } from "./ApprovalCard";
import { ArtifactCard } from "./ArtifactCard";
import { ToolCallCard } from "./ToolCallCard";

export function RunEventItem({ event }: { event: AioRunEvent }) {
  if (event.type === "tool.started" || event.type === "tool.completed" || event.type === "tool.failed") {
    return <ToolCallCard event={event} />;
  }
  if (event.type === "approval.requested" || event.type === "approval.responded") {
    return <ApprovalCard event={event} />;
  }
  if (event.type === "artifact.created") {
    return <ArtifactCard event={event} />;
  }

  const { icon, label, summary } = genericEventMeta(event);
  return (
    <div className="flex gap-2 rounded-lg px-1 py-1.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-color)] text-[var(--text-muted)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold text-[var(--text-primary)]">{label}</span>
          <time className="font-mono text-[10.5px] text-[var(--text-muted)]">{formatTime(event.createdAt)}</time>
        </div>
        {summary && <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-5 text-[var(--text-secondary)]">{summary}</p>}
      </div>
    </div>
  );
}

function genericEventMeta(event: AioRunEvent) {
  switch (event.type) {
    case "run.created":
      return { icon: <Bot className="h-3 w-3" />, label: "Run started", summary: event.status };
    case "message.delta":
      return { icon: <MessageSquareText className="h-3 w-3" />, label: "Responding", summary: event.delta };
    case "message.completed":
      return { icon: <MessageSquareText className="h-3 w-3" />, label: "Message completed", summary: event.text };
    case "reasoning.available":
      return { icon: <Brain className="h-3 w-3" />, label: "Reasoning available", summary: event.text };
    case "task.codeexec":
      return { icon: <Clock className="h-3 w-3" />, label: "Code execution", summary: event.status };
    case "compression.started":
      return { icon: <Clock className="h-3 w-3" />, label: "Compressing context", summary: undefined };
    case "run.completed":
      return { icon: <CheckCircle2 className="h-3 w-3" />, label: "Run completed", summary: undefined };
    case "run.failed":
      return { icon: <CircleAlert className="h-3 w-3" />, label: "Run failed", summary: event.error };
    case "run.cancelled":
      return { icon: <Circle className="h-3 w-3" />, label: "Run cancelled", summary: undefined };
    default:
      return { icon: <Circle className="h-3 w-3" />, label: event.type, summary: undefined };
  }
}

function formatTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
