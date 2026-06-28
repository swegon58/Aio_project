# Aio Agent Entry Point

Read these files in order before planning or editing:

1. `AIO_MASTER_EXECUTION_PLAN.md`
2. `docs/roadmap/R0_EXECUTION_CHECKLIST.md`
3. `docs/roadmap/2026-06-28_aio_product_and_production_roadmap.md`
4. `README.md`

## Active Work

- Worktree: `/home/swegon/AI_Agent/Aio_project_r0`
- Branch: `feat/r0-ci-production-safety`
- Approved phase: R0 only
- Main owner: implementation, integration, verification, Git
- Current blocker: historical secret-scan remediation requires product-owner
  decision; never print detected secret values

Use the R0 checklist for exact status and next commands. Update it immediately
after verified work. Do not begin R1 until the product owner approves the R0
gate.

## Boundaries

- Aio is a consumer product, not a developer or operations console.
- Keep Next.js as control plane and Hermes as execution plane.
- Do not edit generated runtime state under `apps/harness/aio-home`.
- Do not expose `.env`, `.mcp.json`, credential, cookie, token, or Gitleaks
  values.
- Do not rewrite Git history, force-push, merge to `main`, rotate credentials,
  or choose paid infrastructure without explicit approval.
- Preserve unrelated user changes.
- User-facing UI text must be English.
