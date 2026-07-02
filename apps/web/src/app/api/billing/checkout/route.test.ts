import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

let currentUser: { id: string; email?: string } | null = null;
let checkoutResult: { url: string } | Error = { url: "https://checkout.example/session" };

mock.module("@/lib/supabase/server", {
  namedExports: {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: currentUser } }) },
    }),
  },
});
mock.module("@/lib/billing/payment-provider", {
  namedExports: {
    getPaymentProvider: () => ({
      createCheckoutSession: async () => {
        if (checkoutResult instanceof Error) throw checkoutResult;
        return checkoutResult;
      },
      handleWebhook: async () => {
        throw new Error("not used in this test");
      },
    }),
  },
});

let POST: typeof import("./route").POST;
before(async () => {
  ({ POST } = await import("./route"));
});

function req(body: unknown) {
  return new Request("http://localhost/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

test("POST /api/billing/checkout returns 401 when signed out", async () => {
  currentUser = null;
  const res = await POST(req({ kind: "plan", planTier: "pro" }));
  assert.equal(res.status, 401);
});

test("POST /api/billing/checkout requires planTier for kind=plan", async () => {
  currentUser = { id: "user-checkout-plan", email: "a@example.com" };
  const res = await POST(req({ kind: "plan" }));
  assert.equal(res.status, 400);
});

test("POST /api/billing/checkout requires topupCredits for kind=topup", async () => {
  currentUser = { id: "user-checkout-topup", email: "a@example.com" };
  const res = await POST(req({ kind: "topup" }));
  assert.equal(res.status, 400);
});

test("POST /api/billing/checkout returns the checkout session on success", async () => {
  currentUser = { id: "user-checkout-ok", email: "a@example.com" };
  checkoutResult = { url: "https://checkout.example/session" };
  const res = await POST(req({ kind: "plan", planTier: "pro" }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.url, checkoutResult.url);
});

test("POST /api/billing/checkout returns 502 when the provider throws", async () => {
  currentUser = { id: "user-checkout-fail", email: "a@example.com" };
  checkoutResult = new Error("provider down");
  const res = await POST(req({ kind: "plan", planTier: "pro" }));
  assert.equal(res.status, 502);
});
