export const AIO_JOB_SCHEMA_VERSION = 1 as const;

export type AioJobType =
  | "knowledge_ingest"
  | "research_stage"
  | "scheduled_task"
  | "image_generation_poll"
  | "retention_cleanup";

export type AioJobStatus =
  | "queued"
  | "claimed"
  | "running"
  | "retrying"
  | "completed"
  | "cancelled"
  | "dead_lettered"
  | "failed";

export interface AioJobPayloadRef {
  kind: "inline" | "storage";
  redacted: boolean;
  pointer?: string | null;
  preview?: Record<string, unknown> | null;
}

export interface AioJobCorrelationContext {
  tenantId: string;
  userId?: string | null;
  runId?: string | null;
  conversationId?: string | null;
  threadId?: string | null;
}

export interface AioJobEnvelopeV1 {
  id: string;
  schemaVersion: typeof AIO_JOB_SCHEMA_VERSION;
  type: AioJobType;
  status: AioJobStatus;
  tenantId: string;
  runId: string | null;
  idempotencyKey: string;
  attempt: number;
  maxAttempts: number;
  scheduledFor: string;
  deadlineAt: string | null;
  createdAt: string;
  payloadRef: AioJobPayloadRef | null;
  correlation: AioJobCorrelationContext;
}

export type AioJobEnvelope = AioJobEnvelopeV1;

export interface CreateAioJobEnvelopeInput {
  type: AioJobType;
  tenantId: string;
  runId?: string | null;
  idempotencyKey?: string;
  attempt?: number;
  maxAttempts?: number;
  scheduledFor?: string | number | Date;
  deadlineAt?: string | number | Date | null;
  createdAt?: string | number | Date;
  payloadRef?: AioJobPayloadRef | null;
  correlation?: Partial<AioJobCorrelationContext>;
  id?: string;
}

function normalizeTimestamp(value: string | number | Date): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    const millis = value < 1_000_000_000_000 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  throw new Error(`Invalid timestamp: ${String(value)}`);
}

export function createAioJobEnvelope(
  input: CreateAioJobEnvelopeInput,
): AioJobEnvelopeV1 {
  const createdAt = normalizeTimestamp(input.createdAt ?? new Date());
  const scheduledFor = normalizeTimestamp(input.scheduledFor ?? createdAt);
  const deadlineAt =
    input.deadlineAt == null ? null : normalizeTimestamp(input.deadlineAt);

  return {
    id: input.id ?? crypto.randomUUID(),
    schemaVersion: AIO_JOB_SCHEMA_VERSION,
    type: input.type,
    status: "queued",
    tenantId: input.tenantId,
    runId: input.runId ?? null,
    idempotencyKey:
      input.idempotencyKey ??
      `${input.type}:${input.tenantId}:${input.runId ?? "no-run"}:${scheduledFor}`,
    attempt: input.attempt ?? 0,
    maxAttempts: input.maxAttempts ?? 3,
    scheduledFor,
    deadlineAt,
    createdAt,
    payloadRef: input.payloadRef ?? null,
    correlation: {
      tenantId: input.tenantId,
      userId: input.correlation?.userId ?? null,
      runId: input.correlation?.runId ?? input.runId ?? null,
      conversationId: input.correlation?.conversationId ?? null,
      threadId: input.correlation?.threadId ?? null,
    },
  };
}
