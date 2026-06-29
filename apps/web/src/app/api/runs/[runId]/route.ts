import { getRun } from "@/lib/aio/runs/run-repository";
import {
  repoErrorResponse,
  resolveRunApiContext,
  serializeRun,
} from "@/lib/aio/runs/run-api";

// GET /api/runs/[runId] — authenticated, tenant-scoped run detail shell.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;
  const { runId } = await params;

  const result = await getRun(db, runId, userId);
  if (!result.ok) return repoErrorResponse(result);

  return Response.json({ run: serializeRun(result.data) });
}
