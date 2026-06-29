import { resolveApproval } from "@/lib/aio/tools/approval-repository";
import type { AioApprovalResolution } from "@/lib/aio/tools/approval-state-machine";
import {
  repoErrorResponse,
  resolveRunApiContext,
  serializeApproval,
} from "@/lib/aio/runs/run-api";

// POST /api/runs/[runId]/approvals/[approvalId]/resolve — the canonical,
// user-driven approval resolution path. Body: { choice: "approve" | "reject" }.
//
// Resolve-once is enforced by the repository: replaying a resolve, or resolving
// after the writer already recorded an approval.responded event, is a safe
// no-op that returns the current row. Resolving past expires_at is rejected
// (409 ALREADY_TERMINAL) and the row is marked expired.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string; approvalId: string }> },
) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;
  const { approvalId } = await params;

  let body: { choice?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  // Minimal resolution surface for R2.3. once/session/always scoping is added
  // in R2.5; "edit" via API (with edited input) is deferred to the approval UI.
  let resolution: AioApprovalResolution;
  if (body.choice === "approve") {
    resolution = "approve";
  } else if (body.choice === "reject") {
    resolution = "reject";
  } else {
    return Response.json(
      {
        error: "bad_request",
        message: 'choice must be "approve" or "reject".',
      },
      { status: 400 },
    );
  }

  const result = await resolveApproval(db, approvalId, userId, {
    resolution,
    resolvedBy: userId,
  });
  if (!result.ok) return repoErrorResponse(result);

  return Response.json({ approval: serializeApproval(result.data) });
}
