// R4.6 — Knowledge Center panel: upload, status, delete for aio_knowledge_docs.
//
// Self-contained: fetches from /api/knowledge/docs internally.
// Rendered inside the Settings modal Knowledge tab.

"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, Trash2, Upload, XCircle } from "lucide-react";

interface KnowledgeDoc {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  status: "uploaded" | "parsing" | "chunking" | "embedding" | "ready" | "error";
  chunk_count: number;
  error_message: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<KnowledgeDoc["status"], string> = {
  uploaded: "Uploaded",
  parsing: "Parsing…",
  chunking: "Chunking…",
  embedding: "Embedding…",
  ready: "Ready",
  error: "Error",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function KnowledgeCenterPanel() {
  const [docs, setDocs] = useState<KnowledgeDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/knowledge/docs");
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { docs: KnowledgeDoc[] };
      setDocs(data.docs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  };

  useEffect(() => { void load(); }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/knowledge/docs", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? `Upload failed: ${res.status}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setConfirmDelete(null);
    try {
      await fetch(`/api/knowledge/docs/${id}`, { method: "DELETE" });
      setDocs((prev) => prev?.filter((d) => d.id !== id) ?? null);
    } catch {
      setError("Delete failed");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="text-[12px] text-red-400 bg-red-400/10 rounded-md px-3 py-2">{error}</div>
      )}

      {docs === null && !error && (
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)] py-4 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading documents…
        </div>
      )}

      {docs?.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-[var(--text-muted)]">
          <FileText className="h-8 w-8 opacity-40" />
          <p className="text-[12px]">No documents yet. Upload one for the agent to reference.</p>
        </div>
      )}

      {docs?.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-2"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-hover)]">
            <FileText className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">{doc.file_name}</div>
            <div className="text-[11px] text-[var(--text-muted)]">
              {formatBytes(doc.file_size)}
              {" · "}
              {doc.status === "ready"
                ? `${doc.chunk_count} chunks`
                : doc.status === "error"
                  ? (doc.error_message ?? "Error")
                  : STATUS_LABELS[doc.status]}
            </div>
          </div>
          <div className="shrink-0">
            {doc.status === "ready" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            {doc.status === "error" && <XCircle className="h-4 w-4 text-red-400" />}
            {!["ready", "error"].includes(doc.status) && (
              <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
            )}
          </div>
          <button
            type="button"
            className="mcp-add-btn"
            style={
              confirmDelete === doc.id
                ? { marginLeft: 4, padding: "4px 8px", background: "rgba(226, 92, 92, 0.12)", color: "#e25c5c" }
                : { marginLeft: 4, padding: "4px 8px" }
            }
            onClick={() => void handleDelete(doc.id)}
            aria-label={confirmDelete === doc.id ? "Confirm delete" : "Delete document"}
            title={confirmDelete === doc.id ? "Click again to confirm" : "Delete document"}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {/* Upload */}
      <div className="mt-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf,.docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="mcp-add-btn w-full justify-center gap-1.5"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
          ) : (
            <><Upload className="h-3.5 w-3.5" /> Upload document (.txt, .md, .pdf, .docx)</>
          )}
        </button>
        <p className="mt-1.5 text-[10.5px] text-[var(--text-muted)]">
          PDF and DOCX text extraction is queued asynchronously. Max 10 MB.
        </p>
      </div>
    </div>
  );
}
