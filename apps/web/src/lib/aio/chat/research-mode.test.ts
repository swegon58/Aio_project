// R13.4 — unit tests for buildResearchInstructions's turn-aware plan/execute gate.
// Runner: tsx --test.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildResearchInstructions,
  EXPORT_DOCX_INSTRUCTION,
  MIN_RESEARCH_SOURCES,
  RESEARCH_CONFIRM_TEXT,
  RESEARCH_PLAN_INSTRUCTIONS,
  RESEARCH_QUESTIONS_INSTRUCTIONS,
  stripUngroundedCitations,
} from "./research-mode.js";

describe("execute-phase instructions", () => {
  it("steers the model away from delegate_task (no delivery channel on the API_SERVER adapter)", () => {
    const result = buildResearchInstructions("research", [], { role: "user", content: RESEARCH_CONFIRM_TEXT });
    assert.ok(result?.includes("Do not use delegate_task"));
  });
});

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

describe("EXPORT_DOCX_INSTRUCTION", () => {
  it("asks the model to use the docx skill to export the report", () => {
    assert.ok(EXPORT_DOCX_INSTRUCTION.includes("docx"));
    assert.ok(EXPORT_DOCX_INSTRUCTION.toLowerCase().includes("export"));
  });
});

describe("stripUngroundedCitations", () => {
  it("leaves text untouched when every cited source is grounded", () => {
    const text = "Claim one [1]. Claim two [2].\n\nSources:\n[1] https://a.example/x\n[2] https://b.example/y";
    const grounded = ["https://a.example/x", "https://b.example/y"];
    assert.equal(stripUngroundedCitations(text, grounded), text);
  });

  it("strips inline markers and the source line for an ungrounded citation", () => {
    const text = "Claim one [1]. Claim two [2].\n\nSources:\n[1] https://a.example/x\n[2] https://fake.example/made-up";
    const grounded = ["https://a.example/x"];
    const result = stripUngroundedCitations(text, grounded);
    assert.ok(result.includes("Claim one [1]."));
    assert.ok(!result.includes("[2]"));
    assert.ok(!result.includes("fake.example"));
  });

  it("matches grounded URLs ignoring trailing slash and case", () => {
    const text = "Claim [1].\n\nSources:\n[1] HTTPS://A.example/x/";
    const grounded = ["https://a.example/x"];
    assert.equal(stripUngroundedCitations(text, grounded), text);
  });

  it("is a no-op when there is no Sources list", () => {
    const text = "Just a plain report with no citations at all.";
    assert.equal(stripUngroundedCitations(text, ["https://a.example/x"]), text);
  });
});
