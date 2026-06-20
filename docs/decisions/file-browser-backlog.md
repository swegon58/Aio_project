# File Browser — backlog, not half-wired (2026-06-21)

Investigated wiring a workspace file browser into Aio's Activity tab
(next item on the `/app` feature-research gap list after Scheduled Tasks).
Holding off — same "needs a UI/API surface first" situation as moa/computer_use.

## Why it's blocked

Per-customer profiles run `TERMINAL_ENV=daytona` (`provision.ts`
`writeProfileEnv`) — actual code/file work happens in a remote Daytona
sandbox, not on Aio's local disk.

`tools/environments/daytona.py` + `file_sync.py` only sync
`{remote_home}/.hermes` (skills/config) back to the local profile dir —
NOT general workspace output files. So reading
`profiles/<name>/workspace` locally would show stale/empty data, not
what the agent actually produced.

A real file browser needs one of:
1. A new Hermes gateway REST route that lists/reads files from the
   *active* Daytona sandbox for a session (core hermes-agent change —
   against Phase-1 "no core edits" constraint, needs explicit go-ahead).
2. Aio calling the Daytona API directly using the per-profile
   `DAYTONA_API_KEY` (doable without touching hermes-agent core, but
   needs the sandbox ID and Daytona's file-listing API mapped first).

Recommend option 2 as the eventual path — it stays out of hermes-agent
core. Not started: needs the active sandbox ID exposed somewhere
Aio can read (check `/api/sessions/{id}` response shape first).

## Status
Backlog. Do not half-wire (e.g. don't ship a browser pointed at the
local workspace dir — it would mislead users into thinking that's
where their generated files live).
