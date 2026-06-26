import { FileText } from "lucide-react";
import type { ArtifactCreatedEvent } from "@/lib/aio/runs/aio-run-events";

export function ArtifactCard({ event }: { event: ArtifactCreatedEvent }) {
  const title = event.name ?? event.artifact?.name ?? event.artifact?.fileName ?? "Artifact";
  const url = event.url ?? event.artifact?.url ?? event.artifact?.filePath;

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-2">
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-[var(--aio-subtle)]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{title}</div>
          {event.mimeType && <div className="text-[11px] text-[var(--text-muted)]">{event.mimeType}</div>}
        </div>
      </div>
      {(event.preview ?? event.artifact?.preview) && (
        <p className="mt-2 line-clamp-3 text-[12px] leading-5 text-[var(--text-secondary)]">{event.preview ?? event.artifact?.preview}</p>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex rounded-md border border-[var(--border-color)] px-2 py-1 text-[11.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Open
        </a>
      )}
    </div>
  );
}
