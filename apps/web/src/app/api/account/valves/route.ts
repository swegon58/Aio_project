import { resolveRunApiContext } from "@/lib/aio/runs/run-api";

// GET /api/account/valves?tool_id=... — read one tool's per-customer valves.
export async function GET(req: Request) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;

  const toolId = new URL(req.url).searchParams.get("tool_id");
  if (!toolId) {
    return Response.json({ error: "missing_tool_id", message: "tool_id query param is required." }, { status: 400 });
  }

  const { data, error } = await db
    .from("aio_tool_valves")
    .select("valves")
    .eq("customer_id", userId)
    .eq("tool_id", toolId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return Response.json({ valves: {} });
    return Response.json({ error: "db_error", message: error.message }, { status: 500 });
  }

  return Response.json({ valves: (data?.valves as Record<string, unknown>) ?? {} });
}

// POST /api/account/valves — upsert one tool's valves for the signed-in user.
// Body: { tool_id: string, valves: Record<string, unknown> }
export async function POST(req: Request) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;

  const body = await req.json();
  if (typeof body?.tool_id !== "string" || !body.tool_id.trim()) {
    return Response.json({ error: "invalid_tool_id", message: "tool_id must be a non-empty string." }, { status: 400 });
  }
  if (!body.valves || typeof body.valves !== "object" || Array.isArray(body.valves)) {
    return Response.json({ error: "invalid_valves", message: "valves must be an object." }, { status: 400 });
  }

  const { data, error } = await db
    .from("aio_tool_valves")
    .upsert({ customer_id: userId, tool_id: body.tool_id, valves: body.valves })
    .select("valves")
    .single();

  if (error) return Response.json({ error: "db_error", message: error.message }, { status: 500 });

  return Response.json({ valves: (data?.valves as Record<string, unknown>) ?? {} });
}
