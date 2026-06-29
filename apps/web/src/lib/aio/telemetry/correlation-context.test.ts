import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  extractCorrelationContext,
  rootCorrelationContext,
  correlationAttributes,
  withCorrelationHeaders,
  CORRELATION_HEADERS,
} from "./correlation-context";

const makeReq = (headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/test", { headers });

// ---------------------------------------------------------------------------
// extractCorrelationContext
// ---------------------------------------------------------------------------

test("extractCorrelationContext: mints a requestId if header absent", () => {
  const ctx = extractCorrelationContext(makeReq());
  assert.match(ctx.requestId, /^[0-9a-f-]{36}$/);
});

test("extractCorrelationContext: echoes requestId from header", () => {
  const req = makeReq({ [CORRELATION_HEADERS.requestId]: "req-123" });
  const ctx = extractCorrelationContext(req);
  assert.equal(ctx.requestId, "req-123");
});

test("extractCorrelationContext: extracts runId from header", () => {
  const req = makeReq({ [CORRELATION_HEADERS.runId]: "run-abc" });
  const ctx = extractCorrelationContext(req);
  assert.equal(ctx.runId, "run-abc");
});

test("extractCorrelationContext: extracts hermesRunId from header", () => {
  const req = makeReq({ [CORRELATION_HEADERS.hermesRunId]: "h-run-xyz" });
  const ctx = extractCorrelationContext(req);
  assert.equal(ctx.hermesRunId, "h-run-xyz");
});

test("extractCorrelationContext: extracts conversationId from header", () => {
  const req = makeReq({ [CORRELATION_HEADERS.conversationId]: "conv-99" });
  const ctx = extractCorrelationContext(req);
  assert.equal(ctx.conversationId, "conv-99");
});

test("extractCorrelationContext: overrides take precedence over headers", () => {
  const req = makeReq({ [CORRELATION_HEADERS.runId]: "header-run" });
  const ctx = extractCorrelationContext(req, { runId: "override-run" });
  assert.equal(ctx.runId, "override-run");
});

test("extractCorrelationContext: userId comes only from overrides (not headers)", () => {
  const ctx = extractCorrelationContext(makeReq(), { userId: "user-42" });
  assert.equal(ctx.userId, "user-42");
});

test("extractCorrelationContext: non-correlated fields default to null", () => {
  const ctx = extractCorrelationContext(makeReq());
  assert.equal(ctx.userId, null);
  assert.equal(ctx.toolCallId, null);
  assert.equal(ctx.approvalId, null);
  assert.equal(ctx.billingId, null);
  assert.equal(ctx.providerRequestId, null);
});

// ---------------------------------------------------------------------------
// rootCorrelationContext
// ---------------------------------------------------------------------------

test("rootCorrelationContext: mints a requestId by default", () => {
  const ctx = rootCorrelationContext();
  assert.match(ctx.requestId, /^[0-9a-f-]{36}$/);
});

test("rootCorrelationContext: uses provided requestId", () => {
  const ctx = rootCorrelationContext({ requestId: "root-req-1" });
  assert.equal(ctx.requestId, "root-req-1");
});

test("rootCorrelationContext: all nullable fields default to null", () => {
  const ctx = rootCorrelationContext();
  const nullables: (keyof typeof ctx)[] = [
    "userId", "conversationId", "runId", "hermesRunId",
    "toolCallId", "approvalId", "billingId", "providerRequestId",
  ];
  for (const k of nullables) {
    assert.equal(ctx[k], null, `${k} should be null`);
  }
});

test("rootCorrelationContext: two calls produce unique requestIds", () => {
  const a = rootCorrelationContext();
  const b = rootCorrelationContext();
  assert.notEqual(a.requestId, b.requestId);
});

// ---------------------------------------------------------------------------
// correlationAttributes
// ---------------------------------------------------------------------------

test("correlationAttributes: includes requestId always", () => {
  const ctx = rootCorrelationContext({ requestId: "req-1" });
  const attrs = correlationAttributes(ctx);
  assert.equal(attrs["aio.request_id"], "req-1");
});

test("correlationAttributes: omits null fields", () => {
  const ctx = rootCorrelationContext({ requestId: "req-1" });
  const attrs = correlationAttributes(ctx);
  assert.equal("aio.run_id" in attrs, false);
  assert.equal("aio.user_id" in attrs, false);
});

test("correlationAttributes: includes all non-null IDs", () => {
  const ctx = rootCorrelationContext({
    requestId: "req-1",
    userId: "u-1",
    runId: "run-1",
    hermesRunId: "h-1",
    conversationId: "conv-1",
    toolCallId: "tc-1",
    approvalId: "ap-1",
    billingId: "bill-1",
    providerRequestId: "prov-1",
  });
  const attrs = correlationAttributes(ctx);
  assert.equal(attrs["aio.request_id"], "req-1");
  assert.equal(attrs["aio.user_id"], "u-1");
  assert.equal(attrs["aio.run_id"], "run-1");
  assert.equal(attrs["hermes.run_id"], "h-1");
  assert.equal(attrs["aio.conversation_id"], "conv-1");
  assert.equal(attrs["aio.tool_call_id"], "tc-1");
  assert.equal(attrs["aio.approval_id"], "ap-1");
  assert.equal(attrs["aio.billing_id"], "bill-1");
  assert.equal(attrs["provider.request_id"], "prov-1");
});

test("correlationAttributes: no PII fields present", () => {
  const ctx = rootCorrelationContext({ requestId: "req-1" });
  const attrs = correlationAttributes(ctx);
  const keys = Object.keys(attrs);
  for (const k of keys) {
    assert.equal(k.includes("email"), false, `key ${k} looks like PII`);
    assert.equal(k.includes("name"), false, `key ${k} looks like PII`);
    assert.equal(k.includes("password"), false, `key ${k} looks like PII`);
  }
});

// ---------------------------------------------------------------------------
// withCorrelationHeaders
// ---------------------------------------------------------------------------

test("withCorrelationHeaders: always sets request-id header", () => {
  const ctx = rootCorrelationContext({ requestId: "req-99" });
  const init = withCorrelationHeaders(ctx);
  const headers = new Headers(init.headers);
  assert.equal(headers.get(CORRELATION_HEADERS.requestId), "req-99");
});

test("withCorrelationHeaders: sets runId header when present", () => {
  const ctx = rootCorrelationContext({ requestId: "r", runId: "run-42" });
  const init = withCorrelationHeaders(ctx);
  const headers = new Headers(init.headers);
  assert.equal(headers.get(CORRELATION_HEADERS.runId), "run-42");
});

test("withCorrelationHeaders: omits optional headers when null", () => {
  const ctx = rootCorrelationContext({ requestId: "r" });
  const init = withCorrelationHeaders(ctx);
  const headers = new Headers(init.headers);
  assert.equal(headers.get(CORRELATION_HEADERS.runId), null);
  assert.equal(headers.get(CORRELATION_HEADERS.hermesRunId), null);
  assert.equal(headers.get(CORRELATION_HEADERS.conversationId), null);
});

test("withCorrelationHeaders: merges with existing init headers", () => {
  const ctx = rootCorrelationContext({ requestId: "r" });
  const init = withCorrelationHeaders(ctx, {
    headers: { "content-type": "application/json" },
  });
  const headers = new Headers(init.headers);
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get(CORRELATION_HEADERS.requestId), "r");
});
