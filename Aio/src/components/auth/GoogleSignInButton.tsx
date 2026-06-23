"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/icons";

export function GoogleSignInButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    if (next) redirectTo.searchParams.set("next", next);

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });
  }

  return (
    <Button onClick={handleSignIn} disabled={loading} className="w-full" size="lg">
      <GoogleIcon className="size-4" />
      {loading ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}
