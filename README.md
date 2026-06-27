# Aio

Aio is a consumer-focused AI agent workspace for turning a conversation into
research, plans, files, and completed tasks. The product combines a Next.js
application with an isolated Hermes agent runtime while keeping product APIs
and UI independent from the underlying runtime.

## What Aio Includes

- Streaming chat with Auto, Plan, and Deep Research modes.
- Tool execution, run timelines, approvals, and downloadable artifacts.
- Persistent conversations, memory, knowledge, files, and image gallery.
- Scheduled tasks and task-oriented workspace views.
- Aio Output for task activity and generated-file previews.
- Local development through LM Studio and cloud model routing through
  OpenRouter-compatible providers.
- Credit accounting, per-task limits, and per-customer provider spend caps.

## Architecture

```text
Browser
  |
  v
Next.js web app
  |-- authentication, conversations, credits, settings
  |-- Aio request and run-event contracts
  |
  v
Hermes runtime adapter
  |-- agent loop and tool execution
  |-- approvals, artifacts, memory, scheduled work
  |
  +--> model providers
  +--> Honcho memory
  +--> sandbox and browser tools
```

Aio product code depends on Aio contracts first. Hermes-specific requests and
events stay behind adapters so the runtime can evolve without leaking its
payloads into the product UI.

## Repository

```text
apps/
  web/                         Next.js product and API routes
  harness/
    aio-home/                  Aio runtime profiles and local state
    hermes-agent/              Python agent runtime
docs/
  architecture/                Runtime and event contracts
  research/                    Product and provider research
  roadmap/                     Current engineering follow-ups
```

Runtime state, local credentials, generated screenshots, model caches, and
personal agent instructions are intentionally excluded from source control.

## Requirements

- Node.js 24 or newer.
- Python 3.11 through 3.13.
- `uv` for the Python environment.
- Supabase for authentication and product data.
- LM Studio for the default local model, or a configured cloud provider.

## Local Development

### 1. Configure the web app

```bash
cd apps/web
npm install
cp .env.local.example .env.local
```

Fill in the Supabase values and the Hermes development API server key. Never
commit `.env.local`, provider keys, Supabase service credentials, or MCP
credentials.

### 2. Install the runtime

```bash
cd apps/harness/hermes-agent
uv sync
```

The default Aio profile is stored under
`apps/harness/aio-home/profiles/aio`. Configure its model and memory providers
locally without committing secrets or generated runtime state.

### 3. Start the model

For local development, start the LM Studio server and load the model configured
in the Aio profile. Cloud environments can use OpenRouter or another supported
provider instead.

### 4. Start Hermes

From `apps/harness/hermes-agent`:

```bash
HERMES_HOME="$(pwd)/../aio-home" \
HOME="$(pwd)/../aio-home/profiles/aio/home" \
uv run hermes -p aio gateway run --replace
```

### 5. Start the web app

```bash
cd apps/web
npm run dev
```

Open [http://localhost:3000/app](http://localhost:3000/app).

## Verification

Run the complete frontend check before merging:

```bash
cd apps/web
npm run check
```

Useful focused commands:

```bash
npm run lint
npm run typecheck
npm run build
npm run screenshot -- /app app-review
```

## Model Supply

Aio keeps upstream provider credentials server-side and exposes product
capabilities rather than reselling raw model API access. The initial supply
strategy uses OpenRouter for broad text, image, and video coverage, with
provider adapters available for cost and reliability optimization.

See [Aio Model Supply and Gateway Strategy](docs/research/2026-06-27_model_supply_gateway.md).

## Documentation

- [Runtime architecture](docs/architecture/aio_runtime_architecture.md)
- [Run event protocol](docs/architecture/aio_run_event_protocol.md)
- [Competitive product research](docs/research/2026-06-26_competitive_money_features.md)
- [Model supply strategy](docs/research/2026-06-27_model_supply_gateway.md)
- [Refactor roadmap](docs/roadmap/refactor_next_steps.md)

## Security

- Keep every upstream API key on the server.
- Use scoped provider keys and hard spend limits where supported.
- Do not commit `.env`, `.env.local`, `.mcp.json`, runtime databases, or
  personal agent instruction files.
- Treat model output and fetched web content as untrusted input.
- Review each provider and model license before enabling it for customers.

## License

The Aio product and vendored dependencies may have different licenses. Review
the license of each component and model before redistribution or commercial
use.
