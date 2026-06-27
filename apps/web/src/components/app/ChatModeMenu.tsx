"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { AioChatMode } from "@/lib/aio/chat/chat-mode";
import { cn } from "@/lib/utils";

interface ChatModeMenuProps {
  value: AioChatMode;
  onValueChange: (value: AioChatMode) => void;
}

const CHAT_MODES: Array<{ value: AioChatMode; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "plan", label: "Plan" },
  { value: "research", label: "Research" },
];

export function ChatModeMenu({ value, onValueChange }: ChatModeMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = CHAT_MODES.find((mode) => mode.value === value) ?? CHAT_MODES[0];

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

  return (
    <div className="chat-mode-menu" ref={rootRef}>
      <button
        type="button"
        className={cn("chat-mode-trigger", open && "open")}
        aria-label={`Response mode: ${selected.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5", open && "rotate")} aria-hidden />
      </button>

      {open && (
        <div className="chat-mode-popover" role="menu" aria-label="Response mode">
          <div className="chat-mode-popover-label">Mode</div>
          {CHAT_MODES.map((mode) => {
            const active = mode.value === value;
            return (
              <button
                key={mode.value}
                type="button"
                className={cn("chat-mode-option", active && "active")}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onValueChange(mode.value);
                  setOpen(false);
                }}
              >
                <span>{mode.label}</span>
                {active && <Check className="w-4 h-4" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
