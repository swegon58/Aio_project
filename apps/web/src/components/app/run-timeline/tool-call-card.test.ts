import test from "node:test";
import assert from "node:assert/strict";
import { toolDisplayMeta, humanizeToolName } from "./ToolCallCard";

test("toolDisplayMeta resolves manifest canonicalName to a friendly label + icon", () => {
  const meta = toolDisplayMeta("code_execution");
  assert.equal(meta.label, "Code Execution");
  assert.ok(meta.Icon);
});

test("toolDisplayMeta falls back to a humanized raw name for unknown tools", () => {
  const meta = toolDisplayMeta("read_file");
  assert.equal(meta.label, "Read File");
  assert.ok(meta.Icon);
});

test("humanizeToolName title-cases snake/kebab-case raw tool names", () => {
  assert.equal(humanizeToolName("bash_execute"), "Bash Execute");
  assert.equal(humanizeToolName("web-search"), "Web Search");
});
