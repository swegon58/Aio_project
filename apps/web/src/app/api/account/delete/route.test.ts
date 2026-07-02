import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

let currentUser: { id: string } | null = null;
let deleteResult: { ok: boolean; storageErrors: string[] } = { ok: true, storageErrors: [] };

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
mock.module("@/lib/account/delete", {
  namedExports: { deleteAccountAndData: async () => deleteResult },
});

let DELETE: typeof import("./route").DELETE;
before(async () => {
  ({ DELETE } = await import("./route"));
});

function req(body: unknown) {
  return new Request("http://localhost/api/account/delete", {
    method: "DELETE",
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

test("DELETE /api/account/delete returns 401 when signed out", async () => {
  currentUser = null;
  const res = await DELETE(req({ confirm: "DELETE" }));
  assert.equal(res.status, 401);
});

test("DELETE /api/account/delete requires the typed DELETE confirm", async () => {
  currentUser = { id: "user-confirm-check" };
  const res = await DELETE(req({ confirm: "nope" }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "confirm_required");
});

test("DELETE /api/account/delete deletes the account when confirmed", async () => {
  currentUser = { id: "user-delete-ok" };
  deleteResult = { ok: true, storageErrors: [] };
  const res = await DELETE(req({ confirm: "DELETE" }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test("DELETE /api/account/delete returns 500 when deletion fails", async () => {
  currentUser = { id: "user-delete-fail" };
  deleteResult = { ok: false, storageErrors: ["auth_delete: forbidden"] };
  const res = await DELETE(req({ confirm: "DELETE" }));
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error, "delete_failed");
});
