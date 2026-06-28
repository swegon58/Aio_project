# Aio Project State

**Canonical repository:** `/home/swegon/AI_Agent/Aio_project`  
**Canonical branch:** `main`  
**Current main status:** run `scripts/aio-context.sh` for the exact live HEAD
**Most recent verified CI before this state update:** GitHub Actions run `28318122604`, all jobs passed
**Updated:** 2026-06-28

This is the first file an agent reads to learn current location and progress.
It is a status index, not a replacement for the master plan or phase checklist.

## Current Status

- R0 is formally closed on `main`.
- Web quality, security, clean migrations, and desktop/mobile Playwright CI
  pass on `main`.
- Aio local services were last verified at:
  - Web: `http://localhost:3000/app`
  - Hermes: `http://localhost:8642/health`
  - LM Studio: `http://localhost:1234/v1/models`
- No phase after R0 has been approved.
- R1 must not start until the product owner explicitly approves it.
- Historical secret-scan triage is closed for Aio R0.
- Owner decision: do not rewrite Git history for the deleted historical
  `.mcp.json` files as part of R0. Keep current-tree protection, CI scanning,
  and documentation as the repository closure boundary.
- Do not treat this repository note as proof of external credential revocation.
  Secret lifecycle remains outside the repo and must never be handled by
  exposing values in chat or commits.

## Worktree Roles

- `/home/swegon/AI_Agent/Aio_project`
  - Canonical product repository.
  - Use for `main`, integration, final verification, and running Aio.
- `/home/swegon/AI_Agent/Aio_project_onyx_openmanus_lab`
  - Research-only worktree for Onyx/OpenManus.
  - Do not implement product features here.
- `/home/swegon/AI_Agent/Aio_project_r0`
  - Historical R0 implementation worktree.
  - R0 is already merged; do not continue product work there.

## Required Reading Order

1. `AIO_PROJECT_STATE.md`
2. `AIO_MASTER_EXECUTION_PLAN.md`
3. Current phase checklist under `docs/roadmap/`
4. `AGENTS.md`
5. `README.md`

## Meaning Of "Continue Building Aio"

When the product owner says "continue building Aio":

1. Run `scripts/aio-context.sh`.
2. Confirm the canonical repo, branch, local/remote commit, dirty state, CI, and
   service status.
3. Read this state file and the current phase checklist.
4. If an approved task is marked in progress, continue that exact task.
5. If no task is approved, do not start coding. Present the next decision gate
   with concise A/B/C options and mark the recommended option.
6. After approval, create a dedicated branch/worktree from current
   `origin/main`; never implement a feature in the research worktree.
7. Implement, test, review, push, and put Aio online.
8. Update this file and the phase checklist after merge.

## Next Decision Gate

No feature is currently approved after R0 closure.

- **A. Recommended:** approve R1 Durable Run Foundation and create its detailed
  execution checklist before coding.
- **B:** choose another item from the master plan for reprioritization;
  document why dependencies can be changed.
- **C:** keep `main` stable and continue research only until a new product phase
  is approved.

## Update Contract

The integrating agent must update this file whenever:

- a phase or feature is approved
- a new implementation worktree is created
- a task becomes blocked
- a branch is merged
- CI status materially changes
- canonical paths or runtime commands change

Do not record secrets, raw provider responses, personal prompt content, or
uncommitted runtime-state details here.
