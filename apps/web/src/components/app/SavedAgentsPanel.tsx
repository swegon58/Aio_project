// R7 — Saved Agents panel: create/edit/delete reusable instruction bundles.
//
// Self-contained: fetches/writes /api/saved-agents internally.
// Rendered inside the Settings modal "Saved Agents" tab.

"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

interface SavedAgent {
  id: string;
  name: string;
  instructionsAddition: string;
  useKnowledge: boolean;
}

const MAX_NAME_LENGTH = 80;
const MAX_INSTRUCTIONS_LENGTH = 4000;

function emptyDraft(): { name: string; instructionsAddition: string; useKnowledge: boolean } {
  return { name: "", instructionsAddition: "", useKnowledge: true };
}

export function SavedAgentsPanel() {
  const [agents, setAgents] = useState<SavedAgent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/saved-agents");
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { savedAgents: SavedAgent[] };
      setAgents(data.savedAgents);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startCreate = () => {
    setDraft(emptyDraft());
    setEditingId("new");
  };

  const startEdit = (agent: SavedAgent) => {
    setDraft({
      name: agent.name,
      instructionsAddition: agent.instructionsAddition,
      useKnowledge: agent.useKnowledge,
    });
    setEditingId(agent.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft());
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const url = editingId === "new" ? "/api/saved-agents" : `/api/saved-agents/${editingId}`;
      const method = editingId === "new" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Save failed: ${res.status}`);
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setConfirmDelete(null);
    try {
      await fetch(`/api/saved-agents/${id}`, { method: "DELETE" });
      setAgents((prev) => prev?.filter((a) => a.id !== id) ?? null);
    } catch {
      setError("Delete failed");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11.5px] text-[var(--text-muted)]">
        A saved agent appends extra instructions to your message and can skip your knowledge
        sources. It never overrides Aio&apos;s core behavior or unlocks additional tools.
      </p>

      {error && <div className="text-[12px] text-red-400 bg-red-400/10 rounded-md px-3 py-2">{error}</div>}

      {agents === null && !error && (
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)] py-4 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading saved agents…
        </div>
      )}

      {agents?.length === 0 && editingId === null && (
        <div className="flex flex-col items-center gap-2 py-6 text-[var(--text-muted)]">
          <Bot className="h-8 w-8 opacity-40" />
          <p className="text-[12px]">No saved agents yet.</p>
        </div>
      )}

      {agents?.map((agent) =>
        editingId === agent.id ? null : (
          <div
            key={agent.id}
            className="flex items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-2"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-hover)]">
              <Bot className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">{agent.name}</div>
              <div className="truncate text-[11px] text-[var(--text-muted)]">
                {agent.instructionsAddition || "No extra instructions"}
                {!agent.useKnowledge && " · Knowledge off"}
              </div>
            </div>
            <button
              type="button"
              className="mcp-add-btn"
              style={{ marginLeft: 4, padding: "4px 8px" }}
              onClick={() => startEdit(agent)}
              aria-label="Edit saved agent"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="mcp-add-btn"
              style={
                confirmDelete === agent.id
                  ? { marginLeft: 4, padding: "4px 8px", background: "rgba(226, 92, 92, 0.12)", color: "#e25c5c" }
                  : { marginLeft: 4, padding: "4px 8px" }
              }
              onClick={() => void handleDelete(agent.id)}
              aria-label={confirmDelete === agent.id ? "Confirm delete" : "Delete saved agent"}
              title={confirmDelete === agent.id ? "Click again to confirm" : "Delete"}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      )}

      {editingId !== null && (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-3">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value.slice(0, MAX_NAME_LENGTH) }))}
            placeholder="Name (e.g. Code Reviewer)"
            className="message-input"
            style={{ height: 32 }}
            autoFocus
          />
          <textarea
            value={draft.instructionsAddition}
            onChange={(e) =>
              setDraft((d) => ({ ...d, instructionsAddition: e.target.value.slice(0, MAX_INSTRUCTIONS_LENGTH) }))
            }
            placeholder="Extra instructions appended to every message you send with this agent active…"
            className="message-input"
            style={{ height: 96, resize: "vertical", paddingTop: 8 }}
          />
          <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={draft.useKnowledge}
              onChange={(e) => setDraft((d) => ({ ...d, useKnowledge: e.target.checked }))}
            />
            Use my knowledge sources with this agent
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="mcp-add-btn"
              style={{ width: "auto" }}
              disabled={saving || !draft.name.trim()}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="mcp-add-btn" style={{ width: "auto" }} disabled={saving} onClick={cancelEdit}>
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {editingId === null && (
        <button type="button" className="mcp-add-btn w-full justify-center gap-1.5" onClick={startCreate}>
          <Plus className="h-3.5 w-3.5" /> New saved agent
        </button>
      )}
    </div>
  );
}
