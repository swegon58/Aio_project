# Competitive Money Features Research

Date: 2026-06-26
Branch: `research/competitive-money-features`

## Goal

Find high-value product features Aio does not fully have yet, using Onyx, OpenManus, and current AI agent products as reference points.

Aio's direction is not dev/op-first. The useful pattern is a personal/workspace AI operator for knowledge work: research, decisions, recurring checks, deliverables, and safe actions.

## Sources Reviewed

- Onyx official site: https://onyx.app/
- Onyx GitHub README: https://github.com/onyx-dot-app/onyx
- OpenManus GitHub README: https://github.com/FoundationAgents/OpenManus
- OpenAI Deep Research announcement and updates: https://openai.com/index/introducing-deep-research/
- Market scan result for AI agent tools and workflow patterns: https://kollab.im/blog/best-ai-agent-tools-2026
- Agent product feature scan: https://departmentofproduct.substack.com/p/deep-new-ai-agent-product-features

Raw scrape/search outputs are stored locally under `.firecrawl/` and ignored by git.

## What The Market Has

### Onyx

Onyx is strongest at enterprise knowledge and work context:

- Agentic RAG over internal documents and apps.
- 50+ indexing connectors plus MCP.
- Deep Research with multi-step report generation.
- Custom agents with instructions, knowledge, and actions.
- Actions and MCP with flexible auth.
- Code execution for analysis and charts.
- Enterprise governance: SSO, RBAC, analytics, query history, custom safety code, whitelabeling.

Useful Aio takeaway: do not copy enterprise admin complexity first. Copy the user-visible value: connected knowledge, cited answers, reusable agents, safe actions, and shareable outputs.

### OpenManus

OpenManus is strongest as an agent runtime reference:

- Simple general agent loop.
- MCP runner.
- Experimental multi-agent `run_flow`.
- DataAnalysis Agent for analysis and visualization.
- Browser automation support via Playwright/browser-use patterns.

Useful Aio takeaway: OpenManus is more helpful as a runtime/design reference than as a product UX reference. The best borrow is typed run flows, tool orchestration, data-analysis agent roles, and browser/tool safety boundaries.

### Current Agent Products

The broader market is converging on:

- Deep research with citations and progress tracking.
- Background execution and scheduled tasks.
- Connectors to the user's real apps and files.
- Reusable no-code agents/workflows.
- Multi-format deliverables: reports, tables, decks, docs, images.
- Shared spaces/projects with persistent context.
- Usage-based paid plans around advanced runs, connectors, automations, and team controls.

## Aio Gap Assessment

Aio already has foundations:

- Chat workspace.
- Run event protocol and Run Timeline UI.
- Knowledge upload MVP.
- Memory API.
- Scheduled task API surface.
- Credentials/connections settings.
- Billing/credits.
- Gallery/artifacts.
- Tool/event stream plumbing.

Aio does not yet fully have:

- A polished Deep Research workflow with source review and cited final reports.
- First-class source packs/connectors beyond manual upload.
- Durable background runs that notify the user and persist progress.
- User-created reusable agents/workflows.
- A real Tool Center with permissions, risk levels, and approval defaults.
- A deliverable studio for turning outputs into docs/tables/decks.
- Analytics/value proof for paid conversion.

## Feature Bets

Scoring: 5 is strongest. Revenue means ability to justify paid usage. Fit means fit with Aio's non-dev/op direction. Effort is inverted: 5 means easiest relative to payoff.

| Rank | Feature Bet | Revenue | Fit | Effort | Why It Can Make Money |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | Deep Research Workspace | 5 | 5 | 3 | Users pay for time saved on competitive analysis, buying decisions, reports, and planning. This maps directly to paid credits and usage limits. |
| 2 | Recurring Watch Tasks | 5 | 5 | 4 | Scheduled monitors for competitors, prices, jobs, docs, leads, and news create recurring value and habit. This is a strong subscription driver. |
| 3 | Connected Knowledge Packs | 5 | 4 | 3 | App/file connectors make Aio more useful every day. This enables plan gating by connector count, sync frequency, and storage. |
| 4 | Reusable Agent Templates | 4 | 5 | 3 | Non-technical users can save workflows like "weekly market report" or "lead enrichment" and rerun them. Templates make Aio feel like a product, not just chat. |
| 5 | Tool Center With Safe Actions | 4 | 4 | 3 | App actions are where automation becomes valuable, but approvals and permission UX must be clean. Good candidate after timeline/risk protocol. |
| 6 | Deliverable Studio | 4 | 5 | 2 | Reports, tables, briefs, and images are tangible outputs. Good frontend polish can make Aio feel premium quickly. |
| 7 | Workspace Analytics / ROI | 3 | 3 | 4 | Helpful for paid plans and teams, but less important before users have valuable recurring workflows. |

## Recommended Build Order

### 1. Deep Research Workspace

Build this first because Aio now has the needed base: chat, sources, artifacts, Run Timeline, credits, and knowledge.

MVP frontend:

- Add a `Research` mode in the composer or right-panel module.
- User enters a research question, optional constraints, optional files/knowledge.
- Show live plan, searches/sources, source cards, and report sections in Run Timeline.
- Final output becomes an artifact with citations.

MVP backend:

- `research_runs` table or reuse run event persistence when added.
- Source model: URL/file/title/snippet/confidence/used_in_report.
- Runtime loop: plan -> search/scrape -> extract -> synthesize -> cite -> artifact.
- Credit pricing: charge by source count, depth, and model cost.

Approval policy:

- Search/read actions can auto-run.
- External write/actions require approval.
- Show source confidence and failure states instead of pretending certainty.

Monetization:

- Free: small number of light research runs.
- Pro: more sources, longer reports, file attachments.
- Business: connected internal knowledge, team sharing, export formats.

### 2. Recurring Watch Tasks

Build second because it creates retention.

MVP frontend:

- Left menu item: `Scheduled`.
- Create task form: what to watch, frequency, output format, notification destination.
- Today panel shows due/finished watch tasks.
- Each run opens a Run Timeline and report artifact.

MVP backend:

- Reuse `/api/cron` and add persisted watch definitions.
- Store last result summary and diff.
- Use source-specific adapters later; start with web URL/query watch.

Monetization:

- Gate by number of active watches, frequency, and notification destinations.

### 3. Connected Knowledge Packs

Build third after research/watch tasks expose demand for context.

MVP frontend:

- In Settings, rename Knowledge into `Knowledge & Sources`.
- Support file upload plus source packs: Website, Google Drive, GitHub, Notion later.
- Show sync status and last indexed time.

MVP backend:

- Connector registry.
- Sync jobs and chunk indexing status.
- Respect permissions later; start with user-owned tokens and scoped reads.

Monetization:

- Gate by connector count, storage, sync frequency, and team sharing.

### 4. Reusable Agent Templates

Build after users have repeated research/watch patterns.

MVP frontend:

- `Agent Builder` module becomes real.
- Fields: goal, instructions, allowed sources, allowed tools, approval mode, output format.
- Save as a template and pin to home suggestions.

MVP backend:

- `agent_templates` table.
- Template run creates a normal Aio run with bound config.
- Version templates so old runs remain reproducible.

Monetization:

- Gate by number of templates, shared templates, and advanced tool permissions.

### 5. Tool Center With Safe Actions

Build once run/event/approval behavior is stable.

MVP frontend:

- Tool registry grouped by Read, Analyze, Create, External Action.
- Per-tool risk label and default approval behavior.
- Recent tool usage and failure rate.

MVP backend:

- Tool registry metadata.
- Permission policy by user/template/run.
- Audit log for external actions.

Monetization:

- Gate external actions, advanced MCP tools, and team permission controls.

## What Not To Build Yet

- Full enterprise RBAC/SSO analytics before single-user value is proven.
- A visual workflow canvas before simple saved templates work.
- Heavy multi-agent orchestration UI before users understand one reliable agent.
- Generic app marketplace before 3-5 source/action integrations are clearly useful.
- Dev-centric PR/coding workflows unless Aio later pivots toward developer users.

## Immediate Next Decision

Recommended next feature for implementation approval:

**Deep Research Workspace MVP**

Why:

- Highest revenue/fit score.
- Clear competitive precedent from Onyx and ChatGPT Deep Research.
- Uses Aio's existing strengths: Run Timeline, artifacts, credits, knowledge, web tools.
- Produces a visible premium output users can evaluate immediately.

Decision needed from product owner:

1. Should Aio's first premium workflow be `Deep Research Workspace`?
2. Should its first target use case be competitor research, buying research, business report, or personal decision report?
3. Should the MVP use web-only sources first, or web plus uploaded knowledge from day one?
