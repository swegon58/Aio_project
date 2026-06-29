import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import {
  getRun,
  requestRunCancellation,
} from "@/lib/aio/runs/run-repository";
import {
  repoErrorResponse,
  resolveRunApiContext,
  serializeRun,
} from "@/lib/aio/runs/run-api";

// POST /api/runs/[runId]/stop — idempotent durable stop request + best-effort Hermes forward.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;
  const { runId } = await params;

  const current = await getRun(db, runId, userId);
  if (!current.ok) return repoErrorResponse(current);

  const requested = await requestRunCancellation(db, runId, userId);
  if (!requested.ok) {
    if (requested.code === "ALREADY_TERMINAL") {
      return Response.json({
        ok: true,
        noop: true,
        run: serializeRun(current.data),
        hermesForwarded: false,
        hermesStatus: "already_terminal",
      });
    }
    return repoErrorResponse(requested);
  }

  const run = requested.data.run;
  if (!run.hermes_run_id) {
    return Response.json({
      ok: true,
      noop: requested.data.noop,
      run: serializeRun(run),
      hermesForwarded: false,
      hermesStatus: "not_started",
    });
  }

  const hermesCtx = await resolveHermesRequestContext();
  if (!hermesCtx.ok) {
    return Response.json({
      ok: true,
      noop: requested.data.noop,
      run: serializeRun(run),
      hermesForwarded: false,
      hermesStatus: "runtime_unavailable",
    });
  }

  const { row, apiServerKey } = hermesCtx.ctx;
  try {
    const res = await fetch(`${row.endpoint}/v1/runs/${run.hermes_run_id}/stop`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiServerKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 404) {
      return Response.json({
        ok: true,
        noop: requested.data.noop,
        run: serializeRun(run),
        hermesForwarded: false,
        hermesStatus: "run_not_found",
      });
    }

    if (!res.ok) {
      const body = await res.text();
      return Response.json(
        {
          error: "hermes_stop_failed",
          message: body || `Hermes stop failed with status ${res.status}.`,
          run: serializeRun(run),
        },
        { status: 502 },
      );
    }

    const data = (await res.json().catch(() => null)) as
      | { status?: string }
      | null;
    return Response.json({
      ok: true,
      noop: requested.data.noop,
      run: serializeRun(run),
      hermesForwarded: true,
      hermesStatus: data?.status ?? "stopping",
    });
  } catch (error) {
    return Response.json({
      ok: true,
      noop: requested.data.noop,
      run: serializeRun(run),
      hermesForwarded: false,
      hermesStatus: "request_failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
