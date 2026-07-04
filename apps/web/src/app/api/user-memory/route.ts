import { createFact, listFacts } from "@/lib/aio/user-memory/memory-fact-repository";
import { resolveRunApiContext } from "@/lib/aio/runs/run-api";

// GET /api/user-memory — list all facts for the authenticated customer.
export async function GET(req: Request) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;

  try {
    const facts = await listFacts(db, userId);
    return Response.json({ facts });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list facts.";
    return Response.json({ error: "list_failed", message }, { status: 500 });
  }
}

// POST /api/user-memory — create a new fact.
export async function POST(req: Request) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;

  try {
    const body = await req.json();
    const { label, value } = body;

    if (typeof label !== "string" || typeof value !== "string") {
      return Response.json({ error: "invalid_input", message: "Label and value must be strings." }, { status: 400 });
    }

    const fact = await createFact(db, userId, { label, value });
    return Response.json({ fact });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create fact.";
    const status = message.includes("required") || message.includes("characters") ? 400 : 500;
    return Response.json({ error: "create_failed", message }, { status });
  }
}