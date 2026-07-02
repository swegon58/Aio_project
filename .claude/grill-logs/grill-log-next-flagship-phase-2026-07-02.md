# Grill log: next flagship phase after R9 (2026-07-02)

## Origin
Discord request: "2 câu hỏi yes hết. tôi muốn bạn lập team agent agency
nghiên cứu thị trường, công cụ, repo hay những gì đó và đem về đây lên
thành 1 plan kế hoạch để grill me và sẵn sàng để build, cả những gì aio
còn thiếu luôn" — owner asked for a research team covering market, tools/
repos, and Aio's own internal gaps, synthesized into a build-ready plan
delivered via the standard grill-me pattern.

Three parallel research forks launched:
1. **Market landscape** — competitor/consumer-AI-agent product research.
2. **Tools/repos** — open-source tools and libraries Aio could adopt.
3. **Internal gap audit** — code-level audit of what Aio's own spec
   (`AIO_MASTER_EXECUTION_PLAN.md`) still describes but never shipped.

Two forks (gap audit, market research) initially misfired — each replied
with "waiting for the other forks" instead of doing its assigned research,
apparently self-confusing itself for the orchestrator since it inherited
the parent's full context (including the fact that 3 forks were launched).
Both were corrected via a targeted follow-up message restating "YOU are
one of the forks, not a separate waiting agent" plus the original task;
both then returned complete reports. The tools/repos fork was unaffected
and delivered correctly on the first pass.

Cross-validation found between forks:
- Notifications/reachability surfaced independently in both the gap audit
  (R5.4's spec'd-but-never-built "notification destination" field) and the
  market research (messaging-bot reachability as a differentiator, citing
  Genspark-style products).
- Browser/computer-use tension: gap audit flagged it as the single biggest
  internal capability gap; market research flagged standalone
  browser-agent products as a "graveyard" (crowded, commoditizing fast).
  Resolved via an embedded-mode framing rather than picking one side.

## Q1 — What's the next flagship consumer-facing direction?
🅰️ Browser/computer-use as its own flagship (biggest gap-audit finding).
↳ Trade-off: lands in a crowded, fast-commoditizing market segment per the
  market-research fork; high build cost for a feature many competitors
  already ship.

🅱️ ⭐ Consumer connect flow — Google Calendar/Gmail OAuth.
↳ Trade-off: narrower in scope than a full browser-agent flagship, but the
  backend capability (Hermes `google-workspace` skill) already exists in
  some form and unlocks real daily-utility use cases (schedule awareness,
  inbox triage) that differentiate from generic chat competitors.
↳ **đây là lựa chọn mình recommend**, vì it's the highest-leverage gap: a
  skill that already exists but has no consumer-usable connect path, and
  daily calendar/email utility is a stronger retention hook than a
  standalone browser agent in an already-crowded segment.

**Picked: B**

## Q2 — What runs in parallel alongside the primary pick?
🅰️ ⭐ Proactive notifications (small companion workstream).
↳ Trade-off: smaller in scope, doesn't move a new flagship narrative by
  itself, but closes a real spec gap (R5.4's "notification destination"
  field, spec'd, never built) with low build cost.
↳ **đây là lựa chọn mình recommend**, vì it's low-risk parallel work with
  a already-scoped acceptance target, plus it directly reinforces Q1's
  pick — a connected Calendar is more useful with a notification path to
  surface what changed.

🅱️ Nothing in parallel — single-thread focus on Q1 only.
↳ Trade-off: simpler execution, but leaves the R5.4 spec gap open for
  another cycle with no compounding benefit to the connect-flow work.

**Picked: A**

## Answer (Discord, msg_id 1522164249751982168, 2026-07-02T08:57:17.585Z)
"1b 2a" — both recommended (⭐) options picked, no elaboration given.

## Decisions summary
- Primary flagship: **Google Calendar consumer connect flow** (real OAuth
  connect button, not the existing CLI/agent-mediated copy-paste flow the
  `google-workspace` Hermes skill ships today).
- Parallel: **Proactive notifications** — implement the R5.4
  "notification destination" field for Scheduled Tasks that was spec'd
  but never built.
- Post-decision scoping (not part of the grill itself, discovered during
  follow-up investigation, surfaced to the owner separately per the
  Karpathy "surface tradeoffs" guardrail): the existing `google-workspace`
  skill's OAuth mechanism is per-installation (`client_secret.json` the
  user brings themselves) and chat-mediated, not a real consumer web OAuth
  flow — building the connect flow needs a genuinely new piece (Aio-owned
  OAuth app, Next.js callback route, Vault-based per-customer token
  bridge into each Hermes profile), not just a UI wrapper around existing
  capability. Google's Gmail/Drive scopes are also "restricted" tier,
  requiring a CASA security assessment — a compliance/cost decision, not
  an engineering one — so this pass scopes to **Calendar only**
  ("sensitive" tier, standard verification), deferring Gmail/Drive.
- Resulting execution scope: `docs/roadmap/R10_EXECUTION_CHECKLIST.md`.
