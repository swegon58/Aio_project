import type { HermesUIMessage, AioGeneratedImage } from "@/lib/hermes/chat-types";
import { persistConversation } from "@/lib/aio/chat/conversation-persistence";
import {
  generateKieImage,
  validateImageOptions,
} from "@/lib/aio/images/kie-client";
import {
  createGalleryImageSignedUrl,
  persistGeneratedImage,
} from "@/lib/aio/images/image-storage";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { resolveProfileSecret } from "@/lib/hermes/profile-secrets";
import { readCredentialFromVault } from "@/lib/hermes/registry";

export const runtime = "nodejs";
export const maxDuration = 300;

const ESTIMATED_COST_USD = {
  "1K": 0.03,
  "2K": 0.05,
  "4K": 0.08,
} as const;

interface GenerateImageBody {
  prompt?: unknown;
  aspectRatio?: unknown;
  resolution?: unknown;
  referenceImageId?: unknown;
  messages?: unknown;
}

function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Image generation failed.";
  return Response.json({ error: "image_generation_failed", message }, { status });
}

export async function POST(req: Request) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { db, userId, row, hermesSessionId, threadId } = ctxResult.ctx;

  const body = (await req.json().catch(() => null)) as GenerateImageBody | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return errorResponse(new Error("Describe the image you want to create."), 400);
  if (prompt.length > 20_000) return errorResponse(new Error("Image prompts are limited to 20,000 characters."), 400);

  let options: ReturnType<typeof validateImageOptions>;
  try {
    options = validateImageOptions(
      typeof body?.aspectRatio === "string" ? body.aspectRatio : "1:1",
      typeof body?.resolution === "string" ? body.resolution : "1K",
    );
  } catch (error) {
    return errorResponse(error, 400);
  }

  const messages = Array.isArray(body?.messages)
    ? (body.messages.slice(-100) as HermesUIMessage[])
    : [];

  let apiKey = await resolveProfileSecret(row.profile_name, "KIE_API_KEY");
  if (!apiKey) {
    try {
      apiKey = await readCredentialFromVault(db, userId, "KIE_API_KEY");
    } catch {
      apiKey = null;
    }
  }
  if (!apiKey) {
    return errorResponse(
      new Error("KIE_API_KEY is not configured for this Aio profile."),
      503,
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        write({ type: "status", status: "preparing" });
        const referenceUrls = typeof body?.referenceImageId === "string" && body.referenceImageId
          ? [
              await createGalleryImageSignedUrl({
                db,
                userId,
                imageId: body.referenceImageId,
              }),
            ]
          : [];
        const generated = await generateKieImage({
          apiKey,
          prompt,
          aspectRatio: options.aspectRatio,
          resolution: options.resolution,
          referenceUrls,
          signal: req.signal,
          onStatus: () => write({ type: "status", status: "generating" }),
        });
        write({ type: "status", status: "saving" });
        const stored = await persistGeneratedImage({
          db,
          userId,
          sessionId: hermesSessionId,
          sourceUrl: generated.imageUrl,
          caption: prompt,
        });
        const image: AioGeneratedImage = {
          ...stored,
          prompt,
          aspectRatio: options.aspectRatio,
          resolution: options.resolution,
          model: generated.model,
          provider: "kie",
          estimatedCostUsd: ESTIMATED_COST_USD[options.resolution],
        };

        await persistConversation(
          db,
          userId,
          threadId,
          messages,
          "Your image is ready.",
          "auto",
          [],
          [],
          undefined,
          [image],
        );
        write({ type: "result", image, threadId });
      } catch (error) {
        const message = req.signal.aborted
          ? "Image generation was cancelled."
          : error instanceof Error
            ? error.message
            : "Image generation failed.";
        if (!req.signal.aborted) console.error("Kie image generation failed:", message);
        write({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
