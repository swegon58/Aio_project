import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isCrossOriginRequest, isUnsafeMethod } from "@/lib/security/origin-check";

const CSRF_EXEMPT_PATHS = ["/api/billing/webhook"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isExempt = CSRF_EXEMPT_PATHS.some((path) => pathname.startsWith(path));

  if (
    pathname.startsWith("/api/") &&
    !isExempt &&
    isUnsafeMethod(request.method) &&
    isCrossOriginRequest(request)
  ) {
    return NextResponse.json({ error: "cross_origin_request_rejected" }, { status: 403 });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|seo|images|videos|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
