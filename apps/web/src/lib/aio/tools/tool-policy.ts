import type { PlanTier } from "@/lib/hermes/pricing";
import {
  AIO_TOOLSET_NAMES,
  getAioToolManifestEntry,
  type AioToolApprovalMode,
  type AioToolManifestEntry,
} from "./tool-manifest";

export interface AioResolvedToolPolicy {
  tool: AioToolManifestEntry;
  available: boolean;
  reason: string;
  defaultApprovalMode: AioToolApprovalMode;
  requiresApproval: boolean;
}

const BASE_ALWAYS_ON_TOOLS = new Set(["file", "terminal"]);

export function resolveAioToolPolicy(
  canonicalName: string,
  planTier: PlanTier,
): AioResolvedToolPolicy | null {
  const tool = getAioToolManifestEntry(canonicalName);
  if (!tool) return null;

  const available = isToolAvailableForPlan(canonicalName, planTier, tool);

  return {
    tool,
    available,
    reason: available
      ? "Available for this plan"
      : `${tool.displayLabel} is not unlocked on the ${planTier} plan`,
    defaultApprovalMode: tool.approvalPolicy.defaultMode,
    requiresApproval: tool.approvalPolicy.defaultMode !== "none",
  };
}

export function isToolAvailableForPlan(
  canonicalName: string,
  planTier: PlanTier,
  tool = getAioToolManifestEntry(canonicalName),
): boolean {
  if (!tool) return false;
  if (BASE_ALWAYS_ON_TOOLS.has(canonicalName)) return true;
  return tool.planAvailability.includes(planTier);
}

export function getMandatoryApprovalToolNames(): string[] {
  return Array.from(
    new Set(
      AIO_TOOLSET_NAMES.filter((name) => {
        const tool = getAioToolManifestEntry(name);
        return tool?.approvalPolicy.defaultMode === "once" || tool?.approvalPolicy.defaultMode === "session";
      }).concat(["file", "terminal", "mcp", "connected_apps"]),
    ),
  ).sort();
}

export function getSafeToolNames(): string[] {
  return Array.from(
    new Set(
      AIO_TOOLSET_NAMES.filter((name) => getAioToolManifestEntry(name)?.risk === "safe"),
    ),
  ).sort();
}

/**
 * R2.5 — Mandatory approval categories from the policy spec.
 *
 * Maps each high-level category to the canonical tool names that cover it.
 * Enforcement is declared in the manifest (`approvalPolicy.defaultMode !== "none"`);
 * this table is the normative reference for audits and tests.
 */
export const MANDATORY_APPROVAL_CATEGORIES: Record<string, string[]> = {
  "destructive-file-or-database-action": ["file"],
  "shell-command": ["terminal"],
  "code-execution": ["code_execution"],
  "external-write-or-message": ["connected_apps"],
  "deploy-or-infrastructure-mutation": ["cronjob"],
  "credential-creation-or-change": ["connected_apps"],
  "mcp-call": ["mcp"],
  "browser-automation": ["browser"],
};

/**
 * Returns true if the given canonical tool name falls under any mandatory
 * approval category from the R2.5 policy spec.
 */
export function requiresMandatoryApproval(canonicalName: string): boolean {
  const entry = getAioToolManifestEntry(canonicalName);
  if (!entry) return false;
  return entry.approvalPolicy.defaultMode !== "none" && entry.risk !== "safe";
}

