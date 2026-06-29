# Aio Tool Risk Register

Updated: 2026-06-29  
Phase: R2.1 Tool Inventory And Manifest

This register is the product-side source of truth for Aio's current tool and
provider risk model. It is intentionally narrower than the full Hermes catalog:
only tools relevant to the Aio product path are listed here.

## Scope

Included in this phase:

- base tools that are always available in Aio-owned runs
- tier-gated Hermes toolsets exposed by Aio
- provider and integration surfaces that need later audit / approval coverage

Excluded for now:

- experimental Hermes/community toolsets not enabled for Aio customers
- internal dev-only scripts and one-off local utilities
- future UI for a public Tool Center

## Current Risk Table

| Canonical name | Label | Risk | Default approval | Plans | Key concern |
|---|---|---|---|---|---|
| `file` | Workspace Files | dangerous | once | Starter, Pro, Business | Local file mutation or deletion |
| `terminal` | Terminal Sandbox | dangerous | once | Starter, Pro, Business | Shell execution can mutate workspace state |
| `clarify` | Clarify / Plan Mode | safe | none | Starter, Pro, Business | In-product questioning only |
| `todo` | Task Tracking | safe | none | Starter, Pro, Business | Internal run/task metadata only |
| `web` | Web Search | safe | none | Starter, Pro, Business | Public-web retrieval without write |
| `code_execution` | Code Execution | dangerous | once | Pro, Business | Compute + local artifact mutation |
| `browser` | Browser Automation | dangerous | once / session | Pro, Business | May submit forms or act on connected sites |
| `vision` | Vision | guarded | none | Pro, Business | Reads user media/screenshots |
| `memory` | Persistent Memory | guarded | none | Pro, Business | Reads/writes private memory state |
| `delegation` | Task Delegation | guarded | none | Pro, Business | Expands scope/cost; child tools inherit stricter policy |
| `image_gen` | Image Generation | guarded | none | Business | Provider spend + prompt/media sensitivity |
| `video_gen` | Video Generation | guarded | none | Business | Higher-cost media generation |
| `cronjob` | Scheduled Tasks | dangerous | once | Business | Creates autonomous future execution |
| `tts` | Text-to-Speech | guarded | none | Business | Media generation via provider |
| `skills` | Skills Catalog | guarded | none | Starter, Pro, Business | Wrapper that inherits underlying tool risk |
| `mcp` | MCP Integrations | dangerous | once / session | Business | Third-party bridge with variable side effects |
| `connected_apps` | Connected App Credentials | dangerous | once | Starter, Pro, Business | Credential create/change/delete |

## Locked Decisions In This Register

1. `file` and `terminal` are treated as Aio-owned base tools, not tier-gated
   toolsets. They remain available on every plan but must move under durable
   approvals in R2.
2. `browser`, `cronjob`, `mcp`, and credential changes are dangerous by
   default because they can mutate third-party or future state.
3. `skills` do not weaken policy. A wrapper inherits the stricter rule of the
   concrete tool it invokes.
4. No `always` approval scope is granted in this phase.
5. Consumer-facing image/video generation remains allowed without an approval
   click by default, but it must become cost-auditable and durably logged.

## Known Gaps After R2.1

- No durable `aio_tool_calls` table yet.
- No durable `aio_approvals` table yet.
- No append-only audit chain yet.
- Browser reads vs browser writes are not yet split into separate policy
  snapshots.
- MCP allowlist enforcement is not yet product-enforced.
- Memory write policy is still broad because Honcho is configured but not yet
  covered by a scoped permission UX.

## Next R2 Steps

- R2.2 persists tool-call lifecycle rows using this manifest as the policy
  snapshot source.
- R2.3 persists approval requests/resolutions against the tool-call row.
- R2.6 adds audit rows and MCP allowlist boundaries that match this register.

