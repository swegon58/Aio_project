import type { UIMessageStreamWriter } from "ai";
import type { HermesUIMessage } from "@/lib/hermes/chat-types";

interface CreditSnapshotInput {
  runId: string;
  balance: number;
  usedPercent?: number;
  resetAt?: string;
  planTier?: string;
}

export function writeCreditSnapshot(
  writer: UIMessageStreamWriter<HermesUIMessage>,
  snapshot: CreditSnapshotInput,
) {
  // TODO: Rename data-hermes-credits to an Aio-native stream part after the
  // current chat UI no longer depends on the legacy name.
  writer.write({
    type: "data-hermes-credits",
    id: `${snapshot.runId}:credits`,
    data: {
      balance: snapshot.balance,
      usedPercent: snapshot.usedPercent,
      resetAt: snapshot.resetAt,
      planTier: snapshot.planTier,
    },
  });
}
