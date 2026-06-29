// R2.6 — Append-only audit log repository.
// The table (aio_audit_log) is write-once: no UPDATE or DELETE ever issued here.
// All writes are best-effort: failures are logged, never thrown, so an audit
// hiccup cannot mask the primary operation's outcome.
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditCategory = "approval" | "tool_execution" | "credential" | "admin" | "mcp";
export type AuditOutcome = "unknown" | "success" | "denied" | "expired" | "error" | "conflict";

export interface AuditEntry {
  userId: string;
  eventType: string;
  category: AuditCategory;
  runId?: string | null;
  toolCallId?: string | null;
  approvalId?: string | null;
  context?: Record<string, unknown>;
  outcome?: AuditOutcome;
  occurredAt?: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string;
  event_type: string;
  category: AuditCategory;
  run_id: string | null;
  tool_call_id: string | null;
  approval_id: string | null;
  context: Record<string, unknown>;
  outcome: AuditOutcome;
  occurred_at: string;
}

export type AuditLogResult =
  | { ok: true; data: AuditLogRow }
  | { ok: false; code: string; message: string };

export async function appendAuditEntry(
  db: SupabaseClient,
  entry: AuditEntry,
): Promise<AuditLogResult> {
  const { data, error } = await db
    .from("aio_audit_log")
    .insert({
      user_id: entry.userId,
      event_type: entry.eventType,
      category: entry.category,
      run_id: entry.runId ?? null,
      tool_call_id: entry.toolCallId ?? null,
      approval_id: entry.approvalId ?? null,
      context: entry.context ?? {},
      outcome: entry.outcome ?? "unknown",
      occurred_at: entry.occurredAt ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    return { ok: false, code: "AUDIT_WRITE_FAILED", message: error?.message ?? "No data returned" };
  }
  return { ok: true, data: data as AuditLogRow };
}

/** Best-effort wrapper — logs failures, never throws. */
export async function recordAuditEntry(
  db: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  const result = await appendAuditEntry(db, entry).catch((err) => ({
    ok: false as const,
    code: "AUDIT_EXCEPTION",
    message: String(err),
  }));
  if (!result.ok) {
    console.error(
      `[audit] failed to write ${entry.category}/${entry.eventType} for user ${entry.userId}:`,
      result.message,
    );
  }
}
