// R6.8 — Unit tests for beta spend-cap helpers.
// Runner: tsx --test

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { configuredSpendCapCredits } from "./spend-cap.js";

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
