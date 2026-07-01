import Link from "next/link";
import { LogoIcon } from "@/components/icons";
import { brand } from "@/lib/brand.config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Link href="/" className="mb-2 flex items-center gap-2">
            <LogoIcon height={36} width={27.5} />
            <span className="font-heading font-bold text-[22px] text-[var(--text-primary)]">{brand.name}</span>
          </Link>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>This page doesn&apos;t exist or may have moved.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/app" />} className="w-full" size="lg">
            Back to Aio
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
