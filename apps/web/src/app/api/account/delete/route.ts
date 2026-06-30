import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { deleteAccountAndData } from "@/lib/account/delete";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

// DELETE /api/account/delete — irreversibly delete the signed-in user's
// account and all derived data (Storage objects + every cascaded DB row).
// Rate-limited (2/min). Requires a typed `{ confirm: "DELETE" }` body as a
// second server-side guard on top of the client's typed-confirm UI.
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const limit = checkRateLimit(`account-delete:${user.id}`, 2, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  let body: { confirm?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (body.confirm !== "DELETE") {
    return Response.json(
      { error: "confirm_required", message: "Type DELETE to confirm account deletion." },
      { status: 400 },
    );
  }

  const db = createServiceClient();
  const result = await deleteAccountAndData(db, user.id);
  if (!result.ok) {
    return Response.json(
      { error: "delete_failed", message: "Account deletion failed.", details: result.storageErrors },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
