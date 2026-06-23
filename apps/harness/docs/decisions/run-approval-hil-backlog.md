# Run-level tool approval (HIL) — backlog, needs UI design first (2026-06-21)

Investigated Hermes's `/v1/runs` API (`gateway/platforms/api_server.py`,
`_handle_runs` + `_handle_run_approval`) while looking for further
roadmap-worthy capability work (priority #3 in the loop directive).
Same "needs a UI surface before wiring" situation as moa/computer_use
and the file browser — flagging instead of half-wiring.

## What it is

`/v1/runs` is a separate async-run API from the `/api/sessions/{id}/chat*`
path Aio currently uses for chat. A run can pause mid-execution and emit
an `approval.request` event over `/v1/runs/{run_id}/events` when the
agent wants to call a sensitive tool; the caller resolves it via
`POST /v1/runs/{run_id}/approval` with a choice of `once|session|always|deny`.

This is a genuine human-in-the-loop safety gate Aio doesn't expose at
all today — Aio's current chat path has no approval concept, so any
tool the agent has access to just runs.

## Why it's blocked

This isn't a drop-in proxy route like cron was. It needs:
1. A product decision on UX: does Aio show an inline approval card in
   the chat thread, a modal, or a toast? Does "always" persist per
   customer or per session?
2. A decision on whether to migrate chat itself onto `/v1/runs` (bigger
   change — different lifecycle than the current streaming chat
   completions path) or run it as a parallel surface only for specific
   tools (e.g. gate `cronjob`/`computer_use`/destructive file ops, leave
   normal chat untouched).
3. ~~Confirms which toolsets actually request approval today~~ — checked
   `tools/approval.py` (2026-06-21): approval gating is scoped to
   `terminal`/`execute_code` only, triggered by dangerous/sudo command-pattern
   detection (`detect_dangerous_command`, `_check_sudo_stdin_guard`), not a
   generic per-toolset hook. Confirmed against the desktop app's own
   `APPROVAL_TOOLS = {'terminal', 'execute_code'}` (`apps/desktop/src/components/assistant-ui/tool-approval.tsx`),
   which is a good reference for the inline-bar UX pattern (run/allow-session/always-allow-with-confirm/deny,
   collapsible command preview) — but it talks to the desktop's own WS gateway
   (`approval.respond`), not `/v1/runs`, so it's a UX reference only, not
   wireable as-is. `cronjob`/`computer_use` do **not** currently request
   approval at all — gating those would need new approval-hook call sites in
   Hermes itself (out of scope for Phase 1's "wrap as-is, no core edits" rule).

## Status

Backlog. Do not wire a partial version (e.g. polling `/v1/runs/{id}`
without a real approval UI) — that would silently block agent runs
with no way for the user to respond.

Worth doing eventually: it's the only Hermes capability that lets
Aio offer "ask before doing something risky" as a customer-facing
trust feature, which fits the tier-gating story (e.g. Business tier
gets auto-approve, lower tiers always prompt).
