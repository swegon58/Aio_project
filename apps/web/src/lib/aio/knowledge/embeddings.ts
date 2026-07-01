// Q4 follow-up — small adapter seam around the direct-provider embeddings
// call (the only place Aio's knowledge pipeline talks to OpenRouter outside
// Hermes's gateway). Callers depend on EmbeddingProvider, never on a raw API
// key or the OpenRouter fetch directly — mirrors the AioTelemetry seam
// pattern (ADR-002), scoped to just this one existing call site per the grill
// decision (no wider provider-plugin system).

import { embedOne, embedTexts, EMBEDDING_DIMENSIONS } from "@/lib/hermes/knowledge";

export interface EmbeddingProvider {
  readonly dimensions: number;
  embedTexts(texts: string[]): Promise<number[][]>;
  embedOne(text: string): Promise<number[]>;
}

export function createOpenRouterEmbeddingProvider(apiKey: string): EmbeddingProvider {
  return {
    dimensions: EMBEDDING_DIMENSIONS,
    embedTexts: (texts) => embedTexts(apiKey, texts),
    embedOne: (text) => embedOne(apiKey, text),
  };
}
