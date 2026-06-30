// Payment-provider webhook receiver (Paddle once configured — see
// src/lib/billing/payment-provider.ts). No user session here: the provider
// calls this directly, auth is via signature verification inside
// handleWebhook(). Grants credits / updates plan_tier on success events.

import { getPaymentProvider } from "@/lib/billing/payment-provider";
import { adjustCredits, serviceDb } from "@/lib/hermes/billing";
import { tierConfig, type PlanTier } from "@/lib/hermes/pricing";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => { headers[key] = value; });

  let event;
  try {
    event = await getPaymentProvider().handleWebhook(rawBody, headers);
  } catch (err) {
    return new Response(`Webhook rejected: ${(err as Error).message}`, { status: 400 });
  }

  if (event.type === "checkout.completed" && event.customerId) {
    const db = serviceDb();

    // Paddle retries webhook deliveries on a non-2xx response, which would
    // otherwise re-run the credit grant below. Insert the event id first and
    // skip processing on conflict so a redelivery is a no-op.
    if (event.eventId) {
      const { error: insertError } = await db
        .from("aio_paddle_webhook_events")
        .insert({ paddle_event_id: event.eventId, event_type: event.type });
      if (insertError) {
        if (insertError.code === "23505") {
          return new Response("ok", { status: 200 });
        }
        return new Response(`Webhook event tracking failed: ${insertError.message}`, { status: 500 });
      }
    }

    if (event.planTier) {
      await db.from("hermes_registry").update({ plan_tier: event.planTier }).eq("customer_id", event.customerId);
      await adjustCredits(db, event.customerId, tierConfig(event.planTier as PlanTier).monthlyCredits);
    } else if (event.creditsGranted) {
      await adjustCredits(db, event.customerId, event.creditsGranted);
    }
  }

  return new Response("ok", { status: 200 });
}
