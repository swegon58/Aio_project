const FAL_QUEUE_BASE = "https://queue.fal.run";
const FAL_MODEL_TEXT_TO_IMAGE = "openai/gpt-image-2";
const FAL_MODEL_EDIT = "openai/gpt-image-2/edit";
const POLL_INTERVAL_MS = 2_500;
const TASK_TIMEOUT_MS = 4 * 60_000;

export const FAL_ASPECT_RATIOS = [
  "auto",
  "1:1",
  "3:2",
  "2:3",
  "4:3",
  "3:4",
  "5:4",
  "4:5",
  "16:9",
  "9:16",
  "2:1",
  "1:2",
  "3:1",
  "1:3",
  "21:9",
  "9:21",
] as const;

export const FAL_RESOLUTIONS = ["1K", "2K", "4K"] as const;

export type FalAspectRatio = (typeof FAL_ASPECT_RATIOS)[number];
export type FalResolution = (typeof FAL_RESOLUTIONS)[number];

// Long edge (px) per product resolution tier. 4K = fal's documented max edge (3840px).
const RESOLUTION_LONG_EDGE: Record<FalResolution, number> = {
  "1K": 1024,
  "2K": 2048,
  "4K": 3840,
};

function providerError(message: string, status?: number): Error {
  const suffix = status ? ` (${status})` : "";
  return new Error(`Fal image generation failed${suffix}: ${message}`);
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & { detail?: unknown; message?: string })
    | null;
  if (!response.ok || !payload) {
    const detail =
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.detail === "string"
          ? payload.detail
          : "Unexpected provider response";
    throw providerError(detail, response.status);
  }
  return payload;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const handleAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", handleAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

export function validateImageOptions(
  aspectRatio: string,
  resolution: string,
): { aspectRatio: FalAspectRatio; resolution: FalResolution } {
  if (!FAL_ASPECT_RATIOS.includes(aspectRatio as FalAspectRatio)) {
    throw new Error("Unsupported aspect ratio.");
  }
  if (!FAL_RESOLUTIONS.includes(resolution as FalResolution)) {
    throw new Error("Unsupported image resolution.");
  }
  if (aspectRatio === "auto" && resolution !== "1K") {
    throw new Error("Auto aspect ratio is available at 1K resolution only.");
  }
  if (aspectRatio === "1:1" && resolution === "4K") {
    throw new Error("Square images are not available at 4K resolution.");
  }
  return {
    aspectRatio: aspectRatio as FalAspectRatio,
    resolution: resolution as FalResolution,
  };
}

// ponytail: fal has no resolution tier — it takes custom {width,height} (mult. of 16)
// or a named preset. We derive pixel dims from the kie-era ratio+tier product contract
// so pricing/UI stay unchanged; only the provider call underneath moved.
function toImageSize(
  aspectRatio: FalAspectRatio,
  resolution: FalResolution,
): "auto" | { width: number; height: number } {
  if (aspectRatio === "auto") return "auto";
  const [wRatio, hRatio] = aspectRatio.split(":").map(Number);
  const longEdge = RESOLUTION_LONG_EDGE[resolution];
  const roundTo16 = (n: number) => Math.max(16, Math.round(n / 16) * 16);
  if (wRatio === hRatio) return { width: longEdge, height: longEdge };
  return wRatio > hRatio
    ? { width: longEdge, height: roundTo16((longEdge * hRatio) / wRatio) }
    : { width: roundTo16((longEdge * wRatio) / hRatio), height: longEdge };
}

interface FalSubmitResponse {
  request_id?: string;
  status_url?: string;
  response_url?: string;
}

interface FalStatusResponse {
  status?: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
}

interface FalResultResponse {
  images?: Array<{ url?: string }>;
}

export async function generateFalImage(args: {
  apiKey: string;
  prompt: string;
  aspectRatio: FalAspectRatio;
  resolution: FalResolution;
  referenceUrls?: string[];
  signal?: AbortSignal;
  onStatus?: (status: "generating") => void;
}): Promise<{ taskId: string; imageUrl: string; model: string }> {
  const referenceUrls = (args.referenceUrls ?? []).slice(0, 16);
  const model = referenceUrls.length ? FAL_MODEL_EDIT : FAL_MODEL_TEXT_TO_IMAGE;

  const submitResponse = await fetch(`${FAL_QUEUE_BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: args.prompt,
      image_size: toImageSize(args.aspectRatio, args.resolution),
      output_format: "png",
      num_images: 1,
      ...(referenceUrls.length ? { image_urls: referenceUrls } : {}),
    }),
    signal: args.signal,
  });
  const submitted = await readJson<FalSubmitResponse>(submitResponse);
  const taskId = submitted.request_id;
  const statusUrl = submitted.status_url;
  const responseUrl = submitted.response_url;
  if (!taskId || !statusUrl || !responseUrl) {
    throw providerError("Provider did not return queue URLs.");
  }
  args.onStatus?.("generating");

  const deadline = Date.now() + TASK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS, args.signal);

    const statusResponse = await fetch(statusUrl, {
      headers: { Authorization: `Key ${args.apiKey}` },
      signal: args.signal,
    });
    const status = await readJson<FalStatusResponse>(statusResponse);
    if (status.status !== "COMPLETED") continue;

    const resultResponse = await fetch(responseUrl, {
      headers: { Authorization: `Key ${args.apiKey}` },
      signal: args.signal,
    });
    const result = await readJson<FalResultResponse>(resultResponse);
    const imageUrl = result.images?.find((img) => typeof img?.url === "string")?.url;
    if (!imageUrl) throw providerError("Completed task did not include an image URL.");
    return { taskId, imageUrl, model };
  }

  throw providerError("Task timed out.");
}
