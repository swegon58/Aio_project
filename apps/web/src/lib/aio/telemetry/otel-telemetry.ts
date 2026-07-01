// R3.3 follow-up — real span export via the standard OpenTelemetry API.
//
// This file is the only place in the telemetry module allowed to import a
// provider SDK (ADR-002's "injected at the edge" seam). The actual exporter
// (Langfuse or otherwise) is registered once at process startup in
// instrumentation.ts via NodeSDK; this file only talks to @opentelemetry/api,
// so swapping the exporter never touches this code.

import { trace, SpanStatusCode, type Span } from "@opentelemetry/api";

import type { AioMetrics, AioSpan, AioSpanAttrs, AioTelemetry, AioTracer } from "@/lib/aio/telemetry/telemetry";

const tracer = trace.getTracer("aio");

function toOtelSpan(span: Span): AioSpan {
  return {
    setAttribute(key, value) {
      span.setAttribute(key, value);
    },
    addEvent(name, attrs) {
      span.addEvent(name, attrs as Record<string, string | number | boolean>);
    },
    setError(reasonCode) {
      span.setAttribute("error.code", reasonCode);
      span.setStatus({ code: SpanStatusCode.ERROR, message: reasonCode });
    },
    end() {
      span.end();
    },
  };
}

const OTEL_TRACER: AioTracer = {
  startSpan(name: string, attrs?: AioSpanAttrs): AioSpan {
    const span = tracer.startSpan(name, {
      attributes: attrs as Record<string, string | number | boolean>,
    });
    return toOtelSpan(span);
  },
  async withSpan<T>(name: string, fn: (span: AioSpan) => Promise<T>, attrs?: AioSpanAttrs): Promise<T> {
    return tracer.startActiveSpan(name, { attributes: attrs as Record<string, string | number | boolean> }, async (span) => {
      try {
        const result = await fn(toOtelSpan(span));
        span.end();
        return result;
      } catch (err) {
        const reasonCode = err instanceof Error ? err.constructor.name : "UnknownError";
        span.setAttribute("error.code", reasonCode);
        span.setStatus({ code: SpanStatusCode.ERROR, message: reasonCode });
        span.end();
        throw err;
      }
    });
  },
};

// Metrics export is not in scope for this pass (Q7 scoped to spans only) —
// kept as a local no-op (not imported from telemetry.ts) so this module has
// no import cycle with the file that selects it in resolveTelemetry().
const OTEL_METRICS: AioMetrics = {
  histogram: () => {},
  increment: () => {},
};

export const OTEL_TELEMETRY: AioTelemetry = {
  tracer: OTEL_TRACER,
  metrics: OTEL_METRICS,
};
