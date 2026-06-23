-- Aio x Hermes integration — per-customer OpenRouter key storage (Q15/Q41)
--
-- Canonical secret store = Supabase Vault (`supabase_vault` extension, pure
-- Postgres, encrypted at rest). `hermes_registry.openrouter_key_ref` holds the
-- Vault secret UUID (NOT the raw key) — same pattern as `api_server_key_ref`
-- but for the per-customer OpenRouter key (Q15 hard spend ceiling).
--
-- Access is via security-definer RPCs, callable only by the service role
-- (revoked from anon/authenticated) — the orchestrator pulls the raw key at
-- spawn time to write the profile's ephemeral `.env`, per Q41.

create extension if not exists supabase_vault;

alter table hermes_registry add column if not exists openrouter_key_ref uuid;

-- Create (or update) the Vault secret holding a customer's per-customer
-- OpenRouter API key. Returns the Vault secret UUID to store in
-- hermes_registry.openrouter_key_ref.
create or replace function vault_store_openrouter_key(
  p_customer_id uuid,
  p_secret text,
  p_existing_ref uuid default null
) returns uuid as $$
declare
  v_ref uuid;
begin
  if p_existing_ref is not null then
    perform vault.update_secret(p_existing_ref, p_secret);
    v_ref := p_existing_ref;
  else
    v_ref := vault.create_secret(
      p_secret,
      'openrouter_key:' || p_customer_id::text,
      'Per-customer OpenRouter API key (Q15/Q41)'
    );
  end if;

  update hermes_registry
  set openrouter_key_ref = v_ref
  where customer_id = p_customer_id;

  return v_ref;
end;
$$ language plpgsql security definer;

-- Decrypt and return a customer's per-customer OpenRouter API key by Vault
-- secret UUID. Orchestrator-only — used at profile spawn to write `.env`.
create or replace function vault_read_openrouter_key(
  p_secret_ref uuid
) returns text as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where id = p_secret_ref;

  return v_secret;
end;
$$ language plpgsql security definer;

revoke all on function vault_store_openrouter_key(uuid, text, uuid) from public;
revoke all on function vault_read_openrouter_key(uuid) from public;
