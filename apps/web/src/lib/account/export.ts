import type { SupabaseClient } from "@supabase/supabase-js";

// R6.5 account-data export. Reads every user-owned table so the customer can
// download everything Aio holds about them. Raw embedding vectors are derived
// data (large, not user-authored) and are stripped from the chunk tables; the
// chunk text + metadata remain.
//
// Tables are keyed by either `customer_id` (the Hermes/aio convention) or
// `user_id` (the R2/R4 tables). Per-table failures are tolerated and recorded
// in `_errors` so one missing/broken table does not fail the whole export.

export type AccountRow = Record<string, unknown>;
export interface AccountExport {
  [table: string]: AccountRow[];
  _errors: Array<{ table: string; error: string }>;
}

interface TableSpec {
  table: string;
  fk: string;
  stripEmbedding?: boolean;
}

const TABLES: TableSpec[] = [
  { table: "hermes_registry", fk: "customer_id" },
  { table: "hermes_threads", fk: "customer_id" },
  { table: "hermes_credential_refs", fk: "customer_id" },
  { table: "hermes_gallery_images", fk: "customer_id" },
  { table: "hermes_conversations", fk: "customer_id" },
  { table: "aio_runs", fk: "customer_id" },
  { table: "aio_run_events", fk: "customer_id" },
  { table: "aio_tool_calls", fk: "customer_id" },
  { table: "aio_approvals", fk: "customer_id" },
  { table: "aio_jobs", fk: "customer_id" },
  { table: "aio_schedules", fk: "customer_id" },
  { table: "aio_schedule_runs", fk: "customer_id" },
  { table: "aio_knowledge_docs", fk: "user_id" },
  { table: "aio_knowledge_chunks", fk: "user_id", stripEmbedding: true },
  { table: "aio_research_sources", fk: "user_id" },
  { table: "aio_research_claims", fk: "user_id" },
  { table: "aio_audit_log", fk: "user_id" },
];

interface QueryResult {
  data: AccountRow[] | null;
  error: { message?: string } | null;
}

export async function gatherAccountData(
  db: SupabaseClient,
  userId: string,
): Promise<AccountExport> {
  const out: AccountExport = { _errors: [] };

  for (const spec of TABLES) {
    const result = (await db
      .from(spec.table)
      .select("*")
      .eq(spec.fk, userId)) as unknown as QueryResult;

    if (result.error) {
      out._errors.push({ table: spec.table, error: result.error.message ?? "unknown" });
      out[spec.table] = [];
      continue;
    }

    let rows = (result.data ?? []) as AccountRow[];
    if (spec.stripEmbedding) {
      rows = rows.map((row) => {
        if (!("embedding" in row)) return row;
        const stripped = { ...row };
        delete stripped.embedding;
        return stripped;
      });
    }
    out[spec.table] = rows;
  }

  return out;
}
