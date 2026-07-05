import { useEffect, useState } from "react";
import { friendlyFetchError } from "@/lib/aio/friendly-fetch-error";
import type { CredentialStatus } from "@/components/app/app-home-types";

interface UseCredentialsParams {
  settingsOpen: boolean;
  logMeta: (text: string) => void;
}

// Gateway credentials (API keys etc.) CRUD, extracted verbatim from
// AppHome.tsx. Settings modal-open state and logMeta stay lifted at the
// shell and are passed in.
export function useCredentials({ settingsOpen, logMeta }: UseCredentialsParams) {
  const [credentials, setCredentials] = useState<CredentialStatus[] | null>(null);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [credentialId, setCredentialId] = useState("");
  const [credentialValue, setCredentialValue] = useState("");
  const [credentialSubmitting, setCredentialSubmitting] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState<string | null>(null);

  const loadCredentials = async () => {
    setCredentialsError(null);
    try {
      const res = await fetch("/api/credentials");
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      const data = await res.json();
      setCredentials(data.credentials);
      if (!credentialId && data.credentials?.[0]) {
        setCredentialId(data.credentials[0].id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCredentialsError(msg);
    }
  };

  useEffect(() => {
    if (settingsOpen && credentials === null) {
      loadCredentials();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialId || !credentialValue.trim()) return;
    setCredentialSubmitting(true);
    setCredentialMessage(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: credentialId, value: credentialValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCredentialMessage(data.message ?? "Failed to save credential");
      } else {
        setCredentialValue("");
        setCredentialMessage("Saved. Restart the gateway for it to take effect.");
        logMeta(`Saved credential "${credentialId}"`);
        await loadCredentials();
      }
    } catch (err) {
      setCredentialMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setCredentialSubmitting(false);
    }
  };

  return {
    credentials,
    credentialsError,
    credentialId,
    setCredentialId,
    credentialValue,
    setCredentialValue,
    credentialSubmitting,
    credentialMessage,
    handleCredentialSubmit,
  };
}
