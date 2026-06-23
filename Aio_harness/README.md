# Aio_harness

Clone of [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) (MIT) — backend agent harness for **Aio**.

## What this is
- `hermes-agent/` — upstream source, pinned to commit `4373e802`. Reference + API boundary for Aio.
- Runs as **one Hermes process per customer** (own profile, port, `state.db`, `.env`). Dev profile = "aio".
- Profiles live under `Aio_harness/aio-home/` — never `~/.hermes/` (Himeko's profile).

## Hard rules
- **Never touch `~/.hermes/`** — that's Himeko's profile. All Aio profiles are under `aio-home/`.
- **No core edits to `hermes-agent/` source** — Phase 1 = API/config boundary only.
- Aio (Next.js) ↔ Hermes = API boundary only, no direct imports.

## Dev environment
```bash
cd hermes-agent
uv venv && uv pip install -e .   # Python 3.11, venv at hermes-agent/.venv
```

## Launch (dev profile)
```bash
HERMES_HOME=/home/swegon/AI_Agent/AI_Autonomous_Project/Aio_harness/aio-home \
HOME=/home/swegon/AI_Agent/AI_Autonomous_Project/Aio_harness/aio-home/profiles/aio/home \
hermes -p aio gateway run --replace
```
Both env vars are **required**: `HERMES_HOME` anchors profile resolution; `HOME` sandboxes `~/...` file writes inside the profile.

Supervisor (idle-kill + crash-reconcile) — start separately:
```bash
cd Aio && npm run hermes:supervisor
```

## Gotchas
- **`hermes gateway api_server` doesn't exist** — use `hermes -p aio gateway run`. `api_server` is auto-enabled by `API_SERVER_KEY` presence.
- **`~/` paths expand to real OS home** unless `HOME` is overridden at launch. Any agent writing `~/foo` lands in `/home/swegon/` if `HOME` isn't set to the profile home. Always launch with `HOME=<profile>/home`.
- **`terminal.cwd: .`** in config.yaml resolves to process cwd at runtime (not profile dir). Set it to the absolute workspace path.
- **Daytona `Proxy` ImportError** — transient venv package-state race. Fix: stop + relaunch gateway (no code change needed). If persistent: `uv pip install -e .` in `hermes-agent/`.
- **`TERMINAL_ENV=daytona`** is the working sandbox backend (Q7 resolved). Not `vercel_sandbox` — that backend doesn't exist in hermes-agent.
- **Migration 0003** (`hermes_adjust_credit_balance` RPC) must be applied before billing works: `npx supabase link --project-ref xeuvoaedwdmuhxdcoxcx && npx supabase db push`.

## Build status
- ✅ Step 1: Single-profile dev bring-up (hermes process, E2E verified)
- ✅ Step 2: Aio gateway proxy route (`/v1/runs` SSE via Vercel AI SDK)
- ✅ Step 3: Dynamic provisioning orchestrator (lazy spawn, idle-kill, crash-reconcile, multi-tenant)
- ✅ Step 4: Billing (credit reserve/settle/refund, OpenRouter usage-delta, tier caps)
- ✅ FE-3/4: Workspace UI + HITL approval cards
- ✅ Honcho memory enabled for profile "aio" (`honcho-ai` installed, `memory.provider: honcho` in profile config, `HONCHO_API_KEY` in profile `.env`, gateway restarted + doctor-verified)
- ⏳ In progress: UI feature batches (Connections, Activity/Kanban+Memory, Image gallery, Credential manager, Usage/guardrail/compression badge) on branch `ui-mockup-port` — merge to master gated on explicit user approval
- ⏳ Next: Paddle payment provider, per-customer OpenRouter keys (Q41 Vault), supervisor in dev process

## Integration decisions (locked)
Full spec: `../Sweg_brain/1_PARA_EXECUTION/Projects/Aio_Hermes_Integration/BUILD_SPEC.md`

Key decisions:
- Multi-tenant: profile-per-customer, own port (8642 dev, 8650+ provisioned)
- API: `/v1/runs` SSE + `session_id` in body, `X-Hermes-Session-Key: userId` header
- Skills: `--no-skills` + curated catalog copied from dev "aio" profile config
- Sandbox: `TERMINAL_ENV=daytona` (dev) → Render/container-per-customer (prod)
- Secrets: Supabase Vault canonical; `.env` written at spawn
- Pricing: $9/$19/$99, defined in `Aio/src/lib/hermes/pricing.ts`
- Payments: Paddle (primary), `DevNoopPaymentProvider` active until credentials wired

## Strategy
Phase 1: wrap Hermes as-is, ship fast — no core edits.
Phase 2: selectively port pieces into Aio's own stack based on real usage.
