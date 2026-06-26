# Aio Run Event Protocol

The Aio Run Event Protocol is the product-facing event contract for a task run. It hides runtime-specific payload details and gives future UI modules one stable language for timelines, approvals, artifacts, and tool activity.

## Event Union

Defined in `apps/web/src/lib/aio/runs/aio-run-events.ts`.

Current event types:

- `run.created`
- `message.delta`
- `message.completed`
- `reasoning.available`
- `tool.started`
- `tool.completed`
- `tool.failed`
- `approval.requested`
- `approval.responded`
- `artifact.created`
- `task.codeexec`
- `compression.started`
- `run.completed`
- `run.failed`
- `run.cancelled`

## Mapping Rule

Runtime adapters must convert raw runtime events into `AioRunEvent` before product code uses them.

Hermes currently maps through `HermesEventMapper`:

```text
Hermes SSE line -> HermesRunEvent -> AioRunEvent
```

Raw Hermes payloads should not be passed to UI or product modules unless there is a documented compatibility reason.

## Legacy Stream Rule

Until the frontend migrates, `run-event-writer.ts` converts `AioRunEvent` into legacy AI SDK stream chunks such as:

- `data-hermes-run`
- `data-hermes-credits`
- `data-hermes-activity`
- `data-hermes-approval`
- `data-hermes-reasoning`
- `data-hermes-compression`
- `data-hermes-showcase`

Each legacy writer call has a TODO marker for the future `data-aio-*` rename.

## Future UI Consumers

The protocol is intended to support these modules without coupling them to Hermes:

- Run Timeline
- Tool Center
- Knowledge Center
- Agent Builder
- Deep Research
- Workflow Canvas
