import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { tierConfig } from "@/lib/hermes/pricing";

function requireCronAccess(planTier: string): Response | null {
  if (!tierConfig(planTier).toolsets.includes("cronjob")) {
    return Response.json(
      { error: "Scheduled tasks require the Business plan." },
      { status: 403 },
    );
  }
  return null;
}

// Sub-action proxy for /api/jobs/{id}/{pause,resume,run} — action comes from
// the `action` query param since Hermes exposes these as separate POST
// routes per action, not a single PATCH body field.
export async function PATCH(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row, planTier, apiServerKey } = ctxResult.ctx;

  const denied = requireCronAccess(planTier);
  if (denied) return denied;

  const payload = await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${row.endpoint}/api/jobs/${jobId}`, {
      method: "PATCH",
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

export async function DELETE(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row, planTier, apiServerKey } = ctxResult.ctx;

  const denied = requireCronAccess(planTier);
  if (denied) return denied;

  let upstream: Response;
  try {
    upstream = await fetch(`${row.endpoint}/api/jobs/${jobId}`, {
      method: "DELETE",
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

export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row, planTier, apiServerKey } = ctxResult.ctx;

  const denied = requireCronAccess(planTier);
  if (denied) return denied;

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  if (!["pause", "resume", "run"].includes(action ?? "")) {
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${row.endpoint}/api/jobs/${jobId}/${action}`, {
      method: "POST",
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
