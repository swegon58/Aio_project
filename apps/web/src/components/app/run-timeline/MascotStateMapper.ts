import type { AioRunEvent } from "@/lib/aio/runs/aio-run-events";
import type { AgentDisplayState } from "./AgentStateBadge";

export type MascotState = AgentDisplayState;

export function getMascotStateFromRunEvents(events: AioRunEvent[]): MascotState {
  if (events.length === 0) return "idle";

  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    switch (event.type) {
      case "run.created":
        return "ready";
      case "message.delta":
        return "talking";
      case "tool.started":
        return "working";
      case "approval.requested":
        return "asking";
      case "tool.failed":
        return "confused";
      case "run.completed":
        return "success";
      case "run.failed":
        return "error";
      case "run.cancelled":
        return "idle";
      case "tool.completed":
        return hasRecentMessageDelta(events, i) ? "talking" : "working";
      default:
        break;
    }
  }

  return "idle";
}

function hasRecentMessageDelta(events: AioRunEvent[], startIndex: number): boolean {
  return events.slice(Math.max(0, startIndex - 3), startIndex).some((event) => event.type === "message.delta");
}
