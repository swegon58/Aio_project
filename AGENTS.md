# Aio Agent Entry Point

Read these files in order before planning or editing:

1. `AIO_PROJECT_STATE.md`
2. `AIO_MASTER_EXECUTION_PLAN.md`
3. Current phase checklist under `docs/roadmap/`
4. `README.md`

Before answering "continue building Aio", run:

```bash
scripts/aio-context.sh
```

Then follow the trigger protocol in `AIO_PROJECT_STATE.md`. If no task is
approved, present the next decision gate; do not infer approval from "continue".

## Active Work

- Primary worktree: `/home/swegon/AI_Agent/Aio_project`
- Branch: `main`
- R0 integrated in merge commit `1a21077`
- No later phase is approved yet
- Main owner: implementation, integration, verification, Git
- Open security follow-up: historical secret-scan remediation requires
  product-owner decision; never print detected secret values

Use the R0 checklist for exact status and next commands. Update it immediately
after verified work. Do not begin R1 until the product owner approves it.

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
