# Grill-me log — Aio tiered toolset gating (2026-06-20)

Goal: map Hermes Blank-Slate-style toolset gating onto Aio's existing
Starter/Pro/Business pricing tiers (`src/lib/hermes/pricing.ts`), plus surface
other Hermes capabilities worth adding to Aio's roadmap.

## Context found in codebase before asking
- `src/lib/hermes/pricing.ts` — 3 tiers already exist (model, markup,
  maxIterations, creditBudget differ per tier). No toolset field yet.
- `src/lib/hermes/provision.ts`:
  - `copyCuratedCatalog()` — copies ONE fixed toolset config (from the "aio"
    dev profile's config.yaml: `toolsets`/`disabled_toolsets`/
    `platform_toolsets`) to every new customer profile, regardless of tier.
    This is the gap — all customers currently get identical toolset access.
  - `applyTierConfig()` — already re-applied on every spawn/respawn, sets
    `agent.max_turns` + `model.default` per tier. Does NOT touch toolsets yet.

## Q1: Where should toolset gating be enforced?
1. **applyTierConfig(), re-applied every spawn** (recommended, matches
   existing model/max_turns pattern — tier upgrade/downgrade takes effect on
   next run, no profile recreation needed)
2. copyCuratedCatalog(), one-time at profile creation only

**Answer: 1 (applyTierConfig)** — confirmed by user.

## Q2: Toolset → tier mapping
Toolsets relevant to Aio (excluding home_assistant/spotify/yuanbao/macOS
computer_use): file, terminal, code_execution, web, browser, vision,
image_generate, video_generate, memory, clarify, delegate_task, cron, skills,
todo, tts.

1. **3-tier ladder by risk/cost** (recommended):
   - Starter: file, terminal, web, clarify, todo
   - Pro: + code_execution, browser, vision, memory, delegate_task
   - Business: + image_generate, video_generate, cron, tts, skills
2. 2-tier (Free/Paid) — rejected, mismatches existing 3-tier pricing
3. User-customized list

**Answer: user said "follow recommendations, build complete" — option 1
(the 3-tier ladder above) is the locked mapping**, no further toolset-list
edits requested.

## Final consolidating question (asked, response pending at time of writing)
Whether tier-gated-but-locked toolsets should be shown to the customer in
the Aio UI as visibly locked/grayed with an upgrade CTA, vs simply hidden.
Recommended: show locked with upgrade CTA (upsell value, matches SaaS norm).

## Scope for this work session (per user instruction 2026-06-20 ~20:14)
- Implement the Q1+Q2 decisions in code (pricing.ts tier toolset lists +
  provision.ts applyTierConfig wiring).
- Research full Hermes docs for additional features worth roadmapping.
- Polish Aio /app UI (use design skills: frontend-design, shadcn,
  ui-ux-pro-max, + component sources 21st.dev/cult-ui/watermelon-ui/skiper-ui,
  + newly requested taste-skill from github.com/Leonxlnx/taste-skill).
- Delegate: Dan Heng = code, Welt (always model=haiku) = research, March 7th
  = review/QA.
- Use lean-ctx tools throughout. Break into small TaskCreate tasks.

## Addendum (2026-06-21) — roadmap candidates from Hermes capability research
Welt's pass over Hermes docs surfaced `moa` (mixture-of-agents) and
`computer_use` as the two toolsets worth a future Aio tier slot (likely
Business). Not added to `ALL_GATEABLE_TOOLSETS`/`TIERS` yet — both need
product-side build first (computer_use needs a UI surface for showing
desktop-control output; moa needs a way to expose/explain multi-model
orchestration to the customer). Wiring the toolset flag alone without that
UI would be a half-built feature. Tracked as backlog, not done.
