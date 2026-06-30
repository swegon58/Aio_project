import assert from "node:assert/strict";
import test from "node:test";

import { isCrossOriginRequest, isUnsafeMethod } from "./origin-check";

test("isUnsafeMethod flags state-changing methods only", () => {
  assert.equal(isUnsafeMethod("POST"), true);
  assert.equal(isUnsafeMethod("put"), true);
  assert.equal(isUnsafeMethod("DELETE"), true);
  assert.equal(isUnsafeMethod("GET"), false);
  assert.equal(isUnsafeMethod("HEAD"), false);
});

test("isCrossOriginRequest is false when Origin host matches Host", () => {
  const req = new Request("https://aio.example/api/x", {
    method: "POST",
    headers: { host: "aio.example", origin: "https://aio.example" },
  });
  assert.equal(isCrossOriginRequest(req), false);
});

test("isCrossOriginRequest is true when Origin host differs from Host", () => {
  const req = new Request("https://aio.example/api/x", {
    method: "POST",
    headers: { host: "aio.example", origin: "https://evil.example" },
  });
  assert.equal(isCrossOriginRequest(req), true);
});

test("isCrossOriginRequest falls back to Referer when Origin is absent", () => {
  const req = new Request("https://aio.example/api/x", {
    method: "POST",
    headers: { host: "aio.example", referer: "https://evil.example/page" },
  });
  assert.equal(isCrossOriginRequest(req), true);
});

test("isCrossOriginRequest is false when neither Origin nor Referer is present", () => {
  const req = new Request("https://aio.example/api/x", {
    method: "POST",
    headers: { host: "aio.example" },
  });
  assert.equal(isCrossOriginRequest(req), false);
});
