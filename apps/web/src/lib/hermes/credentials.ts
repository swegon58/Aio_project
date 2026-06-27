// Canonical credential list for the "Credentials" tab (Batch E).
//
// Covers secrets that aren't already handled by the Connections-tab platform
// tokens (platforms.ts — those write straight into the profile .env and are
// scoped to messaging platform bot tokens) or by hermes_registry's dedicated
// openrouter_key_ref column (the legacy single-key Vault wiring, Q41).
// These are LLM-provider / tool API keys: stored generically via the
// vault_store_credential / vault_read_credential RPCs (migration 0006) in
// prod, or as flat KEY=value lines in the profile .env in dev — same dual
// path the rest of Batch E follows.
export interface CredentialDef {
  id: string;
  label: string;
  envVar: string;
}

export const KNOWN_CREDENTIALS: CredentialDef[] = [
  { id: "openrouter", label: "OpenRouter API Key", envVar: "OPENROUTER_API_KEY" },
  { id: "kie", label: "Kie.ai Image API Key", envVar: "KIE_API_KEY" },
  { id: "daytona", label: "Daytona API Key", envVar: "DAYTONA_API_KEY" },
  { id: "honcho", label: "Honcho API Key", envVar: "HONCHO_API_KEY" },
];

export function findCredential(id: string): CredentialDef | undefined {
  return KNOWN_CREDENTIALS.find((c) => c.id === id);
}

// Last 4 chars only — never return the full value to the client.
export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.max(trimmed.length - 4, 4))}${trimmed.slice(-4)}`;
}
