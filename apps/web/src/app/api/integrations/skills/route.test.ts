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
mock.module("@/lib/hermes/skill-cli", {
  namedExports: {
    runHermesSkills: async (profileName: string, args: string[]) => {
      cliCalls.push({ profileName, args });
      return cliResult;
    },
  },
});

let GET: typeof import("./route").GET;
let POST: typeof import("./route").POST;
let PATCH: typeof import("./route").PATCH;
before(async () => {
  ({ GET, POST, PATCH } = await import("./route"));
});

function req(method: string, body?: unknown) {
  return new Request("http://localhost/api/integrations/skills", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

test("GET passes through the context error response", async () => {
  ctxResult = { ok: false, res: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const res = await GET();
  assert.equal(res.status, 401);
});

test("GET returns 503 when no profile is provisioned", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: null } } };
  const res = await GET();
  assert.equal(res.status, 503);
});

test("GET parses the skills list JSON from hermes_cli", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = {
    code: 0,
    stdout: JSON.stringify({ skills: [{ name: "weather", category: "x", description: "", source: "hub", trust: "community", enabled: true }] }),
    stderr: "",
  };
  cliCalls.length = 0;
  const res = await GET();
  assert.equal(res.status, 200);
  assert.equal(cliCalls[0]?.args.join(" "), "list --json");
  const body = await res.json();
  assert.equal(body.skills[0].name, "weather");
});

test("GET surfaces a hermes_cli list failure", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 1, stdout: "", stderr: "boom" };
  const res = await GET();
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error, "list_failed");
});

test("GET surfaces malformed JSON from hermes_cli", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 0, stdout: "not json", stderr: "" };
  const res = await GET();
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error, "list_parse_failed");
});

test("POST passes through the context error response", async () => {
  ctxResult = { ok: false, res: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const res = await POST(req("POST", { identifier: "weather" }));
  assert.equal(res.status, 401);
});

test("POST returns 503 when no profile is provisioned", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: null } } };
  const res = await POST(req("POST", { identifier: "weather" }));
  assert.equal(res.status, 503);
});

test("POST rejects a missing identifier", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  const res = await POST(req("POST", {}));
  assert.equal(res.status, 400);
});

test("POST installs a skill and scopes to the caller's own profile", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 0, stdout: "", stderr: "" };
  cliCalls.length = 0;
  const res = await POST(req("POST", { identifier: "weather" }));
  assert.equal(res.status, 200);
  assert.equal(cliCalls[0]?.profileName, "cust_abc123");
  assert.deepEqual(cliCalls[0]?.args, ["install", "weather", "--yes"]);
});

test("POST forwards category, name, and force", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 0, stdout: "", stderr: "" };
  cliCalls.length = 0;
  const res = await POST(req("POST", { identifier: "weather", category: "utility", name: "wx", force: true }));
  assert.equal(res.status, 200);
  assert.deepEqual(cliCalls[0]?.args, ["install", "weather", "--category", "utility", "--name", "wx", "--yes", "--force"]);
});

test("POST surfaces a hermes_cli install failure", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 1, stdout: "blocked by scan", stderr: "" };
  const res = await POST(req("POST", { identifier: "nope" }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "install_failed");
});

test("PATCH rejects missing fields", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  const res = await PATCH(req("PATCH", { name: "weather" }));
  assert.equal(res.status, 400);
});

test("PATCH enables a skill", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 0, stdout: "", stderr: "" };
  cliCalls.length = 0;
  const res = await PATCH(req("PATCH", { name: "weather", enabled: true }));
  assert.equal(res.status, 200);
  assert.deepEqual(cliCalls[0]?.args, ["enable", "weather"]);
});

test("PATCH disables a skill", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 0, stdout: "", stderr: "" };
  cliCalls.length = 0;
  const res = await PATCH(req("PATCH", { name: "weather", enabled: false }));
  assert.equal(res.status, 200);
  assert.deepEqual(cliCalls[0]?.args, ["disable", "weather"]);
});

test("PATCH surfaces a hermes_cli toggle failure", async () => {
  ctxResult = { ok: true, ctx: { row: { profile_name: "cust_abc123" } } };
  cliResult = { code: 1, stdout: "not an installed skill", stderr: "" };
  const res = await PATCH(req("PATCH", { name: "ghost", enabled: true }));
  assert.equal(res.status, 400);
});
