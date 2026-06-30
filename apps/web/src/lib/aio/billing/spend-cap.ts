// R6.8 beta gate: per-customer lifetime spend cap. Off by default — only
// enforced when AIO_BETA_SPEND_CAP_CREDITS is set to a positive number,
// which the owner configures for the limited-cohort beta. Reuses
// aio_runs.actual_credits (already settled per run, see weekly-metrics.ts)
// instead of adding a new running-total column.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SpendCapResult {
  ok: boolean;
  capCredits: number | null;
  spentCredits: number;
}

export function configuredSpendCapCredits(): number | null {
  const raw = process.env.AIO_BETA_SPEND_CAP_CREDITS;
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function checkSpendCap(db: SupabaseClient, customerId: string): Promise<SpendCapResult> {
  const capCredits = configuredSpendCapCredits();
  if (capCredits === null) return { ok: true, capCredits: null, spentCredits: 0 };

  const { data, error } = await db
    .from("aio_runs")
    .select("actual_credits")
    .eq("customer_id", customerId)
    .eq("status", "completed");
  if (error) throw new Error(`Spend cap lookup failed: ${error.message}`);

  const spentCredits = (data ?? []).reduce(
    (sum: number, r: { actual_credits: number | null }) => sum + (r.actual_credits ?? 0),
    0,
  );
  return { ok: spentCredits < capCredits, capCredits, spentCredits };
}
