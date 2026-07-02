import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

interface WebhookEvent {
  type: string;
  customerId?: string;
  eventId?: string;
  planTier?: string;
  creditsGranted?: number;
}

let webhookEvent: WebhookEvent | Error = { type: "checkout.completed" };
let insertError: { code: string; message: string } | null = null;
const log: string[] = [];
const adjustCreditsCalls: Array<{ customerId: string; amount: number }> = [];

function makeDb() {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from(table: string): any {
      return {
        insert() {
          log.push(`insert:${table}`);
          return Promise.resolve({ error: insertError });
        },
        update(patch: unknown) {
          return {
            eq(col: string, val: string) {
              log.push(`update:${table}:${col}=${val}:${JSON.stringify(patch)}`);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

mock.module("@/lib/billing/payment-provider", {
  namedExports: {
    getPaymentProvider: () => ({
      handleWebhook: async () => {
        if (webhookEvent instanceof Error) throw webhookEvent;
        return webhookEvent;
      },
      createCheckoutSession: async () => {
        throw new Error("not used in this test");
      },
    }),
  },
});
mock.module("@/lib/hermes/billing", {
  namedExports: {
    serviceDb: () => makeDb(),
    adjustCredits: async (_db: unknown, customerId: string, amount: number) => {
      adjustCreditsCalls.push({ customerId, amount });
    },
  },
});
mock.module("@/lib/hermes/pricing", {
  namedExports: {
    tierConfig: () => ({ monthlyCredits: 6000 }),
  },
});

let POST: typeof import("./route").POST;
before(async () => {
  ({ POST } = await import("./route"));
});

function req(body = "{}") {
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    body,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

test("POST /api/billing/webhook returns 400 when the provider rejects the signature", async () => {
  webhookEvent = new Error("bad signature");
  const res = await POST(req());
  assert.equal(res.status, 400);
});

test("POST /api/billing/webhook is a no-op for event types other than checkout.completed", async () => {
  log.length = 0;
  adjustCreditsCalls.length = 0;
  webhookEvent = { type: "subscription.cancelled" };
  const res = await POST(req());
  assert.equal(res.status, 200);
  assert.equal(log.length, 0);
  assert.equal(adjustCreditsCalls.length, 0);
});

test("POST /api/billing/webhook grants the plan's monthly credits and updates plan_tier on a plan purchase", async () => {
  log.length = 0;
  adjustCreditsCalls.length = 0;
  insertError = null;
  webhookEvent = {
    type: "checkout.completed",
    customerId: "cust-1",
    eventId: "evt-1",
    planTier: "pro",
  };
  const res = await POST(req());
  assert.equal(res.status, 200);
  assert.ok(log.some((e) => e.startsWith("insert:aio_paddle_webhook_events")));
  assert.ok(log.some((e) => e.includes("hermes_registry") && e.includes("customer_id=cust-1")));
  assert.deepEqual(adjustCreditsCalls, [{ customerId: "cust-1", amount: 6000 }]);
});

test("POST /api/billing/webhook grants raw credits for a topup without touching plan_tier", async () => {
  log.length = 0;
  adjustCreditsCalls.length = 0;
  insertError = null;
  webhookEvent = {
    type: "checkout.completed",
    customerId: "cust-2",
    eventId: "evt-2",
    creditsGranted: 500,
  };
  const res = await POST(req());
  assert.equal(res.status, 200);
  assert.ok(!log.some((e) => e.includes("hermes_registry")));
  assert.deepEqual(adjustCreditsCalls, [{ customerId: "cust-2", amount: 500 }]);
});

test("POST /api/billing/webhook skips credit processing on a duplicate event id (redelivery)", async () => {
  log.length = 0;
  adjustCreditsCalls.length = 0;
  insertError = { code: "23505", message: "duplicate key" };
  webhookEvent = {
    type: "checkout.completed",
    customerId: "cust-3",
    eventId: "evt-1",
    planTier: "pro",
  };
  const res = await POST(req());
  assert.equal(res.status, 200);
  assert.equal(adjustCreditsCalls.length, 0);
});

test("POST /api/billing/webhook returns 500 when event-dedup tracking fails for a non-conflict reason", async () => {
  log.length = 0;
  adjustCreditsCalls.length = 0;
  insertError = { code: "500", message: "db unavailable" };
  webhookEvent = {
    type: "checkout.completed",
    customerId: "cust-4",
    eventId: "evt-4",
    planTier: "pro",
  };
  const res = await POST(req());
  assert.equal(res.status, 500);
  assert.equal(adjustCreditsCalls.length, 0);
});
