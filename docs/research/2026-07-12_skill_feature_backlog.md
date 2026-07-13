# Skill & Feature Research Backlog — 2026-07-12

Source: owner request via Discord, two separate lists — (A) skills to research
for Aio integration, (B) toolsets to add to the research backlog (no
implementation requested yet).

## A. Skill integration research

All items already exist as Hermes skill files under
`apps/harness/aio-home/profiles/aio/skills/**` and are auto-discovered by the
agent at runtime (no manifest/registration step needed). "Integration" work
here is product-wiring/polish, not building from scratch.

| Skill | Path | Git status | Notes |
|---|---|---|---|
| claude-code | `autonomous-ai-agents/claude-code/SKILL.md` | tracked | usable as-is |
| caveman | `caveman/` | **untracked** | works at runtime; not committed — lost on a fresh clone until `git add`'d |
| computer use | `computer-use/`, `apple/macos-computer-use/` | **gitignored** (`skills/computer-use/`) | deliberate exclusion already in `.gitignore`; confirm that's still wanted before treating as a gap |
| design-md | `creative/design-md/SKILL.md` | tracked | usable as-is |
| popular-web-designs | `creative/popular-web-designs/SKILL.md` | tracked | usable as-is |
| knowledge extraction | `research/knowledge-extraction/` | **untracked** | same risk as caveman |
| arxiv | `research/arxiv/` | tracked | **wired this session** — `research-mode.ts` prompt now explicitly nudges the agent to use it for academic/technical Deep Research queries |
| competitive-intelligence | `research/competitive-intelligence/` | tracked | adopted as a Claude-Code-side workflow too (see agent memory `feedback_competitive_intelligence_workflow`), not just a product skill |

**Open question for owner:** `caveman/` and `research/knowledge-extraction/`
are untracked — commit them if they're meant to ship, or leave untracked if
still experimental. Not decided here.

**Known secret to flag:** `skills/img-gen/SKILL.md` has a hardcoded fallback
`KIE_API_KEY` value in its script. Kie.ai is retired as the product backend
(replaced by fal.ai this session) but the skill script itself still carries
the old key inline — owner should decide whether to scrub it, since it's a
live-looking secret sitting in a skill file regardless of whether Kie.ai is
still used.

## B. Toolset research backlog (no implementation yet)

Requested list: clarify, todo, web, code_execution, browser, vision, memory,
delegation, cronjob, skill.

All 10 already exist as entries in `ALL_GATEABLE_TOOLSETS`
(`apps/web/src/lib/hermes/pricing.ts`), each already gated per pricing tier
in `TIERS`. So the backlog isn't "does this exist" — it's whether each
toolset's product-facing experience (Settings surfacing, upsell/locked-state
copy, per-toolset UX) is actually complete. That's a separate audit and is
**not done as part of this doc** — flagging as the next research question if
the owner wants it picked up.

| Toolset | Gated in pricing.ts | UX/product-surface audit |
|---|---|---|
| clarify | yes | not audited |
| todo | yes | not audited |
| web | yes | not audited |
| code_execution | yes | not audited |
| browser | yes | not audited |
| vision | yes | not audited |
| memory | yes | not audited |
| delegation | yes | not audited |
| cronjob | yes | not audited |
| skill(s) | yes (`skills`) | not audited |
