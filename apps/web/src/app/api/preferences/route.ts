import { getPreferences, upsertPreferences } from "@/lib/aio/preferences/preference-repository";
import { resolveRunApiContext } from "@/lib/aio/runs/run-api";

// GET /api/preferences — R11.1: get user preferences
export async function GET(req: Request) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;

  const result = await getPreferences(db, userId);
  if (!result.ok) {
    return Response.json({ error: result.code, message: result.message }, { status: 500 });
  }

  return Response.json({ preferences: result.data });
}

// PATCH /api/preferences — R11.1: update user preferences
export async function PATCH(req: Request) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;

  const body = await req.json();
  const patch: Record<string, boolean> = {};

  if (body.notifyDiscordGlobal !== undefined) {
    if (typeof body.notifyDiscordGlobal !== "boolean") {
      return Response.json({ error: "invalid_type", message: "notifyDiscordGlobal must be a boolean." }, { status: 400 });
    }
    patch.notifyDiscordGlobal = body.notifyDiscordGlobal;
  }

  if (body.dataTrainingOptOut !== undefined) {
    if (typeof body.dataTrainingOptOut !== "boolean") {
      return Response.json({ error: "invalid_type", message: "dataTrainingOptOut must be a boolean." }, { status: 400 });
    }
    patch.dataTrainingOptOut = body.dataTrainingOptOut;
  }

  const result = await upsertPreferences(db, userId, patch);
  if (!result.ok) {
    return Response.json({ error: result.code, message: result.message }, { status: 500 });
  }

  return Response.json({ preferences: result.data });
}