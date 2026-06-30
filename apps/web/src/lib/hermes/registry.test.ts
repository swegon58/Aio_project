import assert from "node:assert/strict";
import test from "node:test";

import { markActivatedIfNeeded } from "./registry";

function makeDb(rows: { activated_at: string | null }[]) {
  return {
    from(table: string) {
      assert.equal(table, "hermes_registry");
      return {
        update(_patch: { activated_at: string }) {
          return {
            eq(_col: string, _customerId: string) {
              return {
                is(_col2: string, _value: null) {
                  return {
                    select(_cols: string) {
                      // Mirrors the `activated_at is null` guard: only
                      // "unactivated" rows are returned/updated.
                      const matched = rows.filter((r) => r.activated_at === null);
                      matched.forEach((r) => (r.activated_at = "2026-06-30T00:00:00.000Z"));
                      return Promise.resolve({
                        data: matched.map(() => ({ customer_id: "customer-1" })),
                        error: null,
                      });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

test("markActivatedIfNeeded flips activated_at and returns true on first call", async () => {
  const rows = [{ activated_at: null as string | null }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = makeDb(rows) as any;

  const flipped = await markActivatedIfNeeded(db, "customer-1");
  assert.equal(flipped, true);
  assert.notEqual(rows[0].activated_at, null);
});

test("markActivatedIfNeeded is idempotent: second call returns false", async () => {
  const rows = [{ activated_at: null as string | null }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = makeDb(rows) as any;

  await markActivatedIfNeeded(db, "customer-1");
  const secondCall = await markActivatedIfNeeded(db, "customer-1");
  assert.equal(secondCall, false);
});
