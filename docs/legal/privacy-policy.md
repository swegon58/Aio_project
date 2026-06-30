# Aio Privacy Policy

> **STATUS: UNREVIEWED DRAFT.** This text has not been reviewed by a
> qualified lawyer and must not be published, linked from the product, or
> relied on as a binding disclosure until that review happens. Per
> `AIO_MASTER_EXECUTION_PLAN.md` R6.5, "legal text requires qualified
> review before public launch." This draft is grounded in the data this
> codebase actually collects and stores as of 2026-06-30, not generic
> boilerplate — it should be kept in sync with the code, or re-audited
> before being treated as accurate at review time.

**Last drafted:** 2026-06-30

## 1. What we collect

- **Account data**: email and auth identity (Supabase Auth).
- **Conversations and runs**: chat messages, tool calls, run results,
  schedules (`aio_runs`, `hermes_conversations`, `aio_schedules`, and
  related tables).
- **Knowledge sources**: files/documents you upload for retrieval, plus
  derived embeddings.
- **Saved Agents**: any reusable instruction text you create.
- **Credentials/connections**: API keys or tokens you provide to connect
  external tools, stored for your account's use only.
- **Billing data**: plan tier and credit balance in our database; payment
  card and transaction details are held by Paddle, not by us.
- **Telemetry**: operational metrics and audit-log events (e.g. errors,
  activation, run outcomes) used for reliability and abuse detection, with
  PII redaction per `ADR-002`.

## 2. How we use it

- Run the product: answer your chat turns, execute tools, run scheduled
  tasks, retrieve knowledge for relevant turns.
- Operate the service: billing, rate limiting, abuse prevention, support,
  and reliability monitoring.
- We do not sell your data.

## 3. Model/content training policy

We do not use your conversation content, knowledge sources, or outputs to
train our own models. Requests are routed to model providers (local LM
Studio, which keeps inference on your machine, or cloud
OpenRouter-compatible providers) and to Kie.ai for image generation;
**each upstream provider's own data-use and training policy applies to
requests routed to them** — this draft does not yet enumerate each
provider's specific policy and that enumeration is required before this
section can be considered complete.

## 4. Subprocessors / providers

| Provider | Purpose | Data involved |
|---|---|---|
| Supabase | Auth, Postgres database, file storage | Account, conversation, knowledge, billing-state data |
| Paddle | Payments, billing, merchant of record | Payment/card details, billing contact info |
| OpenRouter (or configured cloud provider) | Cloud model inference | Prompt/conversation content sent for that turn |
| LM Studio | Local model inference | Stays on the local/self-hosted machine running Aio |
| Kie.ai | Image generation | Image prompts and generated images |

This list reflects current code integrations; it must be reconfirmed
against the live deployment configuration before publication.

## 5. Retention

- Account and product data persist until you delete your account or the
  specific item (e.g. a knowledge source).
- Account deletion (Settings -> Data & Privacy) removes Storage objects
  best-effort and then deletes the auth user, which cascades all
  user-owned tables via foreign-key `ON DELETE CASCADE`.
- **No separate, shorter retention window exists yet** beyond
  "until you delete it" — a configurable retention policy (e.g.
  auto-expiring old conversations) is not implemented. This is a known
  gap, not a hidden one.
- Telemetry/audit-log retention follows `ADR-002` (referenced, not
  duplicated here).

## 6. Your controls

- **Export**: `GET /api/account/export` (Settings -> Data & Privacy)
  downloads all your account-owned data as a JSON file.
- **Delete account**: `DELETE /api/account/delete` (Settings -> Data &
  Privacy) permanently deletes your account and all owned data; requires
  typed confirmation and signs you out.
- **Delete a knowledge source**: deleting a knowledge source removes it
  and its derived embeddings immediately.

## 7. Security

Origin/CSRF checks on state-changing requests, per-user rate limiting,
and row-level-security-scoped database access are in place. See
`docs/operations/incident-response.md` for what happens if something goes
wrong.

## 8. Children

Aio is not directed at children. **Minimum age has not yet been set by
the owner** — required before publication.

## 9. Contact

Support/privacy requests: `swegon58@gmail.com` (see
`docs/operations/support-intake.md`).
