// R15 C1 — unit tests for buildPlanInstructions's batch aio-questions gate.
// Runner: tsx --test

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPlanInstructions, isFinalPlanShape, PLAN_MODE_INSTRUCTIONS } from "./plan-mode.js";

describe("buildPlanInstructions", () => {
  it("returns null when plan mode is off", () => {
    const result = buildPlanInstructions(false, [], { role: "user", content: "hi" });
    assert.equal(result, null);
  });

  it("instructs a batch aio-questions block on the first plan-mode turn", () => {
    const result = buildPlanInstructions(true, [], { role: "user", content: "do a thing" });
    assert.ok(result?.startsWith(PLAN_MODE_INSTRUCTIONS));
    assert.ok(result?.includes("one chance to ask clarifying questions"));
  });

  it("instructs the final plan once an aio-questions block has already been asked", () => {
    const history = [
      { role: "user", content: "do a thing" },
      {
        role: "assistant",
        content: '```aio-questions\n{"questions":[{"question":"q","choices":["a","b","c"],"recommended":"a"}]}\n```',
      },
    ];
    const result = buildPlanInstructions(true, history, { role: "user", content: "a" });
    assert.ok(result?.includes("already asked your batch of clarifying questions"));
  });

  it("instructs the final plan when the user sends the skip trigger", () => {
    const result = buildPlanInstructions(true, [], {
      role: "user",
      content: "Skip the remaining questions and write the final plan now, using your best judgment.",
    });
    assert.ok(result?.includes("already asked your batch of clarifying questions"));
  });
});

describe("isFinalPlanShape", () => {
  it("returns true for a numbered plan with an assumption line", () => {
    const text = [
      "1. Read the config file",
      "2. Update the timeout value",
      "3. Restart the service",
      "Assumption: staging env, not prod.",
    ].join("\n");
    assert.equal(isFinalPlanShape(text), true);
  });

  it("returns false for a single-line non-plan reply", () => {
    assert.equal(isFinalPlanShape("Sure, I can help with that!"), false);
  });

  it("returns false for an empty string", () => {
    assert.equal(isFinalPlanShape(""), false);
  });

  it("returns false when an aio-questions block is present, even with numbered-looking lines", () => {
    const text = [
      "```aio-questions",
      '{"questions":[{"question":"1. which env?","choices":["a","b","c"],"recommended":"a"}]}',
      "```",
    ].join("\n");
    assert.equal(isFinalPlanShape(text), false);
  });
});
