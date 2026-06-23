import { createClient } from "@/lib/supabase/server";
import { AppHome } from "@/components/app/AppHome";

export default async function AppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <AppHome email={user?.email ?? "dev@local"} />;
}
