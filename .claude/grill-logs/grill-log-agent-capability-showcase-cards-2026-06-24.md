# Grill log: agent capability showcase cards (2026-06-24)

## Origin
3 reference images (Willow AI Agent Platform) sent on Discord:
1. **code-exec card** — chat shows code-gen + "Run the file to see output", right panel Code/Results tabs with script + ranked results table (Top Products by Revenue).
2. **web-research card** — chat shows research summary + sources logo grid, right panel Sources/Key Insights/All Pages tabs, exec summary, "View all N sources"/"Export report".
3. **doc-understanding card** — chat shows PDF review request, right panel Summary/Key Insights/Action Items tabs, PDF file chip, key-insight bars, action-item checklist.

Backend reality check before grilling: `apps/harness` (Hermes-agent) currently only emits generic `tool`/`file` activity events (`HermesActivityData` in `apps/web/src/lib/hermes/chat-types.ts`) — no structured per-task-type payload exists yet.

## Q1 — Backend or frontend builds this first?
A-- Frontend heuristic: guess task type from existing generic tool-call events.
B-- ⭐ Backend structured payload (`task_type: code_exec/web_research/doc_understanding` + data) — bigger lift, more accurate.
C-- Hybrid: structured for 1 type first (code_exec), rest later.
**Picked: B**

## Q2 — How many task types to build first?
A-- All 3 at once.
B-- ⭐ Just 1 first (code_exec), pattern out research/doc later.
**Picked: B**

## Q3 — How does the card render in chat?
A-- Full card (matches reference image) inline in the bubble.
B-- ⭐ Collapsed chip (icon + name + "Xem chi tiết"), full card lives in right panel.
**Picked: B**

## Q4 — Does the right panel auto-switch tabs when a showcase task starts?
A-- ⭐ Yes, auto-switch to the matching tab.
B-- No, user manually clicks the tab.
**Picked: A**

## Q5 — Mobile behavior?
A-- Card stays as-is, detail opens via sheet/overlay (like existing file preview).
B-- ⭐ Card shrinks further on mobile (icon+name only), tap opens full overlay.
**Picked: B**

## Q6 — How does harness know it's a code_exec task (detection)?
A-- Model self-tags `task_type` via prompt (like the `aio-question` mechanism).
B-- ⭐ Harness infers from tool-call pattern (write .py/.js immediately followed by bash-run it) — no model prompt changes needed.
**Picked: B.** Reasoning given: local LM Studio model is unreliable at self-tagging extra metadata; pattern inference from observed tool calls is more stable than trusting a small model to remember a format.

## Q7 — What does the chat chip show?
A-- Icon + task name only.
B-- ⭐ Icon + task name + one short summary line (e.g. "Tạo top_products.py, đã chạy xong").
**Picked: B.** Reasoning: the chip's whole point is showcasing what the agent did inline — hiding everything behind a click defeats that.

## Q8 — Does the chip update in real time (running → done)?
A-- Spinner while running, swaps to ✓ when done (matches existing activity feed pattern).
B-- ⭐ Same as A, plus: chip is disabled/non-clickable until the task finishes.
**Picked: B.** Reasoning: right panel auto-switches tabs on task start (Q4=A) — clicking into the card while still running would land on an empty/incomplete tab (no results yet), so disable until done to avoid that bad state.

## Q9 — Where does the Results table data come from?
A-- Agent prints structured JSON at the end of its own output (needs a prompt instruction to always emit a JSON table at the end).
B-- ⭐ Harness reads the actual output file the code produced (csv/json) via sandbox file-read and parses it into a table.
**Picked: B.** Reasoning: this is a "showcase" feature — if the table breaks because the local model mis-formats JSON, it kills credibility on the very first demo; reading the real file the code actually produced is always correct regardless of model output quality.

## Q10 — `task_type` schema shape
🅰️ Hardcoded type-specific field names.
🅱️ ⭐ `task_type` enum + separate `task_data` object per type.
**Picked: B.** Reasoning: web_research + doc_understanding are coming later — separating now avoids touching old schema when they land.

## Q11 — code_exec error/crash display
🅰️ Dump full traceback into the card.
🅱️ ⭐ Short error line + "Xem log đầy đủ" expand button.
**Picked: B.** Reasoning: card's job is to look like a showcase even on failure; full trace still reachable via expand.

## Q12 — Card persistence across reload
🅰️ Session/RAM-only, lost on reload.
🅱️ ⭐ DB-persisted with the message, survives reload.
**Picked: B.** Reasoning: showcase cards exist to be reviewed later in old conversations — losing them on reload defeats the point.

## Decisions summary
- Build scope: **code_exec only**, full backend support (structured `task_type` payload from harness, inferred from tool-call pattern — write-then-run a script file).
- Chat UI: collapsed chip (icon + name + 1-line summary), spinner while running, disabled-click + ✓ swap when done.
- Right panel: auto-switches to the matching tab set (Code/Results) when the task starts.
- Results table: sourced from the real output file the executed code wrote, not from model-printed JSON.
- Mobile: chip shrinks to icon+name only, tap opens full overlay.
- Deferred (not built yet, pattern to repeat later): web_research and doc_understanding task types — same chip/panel/detection mechanism, different tab sets and data sources, needs its own short grill pass when picked up (different detection heuristic — no "write then run" pattern for these two).
- Schema: `task_type` enum field + separate `task_data` object per type (Q10), extensible for the two deferred types.
- Error handling: short error line + "Xem log đầy đủ" expand for full traceback (Q11) — card stays showcase-clean even on failure.
- Persistence: DB-backed with the message, survives reload (Q12).

## Side quest: grill-me skill format
Spent this session iterating the grill-me skill's own question format 3 times before landing on the final style (locked in `~/.claude/skills/grill-me/SKILL.md` and `memory/feedback_grillme_style.md`):
1. First attempt: digit+lettered markdown bullets, ⭐ inline, short italic reasoning — too compressed ("rối").
2. Second attempt: ultra-short one-liners — also rejected, user wanted full explanations kept since "chúng ta làm những thứ này quan trọng".
3. Third attempt: presented 4 different full-detail formats side-by-side — user picked "Format 4" (UPPERCASE `A--`/`B--` options, `⭐ RECOMMEND` inline, reasoning paragraph after).
4. Final (v2, locked): kept Format 4's wording/trade-off structure, swapped `A--`/`B--` text markers for circled-letter icons (🅰️/🅱️) each in its own visually separated block with an `↳ Trade-off:` line — merged from a "Kiểu 7" sample the user liked. This is the standing format for all future grill-me rounds, confirmed working on the Q10-Q12 batch above.
