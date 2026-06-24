// POST /api/preview/start — resolves the live session's workspace dir from
// the hermes-agent gateway (GET /v1/workspace/cwd) then starts (or reuses) a
// Docker-isolated preview for it via preview-sandbox.ts. Server-side only:
// the gateway host/port/key never reach the browser, mirroring the
// chat/artifact proxy pattern in api/chat/artifact/route.ts.
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { startPreview } from "@/lib/hermes/preview-sandbox";

export async function POST() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row, apiServerKey, hermesSessionId } = ctxResult.ctx;

  let cwdRes: Response;
  try {
    cwdRes = await fetch(
      `${row.endpoint}/v1/workspace/cwd?task_id=${encodeURIComponent(hermesSessionId)}`,
      {
        headers: { Authorization: `Bearer ${apiServerKey}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "cwd_unreachable", message: msg }, { status: 502 });
  }

  if (!cwdRes.ok) {
    return Response.json(
      { error: "cwd_unreachable", message: `Gateway returned ${cwdRes.status}` },
      { status: 502 },
    );
  }

  const cwdData: { cwd: string | null; reason?: string } = await cwdRes.json();
  if (!cwdData.cwd) {
    return Response.json(
      { error: cwdData.reason ?? "no_workspace", message: "No local workspace directory for this session" },
      { status: 409 },
    );
  }

  try {
    const { previewUrl } = await startPreview(hermesSessionId, cwdData.cwd);
    return Response.json({ previewUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "preview_start_failed", message: msg }, { status: 500 });
  }
}
