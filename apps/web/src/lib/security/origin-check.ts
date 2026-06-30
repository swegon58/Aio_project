// Lightweight CSRF defense for a fetch-based SPA: reject cross-origin
// unsafe-method requests by comparing the Origin (or Referer fallback)
// header's host against the request's own Host. Requests with neither
// header (non-browser callers, e.g. signature-verified webhooks) pass
// through untouched.

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isUnsafeMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase());
}

export function isCrossOriginRequest(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;

  const sourceHeader = request.headers.get("origin") ?? request.headers.get("referer");
  if (!sourceHeader) return false;

  try {
    const sourceHost = new URL(sourceHeader).host;
    return sourceHost !== host;
  } catch {
    return true;
  }
}
