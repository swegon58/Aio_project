import { createClient } from "@/lib/supabase/server";
import { getRegistryRow, serviceDb } from "@/lib/hermes/registry";
import { nextMonthlyResetAt, usedPercentForTier } from "@/lib/hermes/pricing";
import type { HermesCreditsData } from "@/lib/hermes/chat-types";

// Lightweight initial-balance read for the /app usage meter (AppHome).
// Deliberately does NOT call resolveHermesRequestContext / ensureRunning —
// this only needs to read hermes_registry, it must not trigger a gateway
// spawn just because the user opened the page.
const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

export async function GET() {
  if (DEV_BYPASS) {
    const data: HermesCreditsData = {
      balance: 9999,
      usedPercent: 0,
      resetAt: nextMonthlyResetAt(),
      planTier: "pro",
    };
    return Response.json(data);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const row = await getRegistryRow(serviceDb(), user.id);
  if (!row) {
    return new Response("No Hermes registry row yet", { status: 404 });
  }

  const data: HermesCreditsData = {
    balance: row.credit_balance,
    usedPercent: usedPercentForTier(row.plan_tier, row.credit_balance),
    resetAt: nextMonthlyResetAt(),
    planTier: row.plan_tier,
  };
  return Response.json(data);
}
