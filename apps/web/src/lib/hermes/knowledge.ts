// Aio x Hermes — RAG knowledge base (open-webui parity feature).
//
// Embeds via OpenRouter's OpenAI-compatible /embeddings endpoint using the
// same per-profile OPENROUTER_API_KEY chat/route.ts already resolves from
// the profile .env (resolveOpenRouterKey). Chunking follows the
// header-aware approach from tools/vault_rag_ingest.py, ported to plain
// paragraph splitting since uploaded docs aren't guaranteed Markdown.

import fs from "fs/promises";
import { profileEnvPath } from "@/lib/hermes/config";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

const CHUNK_CHARS = 1800; // ~roughly 400-500 tokens
const CHUNK_OVERLAP_CHARS = 200;

export async function resolveOpenRouterKeyForProfile(profileName: string | null): Promise<string | null> {
  if (!profileName) return null;
  try {
    const envRaw = await fs.readFile(profileEnvPath(profileName), "utf-8");
    return envRaw.match(/^OPENROUTER_API_KEY=(.+)$/m)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

// Splits plain text into overlapping chunks on paragraph boundaries first,
// falling back to a hard char-length cut for oversized paragraphs.
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\n+/).filter((p) => p.trim());
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > CHUNK_CHARS && current) {
      chunks.push(current.trim());
      current = current.slice(-CHUNK_OVERLAP_CHARS);
    }
    current += (current ? "\n\n" : "") + para;

    while (current.length > CHUNK_CHARS) {
      chunks.push(current.slice(0, CHUNK_CHARS).trim());
      current = current.slice(CHUNK_CHARS - CHUNK_OVERLAP_CHARS);
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.filter((c) => c.length > 20);
}

interface OpenRouterEmbeddingResponse {
  data: { embedding: number[] }[];
}

// Batches all texts into a single /embeddings call. OpenRouter's embeddings
// endpoint is OpenAI-compatible — `input` accepts a string array.
export async function embedTexts(apiKey: string, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await fetch(`${OPENROUTER_API_BASE}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter embeddings failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as OpenRouterEmbeddingResponse;
  return json.data.map((d) => d.embedding);
}

export async function embedOne(apiKey: string, text: string): Promise<number[]> {
  const [embedding] = await embedTexts(apiKey, [text]);
  return embedding;
}
