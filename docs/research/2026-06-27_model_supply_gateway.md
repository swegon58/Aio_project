# Aio Model Supply and Gateway Strategy

Date: 2026-06-27

## Decision

Use OpenRouter as Aio's initial unified model supply for text, image, and
video, but keep it behind an Aio-owned provider gateway. Add Runware as the
first cost-optimization provider for media and open-source models. Keep fal
as a specialist fallback using Hermes' existing image and video plugins.

Users should never receive or manage upstream provider keys. Aio stores those
keys server-side and exposes product capabilities, plans, and credits.

## Verified Market Facts

### OpenRouter

- Its public catalog currently exposes 339 general models, 38 image-generation
  models, and 16 video-generation models.
- It provides dedicated `POST /api/v1/images` and asynchronous
  `POST /api/v1/videos` APIs under the same account and API key used for LLMs.
- Inference prices are passed through without markup, but purchasing credits
  incurs a 5.5% fee with a $0.80 minimum.
- Provider routing can prioritize price, enforce a maximum price, use model
  fallbacks, and enforce zero-data-retention endpoints.
- BYOK requests are free for the first one million requests per month, after
  which OpenRouter charges a routing fee based on the normal model cost.
- OpenRouter permits incorporating the service into a customer-facing product,
  subject to each model's terms. Its public terms prohibit reselling raw model
  API access or building a competing model API service.

### Runware

- One account covers image, video, audio, text, 3D, and utility models.
- Its current public pricing catalog lists 247 models: 105 image, 88 video,
  19 audio, 33 text, and 7 3D.
- Public image pricing ranges from roughly $0.0006 to $0.24 per successful
  image, depending on model and configuration.
- It advertises lower pricing for open-source LLMs running on its own
  infrastructure and offers negotiated volume discounts.
- Its LLM endpoint is OpenAI-compatible, while media uses its native API.

### fal and Replicate

- fal bills successful outputs by image, megapixel, video second, or video.
  It offers account-specific endpoint pricing and volume discounts.
- Replicate provides a broad long-tail model catalog with pay-per-output or
  pay-per-compute billing and negotiated enterprise volume discounts.
- Both are useful specialist or fallback providers, but neither is as simple
  as OpenRouter for Aio's first unified text-plus-media integration.

## Aio's Existing Foundation

Aio already has most of the required control plane:

- Per-customer OpenRouter key provisioning with monthly spend limits.
- A normalized credit ledger, per-plan markup, per-task caps, and usage checks.
- A provider-agnostic Hermes model configuration.
- Pluggable `ImageGenProvider` and `VideoGenProvider` registries.
- Existing fal image/video plugins and xAI/OpenAI image providers.

The missing work is a provider-neutral cost ledger and OpenRouter media
adapters, not a new agent runtime.

## Target Architecture

```text
Aio user
   |
   v
Aio capability API
   |
   +-- policy router
   |     - task modality
   |     - quality tier
   |     - latency target
   |     - maximum cost
   |     - data policy
   |
   +-- provider adapters
   |     - OpenRouter: default text/image/video supply
   |     - Runware: low-cost media and open-source text
   |     - fal: specialist media fallback
   |     - direct provider/BYOK: negotiated enterprise capacity
   |
   +-- cost control
         - pre-authorization
         - usage settlement
         - retry budget
         - provider circuit breaker
         - immutable cost ledger
```

Clients request capabilities such as `chat`, `research`, `create_image`, or
`create_video`; they do not select an upstream provider. Model selection can
remain available as an advanced preference without exposing provider keys.

## Cost-Sourcing Playbook

There is no safe "cheap key supplier" that guarantees every frontier model.
Legitimate discounts come from:

1. Aggregating Aio's spend into one provider account.
2. Requesting committed-spend or prepaid enterprise quotes.
3. Negotiating per-endpoint pricing for predictable media workloads.
4. Routing open-source workloads to providers running their own inference.
5. Using direct provider or cloud commitments when one model becomes a large
   share of monthly spend.
6. Offering enterprise BYOK while Aio continues to provide routing, policy,
   memory, tools, and workflow value.
7. Self-hosting stable open models only after sustained utilization makes
   reserved GPUs cheaper than serverless inference.

Do not buy shared, resold, geographically bypassed, or unexplained discounted
API keys. They create account-termination, data-exposure, and billing-fraud
risk and cannot support a production SLA.

## Unit Economics

Replace the OpenRouter-specific meaning of `raw model cost` with a generic
provider cost measured in USD micro-units. Every provider adapter must return:

- provider and model identifier;
- estimated maximum cost before execution;
- settled provider cost after execution;
- billable quantity and unit;
- provider request/job identifier;
- retry and failure billing status.

For video, reserve the maximum cost before submitting the asynchronous job and
show the user an explicit credit quote. Settle the final amount only when the
provider reports the completed billable output.

Aio's retail price must cover:

- provider inference cost;
- OpenRouter's credit purchase fee where applicable;
- payment processing;
- retries and failed workflows not reimbursed by providers;
- storage and media egress;
- observability and support;
- Aio's gross margin.

## Rollout

### Phase 1: One-Key MVP

- Add OpenRouter image and video provider plugins to Hermes.
- Store the upstream key only in Aio's server-side secret store.
- Add capability-based model aliases such as `fast`, `balanced`, and `best`.
- Add price ceilings and pre-execution quotes for image/video.
- Keep LM Studio as the local development provider.

### Phase 2: Cost Router

- Generalize the credit ledger from OpenRouter-specific to provider-neutral.
- Add Runware adapters and live pricing ingestion.
- Route by quality floor, latency, data policy, and total expected cost.
- Add provider health checks, fallbacks, and request-level cost telemetry.

### Phase 3: Commercial Optimization

- Request written enterprise quotes from OpenRouter, Runware, and fal using
  the same forecast matrix.
- Move dominant workloads to direct contracts or reserved capacity.
- Add enterprise BYOK and region/data-residency policies.
- Self-host only models with stable demand and measured savings.

## Quote Request Matrix

Send each provider the same three usage scenarios so quotes are comparable:

- monthly text input/output tokens by model class;
- images by model, resolution, and edit/reference-image ratio;
- video seconds by model, resolution, duration, and audio requirement;
- required requests per minute and concurrency;
- target regions, retention policy, SLA, and support level;
- one-month, six-month, and twelve-month committed-spend options.

Require written answers for price protection, overage pricing, failed-request
billing, model deprecation notice, data retention, output rights, and whether
Aio may embed the service in a paid customer-facing application.

## Sources

- [OpenRouter pricing and fees](https://openrouter.ai/docs/faq#pricing-and-fees)
- [OpenRouter image generation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation)
- [OpenRouter video generation](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection)
- [OpenRouter terms](https://openrouter.ai/terms)
- [Runware pricing](https://runware.ai/pricing)
- [Runware LLM API](https://runware.ai/llm-api)
- [Runware terms](https://runware.ai/terms)
- [fal pricing documentation](https://fal.ai/docs/documentation/model-apis/pricing)
- [Replicate pricing](https://replicate.com/pricing)
