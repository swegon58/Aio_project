// R2.6 — Typed audit event builders.
// Each builder returns an AuditEntry ready for recordAuditEntry. They redact
// anything that should not appear in an audit trail (raw prompts, secrets,
// full payloads). Only stable identifiers and outcome metadata are recorded.
import type { AuditEntry, AuditCategory, AuditOutcome } from "./audit-log";

function entry(
  userId: string,
  eventType: string,
  category: AuditCategory,
  fields: Omit<AuditEntry, "userId" | "eventType" | "category">,
): AuditEntry {
  return { userId, eventType, category, ...fields };
}

// ---------------------------------------------------------------------------
// Approval lifecycle (R2.5 policy categories)
// ---------------------------------------------------------------------------

export function auditApprovalRequested(
  userId: string,
  opts: { runId: string; approvalId: string; toolCallId?: string; riskLevel?: string },
): AuditEntry {
  return entry(userId, "approval.requested", "approval", {
    runId: opts.runId,
    approvalId: opts.approvalId,
    toolCallId: opts.toolCallId ?? null,
    context: { riskLevel: opts.riskLevel ?? "unknown" },
    outcome: "unknown",
  });
}

export function auditApprovalResolved(
  userId: string,
  opts: { runId?: string; approvalId: string; resolution: string; resolvedBy: string },
): AuditEntry {
  const outcome: AuditOutcome =
    opts.resolution === "approve" ? "success"
    : opts.resolution === "reject" ? "denied"
    : opts.resolution === "expire" ? "expired"
    : "unknown";
  return entry(userId, "approval.resolved", "approval", {
    runId: opts.runId ?? null,
    approvalId: opts.approvalId,
    context: { resolution: opts.resolution, resolvedBy: opts.resolvedBy },
    outcome,
  });
}

export function auditApprovalExpired(
  userId: string,
  opts: { approvalId: string; runId?: string },
): AuditEntry {
  return entry(userId, "approval.expired", "approval", {
    runId: opts.runId ?? null,
    approvalId: opts.approvalId,
    context: {},
    outcome: "expired",
  });
}

export function auditApprovalConflict(
  userId: string,
  opts: { approvalId: string; attempted: string },
): AuditEntry {
  return entry(userId, "approval.conflict", "approval", {
    approvalId: opts.approvalId,
    context: { attempted: opts.attempted },
    outcome: "conflict",
  });
}

// ---------------------------------------------------------------------------
// Dangerous tool execution
// ---------------------------------------------------------------------------

export function auditDangerousToolStarted(
  userId: string,
  opts: { runId: string; toolCallId: string; toolName: string; approvalId?: string },
): AuditEntry {
  return entry(userId, "tool.dangerous.started", "tool_execution", {
    runId: opts.runId,
    toolCallId: opts.toolCallId,
    approvalId: opts.approvalId ?? null,
    context: { toolName: opts.toolName },
    outcome: "unknown",
  });
}

export function auditDangerousToolCompleted(
  userId: string,
  opts: { runId: string; toolCallId: string; toolName: string; success: boolean },
): AuditEntry {
  return entry(userId, "tool.dangerous.completed", "tool_execution", {
    runId: opts.runId,
    toolCallId: opts.toolCallId,
    context: { toolName: opts.toolName },
    outcome: opts.success ? "success" : "error",
  });
}

// ---------------------------------------------------------------------------
// MCP boundary
// ---------------------------------------------------------------------------

export function auditMcpServerEnabled(
  userId: string,
  opts: { serverName: string; tenantId?: string },
): AuditEntry {
  return entry(userId, "mcp.server.enabled", "mcp", {
    context: { serverName: opts.serverName, tenantId: opts.tenantId ?? null },
    outcome: "success",
  });
}

export function auditMcpToolCall(
  userId: string,
  opts: { runId?: string; serverName: string; toolName: string; outcome: AuditOutcome },
): AuditEntry {
  return entry(userId, "mcp.tool.called", "mcp", {
    runId: opts.runId ?? null,
    context: { serverName: opts.serverName, toolName: opts.toolName },
    outcome: opts.outcome,
  });
}

// ---------------------------------------------------------------------------
// Credential lifecycle
// ---------------------------------------------------------------------------

export function auditCredentialAccessed(
  userId: string,
  opts: { credentialRef: string; purpose: string; runId?: string },
): AuditEntry {
  return entry(userId, "credential.accessed", "credential", {
    runId: opts.runId ?? null,
    context: { credentialRef: opts.credentialRef, purpose: opts.purpose },
    outcome: "success",
  });
}

export function auditCredentialChanged(
  userId: string,
  opts: { credentialRef: string; action: "create" | "update" | "delete" },
): AuditEntry {
  return entry(userId, "credential.changed", "credential", {
    context: { credentialRef: opts.credentialRef, action: opts.action },
    outcome: "success",
  });
}
