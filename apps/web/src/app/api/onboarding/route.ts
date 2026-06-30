import { createClient } from "@/lib/supabase/server";
import { ensureRegistryRow, serviceDb, updateRegistryRow } from "@/lib/hermes/registry";

// R6.1 onboarding state: lightweight read/write for the AppHome welcome-screen
// overlay. Mirrors the /api/credits pattern — no gateway/profile spawn here.
const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

export async function GET() {
  if (DEV_BYPASS) {
    return Response.json({ onboardedAt: new Date().toISOString() });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const row = await ensureRegistryRow(serviceDb(), user.id, user.email ?? "");
  return Response.json({ onboardedAt: row.onboarded_at });
}

export async function POST() {
  if (DEV_BYPASS) {
    return Response.json({ onboardedAt: new Date().toISOString() });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const row = await updateRegistryRow(serviceDb(), user.id, {
    onboarded_at: new Date().toISOString(),
  });
  return Response.json({ onboardedAt: row.onboarded_at });
}
