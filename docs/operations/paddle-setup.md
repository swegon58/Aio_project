# Paddle seller account setup

**Owner:** `@swegon58`
**Last reviewed:** 2026-06-30

The billing code (`apps/web/src/lib/billing/payment-provider.ts`,
`apps/web/src/app/api/billing/webhook/route.ts`,
`apps/web/src/app/api/billing/checkout/route.ts`) is fully implemented and
unit tested against `aio_paddle_webhook_events` idempotency (migration
`0021`). It currently falls back to `DevNoopPaymentProvider` because no
Paddle account exists. This is the **owner action list** to close the R6.8
"billing sandbox end-to-end pass" and "webhook replay pass" gate items —
nothing here is engineering work, it is account creation and dashboard
configuration only.

## Quick checklist (tick off as you go)

- [ ] Paddle seller account created, KYC submitted
- [ ] Sandbox workspace selected (top-left workspace switcher in Paddle
      dashboard)
- [ ] 1 product + 4 prices created in sandbox, price ids copied
- [ ] Webhook endpoint added, subscribed to the 3 event types, signing
      secret copied
- [ ] Env vars set on the deployment, app restarted, `getPaymentProvider()`
      confirmed switched (see step 4 verification)
- [ ] Sandbox checkout completed with a test card, credit/plan change
      confirmed in the database
- [ ] Webhook manually resent from the dashboard, confirmed no double
      credit
- [ ] Result recorded in `R6_EXECUTION_CHECKLIST.md`
- [ ] (Later, separate pass) live mode repeated, env vars swapped to live

## 1. Create the seller account

1. Sign up at <https://www.paddle.com> as a Vietnam individual or business
   seller (per the locked decision in `payment-provider.ts`: Paddle as
   Merchant of Record, payout to VND via Wise). Expect ~10-30 minutes for
   the signup form itself.
2. Complete Paddle's KYC/onboarding (business details, payout method —
   select Wise if offered, otherwise note the alternative payout method
   here once chosen). KYC review by Paddle can take 1-3 business days —
   this is the long pole, not the form-filling; sandbox mode (step 3) is
   usable immediately while KYC is pending, so don't block on KYC to start
   testing.
3. Start in **Sandbox mode** first — use the workspace switcher in the
   top-left of the Paddle dashboard to confirm you're in "Sandbox", not
   "Live". Sandbox has its own separate API keys and price IDs from live;
   don't reuse one in the other.

## 2. Create products and prices (sandbox first)

Create one product with four prices, matching `apps/web/src/lib/hermes/pricing.ts`:

| Price | Plan tier | Monthly credits | Suggested use |
|---|---|---|---|
| `PADDLE_PRICE_ID_STARTER` | `starter` | 6,000 | Recurring monthly subscription price |
| `PADDLE_PRICE_ID_PRO` | `pro` | 14,000 | Recurring monthly subscription price |
| `PADDLE_PRICE_ID_BUSINESS` | `business` | 80,000 | Recurring monthly subscription price |
| `PADDLE_PRICE_ID_TOPUP` | n/a | — | One-time price, quantity = credits purchased (see `createCheckoutSession`'s `topupCredits` quantity) |

Copy each price's id from the Paddle dashboard.

## 3. Configure the webhook

1. In the Paddle dashboard, add a webhook endpoint pointing at:
   `https://<your-deployed-domain>/api/billing/webhook`
   (sandbox events go to the same route — Paddle sandbox and live both call
   it with `Paddle-Signature` headers; the code distinguishes by whichever
   key/secret pair is active).
2. Subscribe to at least: `transaction.completed`, `subscription.updated`,
   `subscription.canceled` (the three event types `handleWebhook` parses;
   see `payment-provider.ts` lines ~149-157).
3. Copy the webhook's signing secret.

## 4. Set environment variables

On the deployment (not committed — see `docs/operations/deployment.md` for
where env vars live):

```
PADDLE_API_KEY=<sandbox or live API key>
PADDLE_WEBHOOK_SECRET=<webhook signing secret from step 3>
PADDLE_PRICE_ID_STARTER=<price id>
PADDLE_PRICE_ID_PRO=<price id>
PADDLE_PRICE_ID_BUSINESS=<price id>
PADDLE_PRICE_ID_TOPUP=<price id>
```

Once `PADDLE_API_KEY` and `PADDLE_WEBHOOK_SECRET` are both set,
`getPaymentProvider()` automatically switches from `DevNoopPaymentProvider`
to `PaddlePaymentProvider` — no code change needed. Restart the app
process after setting env vars (env vars are read at process start, not
hot-reloaded). To verify the switch took effect without reading logs,
trigger a checkout and confirm it redirects to a real Paddle-hosted
checkout URL (`*.paddle.com`) instead of completing instantly — the
no-op provider grants credits with no redirect at all.

## 5. Run the sandbox end-to-end pass (closes the R6.8 gate item)

1. Sign in to the deployed app, trigger a checkout (`/api/billing/checkout`)
   for a plan or top-up.
2. Complete the Paddle sandbox hosted checkout with Paddle's test card
   numbers (see Paddle's sandbox card docs in their dashboard — typically
   `4242 4242 4242 4242`, any future expiry, any CVC; confirm the exact
   number in Paddle's current sandbox docs since test cards can change).
3. Confirm: `hermes_registry.credit_balance` increases (or `plan_tier`
   changes for a plan purchase) and a row appears in
   `aio_paddle_webhook_events`. Quick SQL check via the Supabase SQL editor:
   ```sql
   select credit_balance, plan_tier from hermes_registry where user_id = '<your test user id>';
   select * from aio_paddle_webhook_events order by created_at desc limit 5;
   ```
4. **Webhook replay pass**: in the Paddle dashboard, go to
   Developer Tools -> Notifications (or Webhooks, depending on Paddle's
   current nav) -> find the delivered event from step 1-3 -> "Resend".
   Confirm the credit grant does *not* double — re-run the same SQL query
   from step 3 and check `credit_balance` is unchanged from after step 3
   (not incremented again). The second delivery should hit the `23505`
   unique-violation path in `route.ts` and return `200 ok` without calling
   `adjustCredits` again.
5. If either check fails (credit balance wrong, no webhook-events row,
   or replay double-credits), stop and report back rather than proceeding
   to live mode — this indicates a real bug, not a config gap.
6. Record the result (pass/fail, date) in
   `docs/roadmap/R6_EXECUTION_CHECKLIST.md` under the R6.8 section.

## 6. Go live

Repeat steps 1-4 against Paddle's live mode once sandbox passes, then swap
the env vars to live keys/price ids. `isProductionDeployment()` already
throws if `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET` are unset in production
(see `payment-provider.ts` `getPaymentProvider()`), so there is no risk of
silently falling back to the dev no-op provider in production.
