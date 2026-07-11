import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

interface WebhookEvent {
  type: string;
  customerId?: string;
  eventId?: string;
  planTier?: string;
  creditsGranted?: number;
}

interface ProcessCall {
  customerId: string;
  eventId: string;
  eventType: string;
  delta: number;
  planTier?: string;
}

let webhookEvent: WebhookEvent | Error = { type: "checkout.completed" };
let processResult: { credited: boolean; newBalance: number | null } | Error = {
  credited: true,
  newBalance: 100,
};
const processCalls: ProcessCall[] = [];

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
    serviceDb: () => ({}),
    processWebhookCredit: async (_db: unknown, params: ProcessCall) => {
      processCalls.push(params);
      if (processResult instanceof Error) throw processResult;
      return processResult;
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
  processCalls.length = 0;
  webhookEvent = { type: "subscription.cancelled" };
  const res = await POST(req());
  assert.equal(res.status, 200);
  assert.equal(processCalls.length, 0);
});

test("POST /api/billing/webhook grants the plan's monthly credits and updates plan_tier on a plan purchase", async () => {
  processCalls.length = 0;
  processResult = { credited: true, newBalance: 6000 };
  webhookEvent = {
    type: "checkout.completed",
    customerId: "cust-1",
    eventId: "evt-1",
    planTier: "pro",
  };
  const res = await POST(req());
  assert.equal(res.status, 200);
  assert.deepEqual(processCalls, [
    { customerId: "cust-1", eventId: "evt-1", eventType: "checkout.completed", delta: 6000, planTier: "pro" },
  ]);
});

test("POST /api/billing/webhook grants raw credits for a topup without touching plan_tier", async () => {
  processCalls.length = 0;
  processResult = { credited: true, newBalance: 500 };
  webhookEvent = {
    type: "checkout.completed",
    customerId: "cust-2",
    eventId: "evt-2",
    creditsGranted: 500,
  };
  const res = await POST(req());
  assert.equal(res.status, 200);
  assert.deepEqual(processCalls, [
    { customerId: "cust-2", eventId: "evt-2", eventType: "checkout.completed", delta: 500, planTier: undefined },
  ]);
});

test("POST /api/billing/webhook skips crediting on a duplicate event id (redelivery) without erroring", async () => {
  processCalls.length = 0;
  processResult = { credited: false, newBalance: null };
  webhookEvent = {
    type: "checkout.completed",
    customerId: "cust-3",
    eventId: "evt-1",
    planTier: "pro",
  };
  const res = await POST(req());
  assert.equal(res.status, 200);
  assert.equal(processCalls.length, 1);
});

test("POST /api/billing/webhook rejects a checkout.completed event with no eventId instead of crediting uninsured", async () => {
  processCalls.length = 0;
  webhookEvent = {
    type: "checkout.completed",
    customerId: "cust-5",
    creditsGranted: 500,
  };
  const res = await POST(req());
  assert.equal(res.status, 400);
  assert.equal(processCalls.length, 0);
});

test("POST /api/billing/webhook returns 500 when webhook credit processing fails for a non-conflict reason", async () => {
  processCalls.length = 0;
  processResult = new Error("db unavailable");
  webhookEvent = {
    type: "checkout.completed",
    customerId: "cust-4",
    eventId: "evt-4",
    planTier: "pro",
  };
  const res = await POST(req());
  assert.equal(res.status, 500);
});
