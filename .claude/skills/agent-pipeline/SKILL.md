---
name: agent-pipeline
description: Dispatcher for Aio feature-level work — decides WHEN and WHICH of Aio's existing specialist subagents (frontend-builder, backend-builder, product-ux-guardian, kimo, qa-reviewer, accessibility-auditor, appsec-engineer, data-privacy-officer, reality-checker, etc — see .claude/agents/ / the Agent tool roster) to run, in what order, and loops build→critique→fix→QA→reality-check until the feature is actually polished, not just "typechecks". Use this whenever the user asks to build, add, improve, redesign, or polish a feature/flow in Aio (bigger than a 1-2 file mechanical fix, smaller than a full roadmap phase) and especially when they say things like "dùng agent liên quan", "make it complete/polished", "until it's done properly", or don't specify which agent to use. Do NOT use for a full roadmap phase (spec-to-ship) — that's pipeline-orchestrator's job — or for Team OS grilled chunks — that's the team-os skill's job.
---

# Agent Pipeline

Decision dispatcher for feature-level work in Aio. Purpose: stop guessing
which subagent to use, and stop declaring "done" after only a build step.

## Step 0 — size the task first

- **Trivial** (typo, 1-2 file mechanical change, obvious one-liner): just do
  it inline. No agents, no pipeline. Don't over-orchestrate a small fix.
- **Full roadmap phase** (spec to ship, multi-week, needs PM/Architect
  breakdown): dispatch the `pipeline-orchestrator` agent instead — it already
  owns PM → Architect → [Dev ↔ QA loop] → Reality Check internally. Don't
  re-run that loop by hand here.
- **Team OS grilled chunk** (anything under `.claude/agents/coordination/`):
  use the `team-os` skill instead.
- **Everything else — a real feature, fix, or polish pass that touches a
  handful of files and has a UX/quality bar** — that's this skill's lane.
  Keep going.

## Step 1 — build

If the change is small enough to write yourself with full context of the
codebase (as in: you already read the relevant files this session), just
write it — don't dispatch a subagent to redo work you already understand.
Dispatch a specialist only when the work needs ownership you don't have in
context, or is large enough to isolate:

- UI/component/flow work in `apps/web` → `frontend-builder`
- API/service/orchestration/persistence → `backend-builder`
- New MCP tool or Hermes tool wiring → `mcp-builder`
- Hermes multi-agent pipeline/topology → `hermes-architect`

## Step 2 — critique (pick what's relevant, skip what isn't)

Run these in parallel where independent — they read, they don't need to wait
on each other:

- Touched `apps/web` UI at all → `kimo`, scoped to the exact routes/files
  changed (never "review the whole app" — that reads everything and costs
  more for a vague answer).
- Changed product copy, empty/error states, or flow structure → also
  `product-ux-guardian`.
- New/changed flow (not just a component tweak) → `accessibility-auditor`,
  scoped to that flow.
- Touches auth, secrets, user-submitted input, or an API boundary →
  `appsec-engineer`.
- Adds/changes what user data gets collected, stored, or retained →
  `data-privacy-officer`.

If nothing above applies (e.g. a pure backend refactor with no new surface),
skip straight to Step 3.

## Step 3 — fix and loop

Apply the critique findings yourself (or via the specialist from Step 1).
Re-run only the reviewer(s) that had findings — not the whole Step 2 batch.
Cap at 2 critique→fix rounds: if a reviewer still has findings after round 2,
stop looping and surface the remaining findings to the owner instead of
grinding — that's a real decision point, not something to silently keep
iterating on.

## Step 4 — QA and reality check

- `qa-reviewer` for regressions and missing test coverage on what changed.
- For UI changes: this is also where `phase-closeout`'s live-Playwright rule
  applies — typecheck/unit tests verify the code, not the feature. Actually
  drive it in a browser.
- Only invoke `reality-checker` when you're about to tell the owner
  something is production-ready or fully shipped — not for every small
  polish pass. Its job is to block fantasy "done" claims with evidence; don't
  spend it on things nobody's claiming are finished yet.

## Step 5 — report

Summarize to the owner: what changed, which agents ran and what they found,
what got fixed vs deferred (with why), and evidence (tests run, live-tested
or not). Update the relevant checklist/state file per this repo's normal
"after every verified task" rule — this skill doesn't change that contract,
it just makes sure there's real multi-angle verification behind the update
before it's written.

## Why this shape

Specialist agents exist so a UI critique, a security pass, or a privacy
review each come from a role that's actually looking for that class of
problem — a generalist pass tends to miss what it isn't specifically looking
for. But running all of them on every change is wasteful and slow; the point
of this skill is picking the right subset for what actually changed, not
maximizing agent count.
