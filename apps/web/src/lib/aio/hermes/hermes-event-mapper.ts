import type { AioRunEvent } from "@/lib/aio/runs/aio-run-events";
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
    return {
      type: "run.created",
      runId: this.runId,
      threadId: this.threadId,
      status: "running",
      ts: Date.now(),
    };
  }

  map(evt: HermesRunEvent): AioRunEvent[] {
    const ts = Date.now();

    switch (evt.event) {
      case "message.delta":
        return evt.delta ? [{ type: "message.delta", delta: evt.delta, ts }] : [];

      case "tool.started": {
        if (!evt.tool) return [];
        const toolCallId = `${evt.tool}:${evt.timestamp ?? ts}`;
        const stack = this.runningToolIds.get(evt.tool) ?? [];
        stack.push(toolCallId);
        this.runningToolIds.set(evt.tool, stack);
        return [{ type: "tool.started", toolCallId, tool: evt.tool, label: evt.preview, ts }];
      }

      case "tool.completed": {
        if (!evt.tool) return [];
        const stack = this.runningToolIds.get(evt.tool) ?? [];
        const toolCallId = stack.shift() ?? `${evt.tool}:${evt.timestamp ?? ts}`;
        this.runningToolIds.set(evt.tool, stack);
        const artifact =
          evt.file_path && !evt.error
            ? {
                filePath: this.artifactUrlForPath(evt.file_path),
                fileName: evt.file_name,
              }
            : undefined;

        if (evt.error) {
          return [{ type: "tool.failed", toolCallId, tool: evt.tool, errorText: evt.result_preview, ts }];
        }

        const completed: AioRunEvent = {
          type: "tool.completed",
          toolCallId,
          tool: evt.tool,
          durationS: evt.duration,
          error: false,
          resultPreview: evt.result_preview,
          artifact,
          ts,
        };
        return artifact ? [completed, { type: "artifact.created", artifact, ts }] : [completed];
      }

      case "reasoning.available":
        return [{ type: "reasoning.available", text: evt.text ?? "", ts }];

      case "approval.requested":
      case "approval.request": {
        const requestId = `${this.runId}:${evt.timestamp ?? ts}`;
        return [
          {
            type: "approval.requested",
            requestId,
            runId: this.runId,
            command: evt.command,
            description: evt.description,
            patternKey: evt.pattern_key,
            allowPermanent: Boolean(evt.allow_permanent),
            choices: evt.choices ?? ["once", "session", "always", "deny"],
            ts,
          },
        ];
      }

      case "approval.responded":
        return [
          {
            type: "approval.responded",
            requestId: `${this.runId}:responded`,
            runId: this.runId,
            choice: evt.choice ?? "unknown",
            ts,
          },
        ];

      case "compression.started":
      case "compression.done":
        return [{ type: "compression.started", runId: this.runId, ts }];

      case "task.codeexec": {
        const taskId = this.activeCodeExecTaskId ?? `${this.runId}:codeexec:${evt.timestamp ?? ts}`;
        if (evt.status === "running") this.activeCodeExecTaskId = taskId;
        else this.activeCodeExecTaskId = null;

        return [
          {
            type: "task.codeexec",
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
            ts,
          },
        ];
      }

      case "run.completed":
        return [{ type: "run.completed", runId: evt.run_id ?? this.runId, status: "completed", ts }];

      case "run.failed":
        return [{ type: "run.failed", runId: evt.run_id ?? this.runId, status: "failed", ts }];

      case "run.cancelled":
        return [{ type: "run.cancelled", runId: evt.run_id ?? this.runId, status: "cancelled", ts }];

      default:
        return [];
    }
  }
}
