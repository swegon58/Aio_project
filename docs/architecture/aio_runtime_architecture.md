# Aio Runtime Architecture

Aio is the product layer. Hermes is the current runtime adapter. Product code should depend on Aio concepts first and keep Hermes-specific names behind `apps/web/src/lib/aio/hermes`.

## Runtime Boundary

```text
Aio Frontend
  -> Aio API / Route Handlers
  -> Aio Run Event Protocol
  -> Hermes Adapter / Event Mapper
  -> Hermes Runtime
```

The chat route should stay thin: parse the request, resolve the authenticated runtime context, apply credit and abuse guards, start the runtime run, stream mapped events, settle usage, and persist the conversation.

## Current Modules

- `lib/aio/chat`: request shaping, plan-mode instructions, stream compatibility helpers, conversation persistence.
- `lib/aio/runs`: Aio-neutral run event types and stream writing helpers.
- `lib/aio/hermes`: Hermes client, raw event type, SSE parsing, artifact proxy URLs, and Hermes-to-Aio event mapping.
- `lib/aio/knowledge`: retrieval context and embedding facade.
- `lib/aio/billing`: credit guard and usage settlement facade.
- `lib/aio/security`: input scan and abuse guard facade.

## Compatibility Rule

The frontend still consumes legacy `data-hermes-*` stream parts. The backend now maps:

```text
HermesRunEvent -> AioRunEvent -> legacy UI stream part
```

This keeps the current UI stable while preparing the frontend to move to `data-aio-*` stream parts later.

## Product Direction

Research from Onyx and OpenManus should be treated as feature inspiration, not a dependency plan. Aio can borrow patterns such as knowledge organization, task timelines, approval surfaces, and tool catalogs while preserving Aio's consumer product direction.
