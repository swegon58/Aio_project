import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { LogoIcon } from "@/components/icons";
import { brand } from "@/lib/brand.config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect(next ?? "/app");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Link href="/" className="mb-2 flex items-center gap-2">
            <LogoIcon height={36} width={27.5} />
            <span className="font-heading font-bold text-[22px] text-[var(--text-primary)]">{brand.name}</span>
          </Link>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Continue with your Google account to access your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleSignInButton next={next} />
          {error && (
            <p className="mt-3 text-center text-sm text-destructive">Sign-in failed. Please try again.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
