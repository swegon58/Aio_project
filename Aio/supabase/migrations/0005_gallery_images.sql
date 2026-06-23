-- Aio x Hermes integration — persisted image gallery (Batch D)
--
-- Images live in the pre-existing private Storage bucket `aio-images`
-- (public: false — created out-of-band, not by this migration). This table
-- stores metadata only: the Storage object path, owning customer, the
-- thread/session the image came from, and an optional caption/prompt.
-- Rows survive across chat sessions so the gallery tab can list a
-- customer's full image history, not just the current run.

create table if not exists hermes_gallery_images (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references hermes_threads (session_id) on delete set null,
  storage_path text not null unique, -- object path inside the aio-images bucket
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists hermes_gallery_images_customer_id_idx
  on hermes_gallery_images (customer_id);
create index if not exists hermes_gallery_images_created_at_idx
  on hermes_gallery_images (customer_id, created_at desc);

alter table hermes_gallery_images enable row level security;

-- Direct table access stays service-role only (same trust boundary as
-- hermes_registry/hermes_threads — all reads/writes go through Aio's API
-- routes using the service client, never the browser anon/authenticated
-- client). RLS is enabled with no policies, which denies all access to
-- anon/authenticated by default; explicit policy below covers the case
-- where a future client-side read is added.
create policy "Users can read own gallery images"
  on hermes_gallery_images for select
  using (auth.uid() = customer_id);
