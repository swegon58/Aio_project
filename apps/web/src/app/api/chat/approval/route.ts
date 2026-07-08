import { NextRequest } from "next/server";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { listApprovalsForRun, resolveApproval } from "@/lib/aio/tools/approval-repository";
import { checkToolSubLimit } from "@/lib/aio/billing/spend-cap";

// POST /api/chat/approval — proxy for hermes-agent's
// POST /v1/runs/{run_id}/approval (gateway/platforms/api_server.py
// _handle_run_approval). Body: { runId: string, choice: "once" | "session"
// | "always" | "deny" }. No billing involvement — approval responses don't
// reserve/settle credits, the run they unblock already did.
export async function POST(req: NextRequest) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { db, userId, row, apiServerKey } = ctxResult.ctx;

  const { runId, choice }: { runId?: string; choice?: string } = await req.json();
  if (!runId || !choice) {
    return Response.json({ error: "missing_fields", message: "runId and choice are required" }, { status: 400 });
  }

  // The pending approval row (written by recordApprovalEvent as Hermes's
  // request streamed through) is the only place this route can learn which
  // tool is gated (for the spend sub-limit check below) and which durable
  // aio_approvals row to resolve once Hermes accepts the choice.
  const approvals = await listApprovalsForRun(db, runId, userId);
  const pending = approvals.ok
    ? approvals.data.find((a) => a.status === "requested")
    : undefined;

  // R11.1: block an approve-type choice for a gated tool (code_execution,
  // browser) once the customer's per-tool spend sub-limit is hit.
  if (choice !== "deny") {
    if (pending?.tool_name) {
      const limit = await checkToolSubLimit(db, userId, pending.tool_name);
      if (!limit.ok) {
        // Auto-deny to Hermes so the paused run doesn't hang forever, then
        // tell the client why in plain terms.
        await fetch(`${row.endpoint}/v1/runs/${runId}/approval`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiServerKey}`,
          },
          body: JSON.stringify({ choice: "deny" }),
          signal: AbortSignal.timeout(10_000),
        }).catch(() => {});
        return Response.json(
          {
            error: "tool_sub_limit_exceeded",
            message: `Spend limit reached for ${pending.tool_name} ($${limit.spentUsd.toFixed(2)} / $${limit.limitUsd?.toFixed(2)}).`,
            toolId: pending.tool_name,
            spentUsd: limit.spentUsd,
            limitUsd: limit.limitUsd,
          },
          { status: 402 },
        );
      }
    }
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

  // Mirror the choice into the durable audit trail. Best-effort: Hermes is
  // the source of truth for run behavior, this just keeps aio_approvals from
  // drifting to `expired` regardless of what the user actually clicked.
  if (res.ok && pending) {
    await resolveApproval(db, pending.aio_approval_id, userId, {
      resolution: choice === "deny" ? "reject" : "approve",
      resolvedBy: userId,
    }).catch(() => {});
  }

  return Response.json(data, { status: res.status });
}
