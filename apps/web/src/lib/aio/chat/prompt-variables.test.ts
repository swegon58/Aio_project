import assert from "node:assert/strict";
import test from "node:test";

import { applyPromptVariables } from "./prompt-variables";

test("applyPromptVariables replaces USER_NAME and CURRENT_DATE", () => {
  const out = applyPromptVariables("Hi {{ USER_NAME }}, today is {{CURRENT_DATE}}.", "Ada");
  assert.equal(out.startsWith("Hi Ada, today is "), true);
  assert.match(out, /^Hi Ada, today is \d{4}-\d{2}-\d{2}\.$/);
});

test("applyPromptVariables tolerates extra whitespace and is global", () => {
  assert.equal(applyPromptVariables("{{USER_NAME}}-{{  USER_NAME  }}", "Ada"), "Ada-Ada");
});

test("applyPromptVariables leaves segments without tokens unchanged", () => {
  assert.equal(applyPromptVariables("plain prompt with no tokens", "Ada"), "plain prompt with no tokens");
  assert.equal(applyPromptVariables("", "Ada"), "");
});
