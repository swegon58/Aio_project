// R6.8 — Unit tests for beta spend-cap helpers.
// Runner: tsx --test

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { checkSpendCap, checkToolSubLimit, configuredSpendCapCredits } from "./spend-cap.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FakeDb = any;

const ENV_KEY = "AIO_BETA_SPEND_CAP_CREDITS";
const original = process.env[ENV_KEY];

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
});

describe("configuredSpendCapCredits", () => {
  it("returns null when unset", () => {
    delete process.env[ENV_KEY];
    assert.equal(configuredSpendCapCredits(), null);
  });

  it("returns null for non-numeric values", () => {
    process.env[ENV_KEY] = "not-a-number";
    assert.equal(configuredSpendCapCredits(), null);
  });

  it("returns null for zero or negative values", () => {
    process.env[ENV_KEY] = "0";
    assert.equal(configuredSpendCapCredits(), null);
    process.env[ENV_KEY] = "-5";
    assert.equal(configuredSpendCapCredits(), null);
  });

  it("returns the parsed number for a positive value", () => {
    process.env[ENV_KEY] = "1000";
    assert.equal(configuredSpendCapCredits(), 1000);
  });
});

describe("checkSpendCap", () => {
  it("returns ok=true without querying the db when no cap is configured", async () => {
    delete process.env[ENV_KEY];
    let rpcCalled = false;
    const db: FakeDb = { rpc: async () => { rpcCalled = true; return { data: 0, error: null }; } };
    const result = await checkSpendCap(db, "cust-1");
    assert.deepEqual(result, { ok: true, capCredits: null, spentCredits: 0 });
    assert.equal(rpcCalled, false);
  });

  it("sums spend via a single server-side RPC call, not a row pull", async () => {
    process.env[ENV_KEY] = "1000";
    let calledWith: { name: string; args: unknown } | null = null;
    const db: FakeDb = {
      rpc: async (name: string, args: unknown) => {
        calledWith = { name, args };
        return { data: 500, error: null };
      },
    };
    const result = await checkSpendCap(db, "cust-1");
    assert.deepEqual(calledWith, { name: "hermes_sum_completed_credits", args: { p_customer_id: "cust-1" } });
    assert.equal(result.spentCredits, 500);
    assert.equal(result.ok, true);
  });

  it("returns ok=false once spend reaches the cap", async () => {
    process.env[ENV_KEY] = "1000";
    const db: FakeDb = { rpc: async () => ({ data: 1000, error: null }) };
    const result = await checkSpendCap(db, "cust-1");
    assert.equal(result.ok, false);
  });

  it("throws when the RPC errors", async () => {
    process.env[ENV_KEY] = "1000";
    const db: FakeDb = { rpc: async () => ({ data: null, error: { message: "db down" } }) };
    await assert.rejects(() => checkSpendCap(db, "cust-1"), /Spend cap lookup failed: db down/);
  });
});

describe("checkToolSubLimit", () => {
  function makeDb(opts: { subLimitRow?: { limit_usd: number } | null; toolSpendCredits?: number }): FakeDb {
    return {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: async () => ({ data: opts.subLimitRow ?? null, error: null }),
        };
      },
      rpc: async () => ({ data: opts.toolSpendCredits ?? 0, error: null }),
    };
  }

  it("skips the db entirely for non-gated tools", async () => {
    const db: FakeDb = {
      from() { throw new Error("should not query for a non-gated tool"); },
      rpc() { throw new Error("should not call rpc for a non-gated tool"); },
    };
    const result = await checkToolSubLimit(db, "cust-1", "web_search");
    assert.deepEqual(result, { ok: true, limitUsd: null, spentUsd: 0, toolId: "web_search" });
  });

  it("uses the default limit and sums tool spend via RPC", async () => {
    const db = makeDb({ subLimitRow: null, toolSpendCredits: 500 }); // 500 credits = $5
    const result = await checkToolSubLimit(db, "cust-1", "code_execution");
    assert.equal(result.limitUsd, 10);
    assert.equal(result.spentUsd, 5);
    assert.equal(result.ok, true);
  });

  it("returns ok=false once tool spend reaches the limit", async () => {
    const db = makeDb({ subLimitRow: { limit_usd: 10 }, toolSpendCredits: 1000 }); // $10 spent
    const result = await checkToolSubLimit(db, "cust-1", "code_execution");
    assert.equal(result.ok, false);
  });
});
