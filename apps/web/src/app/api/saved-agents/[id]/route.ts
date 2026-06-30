import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { deleteSavedAgent, updateSavedAgent } from "@/lib/aio/saved-agents/saved-agents";

// PATCH /api/saved-agents/[id] — update a saved agent. Body: { name, instructionsAddition, useKnowledge }.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId } = ctxResult.ctx;

  const limit = checkRateLimit(`saved-agents:write:${userId}`, 20, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const db = createServiceClient();
  const result = await updateSavedAgent(db, userId, id, {
    name: typeof payload.name === "string" ? payload.name : "",
    instructionsAddition: typeof payload.instructionsAddition === "string" ? payload.instructionsAddition : "",
    useKnowledge: payload.useKnowledge !== false,
  });
  if (!result.ok) {
    const status = result.message === "Saved agent not found." ? 404 : 400;
    return Response.json({ error: result.message }, { status });
  }
  return Response.json({ savedAgent: result.data });
}

// DELETE /api/saved-agents/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId } = ctxResult.ctx;

  const db = createServiceClient();
  const result = await deleteSavedAgent(db, userId, id);
  if (!result.ok) return Response.json({ error: result.message }, { status: 404 });
  return Response.json({ ok: true });
}
