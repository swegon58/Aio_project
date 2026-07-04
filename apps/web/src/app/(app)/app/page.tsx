import { createClient } from "@/lib/supabase/server";
import { AppHome } from "@/components/app/AppHome";

export default async function AppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const userName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;
  const userAvatarUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;
  return (
    <AppHome
      email={user?.email ?? "dev@local"}
      userName={userName}
      userAvatarUrl={userAvatarUrl}
    />
  );
}
