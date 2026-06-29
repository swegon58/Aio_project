// R4.7 — Unit tests for research stages helpers.
// Runner: tsx --test

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RESEARCH_STAGES, buildResearchStageEvent } from "./research-stages.js";

describe("RESEARCH_STAGES", () => {
  it("contains exactly 7 stages", () => {
    assert.equal(RESEARCH_STAGES.length, 7);
  });

  it("stage indices are 1-7 in order (1-based)", () => {
    for (let i = 0; i < RESEARCH_STAGES.length; i++) {
      assert.equal(RESEARCH_STAGES[i].index, i + 1);
    }
  });

  it("contains the canonical 7 stage names in order", () => {
    const expected = ["understand", "plan", "discover", "inspect", "synthesize", "verify", "report"];
    const actual = RESEARCH_STAGES.map((s) => s.stage);
    assert.deepEqual(actual, expected);
  });

  it("every stage has a non-empty label", () => {
    for (const s of RESEARCH_STAGES) {
      assert.ok(s.label.length > 0, `empty label for stage ${s.stage}`);
    }
  });
});

describe("buildResearchStageEvent", () => {
  const RUN_ID = "run-abc-123";

  it("builds a valid event for the first stage", () => {
    const event = buildResearchStageEvent(RUN_ID, "understand");
    assert.equal(event.type, "research.stage");
    assert.equal(event.runId, RUN_ID);
    assert.equal(event.stage, "understand");
    assert.equal(event.stageIndex, 1);
    assert.equal(event.totalStages, 7);
  });

  it("builds a valid event for the last stage", () => {
    const event = buildResearchStageEvent(RUN_ID, "report");
    assert.equal(event.stage, "report");
    assert.equal(event.stageIndex, 7);
  });

  it("includes createdAt as an ISO 8601 timestamp", () => {
    const event = buildResearchStageEvent(RUN_ID, "plan");
    assert.ok(!isNaN(Date.parse(event.createdAt)), "createdAt should be a valid date string");
  });

  it("propagates optional sourceCount and claimCount", () => {
    const event = buildResearchStageEvent(RUN_ID, "synthesize", { sourceCount: 12, claimCount: 34 });
    assert.equal(event.sourceCount, 12);
    assert.equal(event.claimCount, 34);
  });

  it("has a non-empty label", () => {
    for (const { stage } of RESEARCH_STAGES) {
      const event = buildResearchStageEvent(RUN_ID, stage);
      assert.ok(event.label.length > 0, `empty label for stage ${stage}`);
    }
  });

  it("stageIndex matches RESEARCH_STAGES 1-based index", () => {
    for (const { stage, index } of RESEARCH_STAGES) {
      const event = buildResearchStageEvent(RUN_ID, stage);
      assert.equal(event.stageIndex, index, `wrong index for stage ${stage}`);
    }
  });
});
