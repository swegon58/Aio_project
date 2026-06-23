"use client";

import { CheckCircle2, CircleAlert, Download, Loader2, UserCheck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HermesActivityData } from "@/lib/hermes/chat-types";

interface ActivityStreamProps {
  items: HermesActivityData[];
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ActivityIcon({ item }: { item: HermesActivityData }) {
  if (item.kind === "approval") {
    return <UserCheck className="h-3.5 w-3.5" style={{ color: "var(--aio-amber)" }} aria-hidden />;
  }
  if (item.error) {
    return <CircleAlert className="h-3.5 w-3.5" style={{ color: "var(--aio-error)" }} aria-hidden />;
  }
  if (item.status === "running") {
    return (
      <Loader2
        className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
        style={{ color: "var(--aio-amber)" }}
        aria-hidden
      />
    );
  }
  return <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--aio-subtle)" }} aria-hidden />;
}

function isRunningTool(item: HermesActivityData): boolean {
  return item.kind === "tool" && item.status === "running";
}

function activityLabel(item: HermesActivityData): string {
  if (item.kind === "approval") return item.desc ?? item.cmd ?? "Approval requested";
  return item.label ?? item.tool;
}

export function ActivityStream({ items }: ActivityStreamProps) {
  if (items.length === 0) {
    return (
      <p className="px-1 text-[11px]" style={{ color: "var(--aio-subtle)" }}>
        Activity will appear here once the agent starts working.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const key = item.kind === "tool" ? item.toolCallId : item.requestId ?? item.ts;
        const isRunning = isRunningTool(item) || item.kind === "approval";
        const artifact = item.kind === "tool" && item.status === "completed" && !item.error ? item.filePath : undefined;
        return (
          <li
            key={key}
            className={cn(
              "flex flex-col gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors duration-200",
              isRunning
                ? "border border-[var(--aio-amber)]/20 bg-[var(--aio-amber-dim)]"
                : "border border-transparent",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="shrink-0" aria-hidden>
                {item.kind === "tool" && item.status === "running" ? (
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                    style={{ color: "var(--aio-amber)" }}
                  />
                ) : item.kind === "tool" && item.emoji ? (
                  <span className="text-sm leading-none">{item.emoji}</span>
                ) : item.kind === "tool" ? (
                  <Wrench className="h-3.5 w-3.5" style={{ color: "var(--aio-subtle)" }} />
                ) : (
                  <ActivityIcon item={item} />
                )}
              </span>
              <span className="flex-1 truncate" style={{ color: "var(--aio-ink)" }}>
                {activityLabel(item)}
              </span>
              {item.kind === "tool" && item.status === "completed" && (
                <ActivityIcon item={item} />
              )}
              <time
                className="shrink-0 font-mono text-[10px]"
                style={{ color: "var(--aio-subtle)" }}
              >
                {formatTime(item.ts)}
              </time>
            </div>
            {artifact && (
              <a
                href={artifact}
                download={item.kind === "tool" ? item.fileName : undefined}
                className="ml-[22px] flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors hover:bg-[var(--aio-amber-dim)]"
                style={{ borderColor: "var(--aio-border)", color: "var(--aio-ink)" }}
              >
                <Download className="h-3 w-3 shrink-0" style={{ color: "var(--aio-subtle)" }} aria-hidden />
                <span className="truncate">{item.kind === "tool" ? item.fileName ?? "Download file" : "Download file"}</span>
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
