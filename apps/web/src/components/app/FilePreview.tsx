"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { MarkdownMessage } from "@/components/app/MarkdownMessage";

// File the agent is actively touching right now, derived from the live
// activity stream (most recent tool entry that carries a filePath).
export interface ActiveFile {
  filePath: string;
  fileName?: string;
}

const LIVE_PREVIEW_EXTS = new Set(["html", "htm", "js", "jsx", "ts", "tsx"]);
const PDF_EXTS = new Set(["pdf"]);
const DOC_EXTS = new Set(["doc", "docx"]);
const SHEET_EXTS = new Set(["xlsx", "csv"]);
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const MARKDOWN_EXTS = new Set(["md", "markdown"]);

export function ShowcaseErrorDetail({ stdout }: { stdout?: string }) {
  const [open, setOpen] = useState(false);
  if (!stdout) return null;
  const firstLine = stdout.trim().split("\n").pop() ?? stdout;
  return (
    <div className="showcase-chip-log" style={{ fontSize: 11.5, color: "var(--aio-error, #e25c5c)", marginTop: 2 }}>
      <span className="truncate">{firstLine}</span>
      <button type="button" className="showcase-chip-log-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide log" : "View full log"}
      </button>
      {open && <pre className="workspace-code-block">{stdout}</pre>}
    </div>
  );
}

// Preview-tab integration point: renders the live-edited file inline in the
// Aio Terminal panel, switching on extension.
export function PreviewPane({ file }: { file: ActiveFile | null }) {
  if (!file) {
    return (
      <div className="terminal-preview-empty">
        No preview available yet.
      </div>
    );
  }

  const name = file.fileName ?? file.filePath;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  let body: React.ReactNode;
  if (LIVE_PREVIEW_EXTS.has(ext)) {
    body = <LiveAppPreview />;
  } else if (PDF_EXTS.has(ext)) {
    body = <PdfPreview url={file.filePath} />;
  } else if (DOC_EXTS.has(ext)) {
    body = <DocPreview url={file.filePath} />;
  } else if (SHEET_EXTS.has(ext)) {
    body = <SheetPreview url={file.filePath} isCsv={ext === "csv"} />;
  } else if (IMAGE_EXTS.has(ext)) {
    body = (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary proxied artifact URL, not a static asset
      <img src={file.filePath} alt={name} className="terminal-preview-image" />
    );
  } else if (MARKDOWN_EXTS.has(ext)) {
    body = <MarkdownPreview url={file.filePath} />;
  } else {
    body = <div className="terminal-preview-placeholder">Preview for this file type will render here.</div>;
  }

  return (
    <div className="terminal-preview-pane">
      <div className="terminal-preview-filename">{name}</div>
      {body}
    </div>
  );
}

// Fetches text/JSON content from the existing artifact-fetch URL
// (/api/chat/artifact?runId=...&path=...) shared by all non-image preview
// branches.
function useArtifactFetch<T>(
  url: string,
  parse: (res: Response) => Promise<T>,
): { data: T | null; error: string | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setLoading(true);
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
        return parse(res);
      })
      .then((parsed) => {
        if (!cancelled) setData(parsed);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parse is a stable inline fn per call site
  }, [url]);

  return { data, error, loading };
}

function PdfPreview({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const docRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPageNum(1);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.2 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageNum, numPages]);

  if (error) return <div className="terminal-preview-placeholder">Couldn&apos;t load PDF: {error}</div>;

  return (
    <div className="terminal-preview-pdf">
      <canvas ref={canvasRef} className="terminal-preview-pdf-canvas" />
      {numPages > 1 && (
        <div className="terminal-preview-pdf-nav">
          <button
            type="button"
            disabled={pageNum <= 1}
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span>
            {pageNum} / {numPages}
          </span>
          <button
            type="button"
            disabled={pageNum >= numPages}
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function DocPreview({ url }: { url: string }) {
  const { data, error, loading } = useArtifactFetch(url, async (res) => {
    const mammoth = await import("mammoth");
    const arrayBuffer = await res.arrayBuffer();
    const { value } = await mammoth.convertToHtml({ arrayBuffer });
    return value;
  });

  if (loading) return <div className="terminal-preview-placeholder">Loading document…</div>;
  if (error) return <div className="terminal-preview-placeholder">Couldn&apos;t load document: {error}</div>;
  return (
    <div
      className="terminal-preview-doc"
      dangerouslySetInnerHTML={{ __html: data ?? "" }}
    />
  );
}

function SheetPreview({ url, isCsv }: { url: string; isCsv: boolean }) {
  type SheetCell = string | number | boolean | Date | null;
  type SheetRows = SheetCell[][];

  const { data, error, loading } = useArtifactFetch<SheetRows>(url, async (res) => {
    if (isCsv) {
      const Papa = (await import("papaparse")).default;
      const result = Papa.parse<SheetCell[]>(await res.text(), { skipEmptyLines: true });
      if (result.errors.length > 0) throw new Error(result.errors[0].message);
      return result.data;
    }

    const { readSheet } = await import("read-excel-file/browser");
    return readSheet(await res.arrayBuffer()) as Promise<SheetRows>;
  });

  if (loading) return <div className="terminal-preview-placeholder">Loading spreadsheet…</div>;
  if (error) return <div className="terminal-preview-placeholder">Couldn&apos;t load spreadsheet: {error}</div>;
  return (
    <div className="terminal-preview-sheet">
      <table>
        <tbody>
          {(data ?? []).map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>
                  {cell instanceof Date ? cell.toLocaleString() : String(cell ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownPreview({ url }: { url: string }) {
  const { data, error, loading } = useArtifactFetch(url, (res) => res.text());

  if (loading) return <div className="terminal-preview-placeholder">Loading…</div>;
  if (error) return <div className="terminal-preview-placeholder">Couldn&apos;t load file: {error}</div>;
  return (
    <div className="terminal-preview-markdown">
      <MarkdownMessage text={data ?? ""} />
    </div>
  );
}

// Live app preview (html/js/jsx/ts/tsx): asks the gateway for this session's
// host workspace dir, starts (or reuses) a Docker preview for it, then loads
// the resulting same-origin proxy URL in a sandboxed iframe.
function LiveAppPreview() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<{ reason: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/preview/start", { method: "POST" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw { reason: body.error ?? "preview_failed", message: body.message ?? "Failed to start preview" };
        return body as { previewUrl: string };
      })
      .then((body) => {
        if (!cancelled) setPreviewUrl(body.previewUrl);
      })
      .catch((err: { reason?: string; message?: string }) => {
        if (!cancelled) {
          setError({
            reason: err.reason ?? "preview_failed",
            message: err.message ?? "Failed to start preview",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="terminal-preview-placeholder">Starting live preview…</div>;
  if (error?.reason === "remote_environment") {
    return (
      <div className="terminal-preview-placeholder">
        Live preview needs a local workspace; this session is running remote.
      </div>
    );
  }
  if (error) {
    return <div className="terminal-preview-placeholder">Couldn&apos;t start live preview: {error.message}</div>;
  }
  if (!previewUrl) return null;

  return (
    <div className="terminal-preview-iframe-wrap">
      <button
        type="button"
        className="panel-action-btn terminal-preview-open-btn"
        onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
        aria-label="Open live preview in new tab"
        title="Open in new tab"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
      <iframe
        src={previewUrl}
        className="terminal-preview-iframe"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title="Live app preview"
      />
    </div>
  );
}
