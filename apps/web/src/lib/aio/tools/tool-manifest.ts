import type { PlanTier } from "@/lib/hermes/pricing";
import { TIERS } from "@/lib/hermes/pricing";
import {
  AIO_TOOL_MANIFEST,
  AIO_TOOL_MANIFEST_BY_NAME,
  AIO_TOOL_MANIFEST_VERSION,
  AIO_TOOLSET_NAMES,
  type AioToolApprovalMode,
  type AioToolApprovalPolicy,
  type AioToolCategory,
  type AioToolDataClass,
  type AioToolManifestEntry,
  type AioNetworkScope,
  type AioToolOwner,
  type AioToolRetryPolicy,
  type AioToolRisk,
  type AioToolSideEffects,
} from "./tool-metadata-constants";

// Re-export all types for consumer compatibility
export type {
  AioToolApprovalMode,
  AioToolApprovalPolicy,
  AioToolCategory,
  AioToolDataClass,
  AioToolManifestEntry,
  AioNetworkScope,
  AioToolOwner,
  AioToolRetryPolicy,
  AioToolRisk,
  AioToolSideEffects,
};

// Re-export constants for consumer compatibility
export {
  AIO_TOOL_MANIFEST,
  AIO_TOOL_MANIFEST_BY_NAME,
  AIO_TOOL_MANIFEST_VERSION,
  AIO_TOOLSET_NAMES,
};

// Logic functions (remain in this file)
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

