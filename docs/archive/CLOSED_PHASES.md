# Closed Phases (R0–R9) — compressed index

One-liner per closed phase. This is the **Tầng-3 forensics** entry point — read
this first; open the archived original only if you need detail. Active phases
(R10/R11/R12) live in `docs/roadmap/`, not here.

| Phase | Outcome | Detail |
|-------|---------|--------|
| **R0** | CI/production safety closure + secret-scan remediation. | `operations/R0_BASELINE_*`, `R0_SECRET_SCAN_*` |
| **R1** | Durable run foundation — runs survive restarts. | `roadmap/R1_EXECUTION_CHECKLIST.md` |
| **R2** | Every sensitive action predictable, reviewable, resumable, auditable (tool governance + approvals). | `roadmap/R2_EXECUTION_CHECKLIST.md` |
| **R3** | Observability — every run traceable (cause, cost, latency, reliability). | `explainers/R3_GIAI_THICH_DE_HIEU.md` |
| **R4** | Deep Research + Knowledge made valuable (plan, progress, sources, verification, report). | `explainers/R4_GIAI_THICH_DE_HIEU.md` |
| **R5** | Schema repair (migrations 0013–0019), background workers/schedule-worker, at-most-once guard + cancel-propagation. | `roadmap/R5_EXECUTION_CHECKLIST.md` |
| **R6** | Commercial private-beta readiness: onboarding (0020), CSRF/rate-limit, webhook dedup (0021), export/delete, analytics, spend-cap (0022). | `roadmap/R6_EXECUTION_CHECKLIST.md` |
| **R7** | Saved Agents (migration 0023). | `roadmap/R7_EXECUTION_CHECKLIST.md` |
| **R8** | Beta-readiness hardening: error pages, ScheduledTasksModal, Discord bot isolation, backend consolidation (0024/0025), observability stack (Langfuse/OTel), EmbeddingProvider. | `roadmap/R8_EXECUTION_CHECKLIST.md` |
| **R9** | Deep Research polish: research pipeline, MD/PDF export, sources panel (Playwright-verified). | `roadmap/R9_EXECUTION_CHECKLIST.md` |

**All merged to `main`** (R10/R11 via `feat/r11-settings` merge `193bb77`; R0–R9
earlier). Full R0–R7 code-level contract: `AIO_MASTER_EXECUTION_PLAN.md` (root,
on-demand). Team-OS operational history: `team-os/`.

## Archive subdirs

- `roadmap/` — closed execution checklists + merge summaries + research reports
- `explainers/` — Vietnamese explainers R0–R9 (active R10–R12 stay in `AIO_GIAI_THICH_DE_HIEU/`)
- `team-os/` — Team-OS design + founder reports + coordination logs
- `operations/` — closed ops baselines (R0)
