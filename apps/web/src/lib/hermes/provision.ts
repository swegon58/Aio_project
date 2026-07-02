import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEV_PROFILE_NAME,
  HEALTH_CHECK_INTERVAL_MS,
  HEALTH_CHECK_TIMEOUT_MS,
  HERMES_COMMIT_PIN,
  hermesSpawnEnv,
  profileDir,
  profileEnvPath,
  profileLogPath,
} from "./config";
import {
  type HermesRegistryRow,
  getRunningRows,
  storeOpenRouterKeyInVault,
  updateRegistryRow,
} from "./registry";
import { allocateFreePort, isPidAlive, isPortFree } from "./process";
import { ALL_GATEABLE_TOOLSETS, type PlanTier, tierConfig } from "./pricing";
import { provisionOpenRouterKey } from "./openrouter";

const HERMES_BIN = "/home/swegon/.local/bin/hermes";

function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

// Step 1: `hermes profile create <id> --no-skills` (BUILD_SPEC §4).
async function createProfile(profileName: string): Promise<void> {
  const dir = profileDir(profileName);
  try {
    await fs.access(dir);
    return; // already created — idempotent (respawn case)
  } catch {
    // not present, create below
  }
  const result = await run(
    HERMES_BIN,
    ["profile", "create", profileName, "--no-skills", "--no-alias"],
    { env: hermesSpawnEnv(profileName) },
  );
  if (result.code !== 0) {
    throw new Error(
      `hermes profile create ${profileName} failed (code ${result.code}): ${result.stderr}`,
    );
  }
}

// Step 2: copy the curated skill/tool catalog (Q12b) into the new profile.
//
// PLACEHOLDER for the real Q12b master catalog: the "aio" dev profile's
// config.yaml already carries the curated `toolsets` / `disabled_toolsets` /
// `platform_toolsets` block (narrowed via `hermes tools disable ...` during
// Build Order Step 1). Until a standalone catalog exists under apps/harness/,
// we copy that block + the (currently empty) skills/ dir from the "aio"
// profile as the seed catalog for every new profile.
async function copyCuratedCatalog(profileName: string): Promise<void> {
  const sourceDir = profileDir(DEV_PROFILE_NAME);
  const targetDir = profileDir(profileName);

  // skills/ dir — currently empty in "aio", but copy structure for forward
  // compatibility once real SKILL.md catalogs land (Q12b).
  const sourceSkills = path.join(sourceDir, "skills");
  const targetSkills = path.join(targetDir, "skills");
  try {
    await fs.cp(sourceSkills, targetSkills, { recursive: true });
  } catch {
    // skills/ may not exist on a fresh profile — non-fatal.
  }

  // Curated config: `hermes profile create --no-skills` does NOT generate a
  // config.yaml for the new profile (confirmed Step 3b E2E) — only the dir
  // skeleton (workspace/, skills/, home/, logs/, etc). The dev "aio" profile's
  // config.yaml is the curated catalog (Q12b placeholder), so it becomes the
  // new profile's config.yaml wholesale, with only terminal.cwd overridden to
  // anchor to THIS profile's workspace.
  const yaml = await import("yaml");
  const sourceConfigRaw = await fs.readFile(
    path.join(sourceDir, "config.yaml"),
    "utf-8",
  );
  const targetConfigPath = path.join(targetDir, "config.yaml");

  const targetConfig = yaml.parse(sourceConfigRaw) as Record<string, unknown>;

  if (targetConfig.terminal) {
    const targetTerminal = targetConfig.terminal as Record<string, unknown>;
    targetTerminal.cwd = path.join(targetDir, "workspace");
    // Outbound network lockdown (2026-06-22) — `terminal`/`process` are base
    // infra, NOT in ALL_GATEABLE_TOOLSETS (pricing.ts), so every tier incl.
    // Starter gets a Daytona terminal sandbox. Without this, a customer can
    // `curl` any external paid API (kie.ai, ElevenLabs, etc.) with their own
    // key, bypassing image_gen/video_gen/tts/code_execution tier gating
    // entirely. Block all outbound network in the sandbox for every tier —
    // closes the bypass at the network layer. Left allow_list empty:
    // hardcoding registry/CDN CIDR ranges without verifying them against
    // Daytona's current network-policy behavior would be worse than no
    // allowlist. Known tradeoff: pip/npm/git inside the sandbox also stop
    // working until specific ranges are added.
    targetTerminal.daytona_network_block_all = true;
  }

  await fs.writeFile(targetConfigPath, yaml.stringify(targetConfig), "utf-8");
}

// Step 2b: apply the customer's plan-tier config (Q17a/Q34) to the profile's
// config.yaml — `agent.max_turns` (per-task iteration cap), `model.default`
// (tier model), and `agent.disabled_toolsets` (tier toolset gating, locked
// via grill-me 2026-06-20 — see
// apps/harness/docs/decisions/tier-toolset-gating-grill.md). Phase 1 =
// config-only, no hermes-agent core edit. Re-applied on every
// provisionAndStart (fresh AND respawn) so a plan-tier change takes effect on
// the customer's next task without a manual profile edit.
async function applyTierConfig(profileName: string, planTier: PlanTier): Promise<void> {
  const cfg = tierConfig(planTier);
  const configPath = path.join(profileDir(profileName), "config.yaml");
  const yaml = await import("yaml");

  const raw = await fs.readFile(configPath, "utf-8");
  const parsed = yaml.parse(raw) as Record<string, unknown>;

  const agent = (parsed.agent ?? {}) as Record<string, unknown>;
  agent.max_turns = cfg.caps.maxIterations;

  // Toolset gating: keep any pre-existing disabled toolsets that are NOT in
  // our gateable universe (e.g. homeassistant, spotify, yuanbao — never
  // relevant to Aio), then disable every gateable toolset this tier hasn't
  // unlocked.
  const existingDisabled = new Set(
    Array.isArray(agent.disabled_toolsets) ? (agent.disabled_toolsets as string[]) : [],
  );
  for (const id of existingDisabled) {
    if ((ALL_GATEABLE_TOOLSETS as readonly string[]).includes(id)) {
      existingDisabled.delete(id);
    }
  }
  for (const id of ALL_GATEABLE_TOOLSETS) {
    if (!cfg.toolsets.includes(id)) {
      existingDisabled.add(id);
    }
  }
  agent.disabled_toolsets = Array.from(existingDisabled).sort();
  parsed.agent = agent;

  const model = (parsed.model ?? {}) as Record<string, unknown>;
  model.provider = "openrouter";
  model.default = cfg.model;
  parsed.model = model;

  // Re-assert outbound network lockdown on every respawn too, in case a
  // stale profile (provisioned before 2026-06-22) is missing it.
  const terminal = (parsed.terminal ?? {}) as Record<string, unknown>;
  terminal.daytona_network_block_all = true;
  parsed.terminal = terminal;

  await fs.writeFile(configPath, yaml.stringify(parsed), "utf-8");
}

// Step 3: write profile .env (BUILD_SPEC §4 step 3 / Q41).
//
// OpenRouter key: if OPENROUTER_PROVISIONING_KEY is configured, provisions a
// real per-customer OpenRouter key with a hard monthly spend ceiling (Q15,
// tier limit from pricing.ts) via the OpenRouter Management API, and stores
// the raw key in Supabase Vault (openrouter_key_ref) so it can be looked up
// later. If unset, falls back to sharing the Aio dev profile's own
// OPENROUTER_API_KEY (Phase-1 placeholder, no per-customer ceiling) — same
// behavior as before this wiring existed.
//
// DAYTONA_API_KEY and Honcho config are still shared/unconfigured — no
// per-customer Vault wiring exists yet for those (TODO, Q41).
async function writeProfileEnv(
  db: SupabaseClient,
  row: HermesRegistryRow,
  profileName: string,
): Promise<{ apiServerKey: string; openrouterKeyRef: string | null; openrouterKeyHash: string | null }> {
  const devEnvPath = profileEnvPath(DEV_PROFILE_NAME);
  const devEnvRaw = await fs.readFile(devEnvPath, "utf-8");
  const daytonaKey = devEnvRaw.match(/^DAYTONA_API_KEY=(.*)$/m)?.[1] ?? "";

  const spendLimitUsd = tierConfig((row.plan_tier as PlanTier) ?? "starter")
    .openrouterMonthlySpendLimitUsd;
  const provisioned = await provisionOpenRouterKey(profileName, spendLimitUsd);

  let openrouterKey: string;
  let openrouterKeyRef: string | null = null;
  let openrouterKeyHash: string | null = null;
  if (provisioned) {
    openrouterKey = provisioned.key;
    openrouterKeyHash = provisioned.hash;
    openrouterKeyRef = await storeOpenRouterKeyInVault(db, row.customer_id, provisioned.key, null);
  } else {
    openrouterKey = devEnvRaw.match(/^OPENROUTER_API_KEY=(.*)$/m)?.[1] ?? "";
  }

  const { randomBytes } = await import("crypto");
  const apiServerKey = `aio_${randomBytes(24).toString("hex")}`;

  const lines = [
    "# Per-profile secrets — generated by Aio orchestrator (Step 3b lazy provisioning).",
    provisioned
      ? `# Per-customer OpenRouter key (Q15/Q41) — hard spend ceiling $${spendLimitUsd}/mo, provisioned via OpenRouter Management API.`
      : "# TODO (Q41): OPENROUTER_PROVISIONING_KEY not set — sharing the Aio dev profile's OPENROUTER_API_KEY as a Phase-1 placeholder (no per-customer ceiling).",
    "# DAYTONA_API_KEY still shared (TODO, Q41).",
    "",
    `OPENROUTER_API_KEY=${openrouterKey}`,
    `API_SERVER_KEY=${apiServerKey}`,
    "TERMINAL_ENV=daytona",
    `DAYTONA_API_KEY=${daytonaKey}`,
    "",
    "# HONCHO (cross-session memory, Q10) — not configured (TODO, Q41).",
    "",
  ];

  await fs.writeFile(profileEnvPath(profileName), lines.join("\n"), "utf-8");
  return { apiServerKey, openrouterKeyRef, openrouterKeyHash };
}

// Step 5: start `hermes -p <id> gateway run` as a detached child process.
async function spawnGateway(profileName: string, port: number): Promise<number> {
  await fs.mkdir(path.dirname(profileLogPath(profileName)), { recursive: true });
  const logFd = await fs.open(profileLogPath(profileName), "a");

  const child = spawn(
    HERMES_BIN,
    ["-p", profileName, "gateway", "run", "--replace"],
    {
      env: {
        ...process.env,
        ...hermesSpawnEnv(profileName),
        API_SERVER_PORT: String(port),
      },
      detached: true,
      stdio: ["ignore", logFd.fd, logFd.fd],
    },
  );
  child.unref();
  await logFd.close();
  if (!child.pid) throw new Error(`Failed to spawn gateway for profile ${profileName}`);
  return child.pid;
}

// Step 7: poll the api_server's /health endpoint until ready or timeout.
async function waitForHealth(endpoint: string): Promise<void> {
  const deadline = Date.now() + HEALTH_CHECK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, HEALTH_CHECK_INTERVAL_MS));
  }
  throw new Error(`Hermes process at ${endpoint} did not become healthy within ${HEALTH_CHECK_TIMEOUT_MS}ms`);
}

// Full 7-step lazy provisioning flow (BUILD_SPEC §4). Called when a customer's
// registry row has status='provisioned' (no profile/port yet) or 'stopped'/
// 'failed'/'idle' (respawn — profile dir persists, steps 1-3 are skipped).
export async function provisionAndStart(
  db: SupabaseClient,
  row: HermesRegistryRow,
): Promise<HermesRegistryRow> {
  const isFreshProvision = !row.profile_name;
  const profileName = row.profile_name ?? `cust_${row.customer_id.replace(/-/g, "").slice(0, 16)}`;

  let apiServerKey: string;
  let openrouterKeyRef: string | null = null;
  let openrouterKeyHash: string | null = null;

  if (isFreshProvision) {
    // Steps 1-3: create profile, copy curated catalog, write .env.
    await createProfile(profileName);
    await copyCuratedCatalog(profileName);
    ({ apiServerKey, openrouterKeyRef, openrouterKeyHash } = await writeProfileEnv(db, row, profileName));
  } else {
    // Respawn: profile dir + .env persist (Q14 build note). Re-read the
    // existing API_SERVER_KEY rather than regenerating it.
    const envRaw = await fs.readFile(profileEnvPath(profileName), "utf-8");
    apiServerKey = envRaw.match(/^API_SERVER_KEY=(.*)$/m)?.[1] ?? "";
    if (!apiServerKey) {
      // Profile .env lost somehow — regenerate (edge case, acceptable for Phase 1 dev).
      ({ apiServerKey, openrouterKeyRef, openrouterKeyHash } = await writeProfileEnv(db, row, profileName));
    }
  }

  // Q17a/Q34: apply the customer's current plan-tier caps + model to
  // config.yaml on every (re)spawn — picks up plan-tier changes.
  await applyTierConfig(profileName, (row.plan_tier as PlanTier) ?? "starter");

  // Step 4: allocate a free port (skip if respawning on the same port and
  // it's actually free again).
  let port = row.port;
  if (!port || !(await isPortFree(port))) {
    port = await allocateFreePort(db);
  }
  const endpoint = `http://127.0.0.1:${port}`;

  // api_server_key_ref: Phase-1 placeholder — store the raw key inline
  // (gitignored profile .env, not committed). TODO (Q41): replace with a
  // Supabase Vault pointer; orchestrator pulls + rewrites .env at spawn.
  const apiServerKeyRef = `inline:${apiServerKey}`;

  // Step 5: spawn the gateway.
  const pid = await spawnGateway(profileName, port);

  // Step 6: write registry row (provisioned -> running, with profile/port/pid).
  // openrouter_key_ref/hash only set when a per-customer key was actually
  // provisioned this call — omitted (not overwritten with null) on respawns
  // that skip writeProfileEnv, so an existing Vault ref survives.
  let updated = await updateRegistryRow(db, row.customer_id, {
    profile_name: profileName,
    port,
    endpoint,
    status: "running",
    api_server_key_ref: apiServerKeyRef,
    ...(openrouterKeyRef ? { openrouter_key_ref: openrouterKeyRef } : {}),
    ...(openrouterKeyHash ? { openrouter_key_hash: openrouterKeyHash } : {}),
    commit_pin: HERMES_COMMIT_PIN,
    pid,
    last_active_at: new Date().toISOString(),
  });

  // Step 7: health-check.
  try {
    await waitForHealth(endpoint);
  } catch (err) {
    updated = await updateRegistryRow(db, row.customer_id, { status: "failed" });
    throw err;
  }

  return updated;
}

// Crash reconcile (Q39, must-have part): on orchestrator startup, mark any
// registry row whose status is running/idle but whose PID is dead as
// 'failed'. Does NOT attempt the state.db in-progress-turn scan — see
// BUILD_SPEC §13 open item (non-trivial without core edits, tracked there).
export async function reconcileCrashedProcesses(db: SupabaseClient): Promise<number> {
  const rows = await getRunningRows(db);
  let reconciled = 0;
  for (const row of rows) {
    if (!isPidAlive(row.pid)) {
      await updateRegistryRow(db, row.customer_id, { status: "failed" });
      reconciled++;
    }
  }
  return reconciled;
}
