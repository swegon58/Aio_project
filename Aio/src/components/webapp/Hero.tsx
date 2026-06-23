"use client";

import { useRef, useState } from "react";
import {
  Paperclip,
  ArrowUp,
  ChevronRight,
  Link2,
  Frame,
  ShoppingCart,
  LayoutTemplate,
  LayoutDashboard,
  Briefcase,
  Building2,
  Cloud,
  Link,
  Newspaper,
  Gamepad2,
  CheckSquare,
  Loader2,
} from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const CATEGORY_PILLS = [
  { label: "E-commerce", sublabel: "Shopify", icon: ShoppingCart },
  { label: "Landing Page", icon: LayoutTemplate },
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Portfolio", icon: Briefcase },
  { label: "Corporate", icon: Building2 },
  { label: "SaaS", icon: Cloud },
  { label: "Link-in-bio", icon: Link },
  { label: "Blog", icon: Newspaper },
  { label: "Mini Games", icon: Gamepad2 },
  { label: "Productivity", icon: CheckSquare },
];

const PLACEHOLDER = "Build an internal sales analytics dashboard with CRM data integration.";

export function WebappHero() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const conversationIdRef = useRef<string>("");

  async function sendMessage() {
    const text = input.trim();
    if (!text || isStreaming) return;

    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

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
            if (event.conversation_id) conversationIdRef.current = event.conversation_id;
            if (event.event === "message" && typeof event.answer === "string") {
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = {
                  role: "assistant",
                  content: next[next.length - 1].content + event.answer,
                };
                return next;
              });
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: `⚠️ ${message}` };
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const hasConversation = messages.length > 0;

  return (
    <section className="box-border flex w-full flex-col items-center px-6 py-20">
      <div className="flex w-full max-w-[1032px] flex-col items-center gap-12">
        <div className="flex w-full max-w-[680px] flex-col items-center gap-3 text-center">
          <h1 className="font-serif text-[32px] font-semibold leading-[1.2] text-[var(--text-primary)] sm:text-[48px]">
            Launch business applications without engineering resources
          </h1>
          <p className="w-full text-base font-normal leading-[1.5] text-[var(--text-secondary)]">
            From internal tools to customer-facing SaaS — deploy production-ready apps in minutes, not months.
          </p>
        </div>

        {hasConversation && (
          <div className="flex w-full flex-col gap-4 sm:max-w-[768px]">
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
          </div>
        )}

        <div className="mx-auto flex w-full flex-col gap-1 sm:max-w-[768px] sm:min-w-[360px]">
          <div className="flex w-full flex-col rounded-[22px] border border-black/8 bg-[var(--background-menu-white)] py-3 shadow-[0px_12px_32px_0px_rgba(0,0,0,0.02)]">
            <div
              role="textbox"
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setInput(e.currentTarget.textContent ?? "")}
              onKeyDown={handleKeyDown}
              data-placeholder={PLACEHOLDER}
              className="min-h-[46px] overflow-auto px-4 pe-2 text-[15px] leading-[24px] text-[var(--text-primary)] outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-[var(--text-secondary)]"
            />
            <div className="px-3" />
            <div className="flex items-center gap-2 px-3">
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-main)] p-0"
              >
                <Paperclip className="h-[18px] w-[18px] text-[var(--text-primary)]" />
              </button>
              <div className="flex shrink-0 flex-1 items-center gap-2" />
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--fill-tsp-white-dark)] p-0 text-[var(--text-onblack)] disabled:opacity-50"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 px-4">
            <div className="flex flex-col gap-3 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 pe-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  What would you like to build?
                </p>
                <div className="flex items-center gap-[2px]">
                  <button
                    type="button"
                    className="flex items-center gap-[6px] rounded-md px-[2px] py-1 text-[var(--text-primary)] hover:bg-[var(--fill-tsp-white-light)]"
                  >
                    <Link2 className="h-[18px] w-[18px]" />
                    <span className="text-[13px] leading-[18px] tracking-[-0.091px]">
                      Add website reference
                    </span>
                  </button>
                  <div className="h-3 w-px bg-[var(--border-main)]" />
                  <button
                    type="button"
                    className="flex items-center gap-[6px] rounded-md px-[2px] py-1 text-[var(--text-primary)] hover:bg-[var(--fill-tsp-white-light)]"
                  >
                    <Frame className="h-[18px] w-[18px]" />
                    <span className="text-[13px] leading-[18px] tracking-[-0.091px]">
                      Import from Figma
                    </span>
                  </button>
                </div>
              </div>

              <div className="relative h-10">
                <div className="overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
                  <div className="flex w-max gap-3">
                    {CATEGORY_PILLS.map(({ label, sublabel, icon: Icon }) => (
                      <button
                        key={label}
                        type="button"
                        className="clickable flex h-10 shrink-0 items-center gap-[10px] rounded-[10px] border border-[var(--border-main)] bg-[var(--background-card-gray)] py-3 pl-[14px] pr-3 hover:bg-[var(--fill-tsp-white-light)]"
                      >
                        <Icon className="h-[18px] w-[18px] text-[var(--text-primary)]" />
                        <span className="flex items-center gap-[6px] text-[13px] leading-[18px] tracking-[-0.091px] text-[var(--text-primary)] whitespace-nowrap">
                          {label}
                          {sublabel && (
                            <span className="text-[var(--text-secondary)]">{sublabel}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pointer-events-none absolute end-0 top-0 bottom-0 flex w-[72px] items-center justify-end bg-gradient-to-l from-[var(--background-gray-main)] to-transparent pe-2">
                  <button
                    type="button"
                    className="pointer-events-auto flex size-6 items-center justify-center rounded-full border border-[var(--border-white)] bg-[var(--background-menu-white)] backdrop-blur-[34px] hover:bg-[var(--fill-tsp-white-main)]"
                  >
                    <ChevronRight className="h-4 w-4 text-[var(--text-primary)]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
