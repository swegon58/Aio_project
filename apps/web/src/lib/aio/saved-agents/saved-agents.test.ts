// R7 — Unit tests for Saved Agents validation.
// Runner: tsx --test

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateSavedAgentInput } from "./saved-agents.js";

describe("validateSavedAgentInput", () => {
  it("requires a non-empty name", () => {
    assert.equal(
      validateSavedAgentInput({ name: "", instructionsAddition: "" }),
      "Name is required.",
    );
    assert.equal(
      validateSavedAgentInput({ name: "   ", instructionsAddition: "" }),
      "Name is required.",
    );
  });

  it("rejects a name over 80 characters", () => {
    const longName = "a".repeat(81);
    assert.equal(
      validateSavedAgentInput({ name: longName, instructionsAddition: "" }),
      "Name must be 80 characters or fewer.",
    );
  });

  it("accepts a name at the 80-character boundary", () => {
    const boundaryName = "a".repeat(80);
    assert.equal(validateSavedAgentInput({ name: boundaryName, instructionsAddition: "" }), null);
  });

  it("rejects instructions over 4000 characters", () => {
    assert.equal(
      validateSavedAgentInput({ name: "Code Reviewer", instructionsAddition: "a".repeat(4001) }),
      "Instructions must be 4000 characters or fewer.",
    );
  });

  it("accepts valid input", () => {
    assert.equal(
      validateSavedAgentInput({ name: "Code Reviewer", instructionsAddition: "Be terse." }),
      null,
    );
  });
});
