import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { friendlyFetchError } from "@/lib/aio/friendly-fetch-error";
import type {
  FilesSubTab,
  FileTreeEntry,
  GalleryImage,
  KanbanBoard,
  MemorySnapshot,
  MetaLogEntry,
  TerminalTab,
} from "@/components/app/app-home-types";

interface UseWorkspacePanelParams {
  chatStatus: "submitted" | "streaming" | "ready" | "error";
  confirmDeleteId: string | null;
  setConfirmDeleteId: Dispatch<SetStateAction<string | null>>;
  confirmDeleteTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

// Right-panel workspace state (terminal/files-tab shell, meta activity log,
// kanban, memory snapshot, gallery, file tree), extracted verbatim from
// AppHome.tsx. Gallery-delete reuses the cross-cutting delete-confirmation
// pattern, so that state stays lifted at the shell and is passed in; the
// memory-snapshot refresh effect reacts to chat run completion, so chat
// status is passed in rather than read from a shared context.
export function useWorkspacePanel({
  chatStatus,
  confirmDeleteId,
  setConfirmDeleteId,
  confirmDeleteTimeoutRef,
}: UseWorkspacePanelParams) {
  const [filesSubTab, setFilesSubTab] = useState<FilesSubTab>("gallery");
  const [metaLog, setMetaLog] = useState<MetaLogEntry[]>([]);
  const logMeta = (text: string) =>
    setMetaLog((prev) => [{ id: `${Date.now()}-${Math.random()}`, text, ts: Date.now() }, ...prev].slice(0, 20));
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTab, setTerminalTab] = useState<TerminalTab>("activity");
  const cycleTerminal = () => setTerminalOpen((prev) => !prev);
  const [kanban, setKanban] = useState<KanbanBoard | null>(null);
  const [kanbanError, setKanbanError] = useState<string | null>(null);
  const [memorySnapshot, setMemorySnapshot] = useState<MemorySnapshot | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[] | null>(null);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const [fileTreePath, setFileTreePath] = useState(".");
  const [fileTreeEntries, setFileTreeEntries] = useState<FileTreeEntry[] | null>(null);
  const [fileTreeError, setFileTreeError] = useState<string | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);

  const loadKanban = async () => {
    setKanbanError(null);
    try {
      const res = await fetch("/api/kanban");
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      const data = await res.json();
      setKanban(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setKanbanError(msg);
    }
  };

  const loadMemorySnapshot = async () => {
    try {
      const res = await fetch("/api/memory");
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      const data = await res.json();
      setMemorySnapshot(data);
    } catch {
      // No pill surfaces memory errors; leave memorySnapshot null so
      // data-gated UI (e.g. Today cards) simply treats it as unavailable.
    }
  };

  useEffect(() => {
    if (kanban === null) {
      loadKanban();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (memorySnapshot === null) {
      loadMemorySnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previousMemoryRunStatus = useRef(chatStatus);
  useEffect(() => {
    const wasRunning =
      previousMemoryRunStatus.current === "submitted"
      || previousMemoryRunStatus.current === "streaming";
    previousMemoryRunStatus.current = chatStatus;
    if (!wasRunning || chatStatus !== "ready") return;

    const refreshTimer = window.setTimeout(() => {
      void loadMemorySnapshot();
    }, 2000);
    return () => window.clearTimeout(refreshTimer);
  }, [chatStatus]);

  const loadGallery = async () => {
    setGalleryError(null);
    try {
      const res = await fetch("/api/gallery");
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      const data = await res.json();
      setGalleryImages(data.images);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGalleryError(msg);
    }
  };

  useEffect(() => {
    if (filesSubTab === "gallery" && galleryImages === null) {
      loadGallery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesSubTab]);

  const loadFileTree = async (path: string) => {
    setFileTreeLoading(true);
    setFileTreeError(null);
    try {
      const res = await fetch(`/api/workspace/tree?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (res.status === 409) {
        setFileTreeEntries([]);
        setFileTreeError("no_workspace");
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? friendlyFetchError(res.status));
      setFileTreeEntries(data.entries ?? []);
      setFileTreePath(data.path ?? path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFileTreeError(msg);
    } finally {
      setFileTreeLoading(false);
    }
  };

  useEffect(() => {
    if (filesSubTab === "files" && fileTreeEntries === null) {
      loadFileTree(fileTreePath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesSubTab]);

  const handleGalleryFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setGalleryUploading(true);
    setGalleryError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/gallery", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? friendlyFetchError(res.status));
      await loadGallery();
      logMeta(`Saved image "${file.name}" to gallery`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGalleryError(msg);
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleGalleryDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
      confirmDeleteTimeoutRef.current = setTimeout(
        () => setConfirmDeleteId((cur) => (cur === id ? null : cur)),
        3000,
      );
      return;
    }
    if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
    setConfirmDeleteId(null);
    setGalleryImages((prev) => prev?.filter((img) => img.id !== id) ?? prev);
    setLightboxImage((prev) => (prev?.id === id ? null : prev));
    try {
      const res = await fetch(`/api/gallery?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGalleryError(msg);
      await loadGallery();
    }
  };

  return {
    filesSubTab,
    setFilesSubTab,
    metaLog,
    logMeta,
    terminalOpen,
    setTerminalOpen,
    terminalTab,
    setTerminalTab,
    cycleTerminal,
    kanban,
    kanbanError,
    memorySnapshot,
    galleryImages,
    setGalleryImages,
    galleryError,
    galleryUploading,
    lightboxImage,
    setLightboxImage,
    galleryFileInputRef,
    fileTreePath,
    fileTreeEntries,
    setFileTreeEntries,
    fileTreeError,
    fileTreeLoading,
    loadFileTree,
    handleGalleryFileSelected,
    handleGalleryDelete,
  };
}
