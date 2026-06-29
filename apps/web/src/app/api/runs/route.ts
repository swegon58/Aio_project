import { listRuns } from "@/lib/aio/runs/run-repository";
import {
  parseBoundedInt,
  repoErrorResponse,
  resolveRunApiContext,
  serializeRun,
} from "@/lib/aio/runs/run-api";

// GET /api/runs — authenticated, tenant-scoped run history.
export async function GET(req: Request) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;

  const url = new URL(req.url);
  const limit = parseBoundedInt(url.searchParams.get("limit"), {
    defaultValue: 25,
    min: 1,
    max: 100,
  });
  if (limit == null) {
    return Response.json(
      { error: "invalid_limit", message: "limit must be an integer between 1 and 100." },
      { status: 400 },
    );
  }

  const result = await listRuns(db, {
    customerId: userId,
    limit,
    cursor: url.searchParams.get("cursor") ?? undefined,
    conversationId: url.searchParams.get("conversationId") ?? undefined,
  });
  if (!result.ok) return repoErrorResponse(result);

  return Response.json({
    runs: result.data.runs.map(serializeRun),
    nextCursor: result.data.nextCursor,
  });
}
