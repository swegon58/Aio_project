# R9 Execution Checklist — Deep Research Polish

Goal: close the gap between "R4 (Deep Research) is marked done" and what the
R4 spec (`AIO_MASTER_EXECUTION_PLAN.md`, R4.4/R4.7) actually requires. Scoped
by code-level audit against the R4 spec, not a fresh grill round — see
`AIO_PROJECT_STATE.md` Next Decision Gate option B ("Deep Research polish").

Trigger: owner selected option B (Deep Research) as the next flagship
workflow (2026-07-01, Discord). This checklist is the resulting scope.

## Status Key

- `[ ]` not started
- `[~]` in progress
- `[x]` completed and verified

## Current State

R4 (Deep Research) shipped a working pipeline: research-mode system prompt
injection, a heuristic 4-step progress card, and a Knowledge Center
ingestion pipeline. It also shipped `research-stages.ts` — a 7-stage
durable orchestration + source/claim persistence module built to the
R4.2/R4.3 spec — but that module was never wired into the live
orchestrator. Auditing against the R4 spec found four gaps:

## R9.0 — Durable research pipeline is orphaned (blocks R9.1 and R9.3) [x]

Deeper audit found the real root cause: `research-stages.ts` (R4.2/R4.3's
durable 7-stage pipeline + source/claim DB persistence) is never called
from any live code path. `recordResearchSource`, `recordResearchClaim`,
`updateResearchProgress`, and `buildResearchStageEvent` are only invoked
from their own unit test. The live orchestrator (`run-orchestrator.ts`)
only injects the research system prompt and tracks a simple tool-call
count for the heuristic 4-step `ResearchProgressCard.tsx` — it never
writes to `aio_research_sources` / `aio_research_claims`, so those tables
are always empty in production.

This means R9.1 (dedupe) and R9.3 (sources panel) are moot until the
durable pipeline is actually wired into `run-orchestrator.ts` — closing
out the unfinished part of R4.2/R4.3, not just "polish." Flagged to the
owner (2026-07-01, Discord) for a scope decision before proceeding.
Owner selected option A: wire the full durable pipeline now.

**Implementation** (`run-orchestrator.ts`, `execute` closure): a monotonic
`advanceResearchStage` heuristic state machine drives the 7 stages from
signals already available in the orchestrator loop — no Hermes-side
changes, since Hermes has no native "research stage" concept and the
`research-stages.ts` module comment describing one is stale/aspirational.

- `understand` — fires once at the start of `execute`, before the Hermes
  event loop, for `mode === "research"` runs only.
- `plan` — fires on the first `tool.started` event.
- `discover` — fires on the first `tool.started` where
  `isWebResearchTool(toolName)` is true.
- `inspect` — fires on every `tool.completed` event.
- (source recording) — on `tool.completed`, URLs are extracted from
  `resultPreview` via a capped regex (`extractResultUrls`, max 5/result)
  and appended to `aio_research_sources` via `recordResearchSource`, with
  an in-run `Map<url, sourceId>` dedupe guard (see R9.1).
- `synthesize` — fires once at least one source has been recorded.
- `verify` — fires on the first `message.delta` (first assistant text
  token), since that's the only observable signal of the model moving
  from tool use into producing its answer.
- `report` — fires once the run reaches `succeeded && !budgetExceeded` in
  the `finally` block.

Each transition persists a `research.stage` `AioRunEvent` (durable log +
legacy UI stream, matching the existing `run.created` pattern) and calls
`updateResearchProgress` to patch `aio_runs.metadata`. The client-side
`ResearchProgressCard.tsx` (run-timeline variant) required zero changes —
it was already built against the `research.stage` event contract and was
just never receiving real events.

**Deliberately out of scope**: `recordResearchClaim` is not wired. There
is no reliable live signal to populate claims — doing so would require a
new LLM-side claim-extraction/verification design (mapping specific
assertions to specific sources), which is a separate scoping decision,
not a wiring gap. `aio_research_claims` remains empty after this change;
revisit if/when claim-level citation UI (R9.3's "citations linked at
claim level") is prioritized.

Verified: `npx tsc --noEmit` clean, `eslint` clean, full unit suite
249/249 passing (existing `research-stages.test.ts` unaffected — no
production code path exercises it, only its own unit tests still do).
No dedicated `run-orchestrator.ts` unit test exists; this change was
verified by type/lint/test-suite passage plus manual trace of the event
path, not a new automated test (would need Hermes stream mocking, judged
out of scope for this pass).

## R9.1 — Source dedupe [x]

Spec (R4.7) requires a "source dedupe" test; none exists. Migration
`0016_aio_research.sql` stores `content_hash` on `aio_research_sources` but
has no uniqueness constraint or dedupe check — the same URL/content can be
inserted multiple times per run with no guard.

R9.0 added an in-run `Map<url, sourceId>` guard in `run-orchestrator.ts`
that prevents the same URL being inserted twice within a single run — a
lightweight application-level dedupe, not a DB-level constraint. Remaining
gap: no DB-level `UNIQUE` constraint (a URL could still be duplicated
across separate runs, or by a future caller that bypasses this in-memory
guard), and no automated test for the dedupe behavior itself. A DB
migration was judged out of scope/higher-risk for this pass.

**Implementation**: `extractResultUrls` in `run-orchestrator.ts` exported
(was private). New unit test file
`src/lib/aio/chat/run-orchestrator-dedupe.test.ts` covers both dedupe
layers: `extractResultUrls` (empty/undefined input, URL extraction, trailing
punctuation stripping `.,;:`, within-preview dedup, 5-URL cap) and the
in-run `Map` guard (same-URL skip, distinct-URL-once guarantee).

Verified: 258/258 tests passing (up from 249 — 9 new dedupe tests).

## R9.2 — Export report to Markdown/PDF [x]

Spec (R4.4) requires "export report to Markdown/PDF after completion" as a
required UI element. Not implemented anywhere in the codebase.

**Implementation** (`AppHome.tsx`, message-meta toolbar): two buttons appear
next to the existing copy button, gated on the same `isResearchMessage`
signal already used by `ResearchProgressCard` (survives reload via
`message.metadata?.mode`), only once the message text is non-empty.

- Markdown export (`handleDownloadReportMarkdown`) reuses the same
  client-side Blob-download pattern already used by
  `handleDownloadCodeBlock` — no new dependency, no server round-trip.
- PDF export (`handleExportReportPdf`) renders the message through the
  existing `MarkdownMessage` component via `react-dom/server`'s
  `renderToStaticMarkup`, injects the resulting HTML into a new tab
  (`window.open` + minimal print CSS), and calls `.print()` so the browser's
  native print-to-PDF satisfies the "PDF" half of the spec. No new
  dependency (`react-markdown`/`remark-gfm` were already installed).
- Filenames sanitized via `reportFileBaseName` (slugified query, capped at
  60 chars, falls back to `"research-report"`). Title text HTML-escaped
  before injection into the new tab's `<title>`/`<h1>`.

Verified: `npx tsc --noEmit` clean, `eslint src/components/app/AppHome.tsx`
clean (0 errors, 4 pre-existing unrelated warnings). Live-browser verified
via Playwright against the running dev server (Chrome extension still not
connected in this environment, so this replaces it as the live-runtime
check): `apps/web/e2e/research-export.spec.ts` drives a full research-mode
chat turn (mocked `/api/chat` SSE stream carrying `data-aio-run` +
completed report text) through the real `/app` UI, asserts "Download
report as Markdown" and "Export report as PDF" render on the completed
research message, clicks Markdown to confirm a real file download fires
with the expected slugified filename, and clicks PDF to confirm a new tab
opens with the rendered report (`h1.report-title`, `.markdown-message`
content). Run: `npx playwright test e2e/research-export.spec.ts
--project=desktop-chromium` → `1 passed (3.0s)`.

## R9.3 — Sources panel UI [x]

Spec (R4.4) requires "citations linked at claim level" and "sources panel
available without covering the report." Today `aio_research_sources` /
`aio_research_claims` are meant to be written during a run but never read
back — self-documented gap at
`apps/web/src/app/api/internal/analytics/weekly/route.ts` ("research
sources have no UI surface to click"). The report text itself does
contain inline markdown links + a self-reported "Sources" section (per
the LLM system instructions in `research-mode.ts`), but that's not backed
by the structured, provenance-tracked source rows — a user can't verify
what Aio actually fetched vs. what the model claims. Blocked on R9.0
(now unblocked, R9.0 is `[x]`).

**Implementation**: a self-contained, per-message expandable disclosure
attached to each research message's `message-meta` toolbar, rather than
wiring into the existing (code-oriented, closed-by-default) Workspace/
Activity side panel — that panel is scoped to the live run's
`timelineEvents` only, not historical per-message runs, so it can't serve
reloaded research messages.

- `runId?: string` added to `AioResearchSummary`
  (`lib/aio/chat/chat-mode.ts`) and threaded through
  `persistConversation`'s research summary in `run-orchestrator.ts`, so
  every persisted research message carries its own `runId` in
  `message.metadata.research.runId` — reload-persistent, unlike
  `activeRunId` which only tracks the current/live turn.
- `listResearchSources(db, runId, userId)` added to
  `lib/aio/research/research-stages.ts` — tenant-scoped via
  `.eq("user_id", userId)` (the service-role client bypasses RLS, so this
  filter is the actual isolation boundary, matching the pattern used
  throughout this module and in `resolveRunApiContext`).
- New route `GET /api/runs/[runId]/sources`
  (`app/api/runs/[runId]/sources/route.ts`) reuses the existing
  `resolveRunApiContext()` auth/dev-bypass pattern used by all other
  `/api/runs/[runId]/*` routes.
- New client helper `fetchRunSources(runId)` in `lib/aio/runs/run-client.ts`.
- `AppHome.tsx`: a "Sources" toggle button (`Link2` icon) appears in the
  `message-meta` toolbar next to the Markdown/PDF export buttons, gated on
  `isResearchMessage` and a resolvable `researchRunId`
  (`message.metadata?.research?.runId ?? (isLatestAssistant ? activeRunId
  : null)`). Toggling renders a disclosure panel (`.research-sources-panel`,
  new CSS in `mockup.css`) as a JSX sibling appended after `message-meta`'s
  closing tag — not nested inside `message-bubble` — so it pushes layout
  instead of overlaying the report text, satisfying the "without covering
  the report" requirement. Sources are fetched lazily on first open and
  cached client-side per `runId` (`sourcesByRunId` state), so reopening
  doesn't re-fetch.
- Out of scope for this pass: claim-level citation linking (would require
  `recordResearchClaim` to actually be called, which needs a new
  LLM-driven claim-extraction step — not wired in R9.0 either). This pass
  closes the "sources panel" half of the R4.4 requirement only.

Verified: `npx tsc --noEmit` clean, `eslint` clean on all touched files (0
errors, same 4 pre-existing unrelated warnings in `AppHome.tsx`), full
unit suite 249/249 passing. Live-browser verified via the same
`apps/web/e2e/research-export.spec.ts` Playwright spec (Chrome extension
still not connected in this environment, so Playwright against the real
running dev server stands in as the live-runtime check): after the
research report renders, clicks "Show sources", asserts
`.research-sources-panel` becomes visible and fetches the mocked
`GET /api/runs/:runId/sources` response, confirms the single source
renders with its title as a link and its source type, then clicks the
toggle again and asserts the panel unmounts. Run: `npx playwright test
e2e/research-export.spec.ts --project=desktop-chromium` → `1 passed
(3.0s)`.

## Ordering rationale

R9.0 must land first — R9.1 and R9.3 build on a table that is otherwise
always empty. R9.2 (export) has no dependency on R9.0 and can proceed
independently since it operates on already-rendered report text.

## Status

R9 closed 2026-07-02: R9.0/R9.1/R9.2/R9.3 all `[x]`, live-verified via
`apps/web/e2e/research-export.spec.ts` (kept as permanent regression
coverage). Deliberately out of scope for this pass (see R9.0/R9.3):
claim-level citation linking (`recordResearchClaim` never called — needs
a new LLM-driven claim-extraction design) and a DB-level uniqueness
constraint for source dedupe (currently application-level only). Next
step: present the owner a fresh Next Decision Gate for the next flagship
line of work.
