import { isIP } from "net";
import { lookup } from "dns/promises";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "aio-images";
const SIGNED_URL_TTL_S = 60 * 60;
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

function isPrivateAddress(address: string): boolean {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) {
    return true;
  }
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return (
    a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
  );
}

async function assertSafeRemoteUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Provider returned a non-HTTPS image URL.");
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Provider returned an unsafe image URL.");
  }
  return url;
}

async function downloadImage(sourceUrl: string): Promise<{ bytes: Uint8Array; contentType: string; extension: string }> {
  let url = await assertSafeRemoteUrl(sourceUrl);
  let response: Response | null = null;

  for (let redirects = 0; redirects <= 3; redirects += 1) {
    response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location) throw new Error("Image download redirect was missing a destination.");
    url = await assertSafeRemoteUrl(new URL(location, url).toString());
  }

  if (!response?.ok || !response.body) {
    throw new Error(`Could not download generated image (${response?.status ?? "network error"}).`);
  }
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
  const extension = IMAGE_TYPES.get(contentType);
  if (!extension) throw new Error("Provider returned an unsupported image format.");

  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_IMAGE_BYTES) throw new Error("Generated image exceeds the 30 MB limit.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("Generated image exceeds the 30 MB limit.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, contentType, extension };
}

export async function persistGeneratedImage(args: {
  db: SupabaseClient;
  userId: string;
  sessionId: string;
  sourceUrl: string;
  caption: string;
}) {
  const image = await downloadImage(args.sourceUrl);
  const storagePath = `${args.userId}/${crypto.randomUUID()}.${image.extension}`;
  const { error: uploadError } = await args.db.storage
    .from(BUCKET)
    .upload(storagePath, image.bytes, {
      contentType: image.contentType,
      upsert: false,
    });
  if (uploadError) throw new Error(`Could not store generated image: ${uploadError.message}`);

  const { data: inserted, error: insertError } = await args.db
    .from("hermes_gallery_images")
    .insert({
      customer_id: args.userId,
      session_id: args.sessionId.startsWith("dev-session-") ? null : args.sessionId,
      storage_path: storagePath,
      caption: args.caption,
    })
    .select("id, created_at")
    .single();
  if (insertError) {
    await args.db.storage.from(BUCKET).remove([storagePath]);
    throw new Error(`Could not save generated image metadata: ${insertError.message}`);
  }

  return {
    id: inserted.id as string,
    url: `/api/gallery/image?id=${encodeURIComponent(inserted.id as string)}`,
    createdAt: inserted.created_at as string,
  };
}

export async function createGalleryImageSignedUrl(args: {
  db: SupabaseClient;
  userId: string;
  imageId: string;
}): Promise<string> {
  const { data: row, error: rowError } = await args.db
    .from("hermes_gallery_images")
    .select("storage_path")
    .eq("id", args.imageId)
    .eq("customer_id", args.userId)
    .maybeSingle();
  if (rowError || !row?.storage_path) throw new Error("Reference image was not found.");

  const { data: signed, error: signError } = await args.db.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_S);
  if (signError || !signed?.signedUrl) {
    throw new Error(`Could not open reference image: ${signError?.message ?? "missing signed URL"}`);
  }
  return signed.signedUrl;
}
