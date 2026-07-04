"use client";

import { useEffect, useState } from "react";

// Self-contained R11.1 Memory settings tab. Manual CRUD over /api/user-memory
// (migration 0029). No auto-learn write-path this pass — user curates facts by hand.
// ponytail: limits mirror MAX_MEMORY_FACT_LABEL/VALUE in memory-fact-repository.ts;
// keep in sync if the backend caps change.
const MAX_LABEL = 80;
const MAX_VALUE = 500;

type MemoryFact = {
  id: string;
  label: string;
  value: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export function MemoryFactsPanel() {
  const [facts, setFacts] = useState<MemoryFact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/user-memory");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load");
      setFacts(json.facts);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setLabel("");
    setValue("");
    setEditId(null);
    setFormMsg(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormMsg(null);
    try {
      const url = editId ? `/api/user-memory/${editId}` : "/api/user-memory";
      const method = editId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), value: value.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Save failed");
      resetForm();
      await load();
    } catch (e) {
      setFormMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (f: MemoryFact) => {
    setEditId(f.id);
    setLabel(f.label);
    setValue(f.value);
    setFormMsg(null);
  };

  const remove = async (id: string) => {
    setSaving(true);
    setFormMsg(null);
    try {
      const res = await fetch(`/api/user-memory/${id}`, { method: "DELETE" });
      if (res.status !== 204 && !res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? "Delete failed");
      }
      if (editId === id) resetForm();
      await load();
    } catch (e) {
      setFormMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="setting-desc" style={{ marginBottom: 12 }}>
        Facts Aio remembers about you across conversations. Add anything you want Aio to
        always know — these stay private to your account.
      </div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <div className="panel-section-title" style={{ marginTop: 0 }}>
          {editId ? "Edit fact" : "Add a fact"}
        </div>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Lives in)"
          maxLength={MAX_LABEL}
          className="message-input"
          style={{ height: 32 }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value (e.g. Hanoi)"
          maxLength={MAX_VALUE}
          className="message-input"
          style={{ height: 32 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            className="mcp-add-btn"
            style={{ width: "auto" }}
            disabled={saving || !label.trim() || !value.trim()}
          >
            {saving ? "Saving…" : editId ? "Save changes" : "Add fact"}
          </button>
          {editId && (
            <button type="button" className="mcp-add-btn" style={{ width: "auto" }} onClick={resetForm} disabled={saving}>
              Cancel
            </button>
          )}
        </div>
        {formMsg && <div className="memory-text" style={{ color: "#e25c5c" }}>{formMsg}</div>}
      </form>

      {error && (
        <div className="memory-text" style={{ color: "#e25c5c", marginBottom: 8 }}>
          {error}
        </div>
      )}

      <div className="panel-section-title">Saved facts</div>
      {facts === null && !error && <div className="memory-text">Loading…</div>}
      {facts !== null && facts.length === 0 && (
        <div className="memory-text">No facts yet. Add one above.</div>
      )}
      {facts?.map((f) => (
        <div key={f.id} className="mcp-server-item">
          <div className="mcp-server-info" style={{ minWidth: 0 }}>
            <div className="mcp-server-name">{f.label}</div>
            <div className="mcp-server-url" style={{ whiteSpace: "pre-wrap" }}>{f.value}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              className="mcp-add-btn"
              style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}
              disabled={saving}
              onClick={() => startEdit(f)}
            >
              Edit
            </button>
            <button
              type="button"
              className="mcp-add-btn"
              style={{
                width: "auto",
                padding: "4px 8px",
                fontSize: 12,
                background: "rgba(226, 92, 92, 0.12)",
                color: "#e25c5c",
              }}
              disabled={saving}
              onClick={() => remove(f.id)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
