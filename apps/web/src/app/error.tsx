"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LogoIcon } from "@/components/icons";
import { brand } from "@/lib/brand.config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Link href="/" className="mb-2 flex items-center gap-2">
            <LogoIcon height={36} width={27.5} />
            <span className="font-heading font-bold text-[22px] text-[var(--text-primary)]">{brand.name}</span>
          </Link>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>Please try again, or head back to Aio.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button onClick={reset} className="w-full" size="lg">
            Try again
          </Button>
          <Button render={<Link href="/app" />} variant="outline" className="w-full" size="lg">
            Back to Aio
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
