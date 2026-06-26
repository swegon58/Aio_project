import type { HermesActivityData, HermesApprovalData, HermesShowcaseData } from "@/lib/hermes/chat-types";
import type { AioRunEvent, AioRiskLevel } from "@/lib/aio/runs/aio-run-events";

interface LegacyTimelineInput {
  activity: HermesActivityData[];
  approvals?: HermesApprovalData[];
  showcases?: HermesShowcaseData[];
  runId?: string;
}

export function legacyFrontendEventsToAioRunEvents({
  activity,
  approvals = [],
  showcases = [],
  runId = "current-run",
}: LegacyTimelineInput): AioRunEvent[] {
  const events: AioRunEvent[] = [];

  for (const item of activity) {
    if (item.kind === "approval") {
      events.push({
        type: "approval.requested",
        runId,
        approvalId: item.requestId ?? `${runId}:approval:${item.ts}`,
        requestId: item.requestId,
        title: "Approval requested",
        description: item.desc,
        command: item.cmd,
        actions: ["approve", "reject"],
        createdAt: new Date(item.ts).toISOString(),
        ts: item.ts,
      });
      continue;
    }

    const common = {
      runId,
      toolCallId: item.toolCallId,
      toolName: item.tool,
      tool: item.tool,
      createdAt: new Date(item.ts).toISOString(),
      ts: item.ts,
    };

    if (item.status === "running") {
      events.push({
        type: "tool.started",
        ...common,
        preview: item.label,
        label: item.label,
        riskLevel: riskLevelForTool(item.tool),
      });
    } else if (item.error) {
      events.push({
        type: "tool.failed",
        ...common,
        error: item.resultPreview ?? "Tool failed",
        errorText: item.resultPreview,
      });
    } else {
      events.push({
        type: "tool.completed",
        ...common,
        durationS: item.durationS,
        resultPreview: item.resultPreview,
        error: false,
        artifact: item.filePath
          ? {
              filePath: item.filePath,
              fileName: item.fileName,
              name: item.fileName,
              url: item.filePath,
            }
          : undefined,
      });
      if (item.filePath) {
        events.push({
          type: "artifact.created",
          runId,
          artifactId: `${item.toolCallId}:artifact`,
          name: item.fileName,
          url: item.filePath,
          artifact: {
            filePath: item.filePath,
            fileName: item.fileName,
            name: item.fileName,
            url: item.filePath,
          },
          createdAt: new Date(item.ts).toISOString(),
          ts: item.ts,
        });
      }
    }
  }

  for (const approval of approvals) {
    if (approval.kind === "request") {
      events.push({
        type: "approval.requested",
        runId: approval.runId,
        approvalId: approval.requestId,
        requestId: approval.requestId,
        title: "Approval requested",
        description: approval.description,
        command: approval.command,
        actions: ["approve", "reject"],
        createdAt: new Date(approval.ts).toISOString(),
        ts: approval.ts,
      });
    } else {
      events.push({
        type: "approval.responded",
        runId: approval.runId,
        approvalId: approval.requestId,
        requestId: approval.requestId,
        status: approval.choice === "deny" ? "rejected" : "approved",
        choice: approval.choice,
        createdAt: new Date(approval.ts).toISOString(),
        ts: approval.ts,
      });
    }
  }

  for (const showcase of showcases) {
    events.push({
      type: "task.codeexec",
      runId,
      taskId: showcase.taskId,
      status: showcase.status,
      taskData: showcase.taskData,
      createdAt: new Date(showcase.ts).toISOString(),
      ts: showcase.ts,
    });
  }

  return events.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function riskLevelForTool(toolName: string): AioRiskLevel {
  const tool = toolName.toLowerCase();
  if (/(read|search|inspect|list|grep|find|fetch|view|scan)/.test(tool)) return "safe";
  if (/(write|delete|deploy|send|execute|exec|bash|shell|run|edit|apply|mutate|post|publish)/.test(tool)) {
    return "dangerous";
  }
  return "medium";
}
