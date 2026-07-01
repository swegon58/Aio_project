import assert from "node:assert/strict";
import test from "node:test";

import { gatherAccountData } from "./export";

// Minimal fake of the chained Supabase query builder for `.from(t).select().eq()`.
// `tables` maps table -> { rows, error? }. Captures the fk column used.
function makeDb(tables: Record<string, { rows: Record<string, unknown>[]; error?: { message: string } }>) {
  const calls: Array<{ table: string; fk: string; value: string }> = [];
  const db = {
    from(table: string) {
      return {
        select() {
          return {
            eq(fk: string, value: string) {
              calls.push({ table, fk, value });
              const spec = tables[table];
              if (!spec) return Promise.resolve({ data: [], error: null });
              if (spec.error) return Promise.resolve({ data: null, error: spec.error });
              return Promise.resolve({ data: spec.rows, error: null });
            },
          };
        },
      };
    },
    _calls: calls,
  };
  return db;
}

test("gatherAccountData returns each table keyed by name and scopes by userId", async () => {
  const tables = {
    aio_runs: { rows: [{ id: "r1", status: "succeeded" }] },
    hermes_conversations: { rows: [{ id: "c1" }] },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = makeDb(tables) as any;

  const out = await gatherAccountData(db, "user-1");

  assert.ok(Array.isArray(out.aio_runs));
  assert.equal(out.aio_runs.length, 1);
  assert.equal(out.aio_runs[0].id, "r1");
  assert.equal(out._errors.length, 0);
  // every call scoped to the user
  assert.ok(db._calls.every((c: { value: string }) => c.value === "user-1"));
  // customer_id and user_id tables are both covered
  assert.ok(db._calls.some((c: { fk: string }) => c.fk === "customer_id"));
  assert.ok(db._calls.some((c: { fk: string }) => c.fk === "user_id"));
});

test("gatherAccountData tolerates a failing table and still resolves", async () => {
  const tables = {
    aio_runs: { rows: [{ id: "r1" }] },
    aio_audit_log: { rows: [], error: { message: "boom" } },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = makeDb(tables) as any;

  const out = await gatherAccountData(db, "user-1");

  assert.equal(out.aio_runs.length, 1);
  assert.equal(out.aio_audit_log.length, 0);
  assert.equal(out._errors.length, 1);
  assert.equal(out._errors[0].table, "aio_audit_log");
  assert.equal(out._errors[0].error, "boom");
});

test("gatherAccountData strips raw embedding vectors from chunk tables", async () => {
  const tables = {
    aio_knowledge_chunks: { rows: [{ id: "k2", content: "world", embedding: "[0.3]" }] },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = makeDb(tables) as any;

  const out = await gatherAccountData(db, "user-1");

  assert.deepEqual(out.aio_knowledge_chunks[0], { id: "k2", content: "world" });
  assert.equal("embedding" in out.aio_knowledge_chunks[0], false);
});
