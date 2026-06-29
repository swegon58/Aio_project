import test from "node:test";
import assert from "node:assert/strict";
import {
  getMandatoryApprovalToolNames,
  getSafeToolNames,
  resolveAioToolPolicy,
  MANDATORY_APPROVAL_CATEGORIES,
  requiresMandatoryApproval,
} from "./tool-policy";

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

// R2.5 mandatory policy tests
test("R2.5: all mandatory categories reference tools that require approval", () => {
  for (const [category, tools] of Object.entries(MANDATORY_APPROVAL_CATEGORIES)) {
    for (const toolName of tools) {
      assert.ok(
        requiresMandatoryApproval(toolName),
        `Category '${category}' tool '${toolName}' must require mandatory approval`,
      );
    }
  }
});

test("R2.5: dangerous tools require mandatory approval; safe tools do not", () => {
  assert.equal(requiresMandatoryApproval("file"), true);
  assert.equal(requiresMandatoryApproval("terminal"), true);
  assert.equal(requiresMandatoryApproval("browser"), true);
  assert.equal(requiresMandatoryApproval("mcp"), true);
  assert.equal(requiresMandatoryApproval("connected_apps"), true);
  assert.equal(requiresMandatoryApproval("cronjob"), true);
  assert.equal(requiresMandatoryApproval("web"), false);
  assert.equal(requiresMandatoryApproval("clarify"), false);
});

test("R2.5: unknown tool does not require mandatory approval", () => {
  assert.equal(requiresMandatoryApproval("unknown_tool"), false);
});

