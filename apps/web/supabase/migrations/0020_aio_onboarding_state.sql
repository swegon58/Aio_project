-- R6.1 onboarding/activation state on hermes_registry.
-- onboarded_at: set when the user completes or skips the onboarding overlay.
-- activated_at: set once, on first successful run (see run-orchestrator.ts).
-- Existing RLS (select using auth.uid() = customer_id) already covers these
-- columns; writes remain service-role only.
alter table hermes_registry add column if not exists onboarded_at timestamptz;
alter table hermes_registry add column if not exists activated_at timestamptz;
