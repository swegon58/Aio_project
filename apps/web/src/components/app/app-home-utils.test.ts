import test from "node:test";
import assert from "node:assert/strict";
import { reportSummary, latestResearchStageEvent, parsePlanQuestions, parseResearchPlan } from "./app-home-utils";
import type { AioRunEvent, ResearchStageEvent } from "@/lib/aio/runs/aio-run-events";

// R13.3 item 2: reportSummary() is pure string logic with no e2e-only path
// covering its edge cases (research-export.spec.ts only exercises the happy
// "Open report" click flow) — 2 real bugs here were previously caught only
// by manual/kimo review, so lock the boundary behavior down.
test("reportSummary strips the first heading line and returns the rest verbatim under the truncation limit", () => {
  const text = "# My Report Title\n\nHere is the short body of the report.";
  assert.equal(reportSummary(text), "Here is the short body of the report.");
});

test("reportSummary returns unchanged text (no truncation) when there is no heading at all", () => {
  const text = "Just a plain paragraph with no markdown heading in it.";
  assert.equal(reportSummary(text), text);
});

test("reportSummary handles an empty/whitespace-only report", () => {
  assert.equal(reportSummary(""), "");
  assert.equal(reportSummary("   \n\n  \t "), "");
});

test("reportSummary strips every heading line, not just the first", () => {
  const text =
    "# Title\n\nIntro sentence.\n\n## Section Two\n\nBody text after the second heading.";
  const summary = reportSummary(text);
  assert.equal(summary, "Intro sentence. Body text after the second heading.");
});

test("reportSummary truncates at a word boundary and appends an ellipsis past 180 chars", () => {
  const body = "word ".repeat(50).trim(); // well over 180 chars, all short words
  const summary = reportSummary(`# Title\n\n${body}`);
  assert.ok(summary.endsWith("…"));
  assert.ok(summary.length <= 181); // 180 + ellipsis
  assert.ok(!summary.slice(0, -1).endsWith(" ")); // trimmed before the ellipsis
});

test("reportSummary falls back to a hard cut when there's no word boundary in the first 180 chars", () => {
  const longWord = "a".repeat(200);
  const summary = reportSummary(longWord);
  assert.equal(summary, `${"a".repeat(180)}…`);
});

function stageEvent(overrides: Partial<ResearchStageEvent>): ResearchStageEvent {
  return {
    type: "research.stage",
    runId: "run-1",
    stage: "discover",
    stageIndex: 3,
    totalStages: 7,
    label: "Discovering",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test("latestResearchStageEvent returns the last research.stage event, ignoring other event types", () => {
  const events = [
    stageEvent({ stageIndex: 1, label: "Understanding" }),
    { type: "tool.started", runId: "run-1", toolCallId: "t1", createdAt: new Date().toISOString() } as unknown as AioRunEvent,
    stageEvent({ stageIndex: 4, label: "Reading" }),
  ];
  assert.equal(latestResearchStageEvent(events)?.label, "Reading");
});

test("latestResearchStageEvent returns undefined when there are no research.stage events", () => {
  assert.equal(latestResearchStageEvent([]), undefined);
});

// R15 C5 — batch aio-questions protocol
test("parsePlanQuestions parses a fenced aio-questions block with 2-5 questions", () => {
  const text =
    '```aio-questions\n{"questions":[{"question":"Q1?","choices":["A","B","C"],"recommended":"B"},{"question":"Q2?","choices":["X","Y","Z"]}]}\n```';
  const parsed = parsePlanQuestions(text);
  assert.equal(parsed?.length, 2);
  assert.equal(parsed?.[0].recommended, "B");
  assert.equal(parsed?.[1].recommended, undefined);
});

test("parsePlanQuestions returns null for plain text (no fenced JSON)", () => {
  assert.equal(parsePlanQuestions("Just a normal chat message."), null);
});

test("parsePlanQuestions returns null when fewer than 2 questions", () => {
  const text = '```aio-questions\n{"questions":[{"question":"Only one?","choices":["A","B","C"]}]}\n```';
  assert.equal(parsePlanQuestions(text), null);
});

test("parsePlanQuestions returns null on malformed JSON", () => {
  assert.equal(parsePlanQuestions("```aio-questions\n{not json\n```"), null);
});

// R15 C5 — research-mode aio-research-plan protocol
test("parseResearchPlan parses a fenced aio-research-plan block", () => {
  const text = '```aio-research-plan\n{"title":"Research the thing","steps":["Step one","Step two"]}\n```';
  const parsed = parseResearchPlan(text);
  assert.deepEqual(parsed, { title: "Research the thing", steps: ["Step one", "Step two"] });
});

test("parseResearchPlan returns null for plain text", () => {
  assert.equal(parseResearchPlan("Here's a normal reply, no plan block."), null);
});
