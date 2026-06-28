import assert from "node:assert/strict";
import test from "node:test";
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
