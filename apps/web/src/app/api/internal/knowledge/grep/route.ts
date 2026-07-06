// "Knowledge as toolset" — on-demand regex grep over the user's knowledge
// base. Same operator-only gate as /api/internal/knowledge/query. Returns
// chunks whose content matches a bounded Postgres regex (`content ~ pattern`),
// scoped to the customer. Lets the agent find exact terms an embedding query
// would smooth over (IDs, error codes, config keys).

import { serviceDb } from "@/lib/hermes/registry";

const INTERNAL_SECRET = process.env.AIO_INTERNAL_SECRET ?? "";

async function isAuthorized(req: Request): Promise<boolean> {
  const secretHeader = req.headers.get("x-aio-internal-secret") ?? "";
  // Secret-only — no session fallback (called by the Hermes runtime).
  return Boolean(INTERNAL_SECRET) && secretHeader === INTERNAL_SECRET;
}

interface GrepBody {
  customer_id?: unknown;
  pattern?: unknown;
  match_count?: unknown;
}

const MAX_PATTERN = 500;
const MAX_MATCH = 50;

export async function POST(req: Request) {
  if (!(await isAuthorized(req))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: GrepBody;
  try {
    body = (await req.json()) as GrepBody;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const customerId = typeof body.customer_id === "string" ? body.customer_id.trim() : "";
  const pattern = typeof body.pattern === "string" ? body.pattern : "";
  if (!customerId || !pattern) {
    return Response.json({ error: "customer_id and pattern are required" }, { status: 400 });
  }
  if (pattern.length > MAX_PATTERN) {
    return Response.json({ error: `pattern exceeds ${MAX_PATTERN} chars` }, { status: 413 });
  }

  const matchCount = clampInt(body.match_count, 20, 1, MAX_MATCH);

  const db = serviceDb();

  // PostgREST `regex` operator → Postgres `~` (POSIX, case-sensitive).
  // Tenant scope is enforced by `.eq("customer_id", ...)`; an invalid regex
  // surfaces as a PostgREST error → 400.
  const { data, error } = await db
    .from("hermes_knowledge_chunks")
    .select("id, file_id, content")
    .eq("customer_id", customerId)
    .filter("content", "regex", pattern)
    .order("file_id", { ascending: true })
    .order("chunk_index", { ascending: true })
    .limit(matchCount);

  if (error) {
    // 40025 = invalid_regex in Postgres; treat any regex error as a 400 so
    // the agent can correct its pattern instead of seeing a server fault.
    const status = /invalid regular expression|invalid regex/i.test(error.message) ? 400 : 500;
    return Response.json({ error: error.message }, { status });
  }

  const chunks = (data as { id: string; file_id: string; content: string }[]).map((r) => ({
    id: r.id,
    file_id: r.file_id,
    content: r.content,
  }));
  return Response.json({ chunks });
}

function clampInt(value: unknown, def: number, lo: number, hi: number): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}
