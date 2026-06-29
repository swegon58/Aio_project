import { CronExpressionParser } from "cron-parser";

export const AIO_SCHEDULE_CONCURRENCY_POLICY = "forbid_overlap" as const;
export const AIO_SCHEDULE_CATCH_UP_POLICY = "coalesce_once" as const;
const ONESHOT_GRACE_MS = 120_000;
const UTC_TIMEZONE = "UTC";

export type AioScheduleKind = "once" | "interval" | "cron";
export type AioScheduleState =
  | "scheduled"
  | "paused"
  | "completed"
  | "error"
  | "cancelled";
export type AioScheduleRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped_overlap"
  | "cancelled";
export type AioScheduleTriggerKind = "scheduled" | "manual" | "catch_up";

export interface AioScheduleDefinitionBase {
  kind: AioScheduleKind;
  display: string;
}

export interface AioOnceScheduleDefinition extends AioScheduleDefinitionBase {
  kind: "once";
  runAt: string;
}

export interface AioIntervalScheduleDefinition extends AioScheduleDefinitionBase {
  kind: "interval";
  minutes: number;
}

export interface AioCronScheduleDefinition extends AioScheduleDefinitionBase {
  kind: "cron";
  expr: string;
}

export type AioScheduleDefinition =
  | AioOnceScheduleDefinition
  | AioIntervalScheduleDefinition
  | AioCronScheduleDefinition;

function parseDurationToMinutes(input: string): number {
  const trimmed = input.trim().toLowerCase();
  const match = /^(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/.exec(
    trimmed,
  );
  if (!match) {
    throw new Error(
      `Invalid duration: "${input}". Use values like "30m", "2h", or "1d".`,
    );
  }

  const value = Number.parseInt(match[1], 10);
  const unit = match[2][0];
  const multipliers = { m: 1, h: 60, d: 1440 } as const;
  return value * multipliers[unit as keyof typeof multipliers];
}

function normalizeTimestamp(input: string | number | Date): string {
  if (input instanceof Date) return input.toISOString();
  if (typeof input === "number") {
    const millis = input < 1_000_000_000_000 ? input * 1000 : input;
    return new Date(millis).toISOString();
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: "${input}"`);
  }
  return date.toISOString();
}

function looksLikeCronExpression(input: string): boolean {
  const parts = input.trim().split(/\s+/);
  return (
    parts.length >= 5 &&
    parts.slice(0, 5).every((part) => /^[\d*\-,/]+$/.test(part))
  );
}

export function parseScheduleInput(
  input: string,
  now: Date = new Date(),
): AioScheduleDefinition {
  const schedule = input.trim();
  if (!schedule) {
    throw new Error("Schedule is required.");
  }

  const lower = schedule.toLowerCase();
  if (lower.startsWith("every ")) {
    const minutes = parseDurationToMinutes(schedule.slice(6));
    return {
      kind: "interval",
      minutes,
      display: `every ${minutes}m`,
    };
  }

  if (looksLikeCronExpression(schedule)) {
    try {
      CronExpressionParser.parse(schedule, {
        currentDate: now.toISOString(),
        tz: UTC_TIMEZONE,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid cron expression "${schedule}": ${message}`);
    }
    return {
      kind: "cron",
      expr: schedule,
      display: schedule,
    };
  }

  if (schedule.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(schedule)) {
    const runAt = normalizeTimestamp(schedule);
    return {
      kind: "once",
      runAt,
      display: `once at ${runAt.slice(0, 16).replace("T", " ")}`,
    };
  }

  try {
    const minutes = parseDurationToMinutes(schedule);
    const runAt = new Date(now.getTime() + minutes * 60_000).toISOString();
    return {
      kind: "once",
      runAt,
      display: `once in ${schedule}`,
    };
  } catch {
    throw new Error(
      `Invalid schedule "${schedule}". Use duration ("30m"), interval ("every 30m"), cron ("0 9 * * *"), or timestamp ("2026-02-03T14:00:00Z").`,
    );
  }
}

export function computeScheduleGraceMs(
  schedule: AioScheduleDefinition,
  now: Date = new Date(),
): number {
  const MIN_GRACE_MS = 120_000;
  const MAX_GRACE_MS = 7_200_000;

  if (schedule.kind === "interval") {
    const periodMs = schedule.minutes * 60_000;
    return Math.max(MIN_GRACE_MS, Math.min(periodMs / 2, MAX_GRACE_MS));
  }

  if (schedule.kind === "cron") {
    try {
      const cron = CronExpressionParser.parse(schedule.expr, {
        currentDate: now.toISOString(),
        tz: UTC_TIMEZONE,
      });
      const first = cron.next().toISOString();
      const second = cron.next().toISOString();
      if (!first || !second) return MIN_GRACE_MS;
      const delta = new Date(second).getTime() - new Date(first).getTime();
      return Math.max(MIN_GRACE_MS, Math.min(delta / 2, MAX_GRACE_MS));
    } catch {
      return MIN_GRACE_MS;
    }
  }

  return MIN_GRACE_MS;
}

export function computeNextScheduleRunAt(
  schedule: AioScheduleDefinition,
  options: {
    lastRunAt?: string | null;
    now?: Date;
  } = {},
): string | null {
  const now = options.now ?? new Date();

  if (schedule.kind === "once") {
    if (options.lastRunAt) return null;
    const runAt = new Date(schedule.runAt).getTime();
    if (Number.isNaN(runAt)) return null;
    return runAt >= now.getTime() - ONESHOT_GRACE_MS ? schedule.runAt : null;
  }

  if (schedule.kind === "interval") {
    const base = options.lastRunAt
      ? new Date(options.lastRunAt).getTime()
      : now.getTime();
    if (Number.isNaN(base)) return null;
    return new Date(base + schedule.minutes * 60_000).toISOString();
  }

  try {
    const cron = CronExpressionParser.parse(schedule.expr, {
      currentDate: options.lastRunAt ?? now.toISOString(),
      tz: UTC_TIMEZONE,
    });
    return cron.next().toISOString();
  } catch {
    return null;
  }
}

export function computeCatchUpRunAt(
  schedule: AioScheduleDefinition,
  nextRunAt: string,
  now: Date = new Date(),
): string | null {
  const nextRunMs = new Date(nextRunAt).getTime();
  if (Number.isNaN(nextRunMs)) return null;
  if (nextRunMs > now.getTime()) return null;

  if (schedule.kind === "once") {
    return nextRunMs >= now.getTime() - ONESHOT_GRACE_MS ? nextRunAt : null;
  }

  const graceMs = computeScheduleGraceMs(schedule, now);
  return now.getTime() - nextRunMs <= graceMs ? nextRunAt : now.toISOString();
}
