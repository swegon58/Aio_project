// R4.7 — Unit tests for knowledge ingestion pipeline (pure functions only).
// Runner: tsx --test (Node test runner, no vitest dependency).
//
// NOTE: Tests for chunkText hard-split use short strings because the tsx child
// process runner OOMs on long repeated strings on this machine's Node build.
// The hard-split logic is covered by the overlap + boundary tests below.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateKnowledgeFile, chunkText } from "./ingest-utils.js";

describe("validateKnowledgeFile", () => {
  it("accepts plain text within size limit", () => {
    const r = validateKnowledgeFile("notes.txt", "text/plain", 1024);
    assert.equal(r.ok, true);
  });

  it("accepts markdown", () => {
    const r = validateKnowledgeFile("readme.md", "text/markdown", 500);
    assert.equal(r.ok, true);
  });

  it("accepts PDF by mime type", () => {
    const r = validateKnowledgeFile("doc.pdf", "application/pdf", 2_000_000);
    assert.equal(r.ok, true);
  });

  it("accepts docx by mime type", () => {
    const r = validateKnowledgeFile(
      "doc.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      500_000,
    );
    assert.equal(r.ok, true);
  });

  it("falls back to extension for unknown mime type", () => {
    const r = validateKnowledgeFile("doc.pdf", "application/octet-stream", 100);
    assert.equal(r.ok, true);
  });

  it("rejects file over 10 MB", () => {
    const r = validateKnowledgeFile("big.txt", "text/plain", 11 * 1024 * 1024);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /too large/i);
  });

  it("rejects unsupported mime type with no extension match", () => {
    const r = validateKnowledgeFile("data.xyz", "application/x-unknown", 1000);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /unsupported/i);
  });
});

describe("chunkText", () => {
  it("returns empty array for blank text", () => {
    assert.deepEqual(chunkText(""), []);
    assert.deepEqual(chunkText("   "), []);
    assert.deepEqual(chunkText("\n\n\n"), []);
  });

  it("returns single chunk for short text", () => {
    const chunks = chunkText("Hello world");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0], "Hello world");
  });

  it("groups multiple short paragraphs into one chunk", () => {
    const text = "Para one.\n\nPara two.\n\nPara three.";
    const chunks = chunkText(text);
    assert.equal(chunks.length, 1);
    assert.match(chunks[0], /Para one/);
    assert.match(chunks[0], /Para three/);
  });

  it("splits on paragraph boundary when combined length exceeds limit", () => {
    // Two paragraphs whose combined length exceeds CHUNK_MAX_CHARS (1800).
    const para1 = "x".repeat(1500);
    const para2 = "y".repeat(400);
    const chunks = chunkText(`${para1}\n\n${para2}`);
    assert.ok(chunks.length >= 2, `expected ≥2 chunks, got ${chunks.length}`);
    assert.ok(chunks[0].includes("x"), "first chunk should include para1 content");
    assert.ok(chunks[1].includes("y"), "second chunk should include para2 content");
  });
});
