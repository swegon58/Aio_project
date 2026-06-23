"use client";

import {
  BarChart3,
  FileSearch,
  Globe,
  ListChecks,
  Mail,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: typeof Search;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "competitor-pricing",
    title: "Research competitor pricing",
    description: "Find 3–5 direct competitors and summarize their pricing tiers.",
    prompt:
      "Research 3-5 direct competitors in my space and summarize their pricing plans, tiers, and any free trial offers in a comparison table.",
    icon: Search,
  },
  {
    id: "webpage-monitor",
    title: "Monitor a webpage for changes",
    description: "Check a page now, then report what to watch for if it changes.",
    prompt:
      "Visit this URL, take note of its current content, and tell me how I could monitor it for changes (e.g. price drops or new postings): https://example.com",
    icon: Globe,
  },
  {
    id: "weekly-ops-report",
    title: "Generate a weekly ops report",
    description: "Turn raw spreadsheet data into a summarized weekly report.",
    prompt:
      "Read the data from my spreadsheet (I'll share the link or upload it) and generate a weekly ops report summarizing key metrics, trends, and any anomalies.",
    icon: BarChart3,
  },
  {
    id: "lead-directory",
    title: "Compile leads from a directory",
    description: "Scrape a directory and build a contact list with key details.",
    prompt:
      "Find businesses listed on a directory site (e.g. Google Maps or Yelp) for a given category and location, and compile a list with name, address, phone, and website.",
    icon: ListChecks,
  },
  {
    id: "inbox-triage",
    title: "Triage and draft email replies",
    description: "Summarize unread messages and draft replies for urgent ones.",
    prompt:
      "Summarize my unread emails from today, flag the ones that need a response, and draft short reply suggestions for the most urgent ones.",
    icon: Mail,
  },
  {
    id: "doc-summary",
    title: "Summarize a long document",
    description: "Condense a report or PDF into key takeaways and action items.",
    prompt:
      "Read this document and summarize it into key takeaways, open questions, and a short list of action items.",
    icon: FileSearch,
  },
];

interface TemplateGalleryProps {
  onSelect: (prompt: string) => void;
}

export function TemplateGallery({ onSelect }: TemplateGalleryProps) {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-7 py-8">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: "var(--aio-ink)" }}
        >
          What will you automate today?
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--aio-muted)" }}>
          Pick a task below or describe your own in the input.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TASK_TEMPLATES.map((template) => {
          const Icon = template.icon;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template.prompt)}
              className={cn(
                "group flex flex-col gap-3 rounded-lg border p-4 text-left transition-all duration-150",
                "border-[var(--aio-border)] bg-[var(--aio-surface)]",
                "hover:border-[var(--aio-amber)]/40 hover:bg-[var(--aio-surface2)]",
              )}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-md border"
                style={{
                  background: "var(--aio-amber-dim)",
                  borderColor: "var(--aio-amber)/20",
                }}
              >
                <Icon className="h-4 w-4" style={{ color: "var(--aio-amber)" }} aria-hidden />
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium" style={{ color: "var(--aio-ink)" }}>
                  {template.title}
                </span>
                <span className="text-xs leading-relaxed" style={{ color: "var(--aio-muted)" }}>
                  {template.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}
