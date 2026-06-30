// R6.7 — Unit tests for weekly analytics aggregation helpers.
// Runner: tsx --test

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  activationCount,
  computeApprovalRates,
  computeCostPerSuccess,
  computeLatencies,
  computeRetention,
  computeRunsPerActiveUser,
  computeSuccessByMode,
  computeTopFailureCategories,
  type RunMetricRow,
} from "./weekly-metrics.js";

const baseRun: RunMetricRow = {
  id: "r1",
  customer_id: "u1",
  status: "completed",
  mode: "auto",
  created_at: "2026-06-24T00:00:00.000Z",
  started_at: "2026-06-24T00:00:00.000Z",
  completed_at: "2026-06-24T00:00:01.000Z",
  actual_credits: 10,
  error_code: null,
};

describe("activationCount", () => {
  it("counts activation rows", () => {
    assert.equal(activationCount([{ customer_id: "a", activated_at: "x" }, { customer_id: "b", activated_at: "y" }]), 2);
  });

  it("returns 0 for empty input", () => {
    assert.equal(activationCount([]), 0);
  });
});

describe("computeRetention", () => {
  it("returns nulls for an empty cohort", () => {
    const result = computeRetention([], new Map());
    assert.deepEqual(result, { cohortSize: 0, d1RetainedPct: null, w1RetainedPct: null });
  });

  it("counts a user retained at D1 but not W1", () => {
    const activations = [{ customer_id: "u1", activated_at: "2026-06-20T00:00:00.000Z" }];
    const runsByCustomer = new Map([["u1", ["2026-06-22T00:00:00.000Z"]]]);
    const result = computeRetention(activations, runsByCustomer);
    assert.equal(result.cohortSize, 1);
    assert.equal(result.d1RetainedPct, 100);
    assert.equal(result.w1RetainedPct, 0);
  });

  it("counts a user retained at both D1 and W1", () => {
    const activations = [{ customer_id: "u1", activated_at: "2026-06-10T00:00:00.000Z" }];
    const runsByCustomer = new Map([["u1", ["2026-06-20T00:00:00.000Z"]]]);
    const result = computeRetention(activations, runsByCustomer);
    assert.equal(result.d1RetainedPct, 100);
    assert.equal(result.w1RetainedPct, 100);
  });

  it("does not retain a user with no later runs", () => {
    const activations = [{ customer_id: "u1", activated_at: "2026-06-20T00:00:00.000Z" }];
    const result = computeRetention(activations, new Map());
    assert.equal(result.d1RetainedPct, 0);
    assert.equal(result.w1RetainedPct, 0);
  });
});

describe("computeSuccessByMode", () => {
  it("buckets runs by mode and computes success rate", () => {
    const runs: RunMetricRow[] = [
      baseRun,
      { ...baseRun, id: "r2", status: "failed" },
      { ...baseRun, id: "r3", mode: "research" },
    ];
    const result = computeSuccessByMode(runs);
    const auto = result.find((m) => m.mode === "auto")!;
    const research = result.find((m) => m.mode === "research")!;
    assert.equal(auto.total, 2);
    assert.equal(auto.succeeded, 1);
    assert.equal(auto.successRatePct, 50);
    assert.equal(research.total, 1);
    assert.equal(research.successRatePct, 100);
  });

  it("returns an empty array for no runs", () => {
    assert.deepEqual(computeSuccessByMode([]), []);
  });
});

describe("computeRunsPerActiveUser", () => {
  it("computes distinct active users and succeeded runs", () => {
    const runs: RunMetricRow[] = [
      baseRun,
      { ...baseRun, id: "r2" },
      { ...baseRun, id: "r3", customer_id: "u2", status: "failed" },
    ];
    const result = computeRunsPerActiveUser(runs);
    assert.equal(result.activeUsers, 2);
    assert.equal(result.succeededRuns, 2);
    assert.equal(result.succeededPerActiveUser, 1);
  });

  it("returns null ratio when there are no runs", () => {
    const result = computeRunsPerActiveUser([]);
    assert.equal(result.activeUsers, 0);
    assert.equal(result.succeededPerActiveUser, null);
  });
});

describe("computeLatencies", () => {
  it("computes completion p95 from started/completed timestamps", () => {
    const runs: RunMetricRow[] = [baseRun];
    const result = computeLatencies(runs, []);
    assert.equal(result.completionP95Ms, 1000);
  });

  it("computes first-response latency from the earliest message event", () => {
    const runs: RunMetricRow[] = [baseRun];
    const events = [
      { run_id: "r1", type: "message.completed", occurred_at: "2026-06-24T00:00:00.800Z", sequence: 2 },
      { run_id: "r1", type: "message.delta", occurred_at: "2026-06-24T00:00:00.300Z", sequence: 1 },
    ];
    const result = computeLatencies(runs, events);
    assert.equal(result.firstResponseP95Ms, 300);
  });

  it("returns nulls when there is no data", () => {
    const result = computeLatencies([], []);
    assert.deepEqual(result, { completionP95Ms: null, firstResponseP95Ms: null });
  });
});

describe("computeApprovalRates", () => {
  it("computes percentages across approval statuses", () => {
    const result = computeApprovalRates([
      { status: "approved" },
      { status: "approved" },
      { status: "rejected" },
      { status: "expired" },
    ]);
    assert.equal(result.total, 4);
    assert.equal(result.approvedPct, 50);
    assert.equal(result.rejectedPct, 25);
    assert.equal(result.expiredPct, 25);
  });

  it("returns nulls for an empty list", () => {
    const result = computeApprovalRates([]);
    assert.deepEqual(result, { total: 0, approvedPct: null, rejectedPct: null, expiredPct: null });
  });
});

describe("computeCostPerSuccess", () => {
  it("averages actual_credits across completed runs only", () => {
    const runs: RunMetricRow[] = [
      baseRun,
      { ...baseRun, id: "r2", actual_credits: 30 },
      { ...baseRun, id: "r3", status: "failed", actual_credits: 999 },
    ];
    assert.equal(computeCostPerSuccess(runs), 20);
  });

  it("returns null when there are no completed runs", () => {
    assert.equal(computeCostPerSuccess([{ ...baseRun, status: "failed" }]), null);
  });
});

describe("computeTopFailureCategories", () => {
  it("groups failed runs by error_code, sorted descending", () => {
    const runs: RunMetricRow[] = [
      { ...baseRun, id: "r1", status: "failed", error_code: "timeout" },
      { ...baseRun, id: "r2", status: "failed", error_code: "timeout" },
      { ...baseRun, id: "r3", status: "failed", error_code: "provider_error" },
      { ...baseRun, id: "r4", status: "completed" },
    ];
    const result = computeTopFailureCategories(runs);
    assert.deepEqual(result[0], { errorCode: "timeout", count: 2 });
    assert.deepEqual(result[1], { errorCode: "provider_error", count: 1 });
  });

  it("falls back to 'unknown' for a missing error_code", () => {
    const result = computeTopFailureCategories([{ ...baseRun, status: "failed", error_code: null }]);
    assert.deepEqual(result, [{ errorCode: "unknown", count: 1 }]);
  });

  it("respects topN", () => {
    const runs: RunMetricRow[] = ["a", "b", "c"].map((code, i) => ({
      ...baseRun,
      id: `r${i}`,
      status: "failed",
      error_code: code,
    }));
    assert.equal(computeTopFailureCategories(runs, 2).length, 2);
  });
});
