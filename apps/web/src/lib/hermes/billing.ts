// Aio × Hermes — credit accounting (BUILD_SPEC §7 Q16/Q29).
//
// Credits are a prepaid balance on hermes_registry.credit_balance (1 credit
// = $0.001 raw OpenRouter cost, pre-markup — see pricing.ts). This module
// implements:
//   - pre-task estimate check (item 1)
//   - speculative pre-deduction + settlement (item 3)
//   - failed-task full refund (Q29, item 3)
//   - actual-cost lookup via OpenRouter's /api/v1/generation endpoint
//     (Helicone substitute — Q24 was skipped for Phase 1, see decision note
//     in apps/harness/CLAUDE.md)

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type PlanTier,
  creditsForUsd,
  estimateTaskCreditCost,
  tierConfig,
} from "./pricing";
import { type HermesRegistryRow, serviceDb } from "./registry";

export interface CreditCheckResult {
  ok: boolean;
  estimate: number;
  balance: number;
}

// Item 1: pre-task credit estimate + balance check. Called before proxying
// to Hermes. Returns ok=false (and a clear message via the caller) if the
// customer cannot afford even the rough ceiling for this tier.
export function checkCreditBalance(row: HermesRegistryRow): CreditCheckResult {
  const tier = (row.plan_tier as PlanTier) ?? "starter";
  const estimate = estimateTaskCreditCost(tier);
  return { ok: row.credit_balance >= estimate, estimate, balance: row.credit_balance };
}

// Speculative pre-deduction: reserve the estimated cost up-front so a
// crash mid-task (Q39, no half-state resume) still leaves the balance
// accounted for — reconcile (settleTask / refundTask) corrects it
// afterwards. Returns the new balance.
export async function reserveCredits(
  db: SupabaseClient,
  customerId: string,
  amount: number,
): Promise<number> {
  const { data, error } = await db.rpc("hermes_adjust_credit_balance", {
    p_customer_id: customerId,
    p_delta: -amount,
  });
  if (error) throw new Error(`Credit reservation failed: ${error.message}`);
  return data as number;
}

// Adjusts credit_balance by `delta` (positive = add, negative = deduct).
export async function adjustCredits(
  db: SupabaseClient,
  customerId: string,
  delta: number,
): Promise<number> {
  const { data, error } = await db.rpc("hermes_adjust_credit_balance", {
    p_customer_id: customerId,
    p_delta: delta,
  });
  if (error) throw new Error(`Credit adjustment failed: ${error.message}`);
  return data as number;
}

// Item 3 (failure path, Q29): full refund of the reserved estimate. Called
// when a proxied task errors out (Hermes 5xx, stream error, timeout abort).
export async function refundTask(
  db: SupabaseClient,
  customerId: string,
  reservedAmount: number,
): Promise<void> {
  await adjustCredits(db, customerId, reservedAmount);
}

// Item 3 (success path): settle the reservation against actual cost.
// `actualCredits` comes from OpenRouter usage lookup (or falls back to the
// reserved estimate if usage data isn't available yet — see
// fetchActualCostCredits). delta = reserved - actual is refunded (positive)
// or, if actual > reserved (rare — estimate was a ceiling), no further
// charge is taken beyond the reservation (Phase 1: never charge more than
// the pre-task estimate without a "continue?" prompt, item 2b).
export async function settleTask(
  db: SupabaseClient,
  customerId: string,
  reservedAmount: number,
  actualCredits: number,
): Promise<void> {
  const actual = Math.min(actualCredits, reservedAmount);
  const refund = reservedAmount - actual;
  if (refund > 0) {
    await adjustCredits(db, customerId, refund);
  }
}

// Free trial grant (Q22): on first provisioning, grant FREE_TRIAL_CREDITS
// once. free_grant_used flag (tied into Sybil normalized-email dedup,
// Q30/Step 3a) prevents re-grant on respawn / repeated ensureRegistryRow
// calls.
export async function grantFreeTrialIfNeeded(
  db: SupabaseClient,
  row: HermesRegistryRow,
): Promise<HermesRegistryRow> {
  if (row.free_grant_used) return row;

  const { FREE_TRIAL_CREDITS } = await import("./pricing");
  const { error } = await db
    .from("hermes_registry")
    .update({
      credit_balance: row.credit_balance + FREE_TRIAL_CREDITS,
      free_grant_used: true,
    })
    .eq("customer_id", row.customer_id);
  if (error) throw new Error(`Free-trial grant failed: ${error.message}`);

  return {
    ...row,
    credit_balance: row.credit_balance + FREE_TRIAL_CREDITS,
    free_grant_used: true,
  };
}

// --- Actual cost lookup (OpenRouter usage, Helicone substitute) -----------
//
// Q24 (Helicone) was SKIPPED for Phase 1 (decisions-log Q24 batch 2 / no
// signup attempted). Substitute: OpenRouter's per-key `/api/v1/key` endpoint
// reports cumulative `usage` (USD spent) for the bearer key used. Because
// each customer profile has its own OpenRouter key (Q15), the delta in
// cumulative usage across a single request brackets that request's actual
// cost. This is coarser than Helicone's per-request breakdown but requires
// no external account.
export interface OpenRouterKeyUsage {
  usageUsd: number;
  limitUsd: number | null;
}

export async function fetchOpenRouterKeyUsage(
  openrouterApiKey: string,
): Promise<OpenRouterKeyUsage | null> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${openrouterApiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data ?? {};
    return {
      usageUsd: typeof data.usage === "number" ? data.usage : 0,
      limitUsd: typeof data.limit === "number" ? data.limit : null,
    };
  } catch {
    return null;
  }
}

// Computes actual task cost in credits by diffing OpenRouter cumulative
// key-usage before/after the task, with the tier's markup applied. Falls
// back to `reservedAmount` (i.e. settle at the pre-task estimate, no extra
// refund/charge) if usage data isn't available — documented gap, see
// BUILD_SPEC §13.
export function actualCostCreditsFromUsageDelta(
  usageBeforeUsd: number | null,
  usageAfterUsd: number | null,
  reservedAmount: number,
  planTier: PlanTier,
): number {
  if (usageBeforeUsd == null || usageAfterUsd == null) return reservedAmount;
  const deltaUsd = Math.max(0, usageAfterUsd - usageBeforeUsd);
  const markup = tierConfig(planTier).markup;
  return Math.max(0, Math.round(creditsForUsd(deltaUsd) * markup));
}

export { serviceDb };
