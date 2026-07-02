"use client";

import { Clock, Loader2, Pause, Play, Plus, SkipForward, Trash2, X } from "lucide-react";
import type { CronJob } from "@/components/app/AppHome";

interface ScheduledTasksModalProps {
  open: boolean;
  onClose: () => void;
  jobs: CronJob[] | null;
  error: string | null;
  locked: boolean;
  actionPending: string | null;
  confirmDeleteId: string | null;
  name: string;
  onNameChange: (value: string) => void;
  schedule: string;
  onScheduleChange: (value: string) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  creating: boolean;
  createMessage: string | null;
  onCreate: (e: React.FormEvent) => void;
  onDelete: (jobId: string) => void;
  onAction: (jobId: string, action: "pause" | "resume" | "run") => void;
}

export function ScheduledTasksModal({
  open,
  onClose,
  jobs,
  error,
  locked,
  actionPending,
  confirmDeleteId,
  name,
  onNameChange,
  schedule,
  onScheduleChange,
  prompt,
  onPromptChange,
  creating,
  createMessage,
  onCreate,
  onDelete,
  onAction,
}: ScheduledTasksModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scheduled-tasks-dialog-title"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="scheduled-tasks-dialog-title">Scheduled Tasks</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {locked ? (
          <div className="flex flex-col items-center gap-2 py-6 text-[var(--text-muted)]">
            <Clock className="h-8 w-8 opacity-40" />
            <p className="text-[13px] text-center">
              {error ?? "Scheduled tasks require the Business plan."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {error && <div className="text-[12px] text-red-400 bg-red-400/10 rounded-md px-3 py-2">{error}</div>}

            {jobs === null && !error && (
              <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)] py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading scheduled tasks…
              </div>
            )}

            {jobs?.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-[var(--text-muted)]">
                <Clock className="h-8 w-8 opacity-40" />
                <p className="text-[12px]">No scheduled tasks yet.</p>
              </div>
            )}

            {jobs?.map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-2"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-hover)]">
                  <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                    {job.name}
                    {job.enabled === false && " · Paused"}
                  </div>
                  <div className="truncate text-[11px] text-[var(--text-muted)]">
                    {job.schedule}
                    {job.next_run ? ` · next ${new Date(job.next_run).toLocaleString()}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="mcp-add-btn"
                  style={{ padding: "4px 8px" }}
                  disabled={actionPending === job.id}
                  onClick={() => onAction(job.id, "run")}
                  aria-label="Run now"
                  title="Run now"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="mcp-add-btn"
                  style={{ padding: "4px 8px" }}
                  disabled={actionPending === job.id}
                  onClick={() => onAction(job.id, job.enabled === false ? "resume" : "pause")}
                  aria-label={job.enabled === false ? "Resume" : "Pause"}
                  title={job.enabled === false ? "Resume" : "Pause"}
                >
                  {job.enabled === false ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  className="mcp-add-btn"
                  style={
                    confirmDeleteId === job.id
                      ? { padding: "4px 8px", background: "rgba(226, 92, 92, 0.12)", color: "#e25c5c" }
                      : { padding: "4px 8px" }
                  }
                  disabled={actionPending === job.id}
                  onClick={() => onDelete(job.id)}
                  aria-label={confirmDeleteId === job.id ? "Confirm delete" : "Delete scheduled task"}
                  title={confirmDeleteId === job.id ? "Click again to confirm" : "Delete"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <form onSubmit={onCreate} className="flex flex-col gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-3">
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Name (e.g. Weekly report)"
                className="message-input"
                style={{ height: 32 }}
              />
              <input
                type="text"
                value={schedule}
                onChange={(e) => onScheduleChange(e.target.value)}
                placeholder="Schedule (e.g. every 30m, 0 9 * * 1-5)"
                className="message-input"
                style={{ height: 32 }}
              />
              <textarea
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder="What should Aio do when this runs?"
                className="message-input"
                style={{ height: 72, resize: "vertical", paddingTop: 8 }}
              />
              {createMessage && <div className="text-[12px] text-red-400">{createMessage}</div>}
              <button
                type="submit"
                className="mcp-add-btn w-full justify-center gap-1.5"
                disabled={creating || !name.trim() || !schedule.trim()}
              >
                <Plus className="h-3.5 w-3.5" /> {creating ? "Creating…" : "New scheduled task"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
