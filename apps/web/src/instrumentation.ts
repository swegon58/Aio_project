// Next.js server-startup hook (stable in Next 15+, no experimental flag).
// Registers the OTel SDK with Langfuse as the span exporter, gated on
// LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY being present. Absent keys:
// this hook does nothing, and AioTelemetry.resolveTelemetry() (see
// src/lib/aio/telemetry/telemetry.ts) falls back to no-op/debug as before.
//
// This is the only place the Langfuse SDK is imported anywhere in the repo —
// business logic and the AioTracer facade (otel-telemetry.ts) only ever talk
// to the vendor-neutral @opentelemetry/api.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) return;

  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { LangfuseSpanProcessor } = await import("@langfuse/otel");

  const sdk = new NodeSDK({
    serviceName: "aio-web",
    spanProcessors: [new LangfuseSpanProcessor()],
  });

  sdk.start();
}
