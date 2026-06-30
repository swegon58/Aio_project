// R6.8 — Unit tests for beta invite-gate helpers.
// Runner: tsx --test

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isBetaInviteOnlyEnabled } from "./invite-gate.js";

const ENV_KEY = "AIO_BETA_INVITE_ONLY";
const original = process.env[ENV_KEY];

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
});

describe("isBetaInviteOnlyEnabled", () => {
  it("is off by default", () => {
    delete process.env[ENV_KEY];
    assert.equal(isBetaInviteOnlyEnabled(), false);
  });

  it("is off for any value other than the literal string 'true'", () => {
    process.env[ENV_KEY] = "1";
    assert.equal(isBetaInviteOnlyEnabled(), false);
    process.env[ENV_KEY] = "TRUE";
    assert.equal(isBetaInviteOnlyEnabled(), false);
  });

  it("is on when set to 'true'", () => {
    process.env[ENV_KEY] = "true";
    assert.equal(isBetaInviteOnlyEnabled(), true);
  });
});
