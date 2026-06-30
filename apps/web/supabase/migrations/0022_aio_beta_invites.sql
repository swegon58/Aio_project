-- R6.8 beta gate: invite-only cohort allowlist. Gating itself stays off
-- (current open-signup behavior) unless AIO_BETA_INVITE_ONLY=true is set —
-- this table is the cohort list the owner populates before flipping that
-- flag. Service-role only; no end-user policies (matches hermes_registry's
-- write pattern).
create table if not exists aio_beta_invites (
  email text primary key,
  invited_at timestamptz not null default now(),
  invited_by text,
  revoked_at timestamptz
);

alter table aio_beta_invites enable row level security;
