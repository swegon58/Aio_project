import { NextRequest } from "next/server";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";

// GET /api/chat/artifact?runId=&path= — proxy for hermes-agent's
// GET /v1/runs/{run_id}/file (gateway/platforms/api_server.py
// _handle_run_file). Lets the chat-bubble attachment card deliver a
// skill-generated file (e.g. .pptx/.xlsx) without exposing the gateway's
// host/port to the browser. The gateway itself enforces that `path` was
// actually surfaced by this run (see `_run_artifacts`) — this proxy adds no
// extra trust boundary, it just forwards the byte stream and headers.
export async function GET(req: NextRequest) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row, apiServerKey } = ctxResult.ctx;

  const runId = req.nextUrl.searchParams.get("runId");
  const path = req.nextUrl.searchParams.get("path");
  if (!runId || !path) {
    return Response.json({ error: "missing_fields", message: "runId and path are required" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(
      `${row.endpoint}/v1/runs/${encodeURIComponent(runId)}/file?path=${encodeURIComponent(path)}`,
      {
        headers: { Authorization: `Bearer ${apiServerKey}` },
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "hermes_request_failed", message: msg }, { status: 502 });
  }

  if (!res.ok || !res.body) {
    return Response.json({ error: "artifact_not_found" }, { status: res.status || 404 });
  }

  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  const contentDisposition = res.headers.get("content-disposition");
  if (contentType) headers.set("content-type", contentType);
  headers.set("content-disposition", contentDisposition ?? `attachment; filename="${path.split("/").pop()}"`);

  return new Response(res.body, { status: 200, headers });
}
