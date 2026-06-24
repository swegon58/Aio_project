// /api/preview/[sessionId]/[...path] — reverse-proxy into the Docker
// preview-sandbox container for that session (see
// apps/web/src/lib/hermes/preview-sandbox.ts). Chosen over a system-level
// nginx/Caddy reload because it needs no config reload per new session: the
// session->port mapping is resolved per-request from the in-memory registry
// preview-sandbox.ts already keeps. A documented Caddy/nginx snippet for
// fronting this with a real reverse proxy instead lives in that file's
// header comment.
//
// This is intentionally a manual fetch-stream proxy rather than a
// dependency like http-proxy-middleware — Next.js route handlers don't give
// you a raw Node req/res to hand to that style of middleware anyway; a plain
// fetch() pass-through is the simplest thing that works for both the HTML
// document and the dev server's HMR/asset requests.
//
// NOTE: most Node dev servers (Vite, Next) use a WebSocket for HMR. Plain
// fetch-based proxying here only covers HTTP requests — HMR over WS will not
// be proxied in v1 (the iframe will still load and show the app; live-reload
// just won't work until the page is manually refreshed). Documented gap, not
// implemented — wiring a WS proxy is a follow-up if HMR-in-iframe turns out
// to matter for the Aio Terminal UX.
import { NextRequest } from "next/server";
import { getPreviewSession } from "@/lib/hermes/preview-sandbox";

async function proxy(req: NextRequest, sessionId: string, pathParts: string[] | undefined) {
  const session = getPreviewSession(sessionId);
  if (!session || session.status !== "running") {
    return Response.json(
      { error: "preview_not_running", message: `No running preview for session ${sessionId}` },
      { status: 404 },
    );
  }

  const subPath = (pathParts ?? []).join("/");
  const targetUrl = new URL(`http://127.0.0.1:${session.port}/${subPath}`);
  targetUrl.search = req.nextUrl.search;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers: stripHopByHopHeaders(req.headers),
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
      // @ts-expect-error - duplex is required by undici for streamed bodies, not yet in the lib.dom types used here
      duplex: ["GET", "HEAD"].includes(req.method) ? undefined : "half",
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "preview_proxy_failed", message: msg }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: stripHopByHopHeaders(upstream.headers),
  });
}

function stripHopByHopHeaders(headers: Headers): Headers {
  const out = new Headers(headers);
  for (const name of ["connection", "keep-alive", "transfer-encoding", "host", "content-encoding"]) {
    out.delete(name);
  }
  return out;
}

type RouteParams = { params: Promise<{ sessionId: string; path?: string[] }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { sessionId, path } = await params;
  return proxy(req, sessionId, path);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { sessionId, path } = await params;
  return proxy(req, sessionId, path);
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { sessionId, path } = await params;
  return proxy(req, sessionId, path);
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { sessionId, path } = await params;
  return proxy(req, sessionId, path);
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { sessionId, path } = await params;
  return proxy(req, sessionId, path);
}
