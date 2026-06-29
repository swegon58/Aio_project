// R4.3 — Research pipeline stage definitions and progress tracking.
//
// The actual LLM/tool calls happen inside Hermes. This module defines the
// stage contract, builds stage events for the UI, and persists source/claim
// rows as a best-effort append. The orchestrator calls recordResearchStage
// each time Hermes emits a research.stage-type tool event.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResearchStage, ResearchStageEvent } from "@/lib/aio/runs/aio-run-events";

export const RESEARCH_STAGES: { stage: ResearchStage; index: number; label: string }[] = [
  { stage: "understand", index: 1, label: "Understanding the question" },
  { stage: "plan",       index: 2, label: "Creating research plan" },
  { stage: "discover",   index: 3, label: "Discovering sources" },
  { stage: "inspect",    index: 4, label: "Reading sources" },
  { stage: "synthesize", index: 5, label: "Synthesizing findings" },
  { stage: "verify",     index: 6, label: "Verifying claims" },
  { stage: "report",     index: 7, label: "Writing report" },
];

export function buildResearchStageEvent(
  runId: string,
  stage: ResearchStage,
  opts: { sourceCount?: number; claimCount?: number } = {},
): ResearchStageEvent {
  const def = RESEARCH_STAGES.find((s) => s.stage === stage);
  if (!def) throw new Error(`Unknown research stage: ${stage}`);
  return {
    type: "research.stage",
    runId,
    stage,
    stageIndex: def.index,
    totalStages: 7,
    sourceCount: opts.sourceCount,
    claimCount: opts.claimCount,
    label: def.label,
    createdAt: new Date().toISOString(),
  };
}

export interface ResearchSourceInput {
  url: string;
  title?: string;
  contentHash?: string;
  sourceType?: "web" | "knowledge_doc" | "provided";
  relevanceScore?: number;
  fetchedAt?: string;
}

/** Append a research source row. Best-effort — logs on failure, never throws. */
export async function recordResearchSource(
  db: SupabaseClient,
  runId: string,
  userId: string,
  source: ResearchSourceInput,
): Promise<string | null> {
  try {
    const { data, error } = await db
      .from("aio_research_sources")
      .insert({
        run_id: runId,
        user_id: userId,
        url: source.url,
        title: source.title ?? null,
        content_hash: source.contentHash ?? null,
        source_type: source.sourceType ?? "web",
        relevance_score: source.relevanceScore ?? null,
        fetched_at: source.fetchedAt ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.error(`recordResearchSource(${runId}):`, error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error(`recordResearchSource(${runId}) threw:`, err);
    return null;
  }
}

/** Append a research claim hash. Best-effort — logs on failure, never throws. */
export async function recordResearchClaim(
  db: SupabaseClient,
  runId: string,
  userId: string,
  opts: { claimHash: string; sourceId?: string; verified?: boolean; conflict?: boolean },
): Promise<void> {
  try {
    const { error } = await db.from("aio_research_claims").insert({
      run_id: runId,
      user_id: userId,
      source_id: opts.sourceId ?? null,
      claim_hash: opts.claimHash,
      verified: opts.verified ?? false,
      conflict: opts.conflict ?? false,
    });
    if (error) console.error(`recordResearchClaim(${runId}):`, error.message);
  } catch (err) {
    console.error(`recordResearchClaim(${runId}) threw:`, err);
  }
}

/** Update aio_runs.metadata with the latest research progress fields. Best-effort. */
export async function updateResearchProgress(
  db: SupabaseClient,
  runId: string,
  userId: string,
  progress: {
    stageCompleted: number;
    searchCount?: number;
    claimCount?: number;
    verifiedCount?: number;
    researchPlan?: string;
  },
): Promise<void> {
  try {
    // Read current metadata and merge (jsonb patch pattern).
    const { data: current } = await db
      .from("aio_runs")
      .select("metadata")
      .eq("id", runId)
      .eq("customer_id", userId)
      .single();

    const existing = (current?.metadata as Record<string, unknown>) ?? {};
    const merged = {
      ...existing,
      stage_completed: progress.stageCompleted,
      ...(progress.searchCount !== undefined && { search_count: progress.searchCount }),
      ...(progress.claimCount !== undefined && { claim_count: progress.claimCount }),
      ...(progress.verifiedCount !== undefined && { verified_count: progress.verifiedCount }),
      ...(progress.researchPlan !== undefined && { research_plan: progress.researchPlan }),
    };

    const { error } = await db
      .from("aio_runs")
      .update({ metadata: merged })
      .eq("id", runId)
      .eq("customer_id", userId);

    if (error) console.error(`updateResearchProgress(${runId}):`, error.message);
  } catch (err) {
    console.error(`updateResearchProgress(${runId}) threw:`, err);
  }
}
