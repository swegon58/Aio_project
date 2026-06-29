// R3.5 — Internal observability metrics endpoint.
//
// Gate: either AIO_INTERNAL_SECRET header matches the env var, OR the
// authenticated user's email matches AIO_OWNER_EMAIL. Never exposed in
// the consumer nav — this is an operator-only diagnostic view.
//
// Returns aggregated run stats from Postgres (no raw prompt data, no PII).

import { createClient } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/hermes/billing";

const INTERNAL_SECRET = process.env.AIO_INTERNAL_SECRET ?? "";
const OWNER_EMAIL = process.env.AIO_OWNER_EMAIL ?? "";

async function isAuthorized(req: Request): Promise<boolean> {
  const secretHeader = req.headers.get("x-aio-internal-secret") ?? "";
  if (INTERNAL_SECRET && secretHeader === INTERNAL_SECRET) return true;

  if (!OWNER_EMAIL) return false;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === OWNER_EMAIL;
}

export async function GET(req: Request) {
  if (!(await isAuthorized(req))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const db = serviceDb();

  // Rolling windows: 24 h, 7 d, 30 d.
  const now = new Date();
  const windows = {
    "24h": new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    "7d": new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    "30d": new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  // Aggregate run counts and latency from aio_runs.
  const runStats = await Promise.all(
    Object.entries(windows).map(async ([label, since]) => {
      const { data, error } = await db
        .from("aio_runs")
        .select("status, created_at, completed_at")
        .gte("created_at", since);

      if (error || !data) return { window: label, error: error?.message };

      const total = data.length;
      const completed = data.filter((r) => r.status === "completed").length;
      const failed = data.filter((r) => r.status === "failed").length;
      const running = data.filter((r) => r.status === "running").length;

      const latencies = data
        .filter((r) => r.completed_at && r.created_at)
        .map((r) => new Date(r.completed_at!).getTime() - new Date(r.created_at).getTime())
        .sort((a, b) => a - b);

      const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : null;
      const p99 = latencies.length ? latencies[Math.floor(latencies.length * 0.99)] : null;

      return { window: label, total, completed, failed, running, p50_ms: p50, p99_ms: p99 };
    }),
  );

  // Approval stats from aio_approvals.
  const approvalStats = await Promise.all(
    Object.entries(windows).map(async ([label, since]) => {
      const { data, error } = await db
        .from("aio_approvals")
        .select("status")
        .gte("created_at", since);

      if (error || !data) return { window: label, error: error?.message };

      return {
        window: label,
        total: data.length,
        approved: data.filter((a) => a.status === "approved").length,
        rejected: data.filter((a) => a.status === "rejected").length,
        expired: data.filter((a) => a.status === "expired").length,
        pending: data.filter((a) => a.status === "requested").length,
      };
    }),
  );

  // Credit/cost aggregate from aio_runs (settled actual_credits field).
  const { data: creditData } = await db
    .from("aio_runs")
    .select("actual_credits, reserved_credits")
    .gte("created_at", windows["30d"])
    .eq("status", "completed");

  const totalActualCredits = creditData?.reduce(
    (sum, r) => sum + (typeof r.actual_credits === "number" ? r.actual_credits : 0),
    0,
  ) ?? 0;
  const totalReservedCredits = creditData?.reduce(
    (sum, r) => sum + (typeof r.reserved_credits === "number" ? r.reserved_credits : 0),
    0,
  ) ?? 0;

  return Response.json({
    generatedAt: now.toISOString(),
    runs: runStats,
    approvals: approvalStats,
    cost_30d: {
      actual_credits: totalActualCredits,
      reserved_credits: totalReservedCredits,
      efficiency_pct: totalReservedCredits > 0
        ? Math.round((totalActualCredits / totalReservedCredits) * 100)
        : null,
    },
  });
}
