import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

interface Ctx {
  row: { profile_name: string | null };
}

let ctxResult: { ok: true; ctx: Ctx } | { ok: false; res: Response } = {
  ok: true,
  ctx: { row: { profile_name: "cust_abc123" } },
};

let cliResult: { code: number; stdout: string; stderr: string } = {
  code: 0,
  stdout: "",
  stderr: "",
};
const cliCalls: Array<{ profileName: string; args: string[] }> = [];

mock.module("@/lib/hermes/request-context", {
  namedExports: {
    resolveHermesRequestContext: async () => ctxResult,
  },
});
mock.module("@/lib/hermes/mcp-cli", {
  namedExports: {
    runHermesMcp: async (profileName: string, args: string[]) => {
      cliCalls.push({ profileName, args });
      return cliResult;
    },
  },
});

let POST: typeof import("./route").POST;
let PATCH: typeof import("./route").PATCH;
let DELETE: typeof import("./route").DELETE;
before(async () => {
  ({ POST, PATCH, DELETE } = await import("./route"));
});

function req(method: string, body?: unknown) {
  return new Request("http://localhost/api/integrations/mcp", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

test("POST passes through the context error response", async () => {
  ctxResult = { ok: false, res: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const res = await POST(req("POST", { name: "n8n" }));
  assert.equal(res.status, 401);
});

test("POST returns 503 when no profile is provisioned", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: null } } };
  const res = await POST(req("POST", { name: "n8n" }));
  assert.equal(res.status, 503);
});

test("POST rejects a missing name", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  const res = await POST(req("POST", {}));
  assert.equal(res.status, 400);
});

test("POST installs a catalog entry and scopes to the caller's own profile", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 0, stdout: "", stderr: "" };
  cliCalls.length = 0;
  const res = await POST(req("POST", { name: "n8n" }));
  assert.equal(res.status, 200);
  assert.equal(cliCalls[0]?.profileName, "cust_abc123");
  assert.deepEqual(cliCalls[0]?.args, ["install", "n8n"]);
});

test("POST forwards env as --env KEY=VALUE pairs", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 0, stdout: "", stderr: "" };
  cliCalls.length = 0;
  const res = await POST(req("POST", { name: "n8n", env: { N8N_API_KEY: "secret" } }));
  assert.equal(res.status, 200);
  assert.deepEqual(cliCalls[0]?.args, ["install", "n8n", "--env", "N8N_API_KEY=secret"]);
});

test("POST rejects an invalid env key", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  const res = await POST(req("POST", { name: "n8n", env: { "bad key": "x" } }));
  assert.equal(res.status, 400);
});

test("POST surfaces a hermes_cli install failure", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 1, stdout: "not in the catalog", stderr: "" };
  const res = await POST(req("POST", { name: "nope" }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "install_failed");
});

test("PATCH rejects missing fields", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  const res = await PATCH(req("PATCH", { name: "n8n" }));
  assert.equal(res.status, 400);
});

test("PATCH enables a server", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 0, stdout: "", stderr: "" };
  cliCalls.length = 0;
  const res = await PATCH(req("PATCH", { name: "n8n", enabled: true }));
  assert.equal(res.status, 200);
  assert.deepEqual(cliCalls[0]?.args, ["enable", "n8n"]);
});

test("PATCH disables a server", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 0, stdout: "", stderr: "" };
  cliCalls.length = 0;
  const res = await PATCH(req("PATCH", { name: "n8n", enabled: false }));
  assert.equal(res.status, 200);
  assert.deepEqual(cliCalls[0]?.args, ["disable", "n8n"]);
});

test("PATCH surfaces a hermes_cli toggle failure (e.g. non-zero exit)", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 1, stdout: "not found in config", stderr: "" };
  const res = await PATCH(req("PATCH", { name: "ghost", enabled: true }));
  assert.equal(res.status, 400);
});

test("DELETE removes a server", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 0, stdout: "", stderr: "" };
  cliCalls.length = 0;
  const res = await DELETE(req("DELETE", { name: "n8n" }));
  assert.equal(res.status, 200);
  assert.deepEqual(cliCalls[0]?.args, ["remove", "n8n"]);
});

test("DELETE rejects a missing name", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  const res = await DELETE(req("DELETE", {}));
  assert.equal(res.status, 400);
});
