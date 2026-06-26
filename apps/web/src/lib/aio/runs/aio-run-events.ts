export type AioRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type AioRiskLevel = "low" | "medium" | "high";

export interface AioArtifactRef {
  filePath: string;
  fileName?: string;
}

export type AioRunEvent =
  | {
      type: "run.created";
      runId: string;
      threadId: string;
      status: AioRunStatus;
      ts: number;
    }
  | {
      type: "message.delta";
      delta: string;
      ts: number;
    }
  | {
      type: "message.completed";
      text?: string;
      ts: number;
    }
  | {
      type: "reasoning.available";
      text: string;
      ts: number;
    }
  | {
      type: "tool.started";
      toolCallId: string;
      tool: string;
      label?: string;
      risk?: AioRiskLevel;
      ts: number;
    }
  | {
      type: "tool.completed";
      toolCallId: string;
      tool: string;
      durationS?: number;
      error: boolean;
      resultPreview?: string;
      artifact?: AioArtifactRef;
      ts: number;
    }
  | {
      type: "tool.failed";
      toolCallId: string;
      tool: string;
      errorText?: string;
      ts: number;
    }
  | {
      type: "approval.requested";
      requestId: string;
      runId: string;
      command?: string;
      description?: string;
      patternKey?: string;
      allowPermanent: boolean;
      choices: string[];
      risk?: AioRiskLevel;
      ts: number;
    }
  | {
      type: "approval.responded";
      requestId: string;
      runId: string;
      choice: string;
      ts: number;
    }
  | {
      type: "artifact.created";
      artifact: AioArtifactRef;
      ts: number;
    }
  | {
      type: "task.codeexec";
      taskId: string;
      status: "running" | "completed" | "error";
      taskData: {
        scriptPath?: string;
        code?: string;
        stdout?: string;
        resultsFile?: string;
        resultsTable?: Record<string, string>[];
      };
      ts: number;
    }
  | {
      type: "compression.started";
      runId: string;
      ts: number;
    }
  | {
      type: "run.completed";
      runId?: string;
      status: "completed";
      ts: number;
    }
  | {
      type: "run.failed";
      runId?: string;
      status: "failed";
      ts: number;
    }
  | {
      type: "run.cancelled";
      runId?: string;
      status: "cancelled";
      ts: number;
    };
