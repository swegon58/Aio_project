---
name: team-os
description: Operating rules for Aio Team OS — the internal long-running team-agent loop used to build and ship Aio. Use when reading or editing anything under .claude/agents/ (TEAM_SPEC, GRILL_PROGRESS, GRILL_DECISION_MAP, ROLE_EVIDENCE_LOG, OPERATING_PLAYBOOK, AIO_TEAM_OS_CHECKLIST, coordination/ACTIVE_CHUNK, coordination/HANDOFF_LOG), running scripts/aio-team-os.sh, or coordinating a grilled roadmap chunk. Not needed for normal product-phase (R-series) work.
---

# Aio Team OS

When working with `Aio Team OS`, also read:

1. `.claude/agents/TEAM_SPEC.md`
2. `.claude/agents/GRILL_PROGRESS.md`
3. `.claude/agents/GRILL_DECISION_MAP.md`
4. `.claude/agents/ROLE_EVIDENCE_LOG.md`
5. `.claude/agents/OPERATING_PLAYBOOK.md`
6. `.claude/agents/AIO_TEAM_OS_CHECKLIST.md`
7. `.claude/agents/coordination/ACTIVE_CHUNK.md`
8. `.claude/agents/coordination/HANDOFF_LOG.md`

Use these rules:

- Use `bash scripts/aio-team-os.sh progress` for the shortest view of total
  progress across the grilled Team OS plan.
- Use `bash scripts/aio-team-os.sh status` for the active chunk and local
  Team OS context.
- Use `bash scripts/aio-team-os.sh doctor` before calling Team OS healthy.
- Open or update `ACTIVE_CHUNK.md` before a meaningful chunk starts.
- Use brief/handoff/report templates under `.claude/agents/templates/`.
- Keep `HANDOFF_LOG.md` append-only.
- Keep all `Aio Team OS` files local: `.claude/agents/` and the related
  rollout/founder/discovery notes under `docs/roadmap/` stay ignored.
- Keep `GRILL_PROGRESS.md` declared progress and computed progress aligned;
  `doctor` must stay clean.
- State files and phase checklists remain the highest source of truth for
  product progress.
- `feat/aio-team-os` is the single ongoing lane for Team OS operational work;
  do not create extra Team OS branches unless the owner explicitly asks.
