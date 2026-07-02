import { listResearchSources } from "@/lib/aio/research/research-stages";
import { resolveRunApiContext } from "@/lib/aio/runs/run-api";

// GET /api/runs/[runId]/sources — R9.3: sources fetched during a research run.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;
  const { runId } = await params;

  const sources = await listResearchSources(db, runId, userId);
  return Response.json({ sources });
}
