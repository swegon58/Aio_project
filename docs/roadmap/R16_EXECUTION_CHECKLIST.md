# R16 Execution Checklist — Wire Existing Hermes Capabilities + Deep Research Prep

**Status:** Tier A + free Tier B **committed** 2026-07-13, commit `db97a5c`
on branch `r16-wire-hermes-capabilities`
(worktree `/home/swegon/AI_Agent/Aio_project_r16_hermes_wiring`).
`db97a5c` has since been **FF-merged into `r15-plan-research-rebuild`**
(that branch's new tip), so the R16 work now lives on the working branch —
but is **still NOT on `main` and NOT pushed** (`origin/r15-plan-research-rebuild`
sits at `99058d7`, 1 behind). Pre-push blocker: three files in the
`r15-plan-research-rebuild` working tree carry stale `git stash pop`
conflict markers (`SettingsModal.tsx`, `research-mode.ts`,
`research-mode.test.ts`) — resolve before any commit/push (see
`AIO_PROJECT_STATE.md` top issue block). Re-verified before commit: TS unit
378/378, tsc clean (1 pre-existing unrelated error unchanged), Python 143/143
on all R16-touched test files. Remaining scope (Firecrawl+Exa paid keys,
Tier C browser-automation appsec review) still hard-gated on explicit owner
approval — unchanged, not started.

## Goal

Three research angles (Hermes internals, MCP servers, skill/agent repos) fed
a 3-tier candidate plan. Owner locked **Tier A only** for this phase — wire
capabilities Hermes already has but Aio's product surface doesn't expose.
Tier B and Tier C are parked with pre-decisions recorded so a future phase
can start straight from a decision, not from scratch.

## Decisions (locked 2026-07-12, grill-me 5Q: answers 1a 2b 3a 4a 5a)

1. **Sequencing:** Tier A only this phase. Ship + review before touching B/C.
   **Amended 2026-07-13 (Discord):** owner said auto-continue through A1-A7
   without stopping to ask each time, then auto-continue into the **free**
   Tier B/C items (MarkItDown/PDF-parser MCP, Mem0 self-host trial) once A
   is done — no separate approval gate for those. Still hard-stop and wait
   for explicit approval before: provisioning Firecrawl+Exa (real paid API
   keys, decision #2) or greenlighting browser-automation (needs
   `appsec-engineer` review first, decision #4). Those two gates are
   unchanged from the original lock.
2. **Search stack** (for whenever Tier B starts): **Firecrawl + Exa**
   combined — both paid APIs, needs explicit owner budget approval before
   any key is provisioned. (Not Brave-only, the cheaper option — owner chose
   quality over the lazy-start default.)
3. **Memory:** trial **Mem0 self-hosted** (free, Postgres+vector) in
   parallel with the existing Honcho provider — no replacement, no ripout,
   just an evaluation track.
4. **New product categories** (video-gen, audio-gen, browser-automation):
   **none greenlit this round.** Browser-automation specifically requires an
   `appsec-engineer` review before any future greenlight — agent-initiated
   web actions are a real security/safety surface, not a call to make from a
   research pass alone.
5. **Document export skill** (Anthropic official `docx`/`pdf`/`pptx`/`xlsx`,
   from `anthropics/skills`): **bundled into Tier A** — official, low
   maintenance risk, pairs directly with existing Deep Research output.

**UI reference (owner instruction, 2026-07-12):** for every Tier A item that
adds a new UI surface (A5 skill marketplace, A6 connect flow, UI triggers for
A1/A3/A4/A7 export action) — browse manus.im (https://manus.im/app) first and
match its pattern, adapted to Aio's existing design-system tokens, rather
than inventing a new layout. Backend-only work (A1's API route, A2's
delegate wiring) is unaffected.

## Status Key

- `[x]` done + verified — `[~]` in progress — `[ ]` not started

---

## Before starting: `origin/main` anomaly — resolved

Discovered 2026-07-12: `origin/main` on GitHub was already at `99058d7`
(the `r15-plan-research-rebuild` tip) — not via a tracked PR merge
(`gh pr list --state merged` showed no such PR). Local `main` ref was stale
at `5961baa` (6 commits behind). Owner said resolve it and proceed.

- [x] **R16.0** Verified true fast-forward (`git merge-base --is-ancestor
      main origin/main`), then `git branch -f main origin/main`. Local
      `main` now `99058d7`, matches `origin/main` and
      `r15-plan-research-rebuild`. How the direct push happened is still
      unconfirmed — not a blocker, revisit only if it causes a concrete
      problem. `AIO_PROJECT_STATE.md` updated to match.
- [x] **R16.1** Branch `r16-wire-hermes-capabilities` cut off `main`
      (`99058d7`), isolated worktree at
      `/home/swegon/AI_Agent/Aio_project_r16_hermes_wiring` (kept separate
      from `r15-plan-research-rebuild`'s dirty tree).

## Tier A — wire what Hermes already has (this phase's scope)

Ranked by product leverage per `hermes-architect` audit (2026-07-12):

- [x] **A1. MCP integrations marketplace, read-write.** Done 2026-07-13
      (worktree `Aio_project_r16_hermes_wiring`, uncommitted). Added
      POST/PATCH/DELETE to `apps/web/src/app/api/integrations/mcp/route.ts`
      via new `apps/web/src/lib/hermes/mcp-cli.ts` subprocess bridge (same
      `spawn` pattern as `provision.ts`). Security stays in `hermes_cli`
      (`mcp_security.py`'s `validate_mcp_server_entry`) — not reimplemented
      in TS. Fixed a real bug found along the way: `enable`/`disable`/
      `remove` always exit-0'd even on failure, breaking scripted callers —
      fixed at the dispatcher. Tests: Python 174/174+1 skipped, TS 361/361,
      tsc clean (1 pre-existing unrelated error untouched). Out of scope
      (deliberate): OAuth `login` (no headless browser flow), `add`/
      `configure` (too interactive), plan-tier gating (no MCP gate exists
      yet in `pricing.ts`, not invented here — product decision).
      **Ops flag (not fixed, not blocking):** live `hermes` binary
      (`~/.local/bin/hermes`) runs a separately-deployed copy at
      `~/.hermes/hermes-agent/`, not a symlink to git — worktree changes
      need a deploy/sync step before they're live. No true end-to-end HTTP
      smoke test against the live binary was done (would've touched shared
      `aio-app.service`); substituted real CLI-contract verification via a
      scoped wrapper + mocked-CLI route unit tests instead.
      UI trigger for this ("Connect a tool" marketplace) is A5/A6, not this
      item — and per owner instruction 2026-07-12, that UI should match
      manus.im's pattern.
- [x] **A2. Delegate/sub-agent parallel research wiring — BLOCKED, not
      wired.** Investigated 2026-07-13 (worktree `Aio_project_r16_hermes_wiring`,
      uncommitted). Real finding, verified via diff: fan-out is **not safely
      buildable today**. `delegate_task` at top level is hard-forced into
      background mode (`delegate_tool.py`/`run_agent.py`); completion is
      delivered by `gateway/run.py`'s watcher calling `adapter.handle_message`
      — but Aio's web chat runs on `APIServerAdapter`, whose `send()` is a
      permanent no-op stub (HTTP request/response only, no push channel, no
      polling endpoint either — grepped, zero hits). A background subagent
      would finish and its result would be **silently dropped**. Interim fix
      applied: one guardrail line added to `RESEARCH_INSTRUCTIONS` in
      `research-mode.ts` telling the model not to use `delegate_task`
      (7/7 tests pass), plus a code comment documenting the gap so this
      isn't re-attempted blind. **New prerequisite for a future phase:**
      ship a delivery channel for `APIServerAdapter` (poll endpoint or
      resumable SSE) — Hermes gateway/platform work, cross-cutting beyond
      Deep Research, belongs in its own item, not folded into A2.
- [x] **A3. Mixture-of-Agents "deep answer" mode.** Done 2026-07-13
      (worktree, uncommitted). Manifest entry added: `category: "toolset"`,
      `risk: "guarded"`, `networkScope: "provider_only"`, `timeoutMs:
      300_000` (5 frontier-model calls: Opus/Gemini Pro/GPT-5.4-Pro/DeepSeek
      + Opus aggregator). **Cost-control gap closed:** `moa` was previously
      ungated on every tier (most expensive toolset in the catalog, unlike
      the free-riding `session_search`) — added to `ALL_GATEABLE_TOOLSETS`
      + gated Business-tier-only, matching precedent for other
      expensive toolsets. No dedicated UI trigger built — confirmed
      `ToolCallCard.tsx` is the only manifest consumer and it's a generic
      post-hoc run-timeline card (fallback Wrench icon), same as every
      other toolset; a real discoverable "Deep Answer" picker is a frontend
      follow-up (manus.im-pattern per owner instruction), not built here.
- [x] **A4. `session_search` manifest.** Done 2026-07-13 (worktree,
      uncommitted). Manifest entry added: `risk: "safe"`, `networkScope:
      "none"`, local SQLite/FTS5 read only. Already in `_HERMES_CORE_TOOLS`
      and never gated — left `pricing.ts` untouched (adding it to
      `ALL_GATEABLE_TOOLSETS` would newly require per-tier unlock and
      regress the "already works everywhere" state). Zero backend work,
      as the roadmap predicted. Tests: `tool-manifest.test.ts` 4/4,
      `pricing.test.ts` 3/3, tsc clean.
- [x] **A5. Skill marketplace — done (backend + UI).** Done 2026-07-13
      (worktree, uncommitted). **Correction to original scope:**
      `skill_manager_tool.py` is the agent's own procedural-memory
      self-authoring tool, NOT the marketplace — the real marketplace layer
      is `hermes_cli/skills_hub.py` (browse/install/enable/disable/etc.) +
      `skills_config.py` + `tools/skills_guard.py` (security gate, stayed
      in `hermes_cli`, not reimplemented). Added `GET/POST/PATCH
      /api/integrations/skills`, `apps/web/src/lib/hermes/skill-cli.ts`
      (same shape as A1's `mcp-cli.ts`). Bug fixed: `do_install` silently
      returned `None` on early-exit paths (same class of bug as A1's
      exit-code fix). No `DELETE`/uninstall yet (CLI supports it, not
      wired — YAGNI). New `SkillsMarketplacePanel` in `SettingsModal.tsx`
      (self-fetching tab, matches existing tab pattern), scoped to what the
      API actually returns: installed-skills list + toggle, plus a raw
      identifier/URL install form (**no browse/catalog UI yet** —
      `hermes skills browse/search` exists CLI-side but isn't wired to any
      endpoint; flagged as a real follow-up, not fabricated in the UI).
      manus.im reference still blocked (CAPTCHA, can't bypass) — built to
      match Aio's own existing settings-tab visual language instead.
      Tests: Python 83/83, TS unit 15/15, **real Playwright run** (not just
      typecheck): 2 new e2e tests 4/4 (desktop+mobile chromium), full
      `r11-settings-and-vision.spec.ts` 14/14 (no regressions), `app-smoke`
      4/4.
- [x] **A6. One-click Linear/n8n connect — done.** Done 2026-07-13
      (worktree, uncommitted). Zero backend changes needed — A1's
      `POST/PATCH/DELETE /api/integrations/mcp` + `mcp-cli.ts` already
      covered the contract (`POST {name, env?}`). New `McpConnectionsPanel`
      in `SettingsModal.tsx`'s Connected Apps tab: n8n gets a real 2-field
      form (Base URL + password-masked API key, client-validated) →
      `POST {name:"n8n", env:{N8N_BASE_URL, N8N_API_KEY}}`; Linear gets a
      single "Connect Linear" button → `POST {name:"linear"}` (no env).
      No pricing-tier gate added (no existing per-integration convention to
      follow, per A3/A4's only-gate-cost-risk precedent).
      **New blocker found (same class as A2):** Linear's OAuth cannot
      actually complete through this architecture — `mcp_oauth_manager.py`'s
      `_build_provider()` throws `OAuthNonInteractiveError` for any non-tty
      caller (the web install subprocess always is), `mcp_oauth.py`'s
      `_wait_for_callback()` binds the redirect HTTP server to
      `127.0.0.1` **on the server**, not the end user's browser/machine, and
      the same failure recurs on every live tool-call (`mcp_tool.py`
      ~L1973-1982), not just install. `hermes mcp install linear` still
      exits 0 because `mcp_catalog.py`'s `_probe_tools()` swallows the probe
      exception and falls back to manifest defaults — the config entry is
      real, sign-in is not. UI reflects this honestly: "Added — sign-in
      still needed" status, not a fake "Connected". Root fix (a real OAuth
      callback path reachable from the connecting user's own browser) is a
      platform-level item, not scoped to A6 — flagging alongside A2's
      `APIServerAdapter` gap as a pair of pre-Tier-B delivery-channel/auth
      prerequisites worth sizing together later.
      Tests: Playwright 22/22 (4 new: n8n success/empty-key/bad-url, Linear
      connect), unit 377/377, tsc clean (1 pre-existing unrelated error
      unchanged). manus.im still CAPTCHA-blocked, matched Aio's own
      settings-tab style per A5 precedent.
- [x] **A7. Document export skill — done (docx only, scope-corrected).**
      Done 2026-07-13 (worktree, uncommitted). **Scope correction:**
      `anthropics/skills` only ships an official `docx` skill today (no
      pdf/pptx/xlsx equivalents upstream) — shipped that one, not the
      originally-assumed four. Real import mechanism is manual vendoring
      into the git-tracked profile tree
      (`apps/harness/aio-home/profiles/aio/skills/productivity/docx/`, 61
      files, trimmed `SKILL.md` frontmatter, matches existing `powerpoint`
      vendoring precedent) — the marketplace CLI from A5
      (`hermes skills install`) writes to a runtime hub dir, not the
      product's shipped profile, so it was the wrong mechanism for a
      bundled default skill. Export UI: new "Export report as Word
      document" button in `RightPanel.tsx`'s report view (next to existing
      Markdown/PDF export), sends a follow-up **agent chat turn**
      (`EXPORT_DOCX_INSTRUCTION` in `research-mode.ts`, forced `mode:
      "auto"` so it can't re-trigger the plan wizard) rather than a
      web-layer file-generator — confirmed this matches Aio's
      agent-does-the-work precedent (image-gen). Existing `.docx` artifact
      pipeline (`api_server.py` `_ARTIFACT_EXTENSIONS`,
      `hermes-event-mapper.ts`) already covers delivery, zero backend
      changes needed. No pricing-tier gate (no existing convention forces
      one, A3/A4/A6 precedent). **FYI, not fixed (pre-existing, out of
      scope):** vendored `powerpoint` skill is missing several files its
      own docs reference (`scripts/thumbnail.py`,
      `scripts/office/{unpack,soffice,validate}.py` + validators) — a
      pre-existing incomplete-vendor gap, unrelated to this session's
      `docx` work, worth a follow-up ticket.
      Tests: unit 378/378, Playwright **full suite** 46/46 (no
      regressions), lint 0 errors, tsc clean (same 1 pre-existing unrelated
      `run-orchestrator.ts` error as A6, confirmed not caused by this work).

## R16 Tier A — CLOSED (2026-07-13)

All 7 items (A1-A7) shipped in the `r16-wire-hermes-capabilities` worktree,
uncommitted pending owner review. Two platform-level blockers surfaced
along the way (both documented in-place above, not fixed — out of scope for
wiring-only work): `APIServerAdapter` has no background-result delivery
channel (A2), and Linear's OAuth can't complete server-side without a
callback path to the connecting user's own browser (A6). Recommend sizing
those two together before any future background-task or full-OAuth-MCP UX.
Next: per owner's locked auto-continue decision, proceed into the **free**
Tier B/C items (MarkItDown/PDF-parser MCP, Mem0 self-host trial) — hard-stop
before Firecrawl+Exa paid provisioning or browser-automation appsec
greenlight. See `[[project_r16_wire_hermes_plan]]` memory / this file's
Decisions section for the parked items and their gates.

## New blocker found during A2 (2026-07-13, not pre-decided, needs owner sequencing)

- **`APIServerAdapter` has no result-delivery channel.** Blocks A2 (and any
  future "background task" UX) until fixed. Needs a poll endpoint or
  resumable SSE stream in `gateway/platforms/api_server.py` — Hermes
  gateway-side work, not an Aio-web change. Not scoped/sized yet.

## Tier B — free items (auto-continued 2026-07-13)

- [x] **MarkItDown + pdf-mcp catalog entries — done.** Done 2026-07-13
      (worktree, uncommitted). Two new Nous-approved manifests, same
      pattern as `linear`/`n8n`: `optional-mcps/markitdown/manifest.yaml`
      (official Microsoft `markitdown-mcp`, PyPI, 165k★, `uvx`-run,
      `auth: none`, single `convert_to_markdown(uri)` tool — PDF/Office/
      image/audio/HTML→Markdown) and `optional-mcps/pdf-mcp/manifest.yaml`
      (community `jztan/pdf-mcp`, picked over ~15 candidates on star count
      + active commits, `auth: none`, 9 tools — paginated read, hybrid
      search, structured table/image extraction with bbox coords, OCR,
      TOC; covers what markitdown doesn't). Both verified for real against
      an isolated scratch profile: `hermes mcp install <name>` succeeded,
      `_probe_tools()` did a live `uvx` stdio handshake and returned the
      exact real tool lists.
      **No UI/backend changes** — deliberately, after checking two things:
      (1) the generic `POST /api/integrations/mcp` from A1 already accepts
      installing any catalog name with zero code changes, so these are
      installable today; (2) wiring them into Knowledge Center's upload
      pipeline would mean web-layer-driving an MCP subprocess outside any
      agent loop, against the established agent-does-the-work pattern
      (A7) — not built.
      **Two blockers found, neither fixed (out of scope):**
      (a) `McpConnectionsPanel` (`SettingsModal.tsx`) is hardcoded to only
      `linear`/`n8n` rows — there is no generic "browse full catalog /
      install by name" MCP UI (unlike A5's skill-marketplace panel, which
      does have a raw-identifier install form). markitdown/pdf-mcp are
      installable via the API but invisible in the product UI today.
      (b) **Pre-existing, unrelated to this item:** Knowledge Center's
      PDF/DOCX ingestion (`/api/knowledge/docs/route.ts` L100-114,
      `ingest-utils.ts`'s `extractTextFromBuffer`) is a dead stub — uploads
      of those types are set to `status: "parsing"` and never advance; the
      extraction function isn't even called by the live route. Predates
      R16, found while checking whether these MCPs could wire into it.
      Worth its own ticket regardless of MCP work.
- [x] **Mem0 self-host trial — done.** Done 2026-07-13 (worktree,
      uncommitted). `plugins/memory/mem0/__init__.py` gained a `mode` config
      key (`MEM0_MODE` env, `platform`|`self_hosted`, **default stays
      `platform`** — no ripout, Honcho unaffected either way). self_hosted
      builds `mem0.Memory.from_config(...)` with a `pgvector` vector store
      (`MEM0_PG_DSN`/`MEM0_PG_COLLECTION` env). Schema-driven `hermes memory
      setup` wizard picks up the new fields automatically (`get_config_schema`
      extended, no wizard code touched). `pyproject.toml` +
      `plugin.yaml`: new `mem0` extra (`mem0ai==2.0.11`,
      `psycopg[binary,pool]`), deliberately not in `[all]`, matching Honcho
      precedent. No new UI (none existed for provider selection to extend).
      Tests: 25/25 (mem0-specific, 8 new) + 374/374 (full memory-provider
      regression sweep). **Real vs stubbed, stated plainly:** real
      `mem0ai`/`psycopg` installed and import/signature-checked live;
      config-building logic tested against a monkeypatched `Memory.from_config`
      capturing the real dict — **not exercised against a live Postgres/
      pgvector instance** (none available in sandbox). Eval-track scope only,
      per the locked decision — a real DB trial is the next step whenever
      someone actually evaluates it.
      **Pre-existing debt noted, not fixed:** mem0 (both modes, predates
      this change) isn't wired into `tools/lazy_deps.py`'s `ensure()`
      framework despite repo policy requiring memory-provider deps to live
      there exclusively (same as Honcho already not being wired — not
      introduced by this change).
- Firecrawl + Exa MCP for real Deep Research content (paid — decision #2
  above; needs owner budget sign-off before provisioning keys). **Not
  started — hard-stop, needs explicit owner approval.**
- ElevenLabs (audio-gen) / Notion / Slack MCP — researched, not prioritized.

**Tier B free items: CLOSED (2026-07-13).** Both MarkItDown/pdf-mcp and
Mem0 self-host trial shipped. Remaining Tier B (Firecrawl+Exa) and all of
Tier C are gated on explicit owner approval per the locked decisions above
— stopping here.

## Parked — Tier C (pre-decided, not started, next phase candidate)

- Claude Deep Research Skill pattern (`199-biotechnologies/claude-deep-research-skill`)
  — upgrade the local `research` skill; pairs naturally with Tier B search
  stack work, so likely sequenced together.
- `visual-skills` (video-gen, already targets Hermes) — no category
  greenlight yet (decision #4).
- Browser automation (`vercel-labs/agent-browser` vs `browser-use/browser-use`,
  pick one) — **requires `appsec-engineer` review before any future
  greenlight**, not a call made in this research pass.
- Chief of Staff / Personal Growth Mentor persona agents
  (`msitarzewski/agency-agents`) — low urgency, only worth pulling if
  personal-assistant-style chat gets real product investment.

## Research provenance (condensed, 2026-07-12)

Three parallel agents, full findings live in this session's transcript only
— condensed here so a future session doesn't need to re-read it:

- **Hermes capability audit** (`hermes-architect`): 8 ranked findings; top 3
  feed A1–A3 above. Also flagged as open question (not confirmed): whether
  `voice_mode.py`/`neutts_synth.py` go beyond the current TTS-only manifest
  entry — unexamined, don't build a feature narrative on it without reading
  those files first.
- **Skill/repo research** (general-purpose, web search): 12 candidates
  ranked; top 2 feed Tier C. Already-covered/skip: Superpowers (already
  installed), agency-agents' Trend/UX Researcher agents (duplicate of Aio's
  existing `trend-researcher`/`ux-researcher`).
- **MCP server research** (general-purpose, web search): checked
  `optional-mcps/` first (only linear/n8n/unreal-engine present, no overlap);
  10 candidates ranked; top 3 feed Tier B search-stack decision.
