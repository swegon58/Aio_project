import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { gatherAccountData } from "@/lib/account/export";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

// GET /api/account/export — download everything Aio holds about the signed-in
// user as a JSON attachment. Rate-limited (5/min) to blunt accidental abuse.
// Auth is the lightweight createClient + getUser pattern (no gateway spawn),
// matching /api/credits.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const limit = checkRateLimit(`account-export:${user.id}`, 5, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const db = createServiceClient();
  const payload = await gatherAccountData(db, user.id);

  return Response.json(payload, {
    headers: {
      "content-disposition": 'attachment; filename="aio-account-export.json"',
    },
  });
}
