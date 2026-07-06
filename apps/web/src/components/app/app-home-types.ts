import type { CredentialCategory } from "@/lib/hermes/credentials";

export interface PlanQuestion {
  question: string;
  choices: string[];
  recommended?: number;
}

export type MessageSegment =
  | { type: "text"; value: string }
  | { type: "code"; lang: string; code: string };

export type FilesSubTab = "gallery" | "files";
export type TodayAction = "plan" | "run" | "schedule" | "ignore";

export interface TodayCard {
  id: string;
  kind: "continue" | "review" | "create" | "schedule";
  label: string;
  title: string;
  reason: string;
  source: string;
  prompt: string;
}

export interface MetaLogEntry {
  id: string;
  text: string;
  ts: number;
}

// Aio Output is a human-facing inspector for the current task. Compact
// keeps the chat primary; focus gives previews more room without turning
// the product into a developer terminal.
export type TerminalScale = "compact" | "focus";
export type TerminalTab = "activity" | "preview";

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  enabled?: boolean;
  next_run?: string | null;
  last_run?: string | null;
}

export interface GalleryImage {
  id: string;
  sessionId: string | null;
  caption: string | null;
  createdAt: string;
  url: string | null;
  bare?: boolean;
}

export interface AioNotification {
  id: string;
  source: "scheduled_task" | "research_run";
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

export type ImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type ImageResolution = "1K" | "2K" | "4K";
export type ImageGenerationStatus = "preparing" | "generating" | "saving";

export interface ConnectionStatus {
  id: string;
  label: string;
  tokenEnvVar: string;
  connected: boolean;
}

export interface CredentialStatus {
  id: string;
  label: string;
  envVar: string;
  category: CredentialCategory;
  set: boolean;
  masked: string | null;
}

export type KanbanStatus = "todo" | "ready" | "running" | "scheduled" | "blocked" | "done" | "archived";

export interface KanbanTask {
  id: string;
  title: string;
  status: string;
  assignee: string | null;
}

export interface KanbanBoard {
  statuses: KanbanStatus[];
  columns: Record<string, KanbanTask[]>;
}

export interface FileTreeEntry {
  name: string;
  type: "dir" | "file";
  size: number | null;
  mtime: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface MemorySnapshot {
  available: boolean;
  summary?: string | null;
  facts?: string[];
  error?: string;
  reason?: string;
}
