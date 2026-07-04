# R11.4 — Terminal Architecture Research (build vs. borrow)

Research pass comparing Aio's Terminal/workspace panel (`RunTimeline`,
`ToolCallCard`, `PreviewPane` under `apps/web/src/components/app/`,
`apps/web/src/components/app/run-timeline/`) against four agent products, per
the R11.4 brief. Also resolves R11.3's "turn-display comparison" item.

Method: Manus via web research (closed-source, no repo). OpenManus, Onyx, and
DeerFlow via `git clone --depth 1` (shallow/sparse) into scratchpad, source
read directly, clones discarded after — nothing committed to Aio's repos, no
Aio product source code touched by this research task.

---

## 1. Manus — "Computer" panel

**What it is**: a two-panel layout — chat/history on the left, a live
"Computer" viewer on the right showing whatever the agent is currently doing
(browsing, editing a file, running a shell command), effectively a session
replay/live-view of the agent's own screen. Steps are logged as short present-
tense lines ("scrolling," "browsing," "editing file.py"), not expanded tool
call/result JSON.

**Architecture inference** (from public write-ups and leaked system-prompt
analysis, since Manus is closed-source): an iterative analyze → plan →
execute → observe loop, a typed event stream (`user` / `action` /
`observation` / `plan`), and file-based memory — a persistent `todo.md`
checklist with step number/status/reflection instead of keeping the full tool
history in the model's own context. Intermediate results (search results,
scraped pages, generated files) are written to files and referenced, not
inlined into chat.

**Recommendation: adapt-this-pattern (behavior only, not code — none
available).** The two-panel "live workspace" idea is already Aio's Terminal
concept. The one behavior worth adopting deliberately: Manus's log lines are
short and present-tense ("scrolling," "reading file"), never raw tool-call
argument dumps — this is a copy-editing change to `RunEventItem`/tool-label
strings, not an architecture change. The `todo.md`-as-memory pattern is a
Hermes/agent-loop concern, out of scope for a frontend Terminal panel.

---

## 2. OpenManus (`github.com/FoundationAgents/OpenManus`)

**Confirmed real repo** (cross-checked against
`Aio_project_onyx_openmanus_lab/.firecrawl/openmanus-github.md` before
cloning). Cloned depth-1 and inspected structure: `app/{agent, daytona,
flow, mcp, prompt, sandbox, tool, utils}`, `examples/`, `config/`,
`protocol/a2a/`, `tests/`, `workspace/`.

**Finding: there is no frontend at all.** `find OpenManus -iname "*.tsx"` and
a top-level listing turn up zero UI code — no `web`/`ui`/`frontend`
directory, nothing but Python, a Dockerfile, and READMEs. The README's own
usage instructions are literally `python main.py` then "input your idea via
terminal!" — a CLI terminal, not a UI Terminal panel.

**Recommendation: build-custom (nothing to copy or adapt).** OpenManus is a
backend agent-loop framework with zero output-rendering UI. Its Python
tool/agent abstractions could theoretically inform Hermes (the execution
plane), but that's a different layer than Aio's Terminal panel and out of
this task's scope.

---

## 3. DeerFlow (`github.com/bytedance/deer-flow`, "DeerFlow 2.0")

**Confirmed real repo**, and a genuine surprise: this is not the older
LangGraph deep-research tool DeerFlow is best known for — the README
describes a ground-up rewrite into a general-purpose "super agent harness"
that orchestrates sub-agents/memory/sandboxes via extensible skills, with a
full Next.js frontend.

**What was read in full** (cloned depth-1,
`frontend/src/components/workspace/messages/`):

- `message-group.tsx` (747 lines) — the turn/output rendering core. Within
  one AI turn, all tool calls + reasoning are flattened into a single
  chronological `ChainOfThought` list. **Only the most recent step is
  expanded by default; every earlier step collapses behind an "N more
  steps" toggle.** There is no numbered "Turn 1"/"Turn 2" header anywhere —
  turns are plain chat bubbles (human/assistant), and duration is shown as a
  live stopwatch label ("Thought for Ns"), not a turn index.
- `subtask-card.tsx` (235 lines) — the sub-agent/delegation pattern: a
  collapsible card per sub-task, shimmer effect on the title while
  in-progress, a `ShineBorder`/"ambilight" glow while active, one-line
  collapsed summary (via a `FlipDisplay` component) of the last tool call,
  full step timeline when expanded, and lazy backfill of historical step
  data from the server only on first expand (`fetchSubtaskSteps`). This is
  the pattern that already informed R11.1's #8 Task Delegation decision
  (merge sub-agent status into the existing status line, not a separate
  graphic).
- `message-list-item.tsx` (566 lines) — confirms the chat-bubble turn
  structure and per-tool custom icon+label renderers (web_search,
  image_search, web_fetch, ls, read_file, write_file/str_replace, bash,
  ask_clarification, write_todos, fallback wrench+name).

**Recommendation: adapt-this-pattern (the collapse-by-recency layout, not
the code wholesale — different component library, `ai-elements` +
Streamdown, not something to vendor into Aio).** DeerFlow's per-tool
icon+label map and its "one step expanded, rest collapsed with a count
toggle" layout are directly implementable inside `ToolCallCard`/
`RunEventItem` without adopting DeerFlow's dependency stack. The
`SubtaskCard` lazy-backfill-on-expand technique is also worth adapting for
Aio's own sub-agent status line once that ships.

---

## 4. Onyx (`github.com/onyx-dot-app/onyx`)

**Confirmed real repo** (cross-checked against `.firecrawl/onyx-github.md`).
Sparse+shallow clone of `web/` only (first sparse-checkout attempt at
`web/src/app/chat` failed — that path doesn't exist; the real app lives at
`web/src/app/app/`).

Onyx has by far the most sophisticated timeline system of the four —
`message/messageComponents/timeline/` has ~35 files: `AgentTimeline.tsx`
(orchestrator), `hooks/usePacedTurnGroups.ts`, `hooks/useTimelineExpansion.ts`,
`hooks/useTimelineMetrics.ts`, `hooks/useTimelineUIState.ts`, per-state
`headers/` (`StreamingHeader`, `CompletedHeader`, `StoppedHeader`,
`ParallelStreamingHeader`), `primitives/` (`TimelineRoot`,
`TimelineHeaderRow`, `StepContainer`, etc.), `ParallelTimelineTabs.tsx`, and
per-tool `renderers/` (code, deepresearch, fetch, filereader, memory,
reasoning, search).

**Read in full**: `AgentTimeline.tsx`, `usePacedTurnGroups.ts`,
`ExpandedTimelineContent.tsx`, `CompletedHeader.tsx`, `StreamingHeader.tsx`.

Key findings:

- **Turn grouping exists only internally, never as a user-visible label.**
  Steps are grouped into `TurnGroup[]` (`{ turnIndex, steps, isParallel }`)
  purely to decide *rendering mode* (sequential list vs. `ParallelTimelineTabs`
  when multiple tools ran concurrently) — `turnIndex` is never printed as
  "Turn 1"/"Turn 2" text anywhere in the header components.
- **One single collapsible timeline per assistant turn**, not one section
  per turn. The header shows an aggregate summary only: while streaming, a
  shimmering current-activity line with a live elapsed-time button; once
  done, `"Thought for {duration}"` plus a `"{N} steps"` expand button. Detail
  is opt-in via one click, not pre-expanded per turn.
- **`usePacedTurnGroups.ts` is a UX-polish hook, not a data/turn-numbering
  concept**: it reveals newly-arrived steps one at a time with a fixed
  200ms delay between them (so multiple tool calls don't all pop in at
  once), bypassing the delay entirely when loading completed history. This
  is purely an animation/pacing detail, unrelated to turn-display structure.
- **`ParallelTimelineTabs`**: when a turn group has `isParallel: true`
  (concurrent tool calls, e.g. a coding sub-agent), steps render as tabs
  instead of a stacked list — a pattern neither Manus nor DeerFlow have.

**Recommendation: adapt-this-pattern for the collapse/expand + parallel-tab
mechanics, build-custom for the rest.** Onyx's actual code (React + its own
`@opal` design system) isn't portable into Aio's Tailwind-based components,
but three specific mechanics are worth reproducing: (1) single aggregate
header per turn with step-count/duration, expand-on-demand, rather than
always-visible per-turn sections; (2) a 200ms stagger when multiple tool
events land in the same tick, so rapid tool bursts don't flash in
simultaneously; (3) a tabbed view for genuinely parallel tool calls (Aio
doesn't have concurrent tool calls yet, so this is a "keep in mind," not an
immediate build item).

---

## Turn-display comparison — direct answer

**Aio's current state**: there is no literal "Turn 1"/"Turn 2" labeling
anywhere in the live codebase today (`grep -rn "Turn" apps/web/src` matches
only unrelated copy strings like "Turn into a plan" and "Turn the latest
context..."). Aio's Activity tab renders one block per chat message
(`messages.map` in `AppHome.tsx`), and `RunTimeline`/`RunEventItem` render a
flat, ungrouped list of all run events inside that block — this is closer to
"no turn structure at all" than to "over-labeled with turn numbers." The
checklist's description is best read as a description of the mental model
(one activity block per back-and-forth) rather than a literal string in the
code today.

**All three products studied structure output the same way, and it is not
numbered turn headers**: DeerFlow and Onyx both converge on the identical
pattern — one collapsible container per assistant turn, an aggregate
one-line summary header ("Thought for Ns" / "N steps"), only the most recent
step expanded by default, full step-by-step detail opt-in via a single
toggle. Manus does something adjacent behaviorally (short present-tense
activity lines, not full step lists) but its architecture is not
inspectable. None of the four products count and label turns 1, 2, 3... to
the user.

**Recommendation**: don't introduce numbered turn headers (nothing studied
uses them, and Aio doesn't have them today either). Instead, when Terminal
polish resumes, apply the pattern all three inspectable products converge
on: one summary line per turn ("Thought for 8s" / "6 steps"), full detail
collapsed by default with a one-click expand, and only the newest step shown
inline while a run is still in progress. This is a layout/behavior change to
`RunTimeline`/`RunEventItem`, not a rewrite — no external code needs to be
vendored in.

---

## Overall recommendation for Aio's Terminal panel

**Evolve `RunTimeline`/`ToolCallCard`/`PreviewPane` in place — do not adopt
another product's codebase.** None of the three inspectable repos have code
that's directly portable (different frameworks/design systems for Onyx and
DeerFlow; no code at all for OpenManus). The right takeaways are three
specific, surgical behavior changes, in priority order:

1. **Collapse-by-default with a one-line aggregate summary per turn**
   (DeerFlow + Onyx convergent pattern) — biggest UX win, directly answers
   the turn-display question, moderate-size change to `RunTimeline`.
2. **Short present-tense tool-activity labels** (Manus behavior,
   DeerFlow's per-tool icon+label map) — small, high-value copy/label
   change to `RunEventItem`/tool-name rendering.
3. **Lazy backfill of historical step detail only on first expand**
   (DeerFlow's `SubtaskCard` technique) — relevant once Aio's own sub-agent
   delegation status line (R11.1 #8) ships; not needed for the current
   single-agent case.

Parallel-tool-call tabs (Onyx) and paced step-reveal animation (Onyx) are
noted as "keep in mind for later," not near-term work — Aio doesn't
currently have concurrent tool calls to display.
