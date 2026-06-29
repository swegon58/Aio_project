// R3.6 — Golden evaluation fixtures.
//
// These fixtures define the expected shape of key Aio outputs at integration
// and regression boundaries. They are NOT unit tests — they are reference
// snapshots used by evals scripts and QA pipelines to detect regressions in
// model behavior, event mapping, or approval flows.
//
// Each fixture has: input, expected output fields, and what NOT to appear.
// Evals compare real outputs against these using the scoring functions below.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvalFixture<I, O> {
  id: string;
  description: string;
  input: I;
  expected: Partial<O>;
  /** Fields that must NOT appear in the output (redaction / PII checks). */
  forbidden?: string[];
  tags: string[];
}

export interface EvalResult {
  fixtureId: string;
  pass: boolean;
  mismatches: string[];
  forbiddenFound: string[];
}

// ---------------------------------------------------------------------------
// Chat event mapping fixtures
// ---------------------------------------------------------------------------

import type { AioRunEvent } from "@/lib/aio/runs/aio-run-events";

export type HermesRawEvent = Record<string, unknown>;

export const EVENT_MAPPING_FIXTURES: EvalFixture<HermesRawEvent, AioRunEvent>[] = [
  {
    id: "em-001",
    description: "Hermes message.delta maps to aio message.delta with delta text",
    input: { type: "message.delta", delta: "Hello, world!" },
    expected: { type: "message.delta", delta: "Hello, world!" },
    tags: ["event-mapping", "message"],
  },
  {
    id: "em-002",
    description: "Hermes tool.started maps to aio tool.started with toolName",
    input: { type: "tool.started", tool_call_id: "tc-1", tool_name: "file", input: { path: "/tmp/x" } },
    expected: { type: "tool.started", toolCallId: "tc-1", toolName: "file" },
    forbidden: ["input", "/tmp/x"],
    tags: ["event-mapping", "tool"],
  },
  {
    id: "em-003",
    description: "Hermes tool.completed maps to aio tool.completed",
    input: { type: "tool.completed", tool_call_id: "tc-1", tool_name: "file", output: "done" },
    expected: { type: "tool.completed", toolCallId: "tc-1", toolName: "file" },
    tags: ["event-mapping", "tool"],
  },
  {
    id: "em-004",
    description: "Hermes approval.requested maps to aio approval.requested with toolCallId",
    input: { type: "approval.requested", tool_call_id: "tc-2", tool_name: "terminal", risk: "dangerous", request_id: "req-1" },
    expected: { type: "approval.requested", toolCallId: "tc-2" },
    tags: ["event-mapping", "approval"],
  },
  {
    id: "em-005",
    description: "Hermes run.started maps to aio run.created",
    input: { type: "run.started", run_id: "h-run-1" },
    expected: { type: "run.created" },
    tags: ["event-mapping", "run"],
  },
  {
    id: "em-006",
    description: "Hermes run.completed maps to aio run.completed",
    input: { type: "run.completed", run_id: "h-run-1" },
    expected: { type: "run.completed" },
    tags: ["event-mapping", "run"],
  },
];

// ---------------------------------------------------------------------------
// Tool call state machine fixtures
// ---------------------------------------------------------------------------

import type { AioToolCallStatus as ToolCallStatus } from "@/lib/aio/tools/tool-call-state-machine";

interface ToolCallTransitionFixture {
  from: ToolCallStatus;
  to: ToolCallStatus;
  allowed: boolean;
}

export const TOOL_CALL_SM_FIXTURES: ToolCallTransitionFixture[] = [
  { from: "proposed", to: "waiting_approval", allowed: true },
  { from: "proposed", to: "running", allowed: true },
  { from: "waiting_approval", to: "approved", allowed: true },
  { from: "waiting_approval", to: "denied", allowed: true },
  { from: "approved", to: "running", allowed: true },
  { from: "running", to: "completed", allowed: true },
  { from: "running", to: "failed", allowed: true },
  { from: "completed", to: "running", allowed: false },
  { from: "failed", to: "completed", allowed: false },
  { from: "denied", to: "approved", allowed: false },
];

// ---------------------------------------------------------------------------
// Approval state machine fixtures
// ---------------------------------------------------------------------------

import type { AioApprovalStatus as ApprovalStatus } from "@/lib/aio/tools/approval-state-machine";

interface ApprovalTransitionFixture {
  from: ApprovalStatus;
  to: ApprovalStatus;
  allowed: boolean;
}

export const APPROVAL_SM_FIXTURES: ApprovalTransitionFixture[] = [
  { from: "requested", to: "approved", allowed: true },
  { from: "requested", to: "rejected", allowed: true },
  { from: "requested", to: "expired", allowed: true },
  { from: "requested", to: "cancelled", allowed: true },
  { from: "approved", to: "rejected", allowed: false },
  { from: "rejected", to: "approved", allowed: false },
  { from: "expired", to: "approved", allowed: false },
  { from: "cancelled", to: "approved", allowed: false },
];

// ---------------------------------------------------------------------------
// Correlation attribute redaction fixtures
// ---------------------------------------------------------------------------

interface RedactionFixture {
  id: string;
  description: string;
  input: Record<string, unknown>;
  forbiddenKeys: string[];
  forbiddenPatterns: RegExp[];
}

export const REDACTION_FIXTURES: RedactionFixture[] = [
  {
    id: "red-001",
    description: "Span attributes must not contain email-like strings",
    input: { "aio.user_id": "user-123", "user.email": "owner@example.com" },
    forbiddenKeys: ["user.email", "email"],
    forbiddenPatterns: [/@[a-z]+\.[a-z]+/i],
  },
  {
    id: "red-002",
    description: "Span attributes must not contain raw prompt text",
    input: { "aio.run_id": "run-1", "prompt": "Do X with secret key sk-..." },
    forbiddenKeys: ["prompt", "completion", "message.content"],
    forbiddenPatterns: [/sk-[a-zA-Z0-9]+/],
  },
  {
    id: "red-003",
    description: "Correlation attributes from rootCorrelationContext are all safe IDs",
    input: {
      "aio.request_id": "req-1",
      "aio.user_id": "user-abc",
      "aio.run_id": "run-abc",
    },
    forbiddenKeys: ["email", "name", "password", "token", "key", "secret"],
    forbiddenPatterns: [/@/, /sk-/, /Bearer /],
  },
];

// ---------------------------------------------------------------------------
// Scorer utility
// ---------------------------------------------------------------------------

/** Check a single event-mapping fixture against an actual mapped event. */
export function scoreEventFixture(
  fixture: EvalFixture<HermesRawEvent, AioRunEvent>,
  actual: AioRunEvent,
): EvalResult {
  const mismatches: string[] = [];
  const forbiddenFound: string[] = [];
  const actualStr = JSON.stringify(actual);

  for (const [k, v] of Object.entries(fixture.expected)) {
    if ((actual as Record<string, unknown>)[k] !== v) {
      mismatches.push(`${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify((actual as Record<string, unknown>)[k])}`);
    }
  }

  for (const f of fixture.forbidden ?? []) {
    if (actualStr.includes(f)) {
      forbiddenFound.push(f);
    }
  }

  return {
    fixtureId: fixture.id,
    pass: mismatches.length === 0 && forbiddenFound.length === 0,
    mismatches,
    forbiddenFound,
  };
}

/** Check a redaction fixture against a span attribute map. */
export function scoreRedactionFixture(
  fixture: RedactionFixture,
  attrs: Record<string, unknown>,
): EvalResult {
  const forbiddenFound: string[] = [];
  const attrStr = JSON.stringify(attrs);

  for (const key of fixture.forbiddenKeys) {
    if (key in attrs) forbiddenFound.push(`key: ${key}`);
  }
  for (const pat of fixture.forbiddenPatterns) {
    if (pat.test(attrStr)) forbiddenFound.push(`pattern: ${pat.source}`);
  }

  return {
    fixtureId: fixture.id,
    pass: forbiddenFound.length === 0,
    mismatches: [],
    forbiddenFound,
  };
}
