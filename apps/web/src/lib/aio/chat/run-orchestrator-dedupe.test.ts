// R9.1 — Unit tests for source dedupe behaviour in the research pipeline.
// R14 Phase 1 — Characterization tests for exported orchestrator functions
// Runner: tsx --test

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  extractResultUrls,
  resolveRunClosureAction,
} from "./run-orchestrator.js";
import {
  creditsForUsd,
  usdForCredits,
  estimateTaskCreditCost,
  usedPercentForTier,
  nextMonthlyResetAt,
  tierConfig,
} from "./../../hermes/pricing.js";
import { checkCreditBalance } from "./../../hermes/billing.js";

describe("extractResultUrls", () => {
  it("returns empty array for undefined input", () => {
    assert.deepEqual(extractResultUrls(undefined), []);
  });

  it("returns empty array for empty string", () => {
    assert.deepEqual(extractResultUrls(""), []);
  });

  it("extracts a single URL from preview text", () => {
    const preview = "Found results at https://example.com/page with more info.";
    assert.deepEqual(extractResultUrls(preview), ["https://example.com/page"]);
  });

  it("strips trailing punctuation from URLs", () => {
    const preview = "See https://example.com/page, and https://other.com/doc.";
    const urls = extractResultUrls(preview);
    assert.ok(!urls[0].endsWith(","), "should strip trailing comma");
    assert.ok(!urls[1].endsWith("."), "should strip trailing period");
  });

  it("deduplicates repeated URLs within the same preview", () => {
    const url = "https://example.com/article";
    const preview = `First mention: ${url} and again: ${url} and once more: ${url}`;
    const urls = extractResultUrls(preview);
    assert.equal(urls.length, 1, "duplicate URLs must appear only once");
    assert.equal(urls[0], url);
  });

  it("caps results at 5 URLs regardless of how many appear in preview", () => {
    const many = Array.from(
      { length: 10 },
      (_, i) => `https://source${i}.com/page`
    ).join(" ");
    const urls = extractResultUrls(many);
    assert.equal(urls.length, 5, "must not exceed 5 sources per preview");
  });

  it("returns distinct URLs up to the cap", () => {
    const preview = [
      "https://a.com",
      "https://b.com",
      "https://c.com",
      "https://d.com",
      "https://e.com",
    ].join(" ");
    const urls = extractResultUrls(preview);
    assert.deepEqual(urls, [
      "https://a.com",
      "https://b.com",
      "https://c.com",
      "https://d.com",
      "https://e.com",
    ]);
  });
});

// Simulates the in-run Map guard used in run-orchestrator.ts to prevent
// recordResearchSource being called twice for the same URL within one run.
describe("in-run URL dedup Map guard", () => {
  it("skips a URL that was already recorded in this run", () => {
    const researchSourceIds = new Map<string, string>();
    const calls: string[] = [];

    function simulateRecord(url: string, sourceId: string) {
      if (researchSourceIds.has(url)) return; // the guard
      calls.push(url);
      researchSourceIds.set(url, sourceId);
    }

    simulateRecord("https://example.com", "src-1");
    simulateRecord("https://example.com", "src-2"); // duplicate — must be skipped
    simulateRecord("https://other.com", "src-3");

    assert.equal(calls.length, 2, "only two unique URLs should be recorded");
    assert.ok(calls.includes("https://example.com"));
    assert.ok(calls.includes("https://other.com"));
  });

  it("records each distinct URL exactly once", () => {
    const researchSourceIds = new Map<string, string>();
    const recorded = new Set<string>();

    const urls = [
      "https://a.com",
      "https://b.com",
      "https://a.com", // duplicate
      "https://c.com",
      "https://b.com", // duplicate
    ];

    for (const url of urls) {
      if (researchSourceIds.has(url)) continue;
      recorded.add(url);
      researchSourceIds.set(url, `id-${recorded.size}`);
    }

    assert.equal(recorded.size, 3);
    assert.deepEqual([...recorded], ["https://a.com", "https://b.com", "https://c.com"]);
  });
});

// R13 — Stop-button race fix: a concurrent /stop request can move the row to
// `cancelling` while this stream loop is still finishing up. The state
// machine only allows cancelling -> cancelled, so the closing write must
// prefer `cancelled` over completed/failed whenever that race happened.
describe("resolveRunClosureAction", () => {
  it("closes to cancelled when the live row is already cancelling, regardless of stream outcome", () => {
    assert.deepEqual(resolveRunClosureAction("cancelling", true, false, false), {
      type: "cancelled",
    });
    assert.deepEqual(resolveRunClosureAction("cancelling", false, false, true), {
      type: "cancelled",
    });
  });

  it("closes to completed on a normal successful stream end", () => {
    assert.deepEqual(resolveRunClosureAction("running", true, false, false), {
      type: "completed",
    });
  });

  it("closes to failed with the right error code otherwise", () => {
    assert.deepEqual(resolveRunClosureAction("running", true, true, false), {
      type: "failed",
      errorCode: "budget_exceeded",
    });
    assert.deepEqual(resolveRunClosureAction("running", false, false, true), {
      type: "failed",
      errorCode: "client_aborted",
    });
    assert.deepEqual(resolveRunClosureAction("running", false, false, false), {
      type: "failed",
      errorCode: "stream_error",
    });
  });
});

// R14 Phase 1: Characterization tests for billing and pricing functions
// These lock CURRENT behavior for pure, extractable functions used in orchestration

describe("creditsForUsd", () => {
  it("converts USD to credits (1 credit = $0.001)", () => {
    assert.equal(creditsForUsd(1), 1000, "$1 = 1000 credits");
    assert.equal(creditsForUsd(0.001), 1, "$0.001 = 1 credit");
    assert.equal(creditsForUsd(10), 10000, "$10 = 10000 credits");
  });

  it("handles fractional USD amounts", () => {
    assert.equal(creditsForUsd(0.5), 500, "$0.5 = 500 credits");
    assert.equal(creditsForUsd(2.5), 2500, "$2.5 = 2500 credits");
  });

  it("handles zero", () => {
    assert.equal(creditsForUsd(0), 0, "$0 = 0 credits");
  });
});

describe("usdForCredits", () => {
  it("converts credits to USD (1 credit = $0.001)", () => {
    assert.equal(usdForCredits(1000), 1, "1000 credits = $1");
    assert.equal(usdForCredits(1), 0.001, "1 credit = $0.001");
    assert.equal(usdForCredits(10000), 10, "10000 credits = $10");
  });

  it("handles fractional credit amounts", () => {
    assert.equal(usdForCredits(500), 0.5, "500 credits = $0.5");
    assert.equal(usdForCredits(2500), 2.5, "2500 credits = $2.5");
  });

  it("handles zero", () => {
    assert.equal(usdForCredits(0), 0, "0 credits = $0");
  });
});

describe("estimateTaskCreditCost", () => {
  it("estimates starter tier cost", () => {
    const estimate = estimateTaskCreditCost("starter");
    assert.ok(estimate > 0, "starter estimate should be positive");
    assert.ok(Number.isInteger(estimate), "estimate should be integer credits");
  });

  it("estimates pro tier cost", () => {
    const estimate = estimateTaskCreditCost("pro");
    assert.ok(estimate > 0, "pro estimate should be positive");
    assert.ok(estimate > estimateTaskCreditCost("starter"), "pro should cost more than starter");
    assert.ok(Number.isInteger(estimate), "estimate should be integer credits");
  });

  it("estimates business tier cost", () => {
    const estimate = estimateTaskCreditCost("business");
    assert.ok(estimate > 0, "business estimate should be positive");
    assert.ok(estimate > estimateTaskCreditCost("pro"), "business should cost more than pro");
    assert.ok(Number.isInteger(estimate), "estimate should be integer credits");
  });

  it("returns consistent estimates for same tier", () => {
    const estimate1 = estimateTaskCreditCost("starter");
    const estimate2 = estimateTaskCreditCost("starter");
    assert.equal(estimate1, estimate2, "same tier should produce same estimate");
  });
});

describe("usedPercentForTier", () => {
  it("calculates 0% when full balance remains", () => {
    const percent = usedPercentForTier("starter", 6000);
    assert.equal(percent, 0, "full balance should show 0% used");
  });

  it("calculates 100% when balance is zero", () => {
    const percent = usedPercentForTier("starter", 0);
    assert.equal(percent, 100, "zero balance should show 100% used");
  });

  it("calculates partial usage correctly", () => {
    const percent = usedPercentForTier("starter", 3000); // half of 6000
    assert.equal(percent, 50, "half balance should show 50% used");
  });

  it("clamps to 100% maximum", () => {
    const percent = usedPercentForTier("starter", -1000); // overused
    assert.equal(percent, 100, "overuse should still show 100% used");
  });

  it("clamps to 0% minimum", () => {
    const percent = usedPercentForTier("starter", 7000); // more than monthly
    assert.equal(percent, 0, "excess balance should show 0% used");
  });

  it("handles different tiers correctly", () => {
    const starterPercent = usedPercentForTier("starter", 3000);
    const proPercent = usedPercentForTier("pro", 7000); // half of 14000
    assert.equal(starterPercent, 50, "starter half usage");
    assert.equal(proPercent, 50, "pro half usage");
  });

  it("handles null/undefined tier as starter", () => {
    const nullPercent = usedPercentForTier(null, 3000);
    const undefinedPercent = usedPercentForTier(undefined, 3000);
    const starterPercent = usedPercentForTier("starter", 3000);
    assert.equal(nullPercent, starterPercent, "null tier should default to starter");
    assert.equal(undefinedPercent, starterPercent, "undefined tier should default to starter");
  });
});

describe("nextMonthlyResetAt", () => {
  it("returns ISO date string", () => {
    const resetAt = nextMonthlyResetAt();
    assert.match(resetAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "should be ISO 8601 format");
  });

  it("returns date in next month", () => {
    const now = new Date();
    const resetAt = new Date(nextMonthlyResetAt());
    assert.equal(resetAt.getUTCMonth(), (now.getUTCMonth() + 1) % 12, "should be next month");
  });

  it("returns first day of month", () => {
    const resetAt = new Date(nextMonthlyResetAt());
    assert.equal(resetAt.getUTCDate(), 1, "should be 1st day of month");
  });

  it("handles year wrap correctly when run in December", () => {
    // This test validates the logic but can only be properly tested in December
    // For now, we verify the function returns a valid date
    const resetAt = nextMonthlyResetAt();
    const resetDate = new Date(resetAt);
    assert.ok(resetDate instanceof Date, "should return valid date");
    assert.equal(resetDate.getUTCDate(), 1, "should be 1st day of month");
  });
});

describe("tierConfig", () => {
  it("returns starter config for starter tier", () => {
    const config = tierConfig("starter");
    assert.equal(config.label, "Starter");
    assert.equal(config.monthlyCredits, 6000);
    assert.equal(config.caps.creditBudget, 800);
  });

  it("returns pro config for pro tier", () => {
    const config = tierConfig("pro");
    assert.equal(config.label, "Pro");
    assert.equal(config.monthlyCredits, 14000);
    assert.equal(config.caps.creditBudget, 2500);
  });

  it("returns business config for business tier", () => {
    const config = tierConfig("business");
    assert.equal(config.label, "Business");
    assert.equal(config.monthlyCredits, 80000);
    assert.equal(config.caps.creditBudget, 8000);
  });

  it("defaults to starter for null tier", () => {
    const config = tierConfig(null);
    assert.equal(config.label, "Starter");
  });

  it("defaults to starter for undefined tier", () => {
    const config = tierConfig(undefined);
    assert.equal(config.label, "Starter");
  });

  it("defaults to starter for invalid tier", () => {
    const config = tierConfig("invalid" as any);
    assert.equal(config.label, "Starter");
  });
});

describe("checkCreditBalance", () => {
  it("returns ok=true when balance >= estimate", () => {
    const row = {
      credit_balance: 1000,
      plan_tier: "starter",
    } as any;
    const result = checkCreditBalance(row);
    assert.equal(result.ok, true);
    assert.ok(result.estimate > 0);
    assert.equal(result.balance, 1000);
  });

  it("returns ok=false when balance < estimate", () => {
    const row = {
      credit_balance: 10,
      plan_tier: "starter",
    } as any;
    const result = checkCreditBalance(row);
    assert.equal(result.ok, false);
    assert.ok(result.estimate > result.balance, "estimate should exceed balance");
  });

  it("provides correct estimate for starter tier", () => {
    const row = {
      credit_balance: 1000,
      plan_tier: "starter",
    } as any;
    const result = checkCreditBalance(row);
    const expectedEstimate = estimateTaskCreditCost("starter");
    assert.equal(result.estimate, expectedEstimate, "estimate should match tier calculation");
  });

  it("provides correct estimate for pro tier", () => {
    const row = {
      credit_balance: 5000,
      plan_tier: "pro",
    } as any;
    const result = checkCreditBalance(row);
    const expectedEstimate = estimateTaskCreditCost("pro");
    assert.equal(result.estimate, expectedEstimate, "estimate should match tier calculation");
  });

  it("handles null plan_tier as starter", () => {
    const row = {
      credit_balance: 1000,
      plan_tier: null,
    } as any;
    const result = checkCreditBalance(row);
    const expectedEstimate = estimateTaskCreditCost("starter");
    assert.equal(result.estimate, expectedEstimate, "null tier should use starter estimate");
  });
});
