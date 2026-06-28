# R0 Secret-Scan Remediation

**Date:** 2026-06-28  
**Scope:** formal closure of the R0 historical secret-scan follow-up

## What Was Verified

- Historical tracked `.mcp.json` files were deleted in commit `aad0a93`.
- The current tracked tree no longer includes `.mcp.json` or
  `apps/web/.mcp.json`.
- The current tracked tree includes only `.mcp.example.json`.
- GitHub Actions CI on `main` passed the active secret-scan gate in runs
  `28310392676` and `28318122604`.
- No broad Gitleaks allowlist was added for source directories or whole secret
  rules.

## Owner Decision

- Do not rewrite Git history or force-push as part of Aio R0 closure.
- Treat current-tree protection, CI secret scanning, and deletion of tracked
  `.mcp.json` files as the repository remediation boundary for this phase.
- Do not restore deleted `.mcp.json` files to source control.

## Important Limitation

This note does not prove that any historical credential was revoked outside the
repository. External credential lifecycle remains an owner-controlled operation
and must never be handled by printing secrets in chat, docs, logs, or commits.

## R0 Closure Result

R0 is considered closed for the Aio product repository because:

- the current product tree is clean of tracked `.mcp.json` files
- the active CI secret-scan gate passes on `main`
- the owner selected a no-history-rewrite closure path for this phase

Any future organization-wide history cleanup can be handled as a separate
governance task and is not a blocker for R1 approval.
