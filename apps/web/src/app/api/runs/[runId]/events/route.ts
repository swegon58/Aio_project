import { listEvents } from "@/lib/aio/runs/run-event-repository";
import {
  parseBoundedInt,
  repoErrorResponse,
  resolveRunApiContext,
  serializeRunEvent,
} from "@/lib/aio/runs/run-api";

// GET /api/runs/[runId]/events — ordered replay stream, optionally after a sequence.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;
  const { runId } = await params;
  const url = new URL(req.url);

  const limit = parseBoundedInt(url.searchParams.get("limit"), {
    defaultValue: 1000,
    min: 1,
    max: 1000,
  });
  if (limit == null) {
    return Response.json(
      { error: "invalid_limit", message: "limit must be an integer between 1 and 1000." },
      { status: 400 },
    );
  }

  const afterSequence = parseBoundedInt(url.searchParams.get("afterSequence"), {
    defaultValue: -1,
    min: -1,
    max: Number.MAX_SAFE_INTEGER,
  });
  if (afterSequence == null) {
    return Response.json(
      {
        error: "invalid_after_sequence",
        message: "afterSequence must be an integer greater than or equal to 0.",
      },
      { status: 400 },
    );
  }

  const result = await listEvents(db, {
    runId,
    customerId: userId,
    limit,
    afterSequence: afterSequence >= 0 ? afterSequence : undefined,
  });
  if (!result.ok) return repoErrorResponse(result);

  return Response.json({
    events: result.data.map(serializeRunEvent),
  });
}
