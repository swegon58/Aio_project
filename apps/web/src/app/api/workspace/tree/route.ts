import { NextRequest } from "next/server";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";

// GET /api/workspace/tree?path= — proxy for hermes-agent's
// GET /v1/workspace/tree (gateway/platforms/api_server.py
// _handle_workspace_tree). Read-only directory listing for the file
// browser panel, scoped to the current thread's Hermes session/task.
export async function GET(req: NextRequest) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { db, userId, threadId, row, apiServerKey, hermesSessionId } = ctxResult.ctx;

  // Guard: hermes-agent's list_dir_tool falls back to the gateway process's
  // own cwd when task_id has no registered workspace root (file_tools.py
  // _resolve_base_dir step 4) — that's the real host filesystem, not a
  // sandboxed task dir. A thread only gets a real Hermes-side task/workspace
  // once its first chat turn has actually run (route.ts persistConversation
  // upserts hermes_conversations at the end of that turn). Until that row
  // exists, refuse rather than risk listing the unsandboxed fallback.
  const { data: conversation } = await db
    .from("hermes_conversations")
    .select("id")
    .eq("id", threadId)
    .eq("customer_id", userId)
    .maybeSingle();
  if (!conversation) {
    return Response.json(
      { error: "no_workspace_yet", message: "Send a message first to start a workspace." },
      { status: 409 },
    );
  }

  const path = req.nextUrl.searchParams.get("path") || ".";

  let res: Response;
  try {
    const url = new URL(`${row.endpoint}/v1/workspace/tree`);
    url.searchParams.set("task_id", hermesSessionId);
    url.searchParams.set("path", path);
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiServerKey}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "hermes_request_failed", message: msg }, { status: 502 });
  }

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
