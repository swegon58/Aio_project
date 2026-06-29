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

