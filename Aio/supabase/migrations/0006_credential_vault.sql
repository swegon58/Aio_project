-- Aio x Hermes integration — generic credential vault (Batch E)
--
-- Extends the OpenRouter-key Vault pattern (0004) to cover other LLM
-- provider / tool secrets not already handled by hermes_registry's
-- dedicated openrouter_key_ref column or the Connections-tab platform
-- tokens (those live in the profile .env, see platforms.ts). Each
-- (customer_id, key_name) pair maps to one Vault secret UUID.

create table if not exists hermes_credential_refs (
  customer_id uuid not null references auth.users (id) on delete cascade,
  key_name text not null,
  secret_ref uuid not null,
  updated_at timestamptz not null default now(),
  primary key (customer_id, key_name)
);

alter table hermes_credential_refs enable row level security;
-- No policies — service-role only, same trust boundary as hermes_registry.

-- Create (or update in place) the Vault secret for one named credential.
-- Returns the Vault secret UUID stored in hermes_credential_refs.
create or replace function vault_store_credential(
  p_customer_id uuid,
  p_key_name text,
  p_secret text
) returns uuid as $$
declare
  v_existing uuid;
  v_ref uuid;
begin
  select secret_ref into v_existing
  from hermes_credential_refs
  where customer_id = p_customer_id and key_name = p_key_name;

  if v_existing is not null then
    perform vault.update_secret(v_existing, p_secret);
    v_ref := v_existing;
  else
    v_ref := vault.create_secret(
      p_secret,
      p_key_name || ':' || p_customer_id::text,
      'Per-customer credential (Batch E): ' || p_key_name
    );
    insert into hermes_credential_refs (customer_id, key_name, secret_ref)
    values (p_customer_id, p_key_name, v_ref);
  end if;

  update hermes_credential_refs
  set secret_ref = v_ref, updated_at = now()
  where customer_id = p_customer_id and key_name = p_key_name;

  return v_ref;
end;
$$ language plpgsql security definer;

-- Decrypt and return one named credential for a customer, or null if unset.
create or replace function vault_read_credential(
  p_customer_id uuid,
  p_key_name text
) returns text as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from hermes_credential_refs r
  join vault.decrypted_secrets s on s.id = r.secret_ref
  where r.customer_id = p_customer_id and r.key_name = p_key_name;

  return v_secret;
end;
$$ language plpgsql security definer;

revoke all on function vault_store_credential(uuid, text, text) from public;
revoke all on function vault_read_credential(uuid, text) from public;
