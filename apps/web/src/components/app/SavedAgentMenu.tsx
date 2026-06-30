// R7 Saved Agents — composer picker. Self-contained: fetches the user's
// saved agents from /api/saved-agents internally, mirrors ChatModeMenu's
// trigger/popover pattern and CSS classes.

"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SavedAgentSummary {
  id: string;
  name: string;
}

interface SavedAgentMenuProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
}

export function SavedAgentMenu({ value, onValueChange }: SavedAgentMenuProps) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<SavedAgentSummary[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/saved-agents")
      .then((res) => (res.ok ? res.json() : { savedAgents: [] }))
      .then((data: { savedAgents: SavedAgentSummary[] }) => {
        if (!cancelled) setAgents(data.savedAgents ?? []);
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Nothing saved yet: no point showing a picker for an empty list.
  if (agents !== null && agents.length === 0) return null;

  const selected = agents?.find((agent) => agent.id === value) ?? null;

  return (
    <div className="chat-mode-menu" ref={rootRef}>
      <button
        type="button"
        className={cn("chat-mode-trigger", "saved-agent-trigger", open && "open")}
        aria-label={`Saved agent: ${selected ? selected.name : "None"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bot className="w-3.5 h-3.5" aria-hidden />
        <span className="saved-agent-trigger-label">{selected ? selected.name : "Agent"}</span>
        <ChevronDown className={cn("w-3.5 h-3.5", open && "rotate")} aria-hidden />
      </button>

      {open && (
        <div className="chat-mode-popover saved-agent-popover" role="menu" aria-label="Saved agent">
          <div className="chat-mode-popover-label">Saved agents</div>
          <button
            type="button"
            className={cn("chat-mode-option", value === null && "active")}
            role="menuitemradio"
            aria-checked={value === null}
            onClick={() => {
              onValueChange(null);
              setOpen(false);
            }}
          >
            <span>None</span>
            {value === null && <Check className="w-4 h-4" aria-hidden />}
          </button>
          {agents?.map((agent) => {
            const active = agent.id === value;
            return (
              <button
                key={agent.id}
                type="button"
                className={cn("chat-mode-option", active && "active")}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onValueChange(agent.id);
                  setOpen(false);
                }}
              >
                <span className="saved-agent-option-label">{agent.name}</span>
                {active && <Check className="w-4 h-4" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
