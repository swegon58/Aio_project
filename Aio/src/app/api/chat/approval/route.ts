import { NextRequest } from "next/server";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";

// POST /api/chat/approval — proxy for hermes-agent's
// POST /v1/runs/{run_id}/approval (gateway/platforms/api_server.py
// _handle_run_approval). Body: { runId: string, choice: "once" | "session"
// | "always" | "deny" }. No billing involvement — approval responses don't
// reserve/settle credits, the run they unblock already did.
export async function POST(req: NextRequest) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row, apiServerKey } = ctxResult.ctx;

  const { runId, choice }: { runId?: string; choice?: string } = await req.json();
  if (!runId || !choice) {
    return Response.json({ error: "missing_fields", message: "runId and choice are required" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${row.endpoint}/v1/runs/${runId}/approval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiServerKey}`,
      },
      body: JSON.stringify({ choice }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "hermes_request_failed", message: msg }, { status: 502 });
  }

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
