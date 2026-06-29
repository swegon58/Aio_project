import test from "node:test";
import assert from "node:assert/strict";
import { ALL_GATEABLE_TOOLSETS, TIERS } from "@/lib/hermes/pricing";
import {
  AIO_TOOL_MANIFEST,
  getAioToolManifestEntry,
  getPlanAvailableTools,
} from "./tool-manifest";

test("every manifest entry has a unique canonical name", () => {
  const seen = new Set<string>();
  for (const entry of AIO_TOOL_MANIFEST) {
    assert.ok(!seen.has(entry.canonicalName), `duplicate entry: ${entry.canonicalName}`);
    seen.add(entry.canonicalName);
  }
});

test("every gateable Hermes toolset is represented in the Aio manifest", () => {
  for (const toolset of ALL_GATEABLE_TOOLSETS) {
    assert.ok(getAioToolManifestEntry(toolset), `missing manifest entry for ${toolset}`);
  }
});

test("every plan's unlocked toolsets are available in the manifest", () => {
  for (const [plan, cfg] of Object.entries(TIERS)) {
    const names = new Set(getPlanAvailableTools(plan as keyof typeof TIERS).map((entry) => entry.canonicalName));
    for (const toolset of cfg.toolsets) {
      assert.ok(names.has(toolset), `${plan} is missing ${toolset} from plan availability`);
    }
  }
});

test("dangerous entries never default to no approval", () => {
  for (const entry of AIO_TOOL_MANIFEST) {
    if (entry.risk === "dangerous") {
      assert.notEqual(
        entry.approvalPolicy.defaultMode,
        "none",
        `${entry.canonicalName} is dangerous but has no approval`,
      );
    }
  }
});

