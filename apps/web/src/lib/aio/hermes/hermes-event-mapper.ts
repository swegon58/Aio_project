import type { AioRiskLevel, AioRunEvent } from "@/lib/aio/runs/aio-run-events";
import type { HermesRunEvent } from "./hermes-event-types";

interface HermesEventMapperOptions {
  runId: string;
  threadId: string;
  artifactUrlForPath: (filePath: string) => string;
}

export class HermesEventMapper {
  private readonly runId: string;
  private readonly threadId: string;
  private readonly artifactUrlForPath: (filePath: string) => string;
  private readonly runningToolIds = new Map<string, string[]>();
  private activeCodeExecTaskId: string | null = null;

  constructor(options: HermesEventMapperOptions) {
    this.runId = options.runId;
    this.threadId = options.threadId;
    this.artifactUrlForPath = options.artifactUrlForPath;
  }

  createRunEvent(): AioRunEvent {
    const { createdAt, ts } = timestampFields();
    return {
      type: "run.created",
      runId: this.runId,
      threadId: this.threadId,
      status: "running",
      createdAt,
      ts,
    };
  }

  map(evt: HermesRunEvent): AioRunEvent[] {
    const { createdAt, ts } = timestampFields(evt.timestamp);

    switch (evt.event) {
      case "message.delta":
        return evt.delta ? [{ type: "message.delta", runId: this.runId, delta: evt.delta, createdAt, ts }] : [];

      case "tool.started": {
        if (!evt.tool) return [];
        const toolCallId = evt.tool_call_id ?? `${evt.tool}:${evt.timestamp ?? ts}`;
        const stack = this.runningToolIds.get(evt.tool) ?? [];
        stack.push(toolCallId);
        this.runningToolIds.set(evt.tool, stack);
        return [
          {
            type: "tool.started",
            runId: this.runId,
            toolCallId,
            toolName: evt.tool,
            tool: evt.tool,
            input: evt.input,
            preview: evt.preview,
            label: evt.preview,
            riskLevel: normalizeHermesRiskLevel(evt.risk_level ?? evt.risk, evt.tool),
            createdAt,
            ts,
          },
        ];
      }

      case "tool.completed": {
        if (!evt.tool) return [];
        const stack = this.runningToolIds.get(evt.tool) ?? [];
        const toolCallId = evt.tool_call_id ?? stack.shift() ?? `${evt.tool}:${evt.timestamp ?? ts}`;
        this.runningToolIds.set(evt.tool, stack);
        const artifact =
          evt.file_path && !evt.error
            ? {
                filePath: this.artifactUrlForPath(evt.file_path),
                fileName: evt.file_name,
                artifactId: evt.artifact_id,
                name: evt.artifact_name ?? evt.file_name,
                mimeType: evt.mime_type,
                url: this.artifactUrlForPath(evt.file_path),
                preview: evt.result_preview,
              }
            : undefined;

        if (evt.error) {
          return [
            {
              type: "tool.failed",
              runId: this.runId,
              toolCallId,
              toolName: evt.tool,
              tool: evt.tool,
              error: evt.error_text ?? evt.result_preview ?? "Tool failed",
              errorText: evt.error_text ?? evt.result_preview,
              createdAt,
              ts,
            },
          ];
        }

        const completed: AioRunEvent = {
          type: "tool.completed",
          runId: this.runId,
          toolCallId,
          toolName: evt.tool,
          tool: evt.tool,
          output: evt.output,
          durationS: evt.duration,
          error: false,
          resultPreview: evt.result_preview,
          artifact,
          createdAt,
          ts,
        };
        return artifact
          ? [
              completed,
              {
                type: "artifact.created",
                runId: this.runId,
                artifactId: artifact.artifactId ?? `${toolCallId}:artifact`,
                name: artifact.name,
                mimeType: artifact.mimeType,
                url: artifact.url,
                preview: artifact.preview,
                artifact,
                createdAt,
                ts,
              },
            ]
          : [completed];
      }

      case "reasoning.available":
        return [{ type: "reasoning.available", runId: this.runId, text: evt.text ?? "", createdAt, ts }];

      case "approval.requested":
      case "approval.request": {
        const approvalId = evt.approval_id ?? `${this.runId}:${evt.timestamp ?? ts}`;
        return [
          {
            type: "approval.requested",
            approvalId,
            requestId: approvalId,
            runId: this.runId,
            title: evt.title ?? "Approval requested",
            command: evt.command,
            description: evt.description,
            patternKey: evt.pattern_key,
            allowPermanent: Boolean(evt.allow_permanent),
            choices: evt.choices ?? ["once", "session", "always", "deny"],
            actions: ["approve", "reject"],
            payload: {
              patternKey: evt.pattern_key,
              allowPermanent: evt.allow_permanent,
              choices: evt.choices,
            },
            riskLevel: normalizeHermesRiskLevel(evt.risk_level ?? evt.risk, evt.tool ?? evt.command),
            createdAt,
            ts,
          },
        ];
      }

      case "approval.responded":
        return [
          {
            type: "approval.responded",
            approvalId: evt.approval_id ?? `${this.runId}:responded`,
            requestId: evt.approval_id ?? `${this.runId}:responded`,
            runId: this.runId,
            status: approvalChoiceToStatus(evt.choice),
            choice: evt.choice ?? "unknown",
            createdAt,
            ts,
          },
        ];

      case "compression.started":
      case "compression.done":
        return [{ type: "compression.started", runId: this.runId, createdAt, ts }];

      case "task.codeexec": {
        const taskId = this.activeCodeExecTaskId ?? `${this.runId}:codeexec:${evt.timestamp ?? ts}`;
        if (evt.status === "running") this.activeCodeExecTaskId = taskId;
        else this.activeCodeExecTaskId = null;

        return [
          {
            type: "task.codeexec",
            runId: this.runId,
            taskId,
            status: evt.status ?? "running",
            taskData: {
              scriptPath: evt.task_data?.scriptPath,
              code: evt.task_data?.code,
              stdout: evt.task_data?.stdout,
              resultsFile: evt.task_data?.resultsFile
                ? this.artifactUrlForPath(evt.task_data.resultsFile)
                : undefined,
              resultsTable: evt.task_data?.resultsTable,
            },
            createdAt,
            ts,
          },
        ];
      }

      case "artifact.created": {
        const artifactId = evt.artifact_id ?? `${this.runId}:artifact:${evt.timestamp ?? ts}`;
        return [
          {
            type: "artifact.created",
            runId: this.runId,
            artifactId,
            name: evt.artifact_name ?? evt.file_name,
            mimeType: evt.mime_type,
            url: evt.url ?? (evt.file_path ? this.artifactUrlForPath(evt.file_path) : undefined),
            preview: evt.preview ?? evt.result_preview,
            artifact: {
              artifactId,
              filePath: evt.file_path ? this.artifactUrlForPath(evt.file_path) : undefined,
              fileName: evt.file_name,
              name: evt.artifact_name ?? evt.file_name,
              mimeType: evt.mime_type,
              url: evt.url ?? (evt.file_path ? this.artifactUrlForPath(evt.file_path) : undefined),
              preview: evt.preview ?? evt.result_preview,
            },
            createdAt,
            ts,
          },
        ];
      }

      case "run.completed":
        return [{ type: "run.completed", runId: evt.run_id ?? this.runId, status: "completed", createdAt, ts }];

      case "run.failed":
        return [
          {
            type: "run.failed",
            runId: evt.run_id ?? this.runId,
            status: "failed",
            error: evt.error_text ?? evt.result_preview,
            createdAt,
            ts,
          },
        ];

      case "run.cancelled":
        return [{ type: "run.cancelled", runId: evt.run_id ?? this.runId, status: "cancelled", createdAt, ts }];

      default:
        return [];
    }
  }
}

function timestampFields(timestamp?: number): { createdAt: string; ts: number } {
  const ts = timestamp ? normalizeTimestampMs(timestamp) : Date.now();
  return { createdAt: new Date(ts).toISOString(), ts };
}

function normalizeTimestampMs(timestamp: number): number {
  return timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
}

export function normalizeHermesRiskLevel(rawRisk: string | undefined, toolName: string | undefined): AioRiskLevel {
  const risk = rawRisk?.toLowerCase();
  if (risk === "low" || risk === "safe") return "safe";
  if (risk === "high" || risk === "critical" || risk === "dangerous") return "dangerous";
  if (risk === "medium") return "medium";

  const tool = toolName?.toLowerCase() ?? "";
  if (/(read|search|inspect|list|grep|find|fetch|view|scan)/.test(tool)) return "safe";
  if (/(write|delete|deploy|send|execute|exec|bash|shell|run|edit|apply|mutate|post|publish)/.test(tool)) {
    return "dangerous";
  }
  return "medium";
}

function approvalChoiceToStatus(choice: string | undefined): "approved" | "rejected" | "edited" {
  if (choice === "deny" || choice === "reject" || choice === "rejected") return "rejected";
  if (choice === "edit" || choice === "edited") return "edited";
  return "approved";
}
