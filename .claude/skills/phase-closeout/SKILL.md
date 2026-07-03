---
name: phase-closeout
description: End-of-phase verification and evidence-recording ritual used when a roadmap phase's tasks (R6, R7, R8, R9, R10, and later phases) are implemented and about to be marked done. Use before updating an EXECUTION_CHECKLIST.md or AIO_PROJECT_STATE.md, or whenever a chunk of work looks finished and needs to be verified and recorded rather than just asserted.
---

# Phase Closeout

Run in order before calling any phase task done:

1. Run typecheck, lint, and the relevant test suite. Do not proceed on red.
2. If the work touched UI (`apps/web/src/**` components, pages, styles),
   get a Kimo review scoped to the exact routes/components changed — not a
   vague "review the app" ask.
3. If the work touched UI, live-test the golden path and edge cases in a
   real browser against the dev server. Passing typecheck/tests verifies the
   code, not the feature — only a live check verifies the feature.
4. Update the current phase's `docs/roadmap/*_EXECUTION_CHECKLIST.md` with
   evidence: what ran, what passed, and file paths touched.
5. Update `AIO_PROJECT_STATE.md` with the new state and the exact next step.
6. Note any owner-only manual item still outstanding (infra provisioning,
   migrations to push, legal/Paddle/consent-screen steps) instead of
   silently completing around it.
