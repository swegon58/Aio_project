// Dev-only credit top-up route — exercises the credit-flow UI without a
// real payment provider (BUILD_SPEC §7 Q40, item 6). See
// src/lib/billing/payment-provider.ts (DevNoopPaymentProvider).
//
// GET so it can be hit directly as the "checkout" redirect target in dev;
// adds credits to the signed-in user's hermes_registry row and redirects
// back to the app. Disabled outside development.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adjustCredits, serviceDb } from "@/lib/hermes/billing";
import { creditsForUsd, tierConfig, type PlanTier } from "@/lib/hermes/pricing";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not available in production", { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "topup";
  const planTier = url.searchParams.get("planTier") as PlanTier | null;
  const explicitCredits = url.searchParams.get("credits");

  let credits: number;
  if (explicitCredits) {
    credits = Number(explicitCredits);
  } else if (kind === "plan" && planTier) {
    credits = tierConfig(planTier).monthlyCredits;
  } else {
    credits = creditsForUsd(5); // 🔢 default dev top-up: $5 worth of credits
  }

  const db = serviceDb();
  const patch: Record<string, unknown> = {};
  if (kind === "plan" && planTier) {
    patch.plan_tier = planTier;
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await db.from("hermes_registry").update(patch).eq("customer_id", user.id);
    if (error) return new Response(`Plan update failed: ${error.message}`, { status: 500 });
  }

  const balance = await adjustCredits(db, user.id, credits);

  return NextResponse.redirect(
    new URL(`/?dev_credits_added=${credits}&balance=${balance}`, req.url),
  );
}
