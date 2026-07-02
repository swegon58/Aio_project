import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

let currentUser: { id: string } | null = null;
let exportPayload: Record<string, unknown> = { conversations: [] };

mock.module("@/lib/supabase/server", {
  namedExports: {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: currentUser } }) },
    }),
  },
});
mock.module("@/lib/supabase/service", {
  namedExports: { createServiceClient: () => ({}) },
});
mock.module("@/lib/account/export", {
  namedExports: { gatherAccountData: async () => exportPayload },
});

let GET: typeof import("./route").GET;
before(async () => {
  ({ GET } = await import("./route"));
});

test("GET /api/account/export returns 401 when signed out", async () => {
  currentUser = null;
  const res = await GET();
  assert.equal(res.status, 401);
});

test("GET /api/account/export returns the gathered payload as an attachment", async () => {
  currentUser = { id: "user-export-ok" };
  exportPayload = { conversations: [{ id: "c1" }] };
  const res = await GET();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-disposition") ?? "", /attachment/);
  const body = await res.json();
  assert.deepEqual(body, exportPayload);
});
