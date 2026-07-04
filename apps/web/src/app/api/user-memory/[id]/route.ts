import { deleteFact, updateFact } from "@/lib/aio/user-memory/memory-fact-repository";
import { resolveRunApiContext } from "@/lib/aio/runs/run-api";

// PATCH /api/user-memory/[id] — update a fact (partial label/value).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;
  const { id } = await params;

  try {
    const body = await req.json();
    const { label, value } = body;

    if (label !== undefined && typeof label !== "string") {
      return Response.json({ error: "invalid_input", message: "Label must be a string." }, { status: 400 });
    }
    if (value !== undefined && typeof value !== "string") {
      return Response.json({ error: "invalid_input", message: "Value must be a string." }, { status: 400 });
    }

    const patch: { label?: string; value?: string } = {};
    if (label !== undefined) patch.label = label;
    if (value !== undefined) patch.value = value;

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: "invalid_input", message: "At least one field (label or value) must be provided." }, { status: 400 });
    }

    const fact = await updateFact(db, userId, id, patch);
    return Response.json({ fact });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update fact.";
    const status = message.includes("required") || message.includes("characters") || message.includes("not found") ? 400 : 500;
    return Response.json({ error: "update_failed", message }, { status });
  }
}

// DELETE /api/user-memory/[id] — delete a fact.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;
  const { id } = await params;

  try {
    await deleteFact(db, userId, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete fact.";
    const status = message.includes("not found") ? 404 : 500;
    return Response.json({ error: "delete_failed", message }, { status });
  }
}