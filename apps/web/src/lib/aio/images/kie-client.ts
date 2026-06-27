const KIE_API_BASE = "https://api.kie.ai/api/v1";
const POLL_INTERVAL_MS = 2_500;
const TASK_TIMEOUT_MS = 4 * 60_000;

export const KIE_ASPECT_RATIOS = [
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

export const KIE_RESOLUTIONS = ["1K", "2K", "4K"] as const;

export type KieAspectRatio = (typeof KIE_ASPECT_RATIOS)[number];
export type KieResolution = (typeof KIE_RESOLUTIONS)[number];

interface KieEnvelope<T> {
  code?: number;
  msg?: string;
  data?: T;
}

interface KieTaskRecord {
  taskId?: string;
  state?: string;
  resultJson?: string | Record<string, unknown>;
  failCode?: string;
  failMsg?: string;
}

function providerError(message: string, status?: number): Error {
  const suffix = status ? ` (${status})` : "";
  return new Error(`Kie image generation failed${suffix}: ${message}`);
}

async function readJson<T>(response: Response): Promise<KieEnvelope<T>> {
  const payload = (await response.json().catch(() => null)) as KieEnvelope<T> | null;
  if (!response.ok || !payload || (payload.code != null && payload.code !== 200)) {
    throw providerError(payload?.msg || "Unexpected provider response", response.status);
  }
  return payload;
}

export function validateImageOptions(
  aspectRatio: string,
  resolution: string,
): { aspectRatio: KieAspectRatio; resolution: KieResolution } {
  if (!KIE_ASPECT_RATIOS.includes(aspectRatio as KieAspectRatio)) {
    throw new Error("Unsupported aspect ratio.");
  }
  if (!KIE_RESOLUTIONS.includes(resolution as KieResolution)) {
    throw new Error("Unsupported image resolution.");
  }
  if (aspectRatio === "auto" && resolution !== "1K") {
    throw new Error("Auto aspect ratio is available at 1K resolution only.");
  }
  if (aspectRatio === "1:1" && resolution === "4K") {
    throw new Error("Square images are not available at 4K resolution.");
  }
  return {
    aspectRatio: aspectRatio as KieAspectRatio,
    resolution: resolution as KieResolution,
  };
}

export async function generateKieImage(args: {
  apiKey: string;
  prompt: string;
  aspectRatio: KieAspectRatio;
  resolution: KieResolution;
  referenceUrls?: string[];
  signal?: AbortSignal;
  onStatus?: (status: "generating") => void;
}): Promise<{ taskId: string; imageUrl: string; model: string }> {
  const referenceUrls = (args.referenceUrls ?? []).slice(0, 16);
  const model = referenceUrls.length
    ? "gpt-image-2-image-to-image"
    : "gpt-image-2-text-to-image";

  const createResponse = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: {
        prompt: args.prompt,
        aspect_ratio: args.aspectRatio,
        resolution: args.resolution,
        ...(referenceUrls.length ? { input_urls: referenceUrls } : {}),
      },
    }),
    signal: args.signal,
  });
  const created = await readJson<{ taskId?: string }>(createResponse);
  const taskId = created.data?.taskId;
  if (!taskId) throw providerError("Provider did not return a task ID.");
  args.onStatus?.("generating");

  const deadline = Date.now() + TASK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve, reject) => {
      const handleAbort = () => {
        clearTimeout(timer);
        args.signal?.removeEventListener("abort", handleAbort);
        reject(new DOMException("Aborted", "AbortError"));
      };
      const timer = setTimeout(() => {
        args.signal?.removeEventListener("abort", handleAbort);
        resolve();
      }, POLL_INTERVAL_MS);
      args.signal?.addEventListener("abort", handleAbort, { once: true });
    });

    const recordResponse = await fetch(
      `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      {
        headers: { Authorization: `Bearer ${args.apiKey}` },
        signal: args.signal,
      },
    );
    const record = await readJson<KieTaskRecord>(recordResponse);
    const state = record.data?.state?.toLowerCase();
    if (state === "fail" || state === "failed") {
      throw providerError(record.data?.failMsg || record.data?.failCode || "Task failed.");
    }
    if (state !== "success") continue;

    const rawResult = record.data?.resultJson;
    const result = typeof rawResult === "string"
      ? (JSON.parse(rawResult) as Record<string, unknown>)
      : rawResult;
    const resultUrls = result?.resultUrls;
    const imageUrl = Array.isArray(resultUrls)
      ? resultUrls.find((value): value is string => typeof value === "string")
      : null;
    if (!imageUrl) throw providerError("Completed task did not include an image URL.");
    return { taskId, imageUrl, model };
  }

  throw providerError("Task timed out.");
}
