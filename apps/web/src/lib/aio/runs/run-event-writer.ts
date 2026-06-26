import type { UIMessageStreamWriter } from "ai";
import type { HermesShowcaseData, HermesUIMessage } from "@/lib/hermes/chat-types";
import type { AioRunEvent } from "./aio-run-events";

export function writeAioRunEventToLegacyStream(
  writer: UIMessageStreamWriter<HermesUIMessage>,
  event: AioRunEvent,
) {
  // TODO: Rename these compatibility parts from data-hermes-* to data-aio-*
  // after the frontend migrates to AioRunEvent-native rendering.
  switch (event.type) {
    case "run.created":
      writer.write({ type: "data-hermes-run", id: event.runId, data: { runId: event.runId, threadId: event.threadId } });
      break;

    case "tool.started":
      writer.write({
        type: "data-hermes-activity",
        id: event.toolCallId,
        data: {
          kind: "tool",
          toolCallId: event.toolCallId,
          tool: event.tool,
          label: event.label,
          status: "running",
          ts: event.ts,
        },
      });
      break;

    case "tool.completed":
      writer.write({
        type: "data-hermes-activity",
        id: event.toolCallId,
        data: {
          kind: "tool",
          toolCallId: event.toolCallId,
          tool: event.tool,
          status: "completed",
          durationS: event.durationS,
          error: event.error,
          resultPreview: event.resultPreview,
          filePath: event.artifact?.filePath,
          fileName: event.artifact?.fileName,
          ts: event.ts,
        },
      });
      break;

    case "tool.failed":
      writer.write({
        type: "data-hermes-activity",
        id: event.toolCallId,
        data: {
          kind: "tool",
          toolCallId: event.toolCallId,
          tool: event.tool,
          status: "completed",
          error: true,
          resultPreview: event.errorText,
          ts: event.ts,
        },
      });
      break;

    case "reasoning.available":
      writer.write({ type: "data-hermes-reasoning", id: crypto.randomUUID(), data: { text: event.text, ts: event.ts } });
      break;

    case "approval.requested":
      writer.write({
        type: "data-hermes-approval",
        id: event.requestId,
        data: {
          kind: "request",
          requestId: event.requestId,
          runId: event.runId,
          command: event.command,
          description: event.description,
          patternKey: event.patternKey,
          allowPermanent: event.allowPermanent,
          choices: event.choices,
          ts: event.ts,
        },
      });
      break;

    case "approval.responded":
      writer.write({
        type: "data-hermes-approval",
        id: `${event.runId}:responded:${event.ts}`,
        data: {
          kind: "resolved",
          requestId: event.requestId,
          runId: event.runId,
          choice: event.choice,
          ts: event.ts,
        },
      });
      break;

    case "compression.started":
      writer.write({
        type: "data-hermes-compression",
        id: `${event.runId}:compression`,
        data: { active: true, ts: event.ts },
      });
      break;

    case "task.codeexec":
      writer.write({ type: "data-hermes-showcase", id: event.taskId, data: legacyShowcaseFromAioTaskCodeExec(event) });
      break;

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
    ts: event.ts,
    taskData: event.taskData,
  };
}
