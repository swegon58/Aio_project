import type { SupabaseClient } from "@supabase/supabase-js";

// R6.5 account deletion. Deleting the auth.users row cascades every user-owned
// table (all of them declare `references auth.users (id) on delete cascade`),
// including the audit log. The only thing the cascade cannot reach is Supabase
// Storage objects, so those are gathered and removed first, best-effort, then
// `auth.admin.deleteUser` fires to drop the user and cascade the DB rows.
//
// Storage cleanup is best-effort: a missing object or transient Storage error
// is recorded in `storageErrors` and must NOT abort the user deletion, since
// the user's clear intent is to delete their account.

export interface DeleteResult {
  ok: boolean;
  storageErrors: string[];
}

interface PathRow {
  storage_path: string;
}
interface PathQueryResult {
  data: PathRow[] | null;
  error: { message?: string } | null;
}
interface StorageRemoveResult {
  data: unknown;
  error: { message?: string } | null;
}

const KNOWLEDGE_BUCKET = "aio-knowledge";
const IMAGES_BUCKET = "aio-images";

async function collectStoragePaths(
  db: SupabaseClient,
  table: string,
  fk: string,
  userId: string,
): Promise<{ paths: string[]; errors: string[] }> {
  const result = (await db
    .from(table)
    .select("storage_path")
    .eq(fk, userId)) as unknown as PathQueryResult;
  if (result.error) {
    return { paths: [], errors: [`${table}: ${result.error.message ?? "unknown"}`] };
  }
  const paths = (result.data ?? []).map((r) => r.storage_path);
  return { paths, errors: [] };
}

async function removeObjects(
  db: SupabaseClient,
  bucket: string,
  paths: string[],
  storageErrors: string[],
): Promise<void> {
  if (paths.length === 0) return;
  const result = (await db.storage.from(bucket).remove(paths)) as unknown as StorageRemoveResult;
  if (result.error) {
    storageErrors.push(`${bucket}: ${result.error.message ?? "unknown"}`);
  }
}

export async function deleteAccountAndData(
  db: SupabaseClient,
  userId: string,
): Promise<DeleteResult> {
  const storageErrors: string[] = [];

  // 1. Gather Storage object paths BEFORE the auth user (and its cascaded rows) vanish.
  const knowledgeFiles = await collectStoragePaths(db, "hermes_knowledge_files", "customer_id", userId);
  const knowledgeDocs = await collectStoragePaths(db, "aio_knowledge_docs", "user_id", userId);
  const galleryImages = await collectStoragePaths(db, "hermes_gallery_images", "customer_id", userId);

  storageErrors.push(...knowledgeFiles.errors, ...knowledgeDocs.errors, ...galleryImages.errors);

  // 2. Remove Storage objects (best-effort; failures are recorded, not fatal).
  await removeObjects(db, KNOWLEDGE_BUCKET, [...knowledgeFiles.paths, ...knowledgeDocs.paths], storageErrors);
  await removeObjects(db, IMAGES_BUCKET, galleryImages.paths, storageErrors);

  // 3. Delete the auth user — cascades all user-owned DB tables.
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) {
    return { ok: false, storageErrors: [...storageErrors, `auth_delete: ${error.message ?? "unknown"}`] };
  }
  return { ok: true, storageErrors };
}
