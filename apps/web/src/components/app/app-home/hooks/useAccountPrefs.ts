import { useEffect, useState } from "react";
import { friendlyFetchError } from "@/lib/aio/friendly-fetch-error";
import type { AccentKey } from "@/components/app/SettingsModal";

interface UseAccountPrefsParams {
  logMeta: (text: string) => void;
}

// Theme/accent (+localStorage persistence), onboarding-seen flag, account
// export/delete, and plan upgrade checkout — extracted verbatim from
// AppHome.tsx. prefsHydrated gates localStorage writes so the client's first
// render doesn't diverge from SSR output (hydration mismatch).
export function useAccountPrefs({ logMeta }: UseAccountPrefsParams) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accent, setAccent] = useState<AccentKey>("blue");
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  useEffect(() => {
    const storedTheme = localStorage.getItem("aio-theme");
    if (storedTheme === "light") setTheme("light");
    const storedAccent = localStorage.getItem("aio-accent") as AccentKey | null;
    if (storedAccent) setAccent(storedAccent);
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (prefsHydrated) localStorage.setItem("aio-theme", theme);
  }, [theme, prefsHydrated]);

  useEffect(() => {
    if (prefsHydrated) localStorage.setItem("aio-accent", accent);
  }, [accent, prefsHydrated]);

  const [onboardedAt, setOnboardedAt] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    fetch("/api/onboarding")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { onboardedAt: string | null } | null) => {
        setOnboardedAt(data ? data.onboardedAt : null);
      })
      .catch(() => setOnboardedAt(null));
  }, []);

  const [exportLoading, setExportLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  const handleExportData = async () => {
    setExportLoading(true);
    setExportStatus(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "aio-account-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportStatus("Download started.");
      logMeta("Exported account data");
    } catch (err) {
      setExportStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteStatus(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? friendlyFetchError(res.status));
      }
      const { createClient } = await import("@/lib/supabase/client");
      await createClient().auth.signOut();
      window.location.href = "/";
    } catch (err) {
      setDeleteStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const [upgrading, setUpgrading] = useState(false);
  const handleUpgradeToBusiness = async () => {
    setUpgrading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "plan", planTier: "business" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const session = await res.json();
      window.location.href = session.url;
    } catch (err) {
      console.error("Upgrade checkout failed:", err);
      setUpgrading(false);
    }
  };

  return {
    theme,
    setTheme,
    accent,
    setAccent,
    prefsHydrated,
    onboardedAt,
    setOnboardedAt,
    exportLoading,
    exportStatus,
    handleExportData,
    deleteLoading,
    deleteStatus,
    handleDeleteAccount,
    upgrading,
    handleUpgradeToBusiness,
  };
}
