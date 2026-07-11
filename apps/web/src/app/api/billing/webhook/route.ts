// Payment-provider webhook receiver (Paddle once configured — see
// src/lib/billing/payment-provider.ts). No user session here: the provider
// calls this directly, auth is via signature verification inside
// handleWebhook(). Grants credits / updates plan_tier on success events.

import { getPaymentProvider } from "@/lib/billing/payment-provider";
import { processWebhookCredit, serviceDb } from "@/lib/hermes/billing";
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
    // Dedup depends on eventId; without it a redelivery would credit twice
    // with no way to detect the replay, so refuse rather than credit uninsured.
    if (!event.eventId) {
      return new Response("Webhook event missing eventId, refusing to process", { status: 400 });
    }

    const delta = event.planTier
      ? tierConfig(event.planTier as PlanTier).monthlyCredits
      : event.creditsGranted;

    if (delta) {
      // Dedup-insert and credit grant happen atomically in one RPC (0034) —
      // a crash between them under the old two-step version could
      // double-credit on Paddle's retry or silently drop the grant.
      try {
        await processWebhookCredit(serviceDb(), {
          customerId: event.customerId,
          eventId: event.eventId,
          eventType: event.type,
          delta,
          planTier: event.planTier,
        });
      } catch (err) {
        return new Response(`Webhook credit processing failed: ${(err as Error).message}`, { status: 500 });
      }
    }
  }

  return new Response("ok", { status: 200 });
}
