// Pure unit tests for the run repository's cursor helpers. The DB-backed methods
// (createRun, transitionRun, requestRunCancellation, listRuns, appendEvent) are
// exercised by the live probe in supabase/migrations/_probes (against the real
// local stack) because they are thin wrappers over Postgres with no client-side
// branching worth unit-testing in isolation.
import assert from "node:assert/strict";
import test from "node:test";
import { decodeRunsCursor, encodeRunsCursor } from "./run-repository";

test("encodeRunsCursor / decodeRunsCursor round-trip", () => {
  const cursor = encodeRunsCursor("2026-06-28T12:00:00.000Z", "run-abc");
  const decoded = decodeRunsCursor(cursor);
  assert.deepEqual(decoded, {
    createdAt: "2026-06-28T12:00:00.000Z",
    id: "run-abc",
  });
});

test("decodeRunsCursor returns null for malformed input", () => {
  assert.equal(decodeRunsCursor("not-valid-base64url-json"), null);
  assert.equal(decodeRunsCursor(""), null);
  // Valid base64url of a non-object string.
  assert.equal(
    decodeRunsCursor(Buffer.from("hello", "utf8").toString("base64url")),
    null,
  );
  // Valid JSON object missing the required shape.
  assert.equal(
    decodeRunsCursor(
      Buffer.from(JSON.stringify({ foo: 1 }), "utf8").toString("base64url"),
    ),
    null,
  );
});
