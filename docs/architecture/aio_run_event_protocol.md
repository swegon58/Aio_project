# Aio Run Event Protocol

The Aio Run Event Protocol is the product-facing event contract for a task run. It hides runtime-specific payload details and gives frontend modules one stable language for timelines, approvals, artifacts, tool activity, and mascot state.

## Status And Risk

`AioRunStatus`:

- `queued`
- `running`
- `waiting_approval`
- `completed`
- `failed`
- `cancelled`

`AioRiskLevel`:

- `safe`
- `medium`
- `dangerous`

Hermes risk normalization:

- `low` -> `safe`
- `medium` -> `medium`
- `high` / `critical` -> `dangerous`
- unknown -> tool-name heuristic, then `medium`

Tool-name heuristic:

- read-only, search, inspect, list, grep, find, fetch, view, scan -> `safe`
- write, delete, deploy, send, execute, exec, bash, shell, run, edit, apply, mutate, post, publish -> `dangerous`
- unclear impact -> `medium`

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

Most run-scoped events include:

- `type`
- `runId`
- `createdAt`

Compatibility-only fields such as `ts`, `tool`, `requestId`, `choices`, and `artifact` may remain optional until the frontend fully migrates.

## Hermes Mapping

Runtime adapters must convert raw runtime events into `AioRunEvent` before product code uses them.

Hermes currently maps through `HermesEventMapper`:

```text
Hermes SSE line -> HermesRunEvent -> AioRunEvent -> legacy stream writer
```

Supported mappings:

- `message.delta` -> `message.delta`
- `tool.started` -> `tool.started`
- `tool.completed` -> `tool.completed` or `tool.failed`
- `tool.failed` -> `tool.failed` when emitted by a runtime adapter
- `reasoning.available` -> `reasoning.available`
- `approval.request` / `approval.requested` -> `approval.requested`
- `approval.responded` -> `approval.responded`
- `compression.started` / `compression.done` -> `compression.started`
- `task.codeexec` -> `task.codeexec`
- `artifact.created` -> `artifact.created`
- `run.completed` -> `run.completed`
- `run.failed` -> `run.failed`
- `run.cancelled` -> `run.cancelled`

Raw Hermes payloads should not be passed to UI or product modules unless there is a documented compatibility reason.

## Legacy Stream Compatibility

The current frontend still consumes legacy AI SDK stream chunks:

- `data-hermes-run`
- `data-hermes-credits`
- `data-hermes-activity`
- `data-hermes-approval`
- `data-hermes-reasoning`
- `data-hermes-compression`
- `data-hermes-showcase`

`apps/web/src/lib/aio/runs/run-event-writer.ts` now emits `data-aio-event` and the matching `data-aio-*` parts while also emitting the legacy chunks above for compatibility. Frontend consumers should prefer:

- `data-aio-event`
- `data-aio-run`
- `data-aio-credits`
- `data-aio-activity`
- `data-aio-approval`
- `data-aio-reasoning`
- `data-aio-compression`
- `data-aio-showcase`

Keep the `data-hermes-*` aliases until older clients and persisted UI assumptions are verified safe to remove.

## Run Timeline UI

Run Timeline components live in `apps/web/src/components/app/run-timeline/`.

The frontend adapter converts existing legacy activity state into Aio events:

```text
legacy frontend activity/showcase/approval state -> AioRunEvent[] -> RunTimeline
```

This keeps the existing stream protocol unchanged while allowing the UI to render product-level run events.

The app shell also includes product module surfaces for Tool Center, Knowledge Center, Agent Builder, Deep Research Mode, and Workflow Canvas. These are UI shells connected to current run state; they do not fake backend behavior.

## Mascot State Mapping

`MascotStateMapper.ts` derives display state from recent `AioRunEvent` values:

- no events -> `idle`
- `run.created` -> `ready`
- `message.delta` -> `talking`
- `tool.started` -> `working`
- `approval.requested` -> `asking`
- `tool.failed` -> `confused`
- `run.completed` -> `success`
- `run.failed` -> `error`
- `run.cancelled` -> `idle`

## Future UI Consumers

The protocol is intended to support these modules without coupling them to Hermes:

- Run Timeline
- Tool Center
- Knowledge Center
- Agent Builder
- Deep Research
- Workflow Canvas
