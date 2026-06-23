# Aio Feature Research: Competitive & UX Analysis

**Date:** June 2026  
**Research Scope:** Competitive agent products, UX patterns, backend features, reusable resources  
**Target:** Inform Aio `/app` workspace build plan post-landing page

---

## Competitor Feature Matrix

| Product | Core Layout | Key Tabs/Panels | Standout UX Feature | Source |
|---------|-------------|-----------------|---------------------|--------|
| **Manus.im** | Split: desktop stream + VS Code-view toggle | Live browser view, file tree, logs | Real-time agent action visualization on user's desktop or cloud; multi-agent planning subagent | [Cybernews Review](https://cybernews.com/ai-tools/manus-ai-review/), [AlphaMatch Blog](https://www.alphamatch.ai/blog/manus-my-computer-ai-agent-desktop-2026) |
| **Devin (Cognition)** | Kanban-first Agent Command Center above IDE editor | Spaces (project grouping), agent sessions, PR/task grouping | Agent Command Center = Kanban of all active sessions; context-sharing across agents via Spaces | [Devin Docs](https://docs.devin.ai/release-notes/2026), [The Agent Report](https://the-agent-report.com/2026/06/cognition-devin-desktop-agent-orchestration/) |
| **Perplexity Comet** | Chat window + Assistant panel (upper-right) + Preview window | Main chat, shortcuts panel, preview | Agent chaining (multi-agent handoff); real-time preview of agent clicks/actions; voice input | [AIFire Guide](https://www.aifire.co/p/a-guide-to-perplexity-comet-your-first-autonomous-ai-system), [Comet Resource Hub](https://www.perplexity.ai/comet/resources) |
| **ChatGPT Operator** | Chat pane + desktop/activity toggle | Desktop view (live GUI), Activity view (reasoning steps) | Activity view = transparent step-by-step reasoning; virtual browser + terminal + API access | [OpenAI Operator Blog](https://openai.com/index/introducing-operator/), [NovaEdge Guide](https://www.novaedgedigitallabs.tech/blog/chatgpt-agent-mode-complete-guide-2026) |
| **Claude Computer Use** | Split: prompt panel + live desktop | Agent output, screenshot history | Visual reasoning via screenshots (human-like interaction); sandboxed X11 environment | [Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool), [Skywork Guide](https://skywork.ai/blog/how-to-use-claude-computer-use-automation-guide/) |
| **Replit Agent** | Browser-based full-stack IDE + chat sidebar | Code workspace, runtime, database, deployment, secrets, chat loop | Parallel agents, managed database/auth/storage built-in, one-click deployment | [Replit Agent Blog](https://www.mindstudio.ai/blog/what-is-replit-agent), [ToolDirectory Review](https://tooldirectory.ai/tools/replit) |

---

## UX/UI Patterns

### Tab/Panel Placement
- **Sidebar (left):** Used by Aio (current), Devin Desktop, Replit — best for persistent context hierarchies
- **Top tabs:** Less common in agent UIs; used for secondary navigation within a section
- **Bottom navigation:** Mobile-first pattern; 40% faster task completion in user testing than hamburger menus ([Design Studio UIUX](https://www.designstudiouiux.com/blog/mobile-navigation-ux/))
- **Hybrid (sidebar + drawer):** Emerging pattern for complex agent workspaces with many secondary features
- **VS Code style:** Devin and Manus both support IDE-style layouts with collapsible explorer panels

### Live Progress & Agent Status Visibility
- **Streaming tokens:** Most show live chat bubbles with streaming text (Vercel AI SDK pattern)
- **Tool call events:** Modern pattern via AG-UI protocol—display tool arguments, execution status, results in real-time with icons ([CopilotKit AG-UI Blog](https://www.copilotkit.ai/blog/master-the-17-ag-ui-event-types-for-building-agents-the-right-way))
- **Activity/reasoning pane:** ChatGPT Operator and Claude Code show step-by-step thinking; builds trust
- **Progress indicators:** Kanban views (Devin) or visual timeline of agent steps work better than spinning loaders
- **Live desktop capture:** Manus, ChatGPT Operator, and Claude Computer Use show actual browser/UI interactions—most transparent but requires infrastructure

### File & Artifact Display
- **Tree view:** All IDEs (Replit, Devin) show file browser; increasingly common in agent UIs
- **Gallery view:** Aio already has this for images; some products (GitHub Artifacts) extend to multi-format previews
- **Inline artifacts:** Assistant-ui pattern = render tool outputs directly in chat as React components or JSON cards
- **Version history:** Modern practice (Claude Code, Devin Desktop) — every artifact publish creates a new version link
- **Search across artifacts:** Increasingly expected for workspaces with 10+ outputs

### Chat History & Multi-Session Management
- **Thread list sidebar:** Standard pattern (Aio, most SaaS chat apps)
- **Unified search:** Cross-session history search crucial when agent sessions span days/weeks
- **Session tags/labels:** Helps organize by project, date, type of work
- **Fork/duplicate:** Perplexity Comet and ChatGPT allow sharing agent configurations or session forks
- **Auto-naming:** Aio already implements; most competitors do too

### Settings/Credentials/Integrations
- **Dedicated modal/drawer:** Aio's current Settings modal works; Perplexity uses a sidebar panel
- **Credentials panel:** Tab showing connected external accounts (Gmail, Notion, Slack, GitHub)
- **Granular permissions:** Which integrations can the agent access? UI should expose scope clearly
- **Team/workspace settings:** Emerging for multi-user agent products
- **Secret management:** Env vars, API keys never shown in plaintext; only "connected" status

### Mobile Responsiveness
- **Chat-primary:** Mobile should hide file tree by default, show chat full-width with hamburger for sidebar
- **Large tap targets:** Buttons 44px+, following WCAG mobile guidelines
- **Bottom input:** Prompt box at bottom, not top (thumb-friendly)
- **Reduced columns:** 1-column layout for mobile vs. 3-column desktop standard
- **Bottom tabs:** If using tabs, bottom placement outperforms top on mobile

---

## Backend/Product Features Users Expect

### Memory & Context Persistence
- **Cross-session memory:** Vector DB or knowledge graph storing agent learnings; top frameworks in 2026: Cognee, Mem0, Zep ([Atlan Comparison](https://atlan.com/know/best-ai-agent-memory-frameworks-2026/))
  - *Why:* Users expect agent to remember preferences, past decisions, document context from previous sessions
- **Temporal knowledge graphs:** Distinguish current facts from past facts (Graphiti/Zep pattern)
  - *Why:* Stale context breaks trust; agents need to know "this was true yesterday, but changed today"
- **Multi-scope memory tagging:** Session + user + workspace scopes for retrieval ([Atlan Multi-Scope Pattern](https://atlan.com/know/agent-memory-architectures/))
  - *Why:* Team workspaces need per-user and shared memory layers

### File Handling & Uploads
- **Drag-and-drop upload:** Standard UX expectation in chat interfaces
- **Attachment types:** Images, PDFs, code files, spreadsheets should all be supported
- **File preview:** User should see what the agent sees before submission
- **File tree with search:** For workspaces with many artifacts
- **Output download:** Export agent results as JSON, CSV, Markdown, or zip

### Integrations Marketplace
- **Native connectors:** Slack, Notion, Gmail, Google Workspace, GitHub ([Notion Integrations](https://www.notion.com/connections), [Slack Marketplace](https://slack.com/integrations))
  - *Why:* Users expect to sync agent outputs to their existing tools without manual copy-paste
- **MCP servers:** Claude Code pattern—use standard MCP for extensibility instead of custom API ([MindStudio Guide](https://www.mindstudio.ai/blog/connect-claude-code-notion-gmail-mcp-servers))
  - *Why:* Decouples Aio's core from integration code; community can contribute

### Scheduled/Recurring Tasks
- **Dedicated task management page:** ChatGPT added this in 2026; shows prompt, recurrence, next run, status ([Windows News](https://windowsnews.ai/article/chatgpt-scheduled-tasks-gets-dedicated-page-after-reliability-overhaul.427609))
  - *Why:* Users want cron-like automation without leaving the UI
- **Status indicators:** Green (scheduled), red (failed), grey (paused)
- **Execution history:** Logs of past runs, outputs per run

### Browser Automation Visibility
- **Live screenshot stream:** Real-time or on-demand screenshot of agent's virtual browser ([Firecrawl Blog](https://www.firecrawl.dev/blog/best-browser-agents))
  - *Why:* Users trust what they can see; opaque agent action = distrust
- **Click/input visualization:** Show cursor position, form fills, navigation path
- **Network panel:** Optional; power users want to see API calls the agent makes

### Team/Workspace Sharing
- **Shareable agent configs:** One-click link to duplicate an agent or chat with it ([OpenAI Workspace Agents](https://openai.com/academy/workspace-agents/))
  - *Why:* Enables repeatable workflows across teams
- **Real-time collaboration:** Multiple users editing same workspace (Google Docs model)
- **Shared scratchpad:** All agents in workspace read/write to same context file
- **Permission model:** Owner, editor, viewer roles at minimum

### Usage/Credits Dashboard
- **Token/credit meter:** Real-time display of tokens consumed, credits remaining, estimated cost per interaction ([Windows News - Copilot Billing](https://windowsnews.ai/article/copilot-to-usage-billing-june-1-2026-ai-credits-token-costs-and-meter-shock.420900))
  - *Why:* Prevents bill shock; essential for paid agent products with per-token billing
- **Usage breakdown:** By model, by tool, by user (for teams)
- **Spending alerts:** Notify when approaching budget or when costs spike

---

## Reusable Resources Found

### Component Libraries

1. **[assistant-ui](https://github.com/assistant-ui/assistant-ui)** (9.9k GitHub stars, Y Combinator-backed)
   - Production-ready React/TypeScript library for AI chat interfaces
   - Composable primitives: Thread, Message, Composer, ActionBar
   - Ships with shadcn/ui starter template
   - Built-in: streaming, auto-scroll, attachments, markdown, voice dictation, keyboard shortcuts
   - Supports generative UI (render tool calls as React components)
   - Integrates with Vercel AI SDK, LangGraph, or custom backends
   - **Status:** Active, well-maintained
   - **Aio fit:** Could accelerate chat component iteration beyond current impl

2. **[21st.dev](https://glama.ai/mcp/servers/@oyasimi1209/magic-mcp/)** (community shadcn/ui marketplace)
   - Agent templates: Web Scraper, API Designer, Support Agent, Data Analyst
   - Anyone can publish shadcn-compatible components
   - Installs via shadcn CLI
   - **Aio fit:** Browse for pre-built agent templates matching planned features

3. **Figma Community UI Kits for AI Agents**
   - [AI Agent UI Kit](https://www.figma.com/community/file/1644825120881335966/) — chat interfaces, agent dashboards, LLM wrappers
   - [Figma UI Kit for AI Agent Chat Apps (freemium)](https://www.figma.com/community/file/1496647384826493443/) — dark mode, 2 dashboard screens
   - [Copilot UI Kit](https://www.figma.com/community/file/1220148787159138654/) — AI/ChatGPT/Copilot dashboards
   - **Aio fit:** Reference for Settings modal, Activity gallery, credit metering UI

### Frameworks & Protocols

4. **[AG-UI Protocol](https://www.copilotkit.ai/blog/master-the-17-ag-ui-event-types-for-building-agents-the-right-way)** (open standard for agent–UI streaming)
   - Event-based protocol: TOOL_CALL_ARGS, TOOL_CALL_END, TOOL_RESULT, STATE_UPDATE, etc.
   - Standardizes real-time communication between agent backend and frontend
   - Enables transparent progress visualization without custom code
   - **Aio fit:** Design pattern for streaming tool calls in real-time chat UI

### Design Patterns

5. **[Agentic Design Patterns](https://agentic-design.ai/patterns/ui-ux-patterns)** (structured UX library)
   - Four principles: transparency, user control, proactive status, structured error recovery
   - Mobile-first patterns: high-contrast chat, large tap targets, voice input, accessibility
   - Common failure: ship capable agent with no UI visibility (black box)
   - **Aio fit:** Reference before finalizing Settings/Activity tabs and Settings modal

---

## Gap Analysis for Aio

**Ranked by frequency of appearance across competitors (table-stakes first) + strategic importance**

| Priority | Feature | Why It Matters | Source/Competitors | Effort Est. |
|----------|---------|----------------|-------------------|-----------|
| **P0** | **Scheduled/Recurring Tasks page** | 5/6 competitors (Manus, Devin, Perplexity, ChatGPT, Replit) expose task scheduling; Aio has no dedicated UI. Users will ask "can I run this daily?" | [ChatGPT Scheduled Tasks](https://windowsnews.ai/article/chatgpt-scheduled-tasks-gets-dedicated-page-after-reliability-overhaul.427609) | Medium (backend exists via Daytona, UI is new page) |
| **P0** | **Live agent progress visualization** | ChatGPT, Manus, Claude Computer Use all show real-time step visualization. Aio's current chat-only UI hides what agent is doing. Trust issue. | [AG-UI Protocol](https://www.copilotkit.ai/blog/master-the-17-ag-ui-event-types-for-building-agents-the-right-way), [Agentic Design](https://agentic-design.ai/patterns/ui-ux-patterns) | Medium (requires streaming tool calls + new Activity panel) |
| **P1** | **Credit/usage metering dashboard** | GitHub Copilot switching to metered billing June 1, 2026. Aio's planned $9/$19/$99 model requires transparent usage tracking. | [GitHub Copilot Billing](https://windowsnews.ai/article/copilot-to-usage-billing-june-1-2026-ai-credits-token-costs-and-meter-shock.420900) | Small (display layer + backend metering) |
| **P1** | **Integrations/Connections tab (marketplace)** | 4/6 competitors offer integration browsing (Perplexity, ChatGPT, Replit, Manus). Aio's Settings has placeholder; needs actual marketplace. | [Notion Integrations](https://www.notion.com/connections), [Slack Marketplace](https://slack.com/integrations) | Large (OAuth flows, per-integration UI, security review) |
| **P1** | **File browser/tree view in workspace** | Replit, Devin, Manus all show file trees. Aio has chat + right panel (Settings/Activity) but no persistent file view. Users need context of what files agent is working with. | [Replit Workspace](https://www.mindstudio.ai/blog/what-is-replit-agent) | Medium (add left sidebar tab or replace Activity subtab) |
| **P2** | **Cross-session memory/knowledge graph UI** | Cognee/Mem0/Zep are production standard for agents. Aio doesn't expose memory state to users. Differentiator if visualized well. | [Atlan Memory Architectures](https://atlan.com/know/agent-memory-architectures/) | Large (memory system selection + retention UI) |
| **P2** | **Workspace sharing & team collaboration** | ChatGPT Workspace Agents, Devin Spaces, and Replit multi-user all launched 2026. Solo-first Aio doesn't need this yet, but roadmap item. | [OpenAI Workspace Agents](https://openai.com/academy/workspace-agents/) | Large (permission model, real-time sync) |
| **P3** | **Mobile-optimized `/app` layout** | No competitor fully solved this; mobile agent UIs still laggy. ~30% of users expect mobile support. | [Mobile Navigation Patterns](https://www.designstudiouiux.com/blog/mobile-navigation-ux/) | Medium (1-col layout + hamburger sidebar) |
| **P3** | **Artifact versioning & rollback** | Claude Code, Devin, GitHub Copilot all ship version history. Aio's Activity gallery doesn't expose old versions. | [Claude Code Artifacts](https://docs.claude.com/changelog) | Small (UI wrapper around existing artifact IDs) |
| **P3** | **Live browser capture for automation tasks** | Manus and ChatGPT show agent's virtual browser. Aio doesn't (sandboxed via Daytona internally). Optional visual polish. | [Manus My Computer](https://www.alphamatch.ai/blog/manus-my-computer-ai-agent-desktop-2026) | Large (requires Daytona integration) |

---

## Summary: What to Build First (Post-Landing Page)

**Immediate priorities for `/app` v2:**
1. **Scheduled Tasks page** — table-stakes feature; unlock recurring automation UX
2. **Live tool call progress in chat** — transparency builds trust; AG-UI pattern available
3. **Usage/credits meter** — billing prerequisite; small display component
4. **File browser sidebar** — context awareness; medium scope
5. **Integrations discovery** — marketplace UI (can launch minimal OAuth support)

**Longer-term differentiators:**
- Memory/knowledge graph visualization (only once memory backend selected)
- Workspace sharing (multi-user features)
- Live agent screen capture (polish, not MVP)

---

## Sources

- [Cybernews: Manus AI Review 2026](https://cybernews.com/ai-tools/manus-ai-review/)
- [AlphaMatch: Manus My Computer AI Agent Desktop 2026](https://www.alphamatch.ai/blog/manus-my-computer-ai-agent-desktop-2026)
- [Devin Docs: Release Notes 2026](https://docs.devin.ai/release-notes/2026)
- [The Agent Report: Devin Desktop Agent Orchestration](https://the-agent-report.com/2026/06/cognition-devin-desktop-agent-orchestration/)
- [AIFire: Perplexity Comet Guide](https://www.aifire.co/p/a-guide-to-perplexity-comet-your-first-autonomous-ai-system)
- [Perplexity Comet Resource Hub](https://www.perplexity.ai/comet/resources)
- [OpenAI: Introducing Operator](https://openai.com/index/introducing-operator/)
- [NovaEdge: ChatGPT Agent Mode Guide 2026](https://www.novaedgedigitallabs.tech/blog/chatgpt-agent-mode-complete-guide-2026)
- [Claude API Docs: Computer Use Tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)
- [Skywork: Claude Computer Use Automation Guide](https://skywork.ai/blog/how-to-use-claude-computer-use-automation-guide/)
- [MindStudio: What is Replit Agent](https://www.mindstudio.ai/blog/what-is-replit-agent)
- [ToolDirectory: Replit Review 2026](https://tooldirectory.ai/tools/replit)
- [Atlan: Agent Memory Architectures 2026](https://atlan.com/know/agent-memory-architectures/)
- [Atlan: Best AI Agent Memory Frameworks 2026](https://atlan.com/know/best-ai-agent-memory-frameworks-2026/)
- [Design Studio UIUX: Mobile Navigation UX Best Practices 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/)
- [GitHub: assistant-ui](https://github.com/assistant-ui/assistant-ui)
- [AdminLTE: shadcn/ui AI Chat Templates 2026](https://adminlte.io/blog/shadcn-ui-ai-chat-templates/)
- [CopilotKit: AG-UI Event Types](https://www.copilotkit.ai/blog/master-the-17-ag-ui-event-types-for-building-agents-the-right-way)
- [Agentic Design: UI/UX Patterns](https://agentic-design.ai/patterns/ui-ux-patterns)
- [Windows News: ChatGPT Scheduled Tasks Redesign 2026](https://windowsnews.ai/article/chatgpt-scheduled-tasks-gets-dedicated-page-after-reliability-overhaul.427609)
- [Windows News: GitHub Copilot Usage-Based Billing June 1 2026](https://windowsnews.ai/article/copilot-to-usage-billing-june-1-2026-ai-credits-token-costs-and-meter-shock.420900)
- [Notion: Integrations & Connections](https://www.notion.com/connections)
- [Slack: Integrations Marketplace](https://slack.com/integrations)
- [MindStudio: Connect Claude Code to Notion, Gmail via MCP](https://www.mindstudio.ai/blog/connect-claude-code-notion-gmail-mcp-servers)
- [OpenAI: Workspace Agents](https://openai.com/academy/workspace-agents/)
- [Firecrawl: Best Browser Agents 2026](https://www.firecrawl.dev/blog/best-browser-agents)
- [Figma Community: AI Agent UI Kit](https://www.figma.com/community/file/1644825120881335966/)
- [Figma Community: Figma UI Kit for AI Agent Chat Apps (freemium)](https://www.figma.com/community/file/1496647384826493443/)
- [Figma Community: Copilot UI Kit](https://www.figma.com/community/file/1220148787159138654/)
