import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { tierConfig } from "@/lib/hermes/pricing";

// Proxies to the customer's Hermes gateway REST cron API (/api/jobs).
// Gated to tiers with "cronjob" in their toolsets list — Hermes itself
// doesn't enforce this at the REST layer, only at agent-tool level, so
// Aio enforces it here before ever forwarding the request.
function requireCronAccess(planTier: string): Response | null {
  if (!tierConfig(planTier).toolsets.includes("cronjob")) {
    return Response.json(
      { error: "Scheduled tasks require the Business plan." },
      { status: 403 },
    );
  }
  return null;
}

export async function GET() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row, planTier, apiServerKey } = ctxResult.ctx;

  const denied = requireCronAccess(planTier);
  if (denied) return denied;

  let upstream: Response;
  try {
    upstream = await fetch(`${row.endpoint}/api/jobs`, {
      headers: { Authorization: `Bearer ${apiServerKey}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "hermes_request_failed", message: msg }, { status: 502 });
  }
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row, planTier, apiServerKey } = ctxResult.ctx;

  const denied = requireCronAccess(planTier);
  if (denied) return denied;

  const payload = await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${row.endpoint}/api/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiServerKey}`,
        "Content-Type": "application/json",
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "hermes_request_failed", message: msg }, { status: 502 });
  }
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
