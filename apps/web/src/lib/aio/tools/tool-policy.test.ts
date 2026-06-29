import test from "node:test";
import assert from "node:assert/strict";
import { getMandatoryApprovalToolNames, getSafeToolNames, resolveAioToolPolicy } from "./tool-policy";

test("starter cannot access browser automation", () => {
  const policy = resolveAioToolPolicy("browser", "starter");
  assert.ok(policy);
  assert.equal(policy.available, false);
  assert.match(policy.reason, /starter/i);
});

test("business can access cronjob and it still requires approval", () => {
  const policy = resolveAioToolPolicy("cronjob", "business");
  assert.ok(policy);
  assert.equal(policy.available, true);
  assert.equal(policy.requiresApproval, true);
  assert.equal(policy.defaultApprovalMode, "once");
});

test("safe tool inventory excludes dangerous tools and includes web", () => {
  const safe = getSafeToolNames();
  assert.ok(safe.includes("web"));
  assert.ok(!safe.includes("browser"));
});

test("mandatory approval list includes local mutation and external bridges", () => {
  const names = getMandatoryApprovalToolNames();
  assert.ok(names.includes("file"));
  assert.ok(names.includes("terminal"));
  assert.ok(names.includes("browser"));
  assert.ok(names.includes("mcp"));
});

