import assert from "node:assert/strict";
import test from "node:test";
import type { HermesRunEvent } from "./hermes-event-types";
import { createRunEventEnvelope } from "@/lib/aio/runs/aio-run-event-envelope";
import { validateEnvelopeShape } from "@/lib/aio/runs/aio-run-event-schema";
import {
  HermesEventMapper,
  normalizeHermesRiskLevel,
} from "./hermes-event-mapper";

test("maps tool lifecycle with a stable tool call id and artifact", () => {
  const mapper = new HermesEventMapper({
    runId: "run-1",
    threadId: "thread-1",
    artifactUrlForPath: (path) => `/artifacts/${path}`,
  });

  const [started] = mapper.map({
    event: "tool.started",
    timestamp: 1_700_000_000,
    tool: "write_file",
    tool_call_id: "tool-1",
    input: { path: "report.md" },
  });
  const completed = mapper.map({
    event: "tool.completed",
    timestamp: 1_700_000_001,
    tool: "write_file",
    tool_call_id: "tool-1",
    file_path: "report.md",
    file_name: "report.md",
  });

  assert.equal(started.type, "tool.started");
  assert.equal(started.type === "tool.started" && started.toolCallId, "tool-1");
  assert.equal(started.type === "tool.started" && started.riskLevel, "dangerous");
  assert.deepEqual(
    completed.map((event) => event.type),
    ["tool.completed", "artifact.created"],
  );
  assert.equal(
    completed[0].type === "tool.completed" && completed[0].artifact?.url,
    "/artifacts/report.md",
  );
});

test("normalizes explicit and inferred risk levels", () => {
  assert.equal(normalizeHermesRiskLevel("low", "bash"), "safe");
  assert.equal(normalizeHermesRiskLevel("critical", "read_file"), "dangerous");
  assert.equal(normalizeHermesRiskLevel(undefined, "web_search"), "safe");
  assert.equal(normalizeHermesRiskLevel(undefined, "send_email"), "dangerous");
  assert.equal(normalizeHermesRiskLevel(undefined, "custom_tool"), "medium");
});

test("maps approval choices and seconds timestamps", () => {
  const mapper = new HermesEventMapper({
    runId: "run-2",
    threadId: "thread-2",
    artifactUrlForPath: String,
  });
  const [requested] = mapper.map({
    event: "approval.requested",
    timestamp: 1_700_000_000,
    approval_id: "approval-1",
    command: "send_email",
  });
  const [responded] = mapper.map({
    event: "approval.responded",
    timestamp: 1_700_000_001,
    approval_id: "approval-1",
    choice: "deny",
  });

  assert.equal(requested.type, "approval.requested");
  assert.equal(requested.createdAt, "2023-11-14T22:13:20.000Z");
  assert.equal(
    responded.type === "approval.responded" && responded.status,
    "rejected",
  );
});

test("maps an unknown Hermes event to an adapter diagnostic, not []", () => {
  const mapper = new HermesEventMapper({
    runId: "run-3",
    threadId: "thread-3",
    artifactUrlForPath: () => "/a/none",
  });

  const out = mapper.map({ event: "something.unrecognized", timestamp: 1_700_000_000, tool: "mystery" });

  assert.equal(out.length, 1);
  assert.equal(out[0].type, "adapter.diagnostic");
  if (out[0].type !== "adapter.diagnostic") throw new Error("unreachable");
  assert.equal(out[0].reason, "unknown_event");
  assert.equal(out[0].source, "hermes");
  assert.equal(out[0].rawEventType, "something.unrecognized");
  assert.ok(out[0].rawEventPreview?.includes("something.unrecognized"));
});

test("mapping the same Hermes event twice is idempotent", () => {
  const mapper = new HermesEventMapper({
    runId: "run-4",
    threadId: "thread-4",
    artifactUrlForPath: (path) => `/a/${path}`,
  });
  const hermesEvent: HermesRunEvent = {
    event: "tool.started",
    timestamp: 1_700_000_000,
    tool_call_id: "tool-9",
    tool: "write_file",
  };

  const first = mapper.map(hermesEvent);
  const second = mapper.map(hermesEvent);

  assert.deepEqual(first, second);
  // Identity derives from the stable tool_call_id, not positional state.
  assert.equal(first[0].type === "tool.started" && first[0].toolCallId, "tool-9");
});

test("every mapped payload wraps into a valid V1 envelope", () => {
  const mapper = new HermesEventMapper({
    runId: "run-5",
    threadId: "thread-5",
    artifactUrlForPath: (path) => `/a/${path}`,
  });
  const events: HermesRunEvent[] = [
    { event: "tool.started", timestamp: 1_700_000_000, tool_call_id: "c1", tool: "write_file" },
    { event: "tool.completed", timestamp: 1_700_000_001, tool_call_id: "c1", tool: "write_file", file_path: "r.md" },
    { event: "message.delta", timestamp: 1_700_000_002, delta: "hi" },
    { event: "run.completed", timestamp: 1_700_000_003 },
    { event: "totally.unknown", timestamp: 1_700_000_004 },
  ];

  let sequence = 0;
  for (const evt of events) {
    for (const payload of mapper.map(evt)) {
      const envelope = createRunEventEnvelope(payload, {
        runId: "run-5",
        threadId: "thread-5",
        sequence: sequence++,
        source: "hermes",
        occurredAt: evt.timestamp ?? 0,
      });
      const result = validateEnvelopeShape(envelope);
      assert.equal(result.ok, true, JSON.stringify(result));
    }
  }
});
