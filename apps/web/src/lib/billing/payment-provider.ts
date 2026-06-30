// Aio — payment processor integration point (BUILD_SPEC §7 Q40).
//
// Locked decision: Merchant of Record — Paddle (primary) / Lemon Squeezy
// (fallback), payout to VND via Wise. No real account/credentials exist yet —
// user needs to create a Paddle seller account (Vietnam individual/business
// onboarding) and set PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, and
// PADDLE_PRICE_ID_STARTER/PRO/BUSINESS/TOPUP env vars before this goes live.
//
// This module defines the interface the rest of Aio (checkout UI, webhook
// route) talks to, plus a dev-only no-op implementation so the credit-flow
// UI can be exercised locally without a real payment provider.

import type { PlanTier } from "@/lib/hermes/pricing";
import { isProductionDeployment } from "@/lib/aio/config/production-guard.mjs";

export interface CheckoutSession {
  /** URL to redirect the customer to for hosted checkout. */
  url: string;
  /** Provider-side session/transaction id, for reconciliation. */
  providerSessionId: string;
}

export interface CreateCheckoutParams {
  customerId: string;
  email: string;
  /** Monthly plan purchase, or a one-off credit top-up. */
  kind: "plan" | "topup";
  planTier?: PlanTier;
  /** For "topup": credits to grant on success (see pricing.ts conversion). */
  topupCredits?: number;
}

export interface WebhookEvent {
  type: "checkout.completed" | "subscription.updated" | "subscription.cancelled" | "unknown";
  /** Provider-stable per-delivery id, used to dedup retried webhook deliveries. */
  eventId: string | null;
  customerId: string | null;
  planTier?: PlanTier;
  creditsGranted?: number;
  raw: unknown;
}

export interface PaymentProvider {
  /** Creates a hosted checkout session for a plan purchase or credit top-up. */
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession>;

  /** Verifies + parses a provider webhook payload into a normalized event. */
  handleWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookEvent>;
}

// Dev/local no-op implementation. createCheckoutSession returns a fake URL
// pointing at the dev add-credits route (see
// src/app/api/dev/add-credits/route.ts) so the credit-flow UI is testable
// end-to-end without a real payment provider. handleWebhook is unreachable
// in this implementation (no real webhooks arrive).
export class DevNoopPaymentProvider implements PaymentProvider {
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const providerSessionId = `dev_${Date.now()}`;
    const query = new URLSearchParams({
      customerId: params.customerId,
      kind: params.kind,
      ...(params.planTier ? { planTier: params.planTier } : {}),
      ...(params.topupCredits ? { credits: String(params.topupCredits) } : {}),
    });
    return {
      url: `/api/dev/add-credits?${query.toString()}`,
      providerSessionId,
    };
  }

  async handleWebhook(): Promise<WebhookEvent> {
    return { type: "unknown", eventId: null, customerId: null, raw: null };
  }
}

// Paddle Billing (Merchant of Record). Activates once PADDLE_API_KEY +
// PADDLE_WEBHOOK_SECRET + per-tier PADDLE_PRICE_ID_* env vars are set —
// until then getPaymentProvider() falls back to DevNoopPaymentProvider.
// Paddle API docs: https://developer.paddle.com/api-reference/overview
const PADDLE_API_BASE = "https://api.paddle.com";

function paddlePriceId(kind: "plan" | "topup", planTier?: PlanTier): string {
  const key =
    kind === "topup"
      ? "PADDLE_PRICE_ID_TOPUP"
      : `PADDLE_PRICE_ID_${(planTier ?? "starter").toUpperCase()}`;
  const id = process.env[key];
  if (!id) throw new Error(`Missing env var ${key} for Paddle checkout`);
  return id;
}

export class PaddlePaymentProvider implements PaymentProvider {
  private apiKey: string;
  private webhookSecret: string;

  constructor() {
    const apiKey = process.env.PADDLE_API_KEY;
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
    if (!apiKey || !webhookSecret) {
      throw new Error("PADDLE_API_KEY / PADDLE_WEBHOOK_SECRET not set");
    }
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const priceId = paddlePriceId(params.kind, params.planTier);
    const quantity = params.kind === "topup" ? (params.topupCredits ?? 1) : 1;

    const res = await fetch(`${PADDLE_API_BASE}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity }],
        customer: { email: params.email },
        custom_data: {
          customerId: params.customerId,
          kind: params.kind,
          ...(params.planTier ? { planTier: params.planTier } : {}),
          ...(params.topupCredits ? { topupCredits: params.topupCredits } : {}),
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`Paddle createCheckoutSession failed: ${res.status} ${await res.text()}`);
    }
    const body = await res.json();
    return {
      url: body.data.checkout.url,
      providerSessionId: body.data.id,
    };
  }

  async handleWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookEvent> {
    const signatureHeader = headers["paddle-signature"] ?? headers["Paddle-Signature"];
    if (!signatureHeader || !(await this.verifySignature(rawBody, signatureHeader))) {
      throw new Error("Invalid Paddle webhook signature");
    }

    const payload = JSON.parse(rawBody);
    const eventId: string | null = payload.event_id ?? null;
    const customerId: string | null = payload.data?.custom_data?.customerId ?? null;
    const planTier: PlanTier | undefined = payload.data?.custom_data?.planTier;
    const creditsGranted: number | undefined = payload.data?.custom_data?.topupCredits;

    switch (payload.event_type) {
      case "transaction.completed":
        return { type: "checkout.completed", eventId, customerId, planTier, creditsGranted, raw: payload };
      case "subscription.updated":
        return { type: "subscription.updated", eventId, customerId, planTier, raw: payload };
      case "subscription.canceled":
        return { type: "subscription.cancelled", eventId, customerId, planTier, raw: payload };
      default:
        return { type: "unknown", eventId, customerId, raw: payload };
    }
  }

  // Paddle-Signature header format: "ts=<unix>;h1=<hex hmac>"
  // HMAC-SHA256 over `${ts}:${rawBody}` using the webhook secret.
  private async verifySignature(rawBody: string, signatureHeader: string): Promise<boolean> {
    const parts = Object.fromEntries(
      signatureHeader.split(";").map((p) => p.split("=") as [string, string])
    );
    const ts = parts.ts;
    const h1 = parts.h1;
    if (!ts || !h1) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${ts}:${rawBody}`));
    const expected = Array.from(new Uint8Array(signed))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return expected === h1;
  }
}

export function getPaymentProvider(): PaymentProvider {
  if (process.env.PADDLE_API_KEY && process.env.PADDLE_WEBHOOK_SECRET) {
    return new PaddlePaymentProvider();
  }
  if (isProductionDeployment()) {
    throw new Error("Paddle is required in production; development payment fallback is disabled.");
  }
  return new DevNoopPaymentProvider();
}
