import assert from "node:assert/strict";
import test from "node:test";
import {
  creditsForUsd,
  tierConfig,
  usdForCredits,
  usedPercentForTier,
} from "./pricing";

test("credit conversion is reversible", () => {
  assert.equal(creditsForUsd(1.25), 1_250);
  assert.equal(usdForCredits(1_250), 1.25);
});

test("unknown plans fail safely to Starter", () => {
  assert.equal(tierConfig("unknown").label, "Starter");
  assert.equal(tierConfig(null).label, "Starter");
});

test("usage percentage is clamped to zero and one hundred", () => {
  assert.equal(usedPercentForTier("starter", 6_000), 0);
  assert.equal(usedPercentForTier("starter", 3_000), 50);
  assert.equal(usedPercentForTier("starter", -100), 100);
});
