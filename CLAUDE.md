# Aio Project

## Start Here

Before any code change, read:

1. `AIO_PROJECT_STATE.md`
2. Current phase checklist under `docs/roadmap/` (active: `R11_EXECUTION_CHECKLIST.md`;
   R12 work — AppHome.tsx decomposition + open-webui-inspired RAG/Valves —
   is happening on `feat/r12-fixes` without a formal checklist file yet)
3. `README.md`

Read on demand, not every session (both are large and `AIO_PROJECT_STATE.md`
already summarizes their outcome):

- `AIO_MASTER_EXECUTION_PLAN.md` — the full R0-R7 code-level execution
  contract, all closed phases. Only open it for old-phase forensics; use the
  current phase checklist plus `docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`
  for latest merged-line status.
- `docs/roadmap/PRODUCT_READY_MASTER_PLAN.md` — parallel 5-phase hardening
  plan (separate lane from R10, does not block it). Only open it when a task
  is actually in that lane.
- `AIO_GIAI_THICH_DE_HIEU/README.md` — plain-language (Vietnamese) explainer
  of every phase R0-R12 for the owner; useful for a quick "why does this
  exist" read, not a substitute for the checklist/state files above.

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
- Do not edit generated runtime state under `apps/harness/aio-home`.
- Never expose or commit secrets.
- Preserve unrelated user changes.
- Keep changes inside the approved phase.
- Run task-specific checks before marking work complete.
- Any change touching `apps/web` UI must be verified with a live Playwright
  run (`apps/web/e2e/`), not just typecheck/lint — stop `aio-app.service`
  first (shares the `.next` build lock with Playwright's own dev server),
  run the relevant specs, then restart the service.
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
