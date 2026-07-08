// "Knowledge as toolset" — on-demand semantic query into the user's
// knowledge base. Same operator-only gate as /api/internal/metrics: the
// Hermes agent calls this when it decides it needs the user's docs, instead
// of (or in addition to) the always-inject path in retrieve-context.ts.
//
// Returns fused RRF-ranked chunks from match_knowledge_chunks_hybrid
// (migration 0031). Tenant-scoped via p_customer_id; the service-role client
// is required because the caller authenticates with the internal secret, not
// the user's Supabase session.

import { serviceDb, getRegistryRow } from "@/lib/hermes/registry";
import { resolveOpenRouterKeyForProfile } from "@/lib/hermes/knowledge";
import { createOpenRouterEmbeddingProvider } from "@/lib/aio/knowledge/embeddings";

const INTERNAL_SECRET = process.env.AIO_INTERNAL_SECRET ?? "";
const OWNER_EMAIL = process.env.AIO_OWNER_EMAIL ?? "";

async function isAuthorized(req: Request): Promise<boolean> {
  const secretHeader = req.headers.get("x-aio-internal-secret") ?? "";
  if (INTERNAL_SECRET && secretHeader === INTERNAL_SECRET) return true;

  // No session fallback for this endpoint: it is called by the Hermes runtime
  // with the internal secret, not by a browser session. Reject if the secret
  // is unset or mismatched.
  return false;
}

interface QueryBody {
  customer_id?: unknown;
  query_text?: unknown;
  match_count?: unknown;
}

const MAX_QUERY = 2000;
const MAX_MATCH = 50;

export async function POST(req: Request) {
  if (!(await isAuthorized(req))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: QueryBody;
  try {
    body = (await req.json()) as QueryBody;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const customerId = typeof body.customer_id === "string" ? body.customer_id.trim() : "";
  const queryText = typeof body.query_text === "string" ? body.query_text.trim() : "";
  if (!customerId || !queryText) {
    return Response.json({ error: "customer_id and query_text are required" }, { status: 400 });
  }
  if (queryText.length > MAX_QUERY) {
    return Response.json({ error: `query_text exceeds ${MAX_QUERY} chars` }, { status: 413 });
  }

  const matchCount = clampInt(body.match_count, 5, 1, MAX_MATCH);

  const db = serviceDb();

  // Resolve the customer's OpenRouter embedding key via the same path the
  // orchestrator uses (registry.profile_name → profile .env → process env).
  const row = await getRegistryRow(db, customerId).catch(() => null);
  const apiKey = await resolveOpenRouterKeyForProfile(row?.profile_name ?? null);
  if (!apiKey) {
    return Response.json(
      { error: "no embedding api key configured for this customer" },
      { status: 503 },
    );
  }

  let embedding: number[];
  try {
    embedding = await createOpenRouterEmbeddingProvider(apiKey).embedOne(queryText);
  } catch (e) {
    return Response.json({ error: `embedding failed: ${(e as Error).message}` }, { status: 502 });
  }

  const { data, error } = await db.rpc("match_knowledge_chunks_hybrid", {
    p_customer_id: customerId,
    p_query_text: queryText,
    p_query_embedding: embedding,
    p_match_count: matchCount,
  });
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const chunks = (data as { id: string; doc_id: string; content: string; similarity: number }[])
    .map((r) => ({ id: r.id, doc_id: r.doc_id, content: r.content, similarity: r.similarity }));
  return Response.json({ chunks });
}

function clampInt(value: unknown, def: number, lo: number, hi: number): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}
