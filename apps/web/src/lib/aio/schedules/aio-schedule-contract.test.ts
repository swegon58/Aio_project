import assert from "node:assert/strict";
import test from "node:test";

import {
  computeCatchUpRunAt,
  computeNextScheduleRunAt,
  parseScheduleInput,
} from "./aio-schedule-contract";

test("parseScheduleInput parses duration one-shots", () => {
  const parsed = parseScheduleInput("30m", new Date("2026-06-29T10:00:00.000Z"));
  assert.equal(parsed.kind, "once");
  if (parsed.kind !== "once") return;
  assert.equal(parsed.runAt, "2026-06-29T10:30:00.000Z");
  assert.equal(parsed.display, "once in 30m");
});

test("parseScheduleInput parses recurring intervals", () => {
  const parsed = parseScheduleInput("every 2h");
  assert.deepEqual(parsed, {
    kind: "interval",
    minutes: 120,
    display: "every 120m",
  });
});

test("parseScheduleInput parses cron expressions", () => {
  const parsed = parseScheduleInput("0 9 * * *", new Date("2026-06-29T10:00:00.000Z"));
  assert.deepEqual(parsed, {
    kind: "cron",
    expr: "0 9 * * *",
    display: "0 9 * * *",
  });
});

test("parseScheduleInput parses timestamps", () => {
  const parsed = parseScheduleInput("2026-07-01T14:30:00Z");
  assert.equal(parsed.kind, "once");
  if (parsed.kind !== "once") return;
  assert.equal(parsed.runAt, "2026-07-01T14:30:00.000Z");
  assert.equal(parsed.display, "once at 2026-07-01 14:30");
});

test("computeNextScheduleRunAt uses the stored once timestamp within grace", () => {
  const schedule = parseScheduleInput("2026-06-29T10:00:30Z");
  const next = computeNextScheduleRunAt(schedule, {
    now: new Date("2026-06-29T10:01:00.000Z"),
  });
  assert.equal(next, "2026-06-29T10:00:30.000Z");
});

test("computeNextScheduleRunAt advances interval schedules from the last run", () => {
  const schedule = parseScheduleInput("every 15m");
  const next = computeNextScheduleRunAt(schedule, {
    lastRunAt: "2026-06-29T10:00:00.000Z",
  });
  assert.equal(next, "2026-06-29T10:15:00.000Z");
});

test("computeNextScheduleRunAt advances cron schedules in UTC", () => {
  const schedule = parseScheduleInput("0 9 * * *");
  const next = computeNextScheduleRunAt(schedule, {
    now: new Date("2026-06-29T10:00:00.000Z"),
  });
  assert.equal(next, "2026-06-30T09:00:00.000Z");
});

test("computeCatchUpRunAt coalesces stale recurring schedules to now", () => {
  const schedule = parseScheduleInput("every 10m");
  const catchUp = computeCatchUpRunAt(
    schedule,
    "2026-06-29T09:00:00.000Z",
    new Date("2026-06-29T10:00:00.000Z"),
  );
  assert.equal(catchUp, "2026-06-29T10:00:00.000Z");
});
