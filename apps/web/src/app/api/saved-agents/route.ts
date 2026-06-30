import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { createSavedAgent, listSavedAgents } from "@/lib/aio/saved-agents/saved-agents";

// GET /api/saved-agents — list the signed-in customer's saved agents.
export async function GET() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId } = ctxResult.ctx;

  const db = createServiceClient();
  const result = await listSavedAgents(db, userId);
  if (!result.ok) return Response.json({ error: result.message }, { status: 500 });
  return Response.json({ savedAgents: result.data });
}

// POST /api/saved-agents — create a saved agent. Body: { name, instructionsAddition, useKnowledge }.
export async function POST(req: Request) {
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
  const result = await createSavedAgent(db, userId, {
    name: typeof payload.name === "string" ? payload.name : "",
    instructionsAddition: typeof payload.instructionsAddition === "string" ? payload.instructionsAddition : "",
    useKnowledge: payload.useKnowledge !== false,
  });
  if (!result.ok) return Response.json({ error: result.message }, { status: 400 });
  return Response.json({ savedAgent: result.data }, { status: 201 });
}
