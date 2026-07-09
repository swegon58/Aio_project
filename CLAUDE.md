# Aio Project

## Start Here

Before any code change, read (**Tầng 1** — every session):

1. `AIO_PROJECT_STATE.md` — status index, current branch, open gates.
2. Active checklist `docs/roadmap/R12_EXECUTION_CHECKLIST.md`
   (`R10`/`R11` checklists stay readable while owner Google OAuth is pending).
3. `README.md` — setup.

**Read on demand** (**Tầng 2** — only when the task is actually in that lane):

- `AIO_MASTER_EXECUTION_PLAN.md` — full R0–R7 code-level contract, all closed.
  Old-phase forensics only; latest merged-line status lives in the current
  checklist + `docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`.
- `docs/roadmap/PRODUCT_READY_MASTER_PLAN.md` — parallel 5-phase hardening
  lane (separate from the R-phases, doesn't block them). Only open it when a
  task is in that lane.
- `AIO_GIAI_THICH_DE_HIEU/` — plain-Vietnamese explainers (active R10–R12 +
  owner-pending). R0–R9 explainers moved to `docs/archive/explainers/`.

**Archive** (**Tầng 3** — forensics, never auto-loaded): start at
`docs/archive/CLOSED_PHASES.md` (1 line/phase, the entry point), then
`docs/archive/{roadmap,explainers,team-os,operations}/` for full detail.

**Archive hygiene (anti state-lag):** when a phase closes, `git mv` its
checklist to `docs/archive/roadmap/`, add one line to `CLOSED_PHASES.md`, and
trim `AIO_PROJECT_STATE.md` — **same session**. (This is the fix for the
state-lag that forced the R12 reorg.)

When the user says "continue building Aio", first run:

```bash
scripts/aio-context.sh
```

Follow `AIO_PROJECT_STATE.md`. Continue an approved in-progress task, or present
the next decision gate when no task has been approved.

## Current Execution

Active branch, in-flight phase, and task status change every phase — treat
`AIO_PROJECT_STATE.md` as the source of truth for all of that, not this file.

A historical GitHub token finding requires owner-led revocation/history
decision; never display the value.

After every verified task, update the relevant state/checklist file with
evidence and the exact next step.

## Product And Architecture

- Aio is a consumer AI agent product, not a developer/operations console.
- Next.js is the product/control plane.
- Hermes is the execution/runtime plane.
- Supabase/Postgres is durable product state.
- Keep one visible default Aio agent.
- Deep Research is the next flagship workflow after durable foundations.
- User-facing UI copy must be English.

## Repository

```text
apps/
  web/       Next.js UI, API, Supabase, billing, provider adapters
  harness/   Hermes runtime and isolated Aio profile
```

The Aio Hermes profile lives under `apps/harness/aio-home/profiles/aio`, never
under an unrelated global Hermes profile.

## Working Rules

- Use LeanCTX for verbose reads, searches, builds, and tests when available.
- Apply ponytail (lazy/minimal-diff) discipline to every code change: smallest
  working fix first, no speculative abstraction.
- Do not edit generated runtime state under `apps/harness/aio-home`.
- Never expose or commit secrets.
- Preserve unrelated user changes.
- Keep changes inside the approved phase.
- Run task-specific checks before marking work complete.
- Any change touching `apps/web` UI must be verified with a live Playwright
  run (`apps/web/e2e/`), not just typecheck/lint. Playwright compiles into an
  isolated `.next-e2e` dir (`AIO_E2E` env, see `next.config.ts`), so it no
  longer collides with the always-on `aio-app.service` `next dev` in `.next` —
  run the relevant specs directly, the service need not be stopped/restarted.
- Do not force-push, rewrite history, rotate credentials, or choose paid
  infrastructure without explicit approval.
- `/clear` (or start a new session) when switching between unrelated tasks
  or across roadmap phases — don't carry stale context forward.
- Research or exploration touching more than 3-4 files goes to a subagent
  (or a fork), not inline reading in the main session.

## Coding Guardrails (Karpathy)

- Think before coding: state assumptions, surface tradeoffs, and ask when
  confused rather than guessing silently.
- Simplicity first: smallest correct change. No speculative abstraction,
  config, or error handling for impossible cases.
- Surgical changes: every changed line traces to the task. Match existing
  style; don't refactor adjacent code or remove unrelated dead code.
- Goal-driven: define verifiable success criteria (tests, checks) first, and
  loop until they pass before marking work done.

## Team-Agent Loop

Team OS operational rules (which files to read, script usage, branch and
log discipline) live in the `team-os` skill — it loads on demand instead of
every session. Invoke it (or let it auto-trigger) when working with
`Aio Team OS`.
