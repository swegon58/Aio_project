import path from "path";

// Repo-relative paths to the Hermes harness (Aio_harness/), kept out of Aio/ itself.
// AIO_REPO_ROOT lets this resolve correctly regardless of cwd (Next.js dev vs scripts).
const AIO_REPO_ROOT =
  process.env.AIO_REPO_ROOT ?? path.resolve(process.cwd(), "..");

export const HERMES_HARNESS_ROOT = path.join(AIO_REPO_ROOT, "Aio_harness");
export const HERMES_HOME = path.join(HERMES_HARNESS_ROOT, "aio-home");
export const HERMES_PROFILES_ROOT = path.join(HERMES_HOME, "profiles");

// Seed dev profile used by Step 3a — also the source of the curated-skills /
// curated-toolset catalog (Q12b placeholder, see provision.ts) and the shared
// dev secrets (OpenRouter / Daytona keys) until Q41 Vault wiring lands.
export const DEV_PROFILE_NAME = "aio";
export const DEV_PROFILE_PORT = 8642;

// Dynamic provisioning port range (Step 3b). Dev seed profile keeps 8642.
export const PROVISION_PORT_RANGE: readonly [number, number] = [8650, 8700];

// Hermes commit pin (Q26) — must match Aio_harness/hermes-agent HEAD.
export const HERMES_COMMIT_PIN = "4373e802a1b90150b131b459c52e84ada2e70d06";

// Idle-kill threshold (Q14).
export const IDLE_TIMEOUT_MS = 60 * 60 * 1000;

// Health-check timeout when waiting for a freshly spawned process (step 7).
export const HEALTH_CHECK_TIMEOUT_MS = 60_000;
export const HEALTH_CHECK_INTERVAL_MS = 1_000;

export function profileDir(profileName: string): string {
  return path.join(HERMES_PROFILES_ROOT, profileName);
}

export function profileHomeDir(profileName: string): string {
  return path.join(profileDir(profileName), "home");
}

export function profileEnvPath(profileName: string): string {
  return path.join(profileDir(profileName), ".env");
}

export function profileLogPath(profileName: string): string {
  return path.join(profileDir(profileName), "logs", "gateway.log");
}

// Spawn env required for every `hermes -p <profile> ...` invocation — see
// Aio_harness/CLAUDE.md "stray-write root cause" fix. Both vars MUST be set
// for every spawned Hermes child process.
export function hermesSpawnEnv(profileName: string): Record<string, string> {
  return {
    HERMES_HOME,
    HOME: profileHomeDir(profileName),
  };
}
