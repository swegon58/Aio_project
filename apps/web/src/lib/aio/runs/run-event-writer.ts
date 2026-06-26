import type { UIMessageStreamWriter } from "ai";
import type { HermesShowcaseData, HermesUIMessage } from "@/lib/hermes/chat-types";
import type { AioRunEvent } from "./aio-run-events";

export function writeAioRunEventToLegacyStream(
  writer: UIMessageStreamWriter<HermesUIMessage>,
  event: AioRunEvent,
) {
  writer.write({ type: "data-aio-event", id: aioEventId(event), data: event });

  switch (event.type) {
    case "run.created":
      writer.write({ type: "data-aio-run", id: event.runId, data: { runId: event.runId, threadId: event.threadId ?? "" } });
      writer.write({ type: "data-hermes-run", id: event.runId, data: { runId: event.runId, threadId: event.threadId ?? "" } });
      break;

    case "tool.started": {
      const data = {
        kind: "tool" as const,
        toolCallId: event.toolCallId,
        tool: event.toolName,
        label: event.preview ?? event.label,
        status: "running" as const,
        ts: event.ts ?? Date.parse(event.createdAt),
      };
      writer.write({ type: "data-aio-activity", id: event.toolCallId, data });
      writer.write({ type: "data-hermes-activity", id: event.toolCallId, data });
      break;
    }

    case "tool.completed": {
      const data = {
        kind: "tool" as const,
        toolCallId: event.toolCallId,
        tool: event.toolName,
        status: "completed" as const,
        durationS: event.durationS,
        error: event.error,
        resultPreview: event.resultPreview,
        filePath: event.artifact?.filePath ?? event.artifact?.url,
        fileName: event.artifact?.fileName ?? event.artifact?.name,
        ts: event.ts ?? Date.parse(event.createdAt),
      };
      writer.write({ type: "data-aio-activity", id: event.toolCallId, data });
      writer.write({ type: "data-hermes-activity", id: event.toolCallId, data });
      break;
    }

    case "tool.failed": {
      const data = {
        kind: "tool" as const,
        toolCallId: event.toolCallId,
        tool: event.toolName,
        status: "completed" as const,
        error: true,
        resultPreview: event.errorText ?? event.error,
        ts: event.ts ?? Date.parse(event.createdAt),
      };
      writer.write({ type: "data-aio-activity", id: event.toolCallId, data });
      writer.write({ type: "data-hermes-activity", id: event.toolCallId, data });
      break;
    }

    case "reasoning.available": {
      const id = crypto.randomUUID();
      const data = { text: event.text, ts: event.ts ?? Date.parse(event.createdAt) };
      writer.write({ type: "data-aio-reasoning", id, data });
      writer.write({ type: "data-hermes-reasoning", id, data });
      break;
    }

    case "approval.requested": {
      const id = event.requestId ?? event.approvalId;
      const data = {
        kind: "request" as const,
        requestId: id,
        runId: event.runId,
        command: event.command,
        description: event.description,
        patternKey: event.patternKey,
        allowPermanent: Boolean(event.allowPermanent),
        choices: event.choices ?? ["once", "session", "always", "deny"],
        ts: event.ts ?? Date.parse(event.createdAt),
      };
      writer.write({ type: "data-aio-approval", id, data });
      writer.write({ type: "data-hermes-approval", id, data });
      break;
    }

    case "approval.responded": {
      const id = `${event.runId}:responded:${event.ts ?? Date.parse(event.createdAt)}`;
      const data = {
        kind: "resolved" as const,
        requestId: event.requestId ?? event.approvalId,
        runId: event.runId,
        choice: event.choice ?? event.status,
        ts: event.ts ?? Date.parse(event.createdAt),
      };
      writer.write({ type: "data-aio-approval", id, data });
      writer.write({ type: "data-hermes-approval", id, data });
      break;
    }

    case "compression.started": {
      const id = `${event.runId}:compression`;
      const data = { active: true, ts: event.ts ?? Date.parse(event.createdAt) };
      writer.write({ type: "data-aio-compression", id, data });
      writer.write({ type: "data-hermes-compression", id, data });
      break;
    }

    case "task.codeexec": {
      const data = legacyShowcaseFromAioTaskCodeExec(event);
      writer.write({ type: "data-aio-showcase", id: event.taskId, data });
      writer.write({ type: "data-hermes-showcase", id: event.taskId, data });
      break;
    }

    default:
      break;
  }
}

export function legacyShowcaseFromAioTaskCodeExec(
  event: Extract<AioRunEvent, { type: "task.codeexec" }>,
): HermesShowcaseData {
  return {
    taskId: event.taskId,
    taskType: "code_exec",
    status: event.status,
    ts: event.ts ?? Date.parse(event.createdAt),
    taskData: event.taskData,
  };
}

function aioEventId(event: AioRunEvent): string {
  if ("toolCallId" in event) return `${event.type}:${event.toolCallId}:${event.createdAt}`;
  if ("approvalId" in event) return `${event.type}:${event.approvalId}:${event.createdAt}`;
  if ("artifactId" in event) return `${event.type}:${event.artifactId}:${event.createdAt}`;
  if ("taskId" in event) return `${event.type}:${event.taskId}:${event.createdAt}`;
  return `${event.type}:${event.runId}:${event.createdAt}`;
}
