"use client";

import { useRef, useState } from "react";
import {
  PlusIcon,
  SubmitArrowIcon,
  CreateSlidesIcon,
  BuildWebsiteIcon,
  DevelopDesktopAppsIcon,
  DesignIcon,
} from "@/components/icons";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const PILLS = [
  { label: "Create slides", icon: CreateSlidesIcon },
  { label: "Build website", icon: BuildWebsiteIcon },
  { label: "Develop desktop apps", icon: DevelopDesktopAppsIcon },
  { label: "Design", icon: DesignIcon },
];

export function Hero() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusLine, setStatusLine] = useState("");
  const conversationIdRef = useRef<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isStreaming) return;

    if (!conversationIdRef.current) {
      conversationIdRef.current =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsStreaming(true);
    setStatusLine("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: conversationIdRef.current,
        }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;

          try {
            const event = JSON.parse(payload);

            switch (event.type) {
              case "step": {
                const content = typeof event.content === "string" ? event.content : "";
                const truncated = content.length > 80 ? `${content.slice(0, 80)}…` : content;
                setStatusLine(`Step ${event.step}/${event.max_steps}: ${truncated}`);
                break;
              }
              case "result": {
                const content = typeof event.content === "string" ? event.content : "";
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = { role: "assistant", content };
                  return next;
                });
                break;
              }
              case "done": {
                setStatusLine("");
                break;
              }
              case "error": {
                const content = typeof event.content === "string" ? event.content : "Something went wrong.";
                setStatusLine("");
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = { role: "assistant", content: `⚠️ ${content}` };
                  return next;
                });
                break;
              }
              default:
                break;
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setStatusLine("");
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: `⚠️ ${message}` };
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function autoResize(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  return (
    <section className="flex flex-col items-center justify-center px-6 max-w-[1080px] mx-auto">
      <h1 className="font-heading font-normal text-[36px] leading-[54px] text-[var(--text-primary)] mb-[34px] text-center">
        What can I do for you?
      </h1>

      {messages.length > 0 && (
        <div className="flex w-full max-w-[766px] flex-col gap-4 mb-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={
                msg.role === "user"
                  ? "self-end max-w-[85%] rounded-[16px] bg-[var(--fill-tsp-white-dark)] px-4 py-2 text-[15px] leading-[24px] text-[var(--text-primary)]"
                  : "self-start max-w-[85%] rounded-[16px] px-4 py-2 text-[15px] leading-[24px] text-[var(--text-primary)] whitespace-pre-wrap"
              }
            >
              {msg.content || (msg.role === "assistant" && isStreaming && i === messages.length - 1 ? "…" : "")}
            </div>
          ))}
          {isStreaming && statusLine && (
            <div className="self-start max-w-[85%] rounded-[16px] px-4 py-2 text-[13px] leading-[20px] text-[var(--text-tertiary)] italic">
              {statusLine}
            </div>
          )}
        </div>
      )}

      <div className="w-full max-w-[766px] min-h-[46px] rounded-[20px] border border-[var(--border-main)] bg-[var(--background-card)] shadow-sm">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onInput={autoResize}
          onKeyDown={handleKeyDown}
          placeholder="Assign a task or ask anything"
          className="w-full resize-none text-[15px] font-normal leading-[24px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] px-4 pr-2 pt-3 outline-none bg-transparent"
        />
        <div className="flex items-center justify-between px-3 py-2">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border-[0.87px] border-[rgba(0,0,0,0.06)]"
          >
            <PlusIcon className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--fill-tsp-white-dark)] text-[var(--icon-disable)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SubmitArrowIcon className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
        {PILLS.map(({ label, icon: Icon }) => (
          <div
            key={label}
            role="button"
            onClick={() => setInput(label)}
            className="h-10 px-[14px] py-[7px] rounded-full border border-[var(--border-main)] flex justify-center items-center gap-2 hover:bg-[var(--fill-tsp-white-light)] flex-shrink-0 cursor-pointer"
          >
            <Icon className="h-[18px] w-[18px] text-[var(--icon-tertiary)]" />
            <span className="text-[var(--text-primary)] text-[14px] font-normal">{label}</span>
          </div>
        ))}
        <div
          role="button"
          className="h-10 px-[14px] py-[7px] rounded-full border border-[var(--border-main)] flex justify-center items-center gap-2 hover:bg-[var(--fill-tsp-white-light)] flex-shrink-0 cursor-pointer"
        >
          <span className="text-[var(--text-primary)] text-[14px] font-normal">More</span>
        </div>
      </div>
    </section>
  );
}
