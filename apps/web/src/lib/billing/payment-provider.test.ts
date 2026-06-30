import assert from "node:assert/strict";
import test from "node:test";

import { PaddlePaymentProvider } from "./payment-provider";

const WEBHOOK_SECRET = "test-webhook-secret";

async function signPayload(rawBody: string, ts: number): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${ts}:${rawBody}`));
  const h1 = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `ts=${ts};h1=${h1}`;
}

async function withPaddleEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prevApiKey = process.env.PADDLE_API_KEY;
  const prevSecret = process.env.PADDLE_WEBHOOK_SECRET;
  process.env.PADDLE_API_KEY = "test-api-key";
  process.env.PADDLE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  try {
    return await fn();
  } finally {
    process.env.PADDLE_API_KEY = prevApiKey;
    process.env.PADDLE_WEBHOOK_SECRET = prevSecret;
  }
}

test("handleWebhook parses the Paddle event_id for dedup", async () => {
  await withPaddleEnv(async () => {
    const provider = new PaddlePaymentProvider();
    const rawBody = JSON.stringify({
      event_id: "evt_01abc",
      event_type: "transaction.completed",
      data: { custom_data: { customerId: "cust_1", planTier: "starter" } },
    });
    const signature = await signPayload(rawBody, Math.floor(Date.now() / 1000));

    const event = await provider.handleWebhook(rawBody, { "paddle-signature": signature });

    assert.equal(event.type, "checkout.completed");
    assert.equal(event.eventId, "evt_01abc");
    assert.equal(event.customerId, "cust_1");
  });
});

test("handleWebhook rejects an invalid signature", async () => {
  await withPaddleEnv(async () => {
    const provider = new PaddlePaymentProvider();
    const rawBody = JSON.stringify({ event_id: "evt_02", event_type: "transaction.completed" });

    await assert.rejects(() => provider.handleWebhook(rawBody, { "paddle-signature": "ts=1;h1=deadbeef" }));
  });
});
