import { resolveHermesRequestContext } from "@/lib/hermes/request-context";

const BUCKET = "aio-images";

export async function GET(req: Request) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { db, userId } = ctxResult.ctx;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "missing_id", message: "id is required" }, { status: 400 });
  }

  const { data: row, error: rowError } = await db
    .from("hermes_gallery_images")
    .select("storage_path, caption")
    .eq("id", id)
    .eq("customer_id", userId)
    .maybeSingle();
  if (rowError || !row?.storage_path) {
    return Response.json({ error: "not_found", message: "Image not found" }, { status: 404 });
  }

  const { data: image, error: downloadError } = await db.storage
    .from(BUCKET)
    .download(row.storage_path);
  if (downloadError || !image) {
    return Response.json({ error: "image_unavailable" }, { status: 502 });
  }

  const headers = new Headers({
    "Content-Type": image.type || "image/png",
    "Cache-Control": "private, max-age=300",
  });
  if (url.searchParams.get("download") === "1") {
    headers.set("Content-Disposition", `attachment; filename="aio-${id}.png"`);
  }
  return new Response(image, { headers });
}
