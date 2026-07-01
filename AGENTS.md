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
- Canonical product branch: `main`
- Active local operating branch: `feat/aio-team-os`
- Aio Team OS is the active operating lane.
- Current grilled Team OS progress is visible with:
  `bash scripts/aio-team-os.sh progress`
- Team OS health is checked with:
  `bash scripts/aio-team-os.sh doctor`
- No later product delivery phase is approved yet.
- Main owner: implementation, integration, verification, Git
- Historical secret-scan triage is closed; never print detected secret values
  or restore deleted `.mcp.json` files.

Use phase checklists as historical closure evidence only unless the current
state file says a task is active.

## Aio Team OS

When working with `Aio Team OS`, read:

1. `.claude/agents/TEAM_SPEC.md`
2. `.claude/agents/GRILL_PROGRESS.md`
3. `.claude/agents/GRILL_DECISION_MAP.md`
4. `.claude/agents/ROLE_EVIDENCE_LOG.md`
5. `.claude/agents/OPERATING_PLAYBOOK.md`
6. `.claude/agents/AIO_TEAM_OS_CHECKLIST.md`
7. `.claude/agents/coordination/ACTIVE_CHUNK.md`
8. `.claude/agents/coordination/HANDOFF_LOG.md`

Useful commands:

```bash
bash scripts/aio-team-os.sh progress
bash scripts/aio-team-os.sh status
bash scripts/aio-team-os.sh doctor
```

Keep Team OS coordination files local-only. Push only repo-system files that
are intended to be shared.

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
