export type AioRunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "cancelling"
  | "completed"
  | "failed"
  | "cancelled";

export type AioRiskLevel = "safe" | "medium" | "dangerous";

export interface AioArtifactRef {
  filePath?: string;
  fileName?: string;
  artifactId?: string;
  name?: string;
  mimeType?: string;
  url?: string;
  preview?: string;
}

export type RunCreatedEvent = {
  type: "run.created";
  runId: string;
  threadId?: string;
  status: AioRunStatus;
  createdAt: string;
  ts?: number;
};

export type MessageDeltaEvent = {
  type: "message.delta";
  runId: string;
  delta: string;
  createdAt: string;
  ts?: number;
};

export type MessageCompletedEvent = {
  type: "message.completed";
  runId: string;
  text?: string;
  createdAt: string;
  ts?: number;
};

export type ReasoningAvailableEvent = {
  type: "reasoning.available";
  runId: string;
  text: string;
  createdAt: string;
  ts?: number;
};

export type ToolStartedEvent = {
  type: "tool.started";
  runId: string;
  toolCallId: string;
  toolName: string;
  input?: unknown;
  preview?: string;
  riskLevel?: AioRiskLevel;
  createdAt: string;
  ts?: number;
  tool?: string;
  label?: string;
};

export type ToolCompletedEvent = {
  type: "tool.completed";
  runId: string;
  toolCallId: string;
  toolName: string;
  output?: unknown;
  resultPreview?: string;
  error?: boolean;
  createdAt: string;
  ts?: number;
  tool?: string;
  durationS?: number;
  artifact?: AioArtifactRef;
};

export type ToolFailedEvent = {
  type: "tool.failed";
  runId: string;
  toolCallId: string;
  toolName: string;
  error: string;
  createdAt: string;
  ts?: number;
  tool?: string;
  errorText?: string;
};

export type ApprovalRequestedEvent = {
  type: "approval.requested";
  runId: string;
  approvalId: string;
  toolCallId?: string;
  title?: string;
  description?: string;
  command?: string;
  payload?: unknown;
  actions?: Array<"approve" | "reject" | "edit">;
  createdAt: string;
  ts?: number;
  requestId?: string;
  patternKey?: string;
  allowPermanent?: boolean;
  choices?: string[];
  riskLevel?: AioRiskLevel;
};

export type ApprovalRespondedEvent = {
  type: "approval.responded";
  runId: string;
  approvalId: string;
  status: "approved" | "rejected" | "edited";
  createdAt: string;
  ts?: number;
  requestId?: string;
  choice?: string;
};

export type ArtifactCreatedEvent = {
  type: "artifact.created";
  runId: string;
  artifactId: string;
  name?: string;
  mimeType?: string;
  url?: string;
  preview?: string;
  createdAt: string;
  ts?: number;
  artifact?: AioArtifactRef;
};

export type TaskCodeExecEvent = {
  type: "task.codeexec";
  runId: string;
  taskId: string;
  status: "running" | "completed" | "error";
  taskData: {
    scriptPath?: string;
    code?: string;
    stdout?: string;
    resultsFile?: string;
    resultsTable?: Record<string, string>[];
  };
  createdAt: string;
  ts?: number;
};

export type CompressionStartedEvent = {
  type: "compression.started";
  runId: string;
  createdAt: string;
  ts?: number;
};

export type RunCompletedEvent = {
  type: "run.completed";
  runId: string;
  status: "completed";
  createdAt: string;
  ts?: number;
};

export type RunFailedEvent = {
  type: "run.failed";
  runId: string;
  status: "failed";
  error?: string;
  createdAt: string;
  ts?: number;
};

export type RunCancelledEvent = {
  type: "run.cancelled";
  runId: string;
  status: "cancelled";
  createdAt: string;
  ts?: number;
};

/**
 * Adapter diagnostic for an event the runtime emitted that Aio does not
 * recognize, or a payload that could not be mapped. Per ADR-001 these are
 * preserved as diagnostics, never dropped silently. Mostly ops/debug; the
 * timeline keeps internal IDs and debug data hidden from users.
 */
export type AdapterDiagnosticEvent = {
  type: "adapter.diagnostic";
  runId: string;
  source: "hermes" | "worker";
  reason: "unknown_event" | "malformed_event" | "redacted_payload";
  rawEventType?: string;
  rawEventPreview?: string;
  createdAt: string;
  ts?: number;
};

export type AioRunEvent =
  | RunCreatedEvent
  | MessageDeltaEvent
  | MessageCompletedEvent
  | ReasoningAvailableEvent
  | ToolStartedEvent
  | ToolCompletedEvent
  | ToolFailedEvent
  | ApprovalRequestedEvent
  | ApprovalRespondedEvent
  | ArtifactCreatedEvent
  | TaskCodeExecEvent
  | CompressionStartedEvent
  | RunCompletedEvent
  | RunFailedEvent
  | RunCancelledEvent
  | AdapterDiagnosticEvent;

/** Discriminator for an AioRunEvent. Re-exported by the envelope module. */
export type AioRunEventType = AioRunEvent["type"];
