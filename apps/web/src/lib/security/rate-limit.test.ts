import assert from "node:assert/strict";
import test from "node:test";

import { checkRateLimit } from "./rate-limit";

test("checkRateLimit allows requests under the limit", () => {
  const key = `test-${Math.random()}`;
  const first = checkRateLimit(key, 2, 60_000);
  const second = checkRateLimit(key, 2, 60_000);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
});

test("checkRateLimit rejects requests over the limit within the window", () => {
  const key = `test-${Math.random()}`;
  checkRateLimit(key, 1, 60_000);
  const second = checkRateLimit(key, 1, 60_000);
  assert.equal(second.allowed, false);
  assert.ok(second.retryAfterSeconds > 0);
});

test("checkRateLimit resets after the window elapses", async () => {
  const key = `test-${Math.random()}`;
  checkRateLimit(key, 1, 1);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const result = checkRateLimit(key, 1, 1);
  assert.equal(result.allowed, true);
});
