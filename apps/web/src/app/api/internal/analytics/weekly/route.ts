// R6.7 — weekly beta-analytics report. Same operator-only gate as
// /api/internal/metrics. Aggregates status/timestamp/cost/error-code
// columns only — no raw prompt content, no PII beyond an opaque
// customer_id, never exposed in the consumer nav.

import { createClient } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/hermes/billing";
import {
  activationCount,
  computeApprovalRates,
  computeCostPerSuccess,
  computeLatencies,
  computeRetention,
  computeRunsPerActiveUser,
  computeSuccessByMode,
  computeTopFailureCategories,
  type ActivationRow,
  type ApprovalMetricRow,
  type RunEventRow,
  type RunMetricRow,
} from "@/lib/aio/analytics/weekly-metrics";

const INTERNAL_SECRET = process.env.AIO_INTERNAL_SECRET ?? "";
const OWNER_EMAIL = process.env.AIO_OWNER_EMAIL ?? "";

async function isAuthorized(req: Request): Promise<boolean> {
  const secretHeader = req.headers.get("x-aio-internal-secret") ?? "";
  if (INTERNAL_SECRET && secretHeader === INTERNAL_SECRET) return true;

  if (!OWNER_EMAIL) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email === OWNER_EMAIL;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  if (!(await isAuthorized(req))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const db = serviceDb();
  const now = new Date();
  const since = new Date(now.getTime() - 7 * DAY_MS).toISOString();

  const [{ data: activations, error: activationsErr }, { data: runs, error: runsErr }, { data: approvals, error: approvalsErr }] =
    await Promise.all([
      db
        .from("hermes_registry")
        .select("customer_id, activated_at")
        .gte("activated_at", since) as unknown as Promise<{ data: ActivationRow[] | null; error: { message: string } | null }>,
      db
        .from("aio_runs")
        .select("id, customer_id, status, mode, created_at, started_at, completed_at, actual_credits, error_code")
        .gte("created_at", since) as unknown as Promise<{ data: RunMetricRow[] | null; error: { message: string } | null }>,
      db
        .from("aio_approvals")
        .select("status")
        .gte("created_at", since) as unknown as Promise<{ data: ApprovalMetricRow[] | null; error: { message: string } | null }>,
    ]);

  if (activationsErr || runsErr || approvalsErr) {
    return Response.json(
      { error: activationsErr?.message ?? runsErr?.message ?? approvalsErr?.message },
      { status: 500 },
    );
  }

  const runRows = runs ?? [];
  const runIds = runRows.map((r) => r.id);

  let events: RunEventRow[] = [];
  if (runIds.length > 0) {
    const { data: eventRows, error: eventsErr } = await db
      .from("aio_run_events")
      .select("run_id, type, occurred_at, sequence")
      .in("run_id", runIds)
      .in("type", ["message.delta", "message.completed"]);
    if (eventsErr) return Response.json({ error: eventsErr.message }, { status: 500 });
    events = eventRows ?? [];
  }

  const runsByCustomer = new Map<string, string[]>();
  for (const r of runRows) {
    const list = runsByCustomer.get(r.customer_id) ?? [];
    list.push(r.created_at);
    runsByCustomer.set(r.customer_id, list);
  }

  return Response.json({
    generatedAt: now.toISOString(),
    windowSince: since,
    activation: { count: activationCount(activations ?? []) },
    retention: computeRetention(activations ?? [], runsByCustomer),
    successByMode: computeSuccessByMode(runRows),
    runsPerActiveUser: computeRunsPerActiveUser(runRows),
    latency: computeLatencies(runRows, events),
    approvals: computeApprovalRates(approvals ?? []),
    costPerSuccessfulRunCredits: computeCostPerSuccess(runRows),
    topFailureCategories: computeTopFailureCategories(runRows),
    gaps: {
      citationInteraction:
        "not trackable yet — research sources (aio_research_sources) have no UI surface to click",
      imageGenerationSuccessRate:
        "not trackable yet — image generation does not create an aio_runs row, only successes are persisted to hermes_gallery_images",
    },
  });
}
