// R13.4 — unit tests for buildResearchInstructions's turn-aware plan/execute gate.
// Runner: tsx --test.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildResearchInstructions,
  MIN_RESEARCH_SOURCES,
  RESEARCH_CONFIRM_TEXT,
  RESEARCH_PLAN_INSTRUCTIONS,
  RESEARCH_QUESTIONS_INSTRUCTIONS,
} from "./research-mode.js";

describe("buildResearchInstructions", () => {
  it("returns null when mode is not research", () => {
    const result = buildResearchInstructions("auto", [], { role: "user", content: "hi" });
    assert.equal(result, null);
  });

  it("returns the batch clarifying-questions instructions on the first research turn", () => {
    const result = buildResearchInstructions("research", [], { role: "user", content: "research X" });
    assert.equal(result, RESEARCH_QUESTIONS_INSTRUCTIONS);
  });

  it("returns plan-phase instructions once a batch aio-questions block has been asked", () => {
    const history = [
      { role: "user", content: "research X" },
      { role: "assistant", content: '```aio-questions\n{"questions":[{"question":"q","choices":["a","b","c"],"recommended":"a"}]}\n```' },
    ];
    const result = buildResearchInstructions("research", history, { role: "user", content: "a" });
    assert.equal(result, RESEARCH_PLAN_INSTRUCTIONS);
  });

  it("returns execute-phase instructions once the user sends the confirm trigger", () => {
    const result = buildResearchInstructions("research", [], { role: "user", content: RESEARCH_CONFIRM_TEXT });
    assert.notEqual(result, RESEARCH_PLAN_INSTRUCTIONS);
    assert.ok(result?.includes("Aio Deep Research task"));
  });

  it("returns execute-phase instructions once a plan block already exists in history", () => {
    const history = [
      { role: "user", content: "research X" },
      { role: "assistant", content: '```aio-research-plan\n{"title":"t","steps":["a"]}\n```' },
    ];
    const result = buildResearchInstructions("research", history, { role: "user", content: "anything" });
    assert.notEqual(result, RESEARCH_PLAN_INSTRUCTIONS);
    assert.ok(result?.includes("Aio Deep Research task"));
  });
});

describe("MIN_RESEARCH_SOURCES", () => {
  it("is a positive floor consistent with the 3-5 range noted in the prompt", () => {
    assert.ok(MIN_RESEARCH_SOURCES >= 3 && MIN_RESEARCH_SOURCES <= 5);
  });
});
