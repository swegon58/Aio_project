# R1 Merge-Ready Summary

**Branch:** `feat/r1-durable-run-foundation`  
**Worktree:** `/home/swegon/AI_Agent/Aio_project_r1`  
**Status:** Verification-complete, awaiting product-owner merge approval  
**Updated:** 2026-06-29

This note is the shortest path for any follow-up agent or reviewer.

## What R1 Delivered

R1 turns Aio runs into durable product objects instead of transient stream-only
sessions.

Delivered scope:

- ADR-owned run lifecycle and cancellation semantics
- versioned run-event envelope and hardened Hermes event mapping
- durable `aio_runs` and `aio_run_events` schema with RLS
- repository/state-machine layer for run creation, transitions, replay, and stop
- thin chat route with orchestration moved out of transport
- authenticated run APIs:
  - `GET /api/runs`
  - `GET /api/runs/:runId`
  - `GET /api/runs/:runId/events`
  - `POST /api/runs/:runId/stop`
- restored timeline UI with reconnect polling and visible `Current Run` surface
- durable stop control in the product UI

## Key User-Facing Outcome

The product now restores saved run state after reload, keeps the visible run
timeline attached to persisted history, and exposes a durable stop action for
stoppable runs.

Desktop:
- `Current Run` renders in the right-side Aio panel

Mobile:
- `Current Run` renders in the Today area above the suggestion cards

## Verification Evidence

Completed and green:

- `npm run typecheck`
- `npm run test:unit` (`36/36`)
- `npm run lint`
- `AIO_DEPLOYMENT_ENV=development npm run build`
- `npm run test:e2e -- app-smoke.spec.ts` (`6/6`)
- `npm run test:e2e` (`6/6`)
- `git diff --check`
- local `supabase db reset` with migrations `0001`–`0011`
- local `supabase db lint --local --level warning --fail-on warning`
- `apps/web/scripts/r1-4-repo-probe.ts` (`22/22`)
- `apps/web/scripts/r1-6-runs-api-probe.ts`

## Probe Caveat

For the live R1.6 stop-route probe, the missing-Hermes-run branch was verified
with a minimal local stub on `127.0.0.1:8642` that returns `404` for
`POST /v1/runs/:id/stop`.

This is documented explicitly in the checklist. It verifies the Aio-owned API
behavior for that branch without claiming a full Hermes runtime was involved.

## Re-run Command

Use the automation script:

```bash
cd /home/swegon/AI_Agent/Aio_project_r1/apps/web
./scripts/r1-live-probes.sh
```

What it does:

- reads local Supabase JWT keys from `supabase status -o env`
- temporarily moves the shared hosted `.env.local` aside
- starts a local Hermes stop-route stub on `127.0.0.1:8642`
- starts an isolated Aio probe server on `127.0.0.1:3001`
- runs the R1.4 and R1.6 live probes
- restores `.env.local`
- restarts Aio on `http://localhost:3000/app` if it had to stop it

## Files Most Relevant To Review

- `docs/architecture/ADR-001-aio-run-ownership.md`
- `apps/web/src/lib/aio/runs/`
- `apps/web/src/lib/aio/chat/run-orchestrator.ts`
- `apps/web/src/lib/aio/chat/chat-transport.ts`
- `apps/web/src/app/api/runs/`
- `apps/web/src/components/app/AppHome.tsx`
- `apps/web/src/components/app/run-timeline/`
- `apps/web/e2e/app-smoke.spec.ts`
- `docs/roadmap/R1_EXECUTION_CHECKLIST.md`

## Recommended Next Action

If the product owner approves, merge `feat/r1-durable-run-foundation` into
`main`, then update the canonical state files in `/home/swegon/AI_Agent/Aio_project`.
