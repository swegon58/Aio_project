import assert from "node:assert/strict";
import test from "node:test";

import { deleteAccountAndData } from "./delete";

interface DbOptions {
  // table -> storage_path values returned by the select query
  paths?: Record<string, string[]>;
  // table -> select error
  selectError?: Record<string, { message: string }>;
  // bucket -> remove error
  storageError?: Record<string, { message: string }>;
  deleteError?: { message: string } | null;
}

// Fake Supabase client that records the order of operations for assertions.
function makeDb(opts: DbOptions = {}) {
  const log: string[] = [];
  const db = {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_fk: string, _userId: string) {
              if (opts.selectError?.[table]) {
                return Promise.resolve({ data: null, error: opts.selectError[table] });
              }
              const paths = opts.paths?.[table] ?? [];
              return Promise.resolve({ data: paths.map((p) => ({ storage_path: p })), error: null });
            },
          };
        },
      };
    },
    storage: {
      from(bucket: string) {
        return {
          remove(paths: string[]) {
            log.push(`remove:${bucket}:${paths.length}`);
            return Promise.resolve({ data: {}, error: opts.storageError?.[bucket] ?? null });
          },
        };
      },
    },
    auth: {
      admin: {
        deleteUser(userId: string) {
          log.push(`deleteUser:${userId}`);
          return Promise.resolve({ error: opts.deleteError ?? null });
        },
      },
    },
    _log: log,
  };
  return db;
}

test("deleteAccountAndData removes Storage objects before deleting the user and returns ok", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = makeDb({ paths: { aio_knowledge_docs: ["u/abc.md"], hermes_gallery_images: ["u/img.png"] } }) as any;

  const result = await deleteAccountAndData(db, "user-1");

  assert.equal(result.ok, true);
  assert.equal(result.storageErrors.length, 0);
  const removeIdx = db._log.findIndex((e: string) => e.startsWith("remove:"));
  const deleteIdx = db._log.findIndex((e: string) => e.startsWith("deleteUser:"));
  assert.notEqual(removeIdx, -1);
  assert.notEqual(deleteIdx, -1);
  assert.ok(removeIdx < deleteIdx, "storage remove must happen before user delete");
  assert.ok(db._log[deleteIdx].includes("user-1"));
});

test("deleteAccountAndData does not abort deletion when Storage cleanup fails", async () => {
  const opts = {
    paths: { aio_knowledge_docs: ["u/abc.md"] },
    storageError: { "aio-knowledge": { message: "transient" } },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = makeDb(opts) as any;

  const result = await deleteAccountAndData(db, "user-1");

  assert.equal(result.ok, true);
  assert.ok(result.storageErrors.some((e) => e.includes("aio-knowledge")));
  assert.ok(db._log.some((e: string) => e.startsWith("deleteUser:")), "user still deleted despite storage error");
});

test("deleteAccountAndData returns ok:false when auth user deletion fails", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = makeDb({ deleteError: { message: "forbidden" } }) as any;

  const result = await deleteAccountAndData(db, "user-1");

  assert.equal(result.ok, false);
  assert.ok(result.storageErrors.some((e) => e.includes("auth_delete")));
});
