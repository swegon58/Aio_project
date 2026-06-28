import type {
  AioRiskLevel,
  AioRunEvent,
  AdapterDiagnosticEvent,
} from "@/lib/aio/runs/aio-run-events";
import type { HermesRunEvent } from "./hermes-event-types";

interface HermesEventMapperOptions {
  runId: string;
  threadId: string;
  artifactUrlForPath: (filePath: string) => string;
}

/**
 * Converts a Hermes runtime event into zero or more AioRunEvent payloads.
 *
 * Per ADR-001 the mapper is STATELESS: it keeps no positional buffers and
 * derives every tool/task identifier deterministically from stable Hermes
 * fields (tool_call_id, scriptPath, timestamp). Mapping the same Hermes event
 * twice therefore yields the same payloads, so a replay is idempotent. Unknown
 * or malformed Hermes events become an explicit adapter.diagnostic instead of
 * being silently dropped.
 *
 * The mapper emits payloads only; envelope id/sequence are assigned by the
 * run-event repository at append time, not here.
 */
export class HermesEventMapper {
  private readonly runId: string;
  private readonly threadId: string;
  private readonly artifactUrlForPath: (filePath: string) => string;

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
        // An empty delta carries no content; skip it rather than emit noise.
        return evt.delta ? [{ type: "message.delta", runId: this.runId, delta: evt.delta, createdAt, ts }] : [];

      case "tool.started": {
        if (!evt.tool) return [this.diagnostic("malformed_event", evt, createdAt, ts)];
        return [
          {
            type: "tool.started",
            runId: this.runId,
            toolCallId: this.toolCallIdFor(evt, ts),
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
        if (!evt.tool) return [this.diagnostic("malformed_event", evt, createdAt, ts)];
        const toolCallId = this.toolCallIdFor(evt, ts);
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
        return [
          {
            type: "task.codeexec",
            runId: this.runId,
            taskId: this.codeExecTaskIdFor(evt, ts),
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
        // Unknown Hermes event — preserve as a diagnostic, never drop (ADR-001).
        return [this.diagnostic("unknown_event", evt, createdAt, ts)];
    }
  }

  /** Deterministic tool-call id: prefer the stable Hermes id, else derive from
   *  the event's own fields so a replay yields the same id. */
  private toolCallIdFor(evt: HermesRunEvent, ts: number): string {
    return evt.tool_call_id ?? `${evt.tool}:${evt.timestamp ?? ts}`;
  }

  /** Deterministic code-exec task id: prefer the stable script path, else
   *  derive from the event's own fields so a replay pairs consistently. */
  private codeExecTaskIdFor(evt: HermesRunEvent, ts: number): string {
    return evt.task_data?.scriptPath ?? `${this.runId}:codeexec:${evt.timestamp ?? ts}`;
  }

  private diagnostic(
    reason: AdapterDiagnosticEvent["reason"],
    evt: HermesRunEvent,
    createdAt: string,
    ts: number,
  ): AdapterDiagnosticEvent {
    return {
      type: "adapter.diagnostic",
      runId: this.runId,
      source: "hermes",
      reason,
      rawEventType: evt.event,
      rawEventPreview: previewHermesEvent(evt),
      createdAt,
      ts,
    };
  }
}

function previewHermesEvent(evt: HermesRunEvent): string {
  try {
    const json = JSON.stringify(evt);
    return json.length > 240 ? `${json.slice(0, 240)}…` : json;
  } catch {
    return "[unserializable]";
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
