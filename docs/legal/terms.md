# Aio Terms of Service

> **STATUS: UNREVIEWED DRAFT.** This text has not been reviewed by a
> qualified lawyer and must not be published, linked from the product, or
> relied on as a binding agreement until that review happens. Per
> `AIO_MASTER_EXECUTION_PLAN.md` R6.5, "legal text requires qualified review
> before public launch." This draft exists so the wording can start that
> review, and so it reflects what the product actually does today rather
> than generic boilerplate.

**Last drafted:** 2026-06-30

## 1. What Aio is

Aio is a consumer AI agent product. You send it tasks in chat; it plans,
calls tools, and runs research/automation on your behalf, optionally on a
schedule. It is not a developer or operations console.

## 2. Accounts

You sign in via Supabase-backed authentication. You're responsible for
keeping your credentials and any connected provider API keys confidential.
We may suspend an account for abuse, non-payment, or activity that breaches
the [Acceptable Use Policy](./acceptable-use-policy.md).

## 3. Plans, credits, and billing

Paid plans and credit purchases are processed by Paddle as our
merchant-of-record. Credits are consumed per task based on the work Aio
performs (model calls, tool runs). Billing cycles, plan tiers, and credit
balances are shown in-product under Settings -> Plan. Refunds follow
Paddle's standard buyer policies unless we state otherwise in writing.

## 4. Your content

You own the prompts, files, and knowledge sources you provide, and the
outputs Aio produces for you. You're responsible for having the rights to
anything you upload (knowledge sources, images, connected accounts).

## 5. Model providers and outputs

Aio routes requests to local models (LM Studio) or cloud model providers
(OpenRouter-compatible providers) depending on configuration, and to
Kie.ai for image generation. Output quality, accuracy, and availability
depend on these upstream providers and are not guaranteed. Do not rely on
Aio's output for decisions where being wrong causes serious harm (medical,
legal, financial, safety-critical) without independent verification.

## 6. Saved Agents and automation

Features like Saved Agents (reusable instruction bundles) and scheduled
tasks run with your account's permissions. You are responsible for what
you configure them to do, including any tools you allow them to call.

## 7. Data export and deletion

You can export your account data and delete your account and its data
at any time from Settings -> Data & Privacy. See the
[Privacy Policy](./privacy-policy.md) for what's included and what
happens on deletion.

## 8. Termination

Either party may stop using/offering the service at any time. On account
deletion, your data is removed per the Privacy Policy's retention terms.

## 9. Disclaimers and liability

Aio is provided as-is, without warranty of any kind, during this beta
period. To the extent permitted by law, we are not liable for indirect,
incidental, or consequential damages arising from use of the service.

## 10. Changes

We may update these terms. Material changes will be reflected here with
an updated "Last drafted" date; this document is not yet wired to any
in-product notification of changes.

## 11. Governing law

**Not yet decided — requires owner/legal input** (jurisdiction,
dispute-resolution venue).
