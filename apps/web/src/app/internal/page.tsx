// R3.5 — Internal observability dashboard (not in consumer nav).
//
// Owner-only view: shows run counts, latency, approval funnel, and credit
// efficiency. Gated server-side; unauthorized users see a blank 403 page.
//
// Access: /internal — requires AIO_OWNER_EMAIL to match the signed-in user,
// or pass x-aio-internal-secret header for programmatic access.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const OWNER_EMAIL = process.env.AIO_OWNER_EMAIL ?? "";

interface RunWindow {
  window: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
  p50_ms: number | null;
  p99_ms: number | null;
  error?: string;
}

interface ApprovalWindow {
  window: string;
  total: number;
  approved: number;
  rejected: number;
  expired: number;
  pending: number;
  error?: string;
}

interface MetricsPayload {
  generatedAt: string;
  runs: RunWindow[];
  approvals: ApprovalWindow[];
  cost_30d: {
    actual_credits: number;
    reserved_credits: number;
    efficiency_pct: number | null;
  };
}

function fmt(n: number | null, unit = "") {
  if (n === null) return "—";
  return `${n.toLocaleString()}${unit}`;
}

function pct(n: number, total: number) {
  if (!total) return "—";
  return `${Math.round((n / total) * 100)}%`;
}

export default async function InternalObservabilityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || (OWNER_EMAIL && user.email !== OWNER_EMAIL)) {
    redirect("/login");
  }

  let metrics: MetricsPayload | null = null;
  let fetchError: string | null = null;

  try {
    // Server component: call the metrics API internally via relative path.
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/internal/metrics`,
      {
        headers: { "x-aio-internal-secret": process.env.AIO_INTERNAL_SECRET ?? "" },
        cache: "no-store",
      },
    );
    if (res.ok) {
      metrics = (await res.json()) as MetricsPayload;
    } else {
      fetchError = `API returned ${res.status}`;
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "fetch failed";
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-mono">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Aio — Internal Observability</h1>
        <p className="text-neutral-500 text-sm mt-1">
          {metrics ? `Generated ${new Date(metrics.generatedAt).toLocaleString()}` : "—"}
        </p>
        {fetchError && (
          <p className="text-red-400 text-sm mt-2">Error: {fetchError}</p>
        )}
      </header>

      {metrics && (
        <div className="space-y-10">
          {/* Run stats */}
          <section>
            <h2 className="text-lg font-medium mb-3 text-neutral-300">Run Counts &amp; Latency</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-neutral-400 border-b border-neutral-800">
                    <th className="text-left py-2 pr-6">Window</th>
                    <th className="text-right pr-6">Total</th>
                    <th className="text-right pr-6">Completed</th>
                    <th className="text-right pr-6">Failed</th>
                    <th className="text-right pr-6">Running</th>
                    <th className="text-right pr-6">Completion %</th>
                    <th className="text-right pr-6">P50 ms</th>
                    <th className="text-right">P99 ms</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.runs.map((row) => (
                    <tr key={row.window} className="border-b border-neutral-900 hover:bg-neutral-900/50">
                      <td className="py-2 pr-6 text-neutral-200 font-medium">{row.window}</td>
                      <td className="text-right pr-6">{row.error ? "—" : fmt(row.total)}</td>
                      <td className="text-right pr-6 text-emerald-400">{row.error ? "—" : fmt(row.completed)}</td>
                      <td className="text-right pr-6 text-red-400">{row.error ? "—" : fmt(row.failed)}</td>
                      <td className="text-right pr-6 text-amber-400">{row.error ? "—" : fmt(row.running)}</td>
                      <td className="text-right pr-6">{row.error ? "—" : pct(row.completed, row.total)}</td>
                      <td className="text-right pr-6">{row.error ? "—" : fmt(row.p50_ms, " ms")}</td>
                      <td className="text-right">{row.error ? "—" : fmt(row.p99_ms, " ms")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Approval funnel */}
          <section>
            <h2 className="text-lg font-medium mb-3 text-neutral-300">Approval Funnel</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-neutral-400 border-b border-neutral-800">
                    <th className="text-left py-2 pr-6">Window</th>
                    <th className="text-right pr-6">Total</th>
                    <th className="text-right pr-6">Approved</th>
                    <th className="text-right pr-6">Rejected</th>
                    <th className="text-right pr-6">Expired</th>
                    <th className="text-right pr-6">Pending</th>
                    <th className="text-right">Grant rate</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.approvals.map((row) => (
                    <tr key={row.window} className="border-b border-neutral-900 hover:bg-neutral-900/50">
                      <td className="py-2 pr-6 text-neutral-200 font-medium">{row.window}</td>
                      <td className="text-right pr-6">{row.error ? "—" : fmt(row.total)}</td>
                      <td className="text-right pr-6 text-emerald-400">{row.error ? "—" : fmt(row.approved)}</td>
                      <td className="text-right pr-6 text-red-400">{row.error ? "—" : fmt(row.rejected)}</td>
                      <td className="text-right pr-6 text-amber-400">{row.error ? "—" : fmt(row.expired)}</td>
                      <td className="text-right pr-6 text-blue-400">{row.error ? "—" : fmt(row.pending)}</td>
                      <td className="text-right">{row.error ? "—" : pct(row.approved, row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Cost efficiency (30d) */}
          <section>
            <h2 className="text-lg font-medium mb-3 text-neutral-300">Credit Efficiency (30 d)</h2>
            <dl className="grid grid-cols-3 gap-4">
              <div className="bg-neutral-900 rounded-lg p-4">
                <dt className="text-neutral-500 text-xs mb-1">Actual credits spent</dt>
                <dd className="text-2xl font-semibold">{fmt(metrics.cost_30d.actual_credits)}</dd>
              </div>
              <div className="bg-neutral-900 rounded-lg p-4">
                <dt className="text-neutral-500 text-xs mb-1">Reserved credits</dt>
                <dd className="text-2xl font-semibold">{fmt(metrics.cost_30d.reserved_credits)}</dd>
              </div>
              <div className="bg-neutral-900 rounded-lg p-4">
                <dt className="text-neutral-500 text-xs mb-1">Efficiency</dt>
                <dd className="text-2xl font-semibold">
                  {metrics.cost_30d.efficiency_pct !== null
                    ? `${metrics.cost_30d.efficiency_pct}%`
                    : "—"}
                </dd>
              </div>
            </dl>
            <p className="text-neutral-600 text-xs mt-2">
              Efficiency = actual / reserved — low means conservative over-reservation (good);
              above 100% means a run ran over budget.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
