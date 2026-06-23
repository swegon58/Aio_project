import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The mockup port (page.tsx) renders its own full shell (sidebar, top bar,
// right panel) matching ai_agent_webapp's markup 1:1.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const devBypass = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !devBypass) {
    redirect("/login");
  }

  return <>{children}</>;
}
