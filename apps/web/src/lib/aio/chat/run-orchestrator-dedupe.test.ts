// R9.1 — Unit tests for source dedupe behaviour in the research pipeline.
// Runner: tsx --test

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractResultUrls } from "./run-orchestrator.js";

describe("extractResultUrls", () => {
  it("returns empty array for undefined input", () => {
    assert.deepEqual(extractResultUrls(undefined), []);
  });

  it("returns empty array for empty string", () => {
    assert.deepEqual(extractResultUrls(""), []);
  });

  it("extracts a single URL from preview text", () => {
    const preview = "Found results at https://example.com/page with more info.";
    assert.deepEqual(extractResultUrls(preview), ["https://example.com/page"]);
  });

  it("strips trailing punctuation from URLs", () => {
    const preview = "See https://example.com/page, and https://other.com/doc.";
    const urls = extractResultUrls(preview);
    assert.ok(!urls[0].endsWith(","), "should strip trailing comma");
    assert.ok(!urls[1].endsWith("."), "should strip trailing period");
  });

  it("deduplicates repeated URLs within the same preview", () => {
    const url = "https://example.com/article";
    const preview = `First mention: ${url} and again: ${url} and once more: ${url}`;
    const urls = extractResultUrls(preview);
    assert.equal(urls.length, 1, "duplicate URLs must appear only once");
    assert.equal(urls[0], url);
  });

  it("caps results at 5 URLs regardless of how many appear in preview", () => {
    const many = Array.from(
      { length: 10 },
      (_, i) => `https://source${i}.com/page`
    ).join(" ");
    const urls = extractResultUrls(many);
    assert.equal(urls.length, 5, "must not exceed 5 sources per preview");
  });

  it("returns distinct URLs up to the cap", () => {
    const preview = [
      "https://a.com",
      "https://b.com",
      "https://c.com",
      "https://d.com",
      "https://e.com",
    ].join(" ");
    const urls = extractResultUrls(preview);
    assert.deepEqual(urls, [
      "https://a.com",
      "https://b.com",
      "https://c.com",
      "https://d.com",
      "https://e.com",
    ]);
  });
});

// Simulates the in-run Map guard used in run-orchestrator.ts to prevent
// recordResearchSource being called twice for the same URL within one run.
describe("in-run URL dedup Map guard", () => {
  it("skips a URL that was already recorded in this run", () => {
    const researchSourceIds = new Map<string, string>();
    const calls: string[] = [];

    function simulateRecord(url: string, sourceId: string) {
      if (researchSourceIds.has(url)) return; // the guard
      calls.push(url);
      researchSourceIds.set(url, sourceId);
    }

    simulateRecord("https://example.com", "src-1");
    simulateRecord("https://example.com", "src-2"); // duplicate — must be skipped
    simulateRecord("https://other.com", "src-3");

    assert.equal(calls.length, 2, "only two unique URLs should be recorded");
    assert.ok(calls.includes("https://example.com"));
    assert.ok(calls.includes("https://other.com"));
  });

  it("records each distinct URL exactly once", () => {
    const researchSourceIds = new Map<string, string>();
    const recorded = new Set<string>();

    const urls = [
      "https://a.com",
      "https://b.com",
      "https://a.com", // duplicate
      "https://c.com",
      "https://b.com", // duplicate
    ];

    for (const url of urls) {
      if (researchSourceIds.has(url)) continue;
      recorded.add(url);
      researchSourceIds.set(url, `id-${recorded.size}`);
    }

    assert.equal(recorded.size, 3);
    assert.deepEqual([...recorded], ["https://a.com", "https://b.com", "https://c.com"]);
  });
});
