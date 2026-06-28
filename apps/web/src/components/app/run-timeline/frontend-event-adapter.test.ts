import assert from "node:assert/strict";
import test from "node:test";
import { legacyFrontendEventsToAioRunEvents } from "./frontend-event-adapter";

test("converts legacy activity into sorted Aio events", () => {
  const events = legacyFrontendEventsToAioRunEvents({
    runId: "run-1",
    activity: [
      {
        kind: "tool",
        toolCallId: "write-1",
        tool: "write_file",
        status: "completed",
        filePath: "/artifact/report.md",
        fileName: "report.md",
        ts: 2_000,
      },
      {
        kind: "tool",
        toolCallId: "search-1",
        tool: "web_search",
        status: "running",
        label: "Searching",
        ts: 1_000,
      },
    ],
  });

  assert.deepEqual(
    events.map((event) => event.type),
    ["tool.started", "tool.completed", "artifact.created"],
  );
  assert.equal(
    events[0].type === "tool.started" && events[0].riskLevel,
    "safe",
  );
  assert.equal(
    events[1].type === "tool.completed" && events[1].artifact?.fileName,
    "report.md",
  );
});
