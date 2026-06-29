import { ALL_GATEABLE_TOOLSETS, type PlanTier, TIERS } from "@/lib/hermes/pricing";

export type AioToolRisk = "safe" | "guarded" | "dangerous";

export type AioToolApprovalMode = "none" | "once" | "session";

export type AioToolCategory =
  | "base"
  | "toolset"
  | "provider"
  | "integration";

export type AioToolOwner =
  | "aio-web"
  | "hermes-gateway"
  | "lmstudio"
  | "honcho"
  | "kie";

export type AioToolDataClass =
  | "conversation_context"
  | "workspace_files"
  | "browser_session"
  | "public_web"
  | "images_user"
  | "memory_private"
  | "credentials"
  | "schedule_metadata"
  | "provider_usage";

export type AioNetworkScope =
  | "none"
  | "local_only"
  | "provider_only"
  | "public_web"
  | "tenant_configured_targets";

export interface AioToolSideEffects {
  reads: Array<"local" | "remote" | "provider" | "memory">;
  writes: Array<"local" | "remote" | "provider" | "memory">;
  externalWrites: boolean;
}

export interface AioToolRetryPolicy {
  maxAttempts: number;
  backoff: "none" | "fixed" | "exponential";
}

export interface AioToolApprovalPolicy {
  defaultMode: AioToolApprovalMode;
  sessionScopeAllowed: boolean;
  alwaysScopeAllowed: boolean;
  rationale: string;
}

export interface AioToolManifestEntry {
  canonicalName: string;
  version: number;
  displayLabel: string;
  category: AioToolCategory;
  owner: AioToolOwner;
  inputSchema: string;
  outputSchema: string;
  sideEffects: AioToolSideEffects;
  dataClasses: AioToolDataClass[];
  networkScope: AioNetworkScope;
  timeoutMs: number;
  retryPolicy: AioToolRetryPolicy;
  risk: AioToolRisk;
  approvalPolicy: AioToolApprovalPolicy;
  planAvailability: PlanTier[];
  notes: string;
}

const ALL_PLANS: PlanTier[] = ["starter", "pro", "business"];

export const AIO_TOOL_MANIFEST_VERSION = 1;

export const AIO_TOOL_MANIFEST: AioToolManifestEntry[] = [
  {
    canonicalName: "file",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Workspace Files",
    category: "base",
    owner: "hermes-gateway",
    inputSchema: "path, operation, optional content payload",
    outputSchema: "redacted file metadata, optional text preview",
    sideEffects: {
      reads: ["local"],
      writes: ["local"],
      externalWrites: false,
    },
    dataClasses: ["workspace_files"],
    networkScope: "none",
    timeoutMs: 30_000,
    retryPolicy: { maxAttempts: 1, backoff: "none" },
    risk: "dangerous",
    approvalPolicy: {
      defaultMode: "once",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "File mutation can destroy or expose user workspace data.",
    },
    planAvailability: ALL_PLANS,
    notes: "Base infra tool; always available and never tier-gated.",
  },
  {
    canonicalName: "terminal",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Terminal Sandbox",
    category: "base",
    owner: "hermes-gateway",
    inputSchema: "command, cwd, timeout, sandbox execution hints",
    outputSchema: "stdout, stderr, exit code, structured status",
    sideEffects: {
      reads: ["local"],
      writes: ["local"],
      externalWrites: false,
    },
    dataClasses: ["workspace_files"],
    networkScope: "none",
    timeoutMs: 120_000,
    retryPolicy: { maxAttempts: 1, backoff: "none" },
    risk: "dangerous",
    approvalPolicy: {
      defaultMode: "once",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "Shell execution can mutate local state even with outbound network blocked.",
    },
    planAvailability: ALL_PLANS,
    notes: "Current Daytona sandbox sets daytona_network_block_all=true on every spawn.",
  },
  {
    canonicalName: "clarify",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Clarify / Plan Mode",
    category: "toolset",
    owner: "aio-web",
    inputSchema: "question prompt and answer options",
    outputSchema: "selected answer or skip signal",
    sideEffects: {
      reads: ["local"],
      writes: [],
      externalWrites: false,
    },
    dataClasses: ["conversation_context"],
    networkScope: "none",
    timeoutMs: 300_000,
    retryPolicy: { maxAttempts: 1, backoff: "none" },
    risk: "safe",
    approvalPolicy: {
      defaultMode: "none",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "This is an in-product question loop, not an external action.",
    },
    planAvailability: ALL_PLANS,
    notes: "Enabled explicitly for api_server because Aio uses plan-confirmation flows.",
  },
  {
    canonicalName: "todo",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Task Tracking",
    category: "toolset",
    owner: "hermes-gateway",
    inputSchema: "task list create/update payload",
    outputSchema: "task state summary",
    sideEffects: {
      reads: ["local"],
      writes: ["local"],
      externalWrites: false,
    },
    dataClasses: ["conversation_context"],
    networkScope: "none",
    timeoutMs: 10_000,
    retryPolicy: { maxAttempts: 1, backoff: "none" },
    risk: "safe",
    approvalPolicy: {
      defaultMode: "none",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "Internal planning state is user-visible but not destructive outside the run.",
    },
    planAvailability: ALL_PLANS,
    notes: "Used for task decomposition and progress tracking.",
  },
  {
    canonicalName: "web",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Web Search",
    category: "toolset",
    owner: "hermes-gateway",
    inputSchema: "query, optional source filters",
    outputSchema: "citations, snippets, extracted results",
    sideEffects: {
      reads: ["remote"],
      writes: [],
      externalWrites: false,
    },
    dataClasses: ["public_web", "provider_usage"],
    networkScope: "public_web",
    timeoutMs: 45_000,
    retryPolicy: { maxAttempts: 2, backoff: "fixed" },
    risk: "safe",
    approvalPolicy: {
      defaultMode: "none",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "Public-web retrieval is a core product capability and does not mutate external state.",
    },
    planAvailability: ALL_PLANS,
    notes: "Consumer-facing research path; source citation remains mandatory in research UX.",
  },
  {
    canonicalName: "code_execution",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Code Execution",
    category: "toolset",
    owner: "hermes-gateway",
    inputSchema: "script or notebook-like execution request",
    outputSchema: "logs, artifacts, execution status",
    sideEffects: {
      reads: ["local"],
      writes: ["local"],
      externalWrites: false,
    },
    dataClasses: ["workspace_files", "conversation_context"],
    networkScope: "none",
    timeoutMs: 180_000,
    retryPolicy: { maxAttempts: 1, backoff: "none" },
    risk: "dangerous",
    approvalPolicy: {
      defaultMode: "once",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "Execution can create or modify local artifacts and spend compute budget.",
    },
    planAvailability: ["pro", "business"],
    notes: "Network is still blocked at the terminal layer to prevent provider bypass.",
  },
  {
    canonicalName: "browser",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Browser Automation",
    category: "toolset",
    owner: "hermes-gateway",
    inputSchema: "URL, action sequence, extraction instructions",
    outputSchema: "page state, screenshots, extracted data",
    sideEffects: {
      reads: ["remote"],
      writes: ["remote"],
      externalWrites: true,
    },
    dataClasses: ["browser_session", "public_web", "credentials"],
    networkScope: "tenant_configured_targets",
    timeoutMs: 180_000,
    retryPolicy: { maxAttempts: 1, backoff: "none" },
    risk: "dangerous",
    approvalPolicy: {
      defaultMode: "once",
      sessionScopeAllowed: true,
      alwaysScopeAllowed: false,
      rationale: "Automation can submit forms or click through logged-in flows on user-connected sites.",
    },
    planAvailability: ["pro", "business"],
    notes: "Read-only browsing and mutating browser flows should be separated in R2.2/R2.3 snapshots.",
  },
  {
    canonicalName: "vision",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Vision",
    category: "toolset",
    owner: "hermes-gateway",
    inputSchema: "image or screenshot reference",
    outputSchema: "caption, extraction, scene understanding",
    sideEffects: {
      reads: ["local", "remote"],
      writes: [],
      externalWrites: false,
    },
    dataClasses: ["images_user", "browser_session"],
    networkScope: "provider_only",
    timeoutMs: 45_000,
    retryPolicy: { maxAttempts: 2, backoff: "fixed" },
    risk: "guarded",
    approvalPolicy: {
      defaultMode: "none",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "Reads user images but does not mutate external state.",
    },
    planAvailability: ["pro", "business"],
    notes: "Image payloads should remain redacted or transformed before durable storage.",
  },
  {
    canonicalName: "memory",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Persistent Memory",
    category: "toolset",
    owner: "honcho",
    inputSchema: "fact extraction or retrieval query",
    outputSchema: "memory facts, summary, retrieval metadata",
    sideEffects: {
      reads: ["memory"],
      writes: ["memory"],
      externalWrites: false,
    },
    dataClasses: ["memory_private", "conversation_context"],
    networkScope: "local_only",
    timeoutMs: 20_000,
    retryPolicy: { maxAttempts: 2, backoff: "fixed" },
    risk: "guarded",
    approvalPolicy: {
      defaultMode: "none",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "Touches private user memory but remains inside Aio-owned storage.",
    },
    planAvailability: ["pro", "business"],
    notes: "Current config points to Honcho; production permission model for memory writes is still pending.",
  },
  {
    canonicalName: "delegation",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Task Delegation",
    category: "toolset",
    owner: "hermes-gateway",
    inputSchema: "subtask goal, optional toolset scope",
    outputSchema: "subtask result and trace metadata",
    sideEffects: {
      reads: ["local", "remote"],
      writes: ["local"],
      externalWrites: false,
    },
    dataClasses: ["conversation_context", "provider_usage"],
    networkScope: "provider_only",
    timeoutMs: 120_000,
    retryPolicy: { maxAttempts: 1, backoff: "none" },
    risk: "guarded",
    approvalPolicy: {
      defaultMode: "none",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "Expands cost/scope but should still inherit child-tool approval rules separately.",
    },
    planAvailability: ["pro", "business"],
    notes: "Needs durable child-run linkage before broad consumer exposure.",
  },
  {
    canonicalName: "image_gen",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Image Generation",
    category: "toolset",
    owner: "kie",
    inputSchema: "prompt, aspect ratio, optional reference inputs",
    outputSchema: "generated image artifact and provider job metadata",
    sideEffects: {
      reads: ["provider"],
      writes: ["provider"],
      externalWrites: true,
    },
    dataClasses: ["images_user", "provider_usage"],
    networkScope: "provider_only",
    timeoutMs: 180_000,
    retryPolicy: { maxAttempts: 2, backoff: "fixed" },
    risk: "guarded",
    approvalPolicy: {
      defaultMode: "none",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "User-initiated generation is a primary product action, but costs and prompts must be auditable.",
    },
    planAvailability: ["business"],
    notes: "Current configured provider is Kie with model gpt-image-2-text-to-image.",
  },
  {
    canonicalName: "video_gen",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Video Generation",
    category: "toolset",
    owner: "hermes-gateway",
    inputSchema: "prompt, duration, format, optional reference media",
    outputSchema: "video artifact and provider job metadata",
    sideEffects: {
      reads: ["provider"],
      writes: ["provider"],
      externalWrites: true,
    },
    dataClasses: ["images_user", "provider_usage"],
    networkScope: "provider_only",
    timeoutMs: 300_000,
    retryPolicy: { maxAttempts: 2, backoff: "fixed" },
    risk: "guarded",
    approvalPolicy: {
      defaultMode: "none",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "High-cost creation path, but still a user-requested media operation rather than an external side effect on third-party data.",
    },
    planAvailability: ["business"],
    notes: "Provider routing is not yet productized in Aio UI.",
  },
  {
    canonicalName: "cronjob",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Scheduled Tasks",
    category: "toolset",
    owner: "hermes-gateway",
    inputSchema: "schedule, prompt, optional enabled toolsets",
    outputSchema: "job id, next run, scheduler status",
    sideEffects: {
      reads: ["local", "remote"],
      writes: ["local", "remote"],
      externalWrites: true,
    },
    dataClasses: ["schedule_metadata", "provider_usage", "credentials"],
    networkScope: "tenant_configured_targets",
    timeoutMs: 60_000,
    retryPolicy: { maxAttempts: 1, backoff: "none" },
    risk: "dangerous",
    approvalPolicy: {
      defaultMode: "once",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "Creates autonomous future actions, so it must never be silently enabled.",
    },
    planAvailability: ["business"],
    notes: "Current API gating exists, but Aio-owned durable queueing lands in R5.",
  },
  {
    canonicalName: "tts",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Text-to-Speech",
    category: "toolset",
    owner: "hermes-gateway",
    inputSchema: "text, voice, output format",
    outputSchema: "audio artifact and provider metadata",
    sideEffects: {
      reads: ["provider"],
      writes: ["provider"],
      externalWrites: true,
    },
    dataClasses: ["conversation_context", "provider_usage"],
    networkScope: "provider_only",
    timeoutMs: 60_000,
    retryPolicy: { maxAttempts: 2, backoff: "fixed" },
    risk: "guarded",
    approvalPolicy: {
      defaultMode: "none",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "Media rendering is user-facing output, not a third-party state mutation.",
    },
    planAvailability: ["business"],
    notes: "No public TTS workflow is exposed in Aio yet.",
  },
  {
    canonicalName: "skills",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Skills Catalog",
    category: "toolset",
    owner: "hermes-gateway",
    inputSchema: "skill selector and skill-specific parameters",
    outputSchema: "skill output, optional files/artifacts",
    sideEffects: {
      reads: ["local", "remote", "provider", "memory"],
      writes: ["local", "memory"],
      externalWrites: false,
    },
    dataClasses: ["conversation_context", "workspace_files", "memory_private", "public_web"],
    networkScope: "tenant_configured_targets",
    timeoutMs: 120_000,
    retryPolicy: { maxAttempts: 1, backoff: "none" },
    risk: "guarded",
    approvalPolicy: {
      defaultMode: "none",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "A skill is a wrapper; the underlying tool call still determines final approval requirements.",
    },
    planAvailability: ALL_PLANS,
    notes: "Skill wrappers should inherit the stricter policy of the concrete tool they invoke.",
  },
  {
    canonicalName: "mcp",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "MCP Integrations",
    category: "integration",
    owner: "hermes-gateway",
    inputSchema: "server selection, method, arguments",
    outputSchema: "tool result, server metadata, audit fields",
    sideEffects: {
      reads: ["remote", "provider"],
      writes: ["remote", "provider"],
      externalWrites: true,
    },
    dataClasses: ["credentials", "conversation_context", "provider_usage"],
    networkScope: "tenant_configured_targets",
    timeoutMs: 60_000,
    retryPolicy: { maxAttempts: 1, backoff: "none" },
    risk: "dangerous",
    approvalPolicy: {
      defaultMode: "once",
      sessionScopeAllowed: true,
      alwaysScopeAllowed: false,
      rationale: "MCP can bridge into third-party systems, so allowlisting and approval are mandatory.",
    },
    planAvailability: ["business"],
    notes: "R2.6 will add allowlisted catalogs, tenant binding, and audit metadata.",
  },
  {
    canonicalName: "connected_apps",
    version: AIO_TOOL_MANIFEST_VERSION,
    displayLabel: "Connected App Credentials",
    category: "integration",
    owner: "aio-web",
    inputSchema: "credential create/update/delete request",
    outputSchema: "redacted connection state",
    sideEffects: {
      reads: ["provider"],
      writes: ["provider"],
      externalWrites: true,
    },
    dataClasses: ["credentials"],
    networkScope: "tenant_configured_targets",
    timeoutMs: 60_000,
    retryPolicy: { maxAttempts: 1, backoff: "none" },
    risk: "dangerous",
    approvalPolicy: {
      defaultMode: "once",
      sessionScopeAllowed: false,
      alwaysScopeAllowed: false,
      rationale: "Credential changes are explicitly listed as mandatory-approval actions in R2.",
    },
    planAvailability: ALL_PLANS,
    notes: "Applies to registry-backed connection changes, not passive token display.",
  },
];

export const AIO_TOOL_MANIFEST_BY_NAME = new Map(
  AIO_TOOL_MANIFEST.map((entry) => [entry.canonicalName, entry] as const),
);

export const AIO_TOOLSET_NAMES = ALL_GATEABLE_TOOLSETS as readonly string[];

export function getAioToolManifestEntry(name: string): AioToolManifestEntry | null {
  return AIO_TOOL_MANIFEST_BY_NAME.get(name) ?? null;
}

export function getPlanAvailableTools(plan: PlanTier): AioToolManifestEntry[] {
  return AIO_TOOL_MANIFEST.filter((entry) => entry.planAvailability.includes(plan));
}

export function getTierUnlockedToolsets(plan: PlanTier): string[] {
  return [...tierToolsetList(plan)];
}

function tierToolsetList(plan: PlanTier): readonly string[] {
  return TIERS[plan].toolsets;
}

