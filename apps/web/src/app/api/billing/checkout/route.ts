// Creates a hosted checkout session (plan purchase or credit top-up) via
// the active PaymentProvider (Paddle once configured, dev no-op otherwise —
// see src/lib/billing/payment-provider.ts).

import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/billing/payment-provider";
import type { PlanTier } from "@/lib/hermes/pricing";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const kind = body?.kind === "topup" ? "topup" : "plan";
  const planTier = body?.planTier as PlanTier | undefined;
  const topupCredits = typeof body?.topupCredits === "number" ? body.topupCredits : undefined;

  if (kind === "plan" && !planTier) {
    return new Response("planTier required for kind=plan", { status: 400 });
  }
  if (kind === "topup" && !topupCredits) {
    return new Response("topupCredits required for kind=topup", { status: 400 });
  }

  try {
    const session = await getPaymentProvider().createCheckoutSession({
      customerId: user.id,
      email: user.email,
      kind,
      planTier,
      topupCredits,
    });
    return Response.json(session);
  } catch (err) {
    return new Response(`Checkout session creation failed: ${(err as Error).message}`, { status: 502 });
  }
}
