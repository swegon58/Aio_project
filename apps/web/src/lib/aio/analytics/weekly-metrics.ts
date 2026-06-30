// R6.7 — pure aggregation functions for the weekly beta-analytics report.
//
// Privacy: every input row here is status/timestamp/cost/error-code data
// already persisted by R1-R5 (aio_runs, aio_approvals, aio_run_events,
// hermes_registry). Nothing here reads message text, prompts, or tool
// payloads — callers must select only the columns declared below.

export interface RunMetricRow {
  id: string;
  customer_id: string;
  status: string;
  mode: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  actual_credits: number | null;
  error_code: string | null;
}

export interface ApprovalMetricRow {
  status: string;
}

export interface ActivationRow {
  customer_id: string;
  activated_at: string;
}

export interface RunEventRow {
  run_id: string;
  type: string;
  occurred_at: string;
  sequence: number;
}

function percentile(valuesMs: number[], p: number): number | null {
  if (valuesMs.length === 0) return null;
  const sorted = [...valuesMs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

export function activationCount(rows: ActivationRow[]): number {
  return rows.length;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionResult {
  cohortSize: number;
  d1RetainedPct: number | null;
  w1RetainedPct: number | null;
}

/**
 * D1/W1 retention: of users activated in the window, the fraction with a
 * run dated at least 1 day / 7 days after their own activation timestamp
 * (activation itself is set on a successful run, so this measures whether
 * they came back, not the activating run itself).
 */
export function computeRetention(
  activations: ActivationRow[],
  runsByCustomer: Map<string, string[]>,
): RetentionResult {
  const cohortSize = activations.length;
  if (cohortSize === 0) return { cohortSize: 0, d1RetainedPct: null, w1RetainedPct: null };

  let d1 = 0;
  let w1 = 0;
  for (const { customer_id, activated_at } of activations) {
    const activatedMs = new Date(activated_at).getTime();
    const runDates = runsByCustomer.get(customer_id) ?? [];
    if (runDates.some((d) => new Date(d).getTime() - activatedMs >= DAY_MS)) d1 += 1;
    if (runDates.some((d) => new Date(d).getTime() - activatedMs >= 7 * DAY_MS)) w1 += 1;
  }

  return {
    cohortSize,
    d1RetainedPct: Math.round((d1 / cohortSize) * 100),
    w1RetainedPct: Math.round((w1 / cohortSize) * 100),
  };
}

export interface ModeSuccessResult {
  mode: string;
  total: number;
  succeeded: number;
  successRatePct: number;
}

export function computeSuccessByMode(runs: RunMetricRow[]): ModeSuccessResult[] {
  const byMode = new Map<string, { total: number; succeeded: number }>();
  for (const r of runs) {
    const entry = byMode.get(r.mode) ?? { total: 0, succeeded: 0 };
    entry.total += 1;
    if (r.status === "completed") entry.succeeded += 1;
    byMode.set(r.mode, entry);
  }
  return Array.from(byMode.entries()).map(([mode, { total, succeeded }]) => ({
    mode,
    total,
    succeeded,
    successRatePct: total > 0 ? Math.round((succeeded / total) * 100) : 0,
  }));
}

export interface RunsPerActiveUserResult {
  activeUsers: number;
  succeededRuns: number;
  succeededPerActiveUser: number | null;
}

export function computeRunsPerActiveUser(runs: RunMetricRow[]): RunsPerActiveUserResult {
  const activeUsers = new Set(runs.map((r) => r.customer_id)).size;
  const succeededRuns = runs.filter((r) => r.status === "completed").length;
  return {
    activeUsers,
    succeededRuns,
    succeededPerActiveUser: activeUsers > 0 ? succeededRuns / activeUsers : null,
  };
}

export interface LatencyResult {
  completionP95Ms: number | null;
  firstResponseP95Ms: number | null;
}

const FIRST_RESPONSE_EVENT_TYPES = new Set(["message.delta", "message.completed"]);

/** First-response latency = first message.delta/message.completed event minus run.started_at. */
export function computeLatencies(runs: RunMetricRow[], events: RunEventRow[]): LatencyResult {
  const completionMs = runs
    .filter((r) => r.status === "completed" && r.started_at && r.completed_at)
    .map((r) => new Date(r.completed_at!).getTime() - new Date(r.started_at!).getTime());

  const firstEventByRun = new Map<string, RunEventRow>();
  for (const e of events) {
    if (!FIRST_RESPONSE_EVENT_TYPES.has(e.type)) continue;
    const existing = firstEventByRun.get(e.run_id);
    if (!existing || e.sequence < existing.sequence) firstEventByRun.set(e.run_id, e);
  }

  const startedAtByRun = new Map(
    runs.filter((r) => r.started_at).map((r) => [r.id, r.started_at!]),
  );
  const firstResponseMs: number[] = [];
  for (const [runId, event] of firstEventByRun) {
    const startedAt = startedAtByRun.get(runId);
    if (!startedAt) continue;
    const delta = new Date(event.occurred_at).getTime() - new Date(startedAt).getTime();
    if (delta >= 0) firstResponseMs.push(delta);
  }

  return {
    completionP95Ms: percentile(completionMs, 0.95),
    firstResponseP95Ms: percentile(firstResponseMs, 0.95),
  };
}

export interface ApprovalRatesResult {
  total: number;
  approvedPct: number | null;
  rejectedPct: number | null;
  expiredPct: number | null;
}

export function computeApprovalRates(approvals: ApprovalMetricRow[]): ApprovalRatesResult {
  const total = approvals.length;
  if (total === 0) return { total: 0, approvedPct: null, rejectedPct: null, expiredPct: null };
  const count = (s: string) => approvals.filter((a) => a.status === s).length;
  return {
    total,
    approvedPct: Math.round((count("approved") / total) * 100),
    rejectedPct: Math.round((count("rejected") / total) * 100),
    expiredPct: Math.round((count("expired") / total) * 100),
  };
}

export function computeCostPerSuccess(runs: RunMetricRow[]): number | null {
  const succeeded = runs.filter((r) => r.status === "completed");
  if (succeeded.length === 0) return null;
  const totalCredits = succeeded.reduce((sum, r) => sum + (r.actual_credits ?? 0), 0);
  return totalCredits / succeeded.length;
}

export interface FailureCategoryResult {
  errorCode: string;
  count: number;
}

export function computeTopFailureCategories(
  runs: RunMetricRow[],
  topN = 5,
): FailureCategoryResult[] {
  const counts = new Map<string, number>();
  for (const r of runs) {
    if (r.status !== "failed") continue;
    const code = r.error_code ?? "unknown";
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([errorCode, count]) => ({ errorCode, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}
