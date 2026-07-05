import { useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { friendlyFetchError } from "@/lib/aio/friendly-fetch-error";
import type { CronJob } from "@/components/app/app-home-types";

interface UseCronJobsParams {
  confirmDeleteId: string | null;
  setConfirmDeleteId: Dispatch<SetStateAction<string | null>>;
  confirmDeleteTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

// Scheduled-tasks (cron) CRUD, extracted verbatim from AppHome.tsx. Delete
// confirmation is a cross-cutting UI pattern shared with conversations/
// gallery, so its state stays lifted at the AppHome shell and is passed in.
export function useCronJobs({ confirmDeleteId, setConfirmDeleteId, confirmDeleteTimeoutRef }: UseCronJobsParams) {
  const [cronJobs, setCronJobs] = useState<CronJob[] | null>(null);
  const [cronError, setCronError] = useState<string | null>(null);
  const [cronLocked, setCronLocked] = useState(false);
  const [cronActionPending, setCronActionPending] = useState<string | null>(null);
  const [cronName, setCronName] = useState("");
  const [cronSchedule, setCronSchedule] = useState("");
  const [cronPrompt, setCronPrompt] = useState("");
  const [cronNotifyDiscord, setCronNotifyDiscord] = useState(false);
  const [cronCreating, setCronCreating] = useState(false);
  const [cronCreateMessage, setCronCreateMessage] = useState<string | null>(null);

  const loadCronJobs = async () => {
    setCronError(null);
    setCronLocked(false);
    try {
      const res = await fetch("/api/cron");
      if (res.status === 403) {
        setCronLocked(true);
        setCronJobs([]);
        return;
      }
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      const data = await res.json();
      if (data.locked) {
        setCronLocked(true);
        setCronJobs([]);
        return;
      }
      setCronJobs(Array.isArray(data) ? data : data.jobs ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCronError(msg);
    }
  };

  const handleCronAction = async (jobId: string, action: "pause" | "resume" | "run") => {
    setCronActionPending(jobId);
    try {
      const res = await fetch(`/api/cron/${encodeURIComponent(jobId)}?action=${action}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      await loadCronJobs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCronError(msg);
    } finally {
      setCronActionPending(null);
    }
  };

  const handleCronDelete = async (jobId: string) => {
    if (confirmDeleteId !== jobId) {
      setConfirmDeleteId(jobId);
      if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
      confirmDeleteTimeoutRef.current = setTimeout(
        () => setConfirmDeleteId((cur) => (cur === jobId ? null : cur)),
        3000,
      );
      return;
    }
    if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
    setConfirmDeleteId(null);
    setCronActionPending(jobId);
    try {
      const res = await fetch(`/api/cron/${encodeURIComponent(jobId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      setCronJobs((prev) => prev?.filter((j) => j.id !== jobId) ?? prev);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCronError(msg);
    } finally {
      setCronActionPending(null);
    }
  };

  const handleCronCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cronName.trim() || !cronSchedule.trim()) return;
    setCronCreating(true);
    setCronCreateMessage(null);
    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cronName.trim(),
          schedule: cronSchedule.trim(),
          prompt: cronPrompt.trim(),
          notifyDiscord: cronNotifyDiscord,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCronCreateMessage(data.error ?? "Failed to create task");
      } else {
        setCronName("");
        setCronSchedule("");
        setCronPrompt("");
        setCronNotifyDiscord(false);
        await loadCronJobs();
      }
    } catch (err) {
      setCronCreateMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setCronCreating(false);
    }
  };

  useEffect(() => {
    if (cronJobs === null) {
      loadCronJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    cronJobs,
    cronError,
    cronLocked,
    cronActionPending,
    cronName,
    setCronName,
    cronSchedule,
    setCronSchedule,
    cronPrompt,
    setCronPrompt,
    cronNotifyDiscord,
    setCronNotifyDiscord,
    cronCreating,
    cronCreateMessage,
    loadCronJobs,
    handleCronAction,
    handleCronDelete,
    handleCronCreate,
  };
}
