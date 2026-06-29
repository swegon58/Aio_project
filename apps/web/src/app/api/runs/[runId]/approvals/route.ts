import { listApprovalsForRun } from "@/lib/aio/tools/approval-repository";
import {
  repoErrorResponse,
  resolveRunApiContext,
  serializeApproval,
} from "@/lib/aio/runs/run-api";

// GET /api/runs/[runId]/approvals — authenticated, tenant-scoped approval list
// for a run, in request order. Lazy-expires overdue `requested` rows before the
// read so the client never sees an approval as still-pending past its TTL.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;
  const { runId } = await params;

  const result = await listApprovalsForRun(db, runId, userId);
  if (!result.ok) return repoErrorResponse(result);

  return Response.json({ approvals: result.data.map(serializeApproval) });
}
