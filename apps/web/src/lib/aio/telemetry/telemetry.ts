// R3.3 — Provider-neutral telemetry interface.
//
// Business logic imports from here, never from an OTel or Langfuse SDK directly.
// The concrete implementation is injected at the edge (route handlers) and
// defaults to a no-op so local dev works without any configuration.
//
// ADR-002: zero config → no-op; OTEL_DEBUG=true → console exporter.
// No provider SDK import at this level.

export interface AioSpanAttrs {
  [key: string]: string | number | boolean | undefined;
}

export interface AioSpan {
  /** Set an attribute (safe, non-PII value only — see ADR-002). */
  setAttribute(key: string, value: string | number | boolean): void;
  /** Record a point-in-time event on the span (name + optional attrs). */
  addEvent(name: string, attrs?: AioSpanAttrs): void;
  /** Mark the span as failed with a stable reason code (not a raw error message). */
  setError(reasonCode: string): void;
  /** End the span. Must always be called (use try/finally). */
  end(): void;
}

export interface AioTracer {
  /** Start a named span; caller must call span.end() in a finally block. */
  startSpan(name: string, attrs?: AioSpanAttrs): AioSpan;
  /** Convenience: run fn inside a span, auto-end on return/throw. */
  withSpan<T>(name: string, fn: (span: AioSpan) => Promise<T>, attrs?: AioSpanAttrs): Promise<T>;
}

export interface AioMetrics {
  /** Record a histogram observation (e.g., latency_ms, cost_micro). */
  histogram(name: string, value: number, labels?: Record<string, string>): void;
  /** Increment a counter (e.g., runs_started_total). */
  increment(name: string, labels?: Record<string, string>): void;
}

export interface AioTelemetry {
  tracer: AioTracer;
  metrics: AioMetrics;
}

// ---------------------------------------------------------------------------
// No-op implementation (default — zero config required)
// ---------------------------------------------------------------------------

const NO_OP_SPAN: AioSpan = {
  setAttribute: () => {},
  addEvent: () => {},
  setError: () => {},
  end: () => {},
};

const NO_OP_TRACER: AioTracer = {
  startSpan: () => NO_OP_SPAN,
  withSpan: async (_name, fn) => fn(NO_OP_SPAN),
};

const NO_OP_METRICS: AioMetrics = {
  histogram: () => {},
  increment: () => {},
};

export const NO_OP_TELEMETRY: AioTelemetry = {
  tracer: NO_OP_TRACER,
  metrics: NO_OP_METRICS,
};

// ---------------------------------------------------------------------------
// Debug console implementation (OTEL_DEBUG=true)
// ---------------------------------------------------------------------------

function debugSpan(name: string, attrs: AioSpanAttrs = {}): AioSpan {
  const start = Date.now();
  const accumulated: AioSpanAttrs = { ...attrs };
  return {
    setAttribute(k, v) { accumulated[k] = v; },
    addEvent(eventName, eventAttrs) {
      if (process.env.OTEL_DEBUG === "true") {
        console.debug(`[span:${name}] event=${eventName}`, eventAttrs);
      }
    },
    setError(code) { accumulated["error.code"] = code; },
    end() {
      if (process.env.OTEL_DEBUG === "true") {
        const dur = Date.now() - start;
        console.debug(`[span] ${name} ${dur}ms`, accumulated);
      }
    },
  };
}

const DEBUG_TRACER: AioTracer = {
  startSpan: (name, attrs) => debugSpan(name, attrs),
  withSpan: async (name, fn, attrs) => {
    const span = debugSpan(name, attrs);
    try {
      const result = await fn(span);
      span.end();
      return result;
    } catch (err) {
      span.setError(err instanceof Error ? err.constructor.name : "UnknownError");
      span.end();
      throw err;
    }
  },
};

const DEBUG_METRICS: AioMetrics = {
  histogram(name, value, labels) {
    if (process.env.OTEL_DEBUG === "true") {
      console.debug(`[metric:histogram] ${name}=${value}`, labels);
    }
  },
  increment(name, labels) {
    if (process.env.OTEL_DEBUG === "true") {
      console.debug(`[metric:counter] ${name}+1`, labels);
    }
  },
};

export const DEBUG_TELEMETRY: AioTelemetry = {
  tracer: DEBUG_TRACER,
  metrics: DEBUG_METRICS,
};

/** Pick the right implementation based on environment variables. */
export function resolveTelemetry(): AioTelemetry {
  if (process.env.OTEL_DEBUG === "true") return DEBUG_TELEMETRY;
  return NO_OP_TELEMETRY;
}
