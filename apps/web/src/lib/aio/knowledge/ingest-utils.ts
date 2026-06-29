// Pure, zero-dependency helpers extracted from ingest-pipeline so they can be
// unit-tested without loading the embeddings/Supabase module graph.

// ---------------------------------------------------------------------------
// File validation
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword",
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export type ValidationResult =
  | { ok: true; mimeType: string }
  | { ok: false; error: string };

export function validateKnowledgeFile(
  fileName: string,
  mimeType: string,
  sizeBytes: number,
): ValidationResult {
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `File too large: ${(sizeBytes / 1024 / 1024).toFixed(1)} MB. Max 10 MB.` };
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "txt", "md", "docx", "doc"].includes(ext)) {
      return { ok: false, error: `Unsupported file type: ${mimeType}` };
    }
  }
  return { ok: true, mimeType };
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

export const CHUNK_MAX_CHARS = 1800;    // ≈ 450 tokens at 4 chars/token average
export const CHUNK_OVERLAP_CHARS = 200; // ≈ 50 tokens overlap

export function chunkText(text: string): string[] {
  if (!text.trim()) return [];

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 2 <= CHUNK_MAX_CHARS) {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
    } else {
      if (current) chunks.push(current);
      if (trimmed.length > CHUNK_MAX_CHARS) {
        const sub = hardSplit(trimmed);
        chunks.push(...sub.slice(0, -1));
        current = sub.at(-1) ?? "";
      } else {
        current = trimmed;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function hardSplit(text: string): string[] {
  const result: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_MAX_CHARS, text.length);
    result.push(text.slice(start, end));
    start = end - CHUNK_OVERLAP_CHARS;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Text extraction (stub)
// ---------------------------------------------------------------------------

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return buffer.toString("utf-8");
  }
  return `[extraction pending: ${mimeType}]`;
}
