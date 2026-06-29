import type { AioRunEvent, AioRunStatus } from "./aio-run-events";

export interface AioPublicRun {
  id: string;
  customerId: string;
  conversationId: string | null;
  threadId: string;
  status: AioRunStatus;
  mode: string;
  inputSummary: string | null;
  hermesRunId: string | null;
  hermesSessionId: string | null;
  reservedCredits: number | null;
  actualCredits: number | null;
  errorCode: string | null;
  errorMessageRedacted: string | null;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  cancelRequestedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface AioPublicRunEventEnvelope {
  id: string;
  schemaVersion: number;
  runId: string;
  customerId: string;
  sequence: number;
  type: string;
  occurredAt: string;
  receivedAt: string;
  source: "aio" | "hermes" | "worker";
  payload: AioRunEvent;
  hermes: { runId?: string; eventId?: string } | null;
}

export async function fetchConversationRuns(conversationId: string, limit = 1): Promise<AioPublicRun[]> {
  const url = new URL("/api/runs", window.location.origin);
  url.searchParams.set("conversationId", conversationId);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load runs (${res.status})`);
  }
  const data = (await res.json()) as { runs: AioPublicRun[] };
  return data.runs;
}

export async function fetchRun(runId: string): Promise<AioPublicRun> {
  const res = await fetch(`/api/runs/${encodeURIComponent(runId)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load run ${runId} (${res.status})`);
  }
  const data = (await res.json()) as { run: AioPublicRun };
  return data.run;
}

export async function fetchRunEvents(
  runId: string,
  options?: { afterSequence?: number; limit?: number },
): Promise<AioPublicRunEventEnvelope[]> {
  const url = new URL(`/api/runs/${encodeURIComponent(runId)}/events`, window.location.origin);
  if (typeof options?.afterSequence === "number") {
    url.searchParams.set("afterSequence", String(options.afterSequence));
  }
  if (typeof options?.limit === "number") {
    url.searchParams.set("limit", String(options.limit));
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load run events (${res.status})`);
  }
  const data = (await res.json()) as { events: AioPublicRunEventEnvelope[] };
  return data.events;
}

export async function requestRunStop(runId: string): Promise<{
  ok: boolean;
  noop?: boolean;
  run: AioPublicRun;
  hermesForwarded?: boolean;
  hermesStatus?: string;
  message?: string;
}> {
  const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/stop`, {
    method: "POST",
  });
  const data = (await res.json()) as {
    ok?: boolean;
    noop?: boolean;
    run?: AioPublicRun;
    hermesForwarded?: boolean;
    hermesStatus?: string;
    message?: string;
  };
  if (!res.ok || !data.run) {
    throw new Error(data.message ?? `Failed to stop run (${res.status})`);
  }
  return {
    ok: Boolean(data.ok),
    noop: data.noop,
    run: data.run,
    hermesForwarded: data.hermesForwarded,
    hermesStatus: data.hermesStatus,
    message: data.message,
  };
}

export function isRunTerminal(status: AioRunStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function isRunStoppable(status: AioRunStatus): boolean {
  return status === "queued" || status === "running" || status === "waiting_approval";
}
