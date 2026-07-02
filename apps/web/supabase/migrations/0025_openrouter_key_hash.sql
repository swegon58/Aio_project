-- Q15/Q41: OpenRouter's own key hash/id for a customer's provisioned
-- per-customer key. Needed to call the OpenRouter Provisioning API's PATCH
-- endpoint (updateOpenRouterKeyLimit) later, e.g. when a customer's plan
-- tier changes. Not secret (the hash identifies the key but cannot
-- authenticate with it), so a plain column is sufficient — the raw key
-- itself still only ever lives in Vault via openrouter_key_ref.
alter table hermes_registry add column if not exists openrouter_key_hash text;
