# R0 Execution Checklist

**Branch:** `feat/r0-ci-production-safety`
**Worktree:** `/home/swegon/AI_Agent/Aio_project_r0`
**Updated:** 2026-06-28
**Owner:** Codex (implementation, integration, verification)

This file tracks active work. The full product sequence remains in
`2026-06-28_aio_product_and_production_roadmap.md`.

The code-level program from R0 through R7 is at the repository root:
`AIO_MASTER_EXECUTION_PLAN.md`.

## Instructions For Claude Code Or Another Agent

Treat this file as the execution contract for R0.

1. Work only in `/home/swegon/AI_Agent/Aio_project_r0`.
2. Stay on branch `feat/r0-ci-production-safety`.
3. Read this file and `2026-06-28_aio_product_and_production_roadmap.md`
   before editing.
4. Do not edit runtime state under `apps/harness/aio-home`.
5. Do not expose values from `.env`, `.mcp.json`, Git history, Gitleaks reports,
   credential stores, or process environments.
6. Do not rewrite Git history, force-push, rotate credentials, merge to `main`,
   or change product scope without owner approval.
7. Preserve existing user changes. Never reset or revert unrelated files.
8. Use the current repo patterns. Keep R0 changes limited to CI, tests,
   dependency security, production guards, migration checks, and baseline
   documentation.
9. After every task, run its listed verification and update this checklist with
   evidence. Do not mark work complete from code inspection alone.
10. Before stopping, leave a concise handoff containing current status, failed
    command output, changed files, and the exact next command.

## Status Key

- `[x]` verified complete
- `[ ]` not started
- `[-]` in progress
- `[!]` blocked or failed

## R0 Checklist

- [x] `R0.1` Move CI to repository root and target `main`.
  - Evidence: `.github/workflows/ci.yml`
- [x] `R0.2` Use `apps/web`, Node 24, deterministic `npm ci`, and lockfile cache.
  - Evidence: CI YAML parses successfully.
- [x] `R0.3` Add focused unit tests.
  - Evidence: 13 tests pass.
- [x] `R0.4` Add critical Playwright smoke coverage.
  - Covered: chat, Research, approval, Settings, image controls.
  - Viewports: desktop Chromium and mobile Chromium.
  - Evidence: 2 tests pass.
- [-] `R0.5` Add security gates.
  - [x] Gitleaks action added.
  - [x] Pull-request dependency review added.
  - [x] Production dependency audit added.
  - [x] Remove high-risk `xlsx`; render parsed cells through React.
  - [x] Upgrade Next.js and transitive production dependencies.
  - [ ] Run full-history local Gitleaks verification.
- [x] `R0.6` Fail closed on unsafe production configuration.
  - [x] Reject dev auth bypass, dev Hermes keys, missing hosted secrets, and
        local/non-HTTPS Supabase.
  - [x] Treat unmarked `NODE_ENV=production` as production.
  - [x] Reject development Hermes registry key references at request time.
  - [x] Add Docker runtime startup check.
  - [x] Verify safe and unsafe CLI checks.
  - [x] Build container and verify unsafe startup exits.
- [x] `R0.7` Verify migrations against a clean database.
  - [x] Add Supabase local project config.
  - [x] Remove generated `.temp` metadata from Git.
  - [x] Apply migrations `0001` through `0008` locally.
  - [x] Make DB lint fail on warnings.
  - [x] Re-run clean migration and lint after final changes.
- [x] `R0.8` Capture baseline metrics.
  - [x] Chat success and latency.
  - [x] Research success and latency.
  - [x] Image success, latency, and provider cost.
  - [x] Record method and results in an operations note.
  - Evidence: `docs/operations/R0_BASELINE_2026-06-28.md`

## Final Gate

- [x] Lint passes.
- [x] Typecheck passes.
- [x] Unit tests pass.
- [x] Playwright tests pass.
- [x] Production build passes.
- [x] Production dependency audit has no high/critical finding.
- [ ] Full-history secret scan passes.
- [ ] Clean migration verification passes.
- [ ] Reviewer findings are resolved or documented.
- [ ] Roadmap R0 boxes and evidence are updated.
- [ ] Branch commits are clean and pushed.
- [ ] Existing Aio instance is online after work.

Lint exits successfully with 281 pre-existing warnings and no errors. Warning
cleanup is tracked as later technical debt because it is outside R0's scoped
behavior changes.

## Team-Agent Rules

- Main agent owns architecture, edits, integration, tests, commits, and push.
- Reviewer agents receive read-only, bounded scopes and severity-based output.
- Worker agents may edit only explicitly assigned, non-overlapping files.
- No agent receives secrets or duplicates work already assigned elsewhere.
- Each delegated result must include changed files or exact file/line findings.
- Main agent verifies every delegated result before marking an item complete.

## Completed Review

Read-only reviewer audited CI, production guards, migrations, and E2E. Findings:

- Docker needed a runtime production check.
- Production detection needed a fail-closed `NODE_ENV` fallback.
- Hermes development key references needed runtime rejection.
- Supabase lint needed `--fail-on warning`.
- Mocked E2E coverage must be identified as UI/control-plane smoke coverage;
  real backend and production startup checks remain separate gates above.

## Exact Implementation Plan

### Task 1: Finish Production Guard

**Status:** Complete
**Owner:** Main agent
**Files:**

- `apps/web/src/lib/aio/config/production-guard.mjs`
- `apps/web/src/lib/aio/config/production-guard.d.mts`
- `apps/web/src/lib/aio/config/production-guard.test.ts`
- `apps/web/scripts/check-production-env.mjs`
- `apps/web/next.config.ts`
- `apps/web/src/lib/hermes/request-context.ts`
- `apps/web/src/lib/billing/payment-provider.ts`
- `apps/web/Dockerfile`
- `apps/web/docker-compose.yml`
- `apps/web/.env.local.example`

**Required behavior:**

- Production is true when `AIO_DEPLOYMENT_ENV=production`.
- If `AIO_DEPLOYMENT_ENV` is absent, production is true when
  `VERCEL_ENV=production`.
- If both markers are absent, production is true when `NODE_ENV=production`.
- Explicit `AIO_DEPLOYMENT_ENV=development`, `test`, or `build` prevents a
  production-only check during local tests or image compilation.
- Production startup must reject:
  - `NEXT_PUBLIC_DEV_AUTH_BYPASS=true`
  - any populated `HERMES_DEV_API_SERVER_KEY`
  - missing Supabase and Paddle variables listed by the guard
  - non-HTTPS or localhost Supabase URLs
- Request context must reject both `inline:` keys and
  `env:HERMES_DEV_API_SERVER_KEY` registry references in production.
- Docker must execute the check before `server.js`, not only during `next build`.
- Payment code must never select the development provider in production.

**Verification:**

```bash
cd /home/swegon/AI_Agent/Aio_project_r0/apps/web
npm run typecheck
npm run test:unit

env \
  AIO_DEPLOYMENT_ENV=production \
  NEXT_PUBLIC_DEV_AUTH_BYPASS=false \
  NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
  SUPABASE_SERVICE_ROLE_KEY=service \
  PADDLE_API_KEY=paddle \
  PADDLE_WEBHOOK_SECRET=webhook \
  PADDLE_PRICE_ID_STARTER=starter \
  PADDLE_PRICE_ID_PRO=pro \
  PADDLE_PRICE_ID_BUSINESS=business \
  PADDLE_PRICE_ID_TOPUP=topup \
  npm run check:prod-env

env NODE_ENV=production NEXT_PUBLIC_DEV_AUTH_BYPASS=true \
  npm run check:prod-env
```

The first environment check must exit `0`. The second must exit nonzero with
`Unsafe Aio production configuration`.

Then build the production container:

```bash
cd /home/swegon/AI_Agent/Aio_project_r0
docker build -t aio-web:r0 apps/web
docker run --rm aio-web:r0
```

The image must build. Startup without hosted secrets must exit nonzero before
the HTTP server starts.

**Evidence:** unit tests pass; safe CLI check exits `0`; unsafe CLI check exits
nonzero; `aio-web:r0` builds; unsafe container is rejected; safe container
serves `/app`.

### Task 2: Finish Dependency Security

**Status:** In progress
**Owner:** Main agent
**Files:**

- `apps/web/package.json`
- `apps/web/package-lock.json`
- `apps/web/src/components/app/AppHome.tsx`

**Implemented design:**

- Next.js and `eslint-config-next` use `16.2.9`.
- `shadcn` is a dev dependency because it is a CLI, not app runtime code.
- Vulnerable `xlsx` is removed because npm has no patched release.
- XLSX preview uses `read-excel-file`.
- CSV preview uses `papaparse`.
- Parsed cells render as React text nodes; no spreadsheet-generated
  `dangerouslySetInnerHTML`.
- Legacy `.xls` preview is not advertised because the replacement parser
  supports `.xlsx`, not binary `.xls`.

**Verification:**

```bash
cd /home/swegon/AI_Agent/Aio_project_r0/apps/web
npm ci
npm audit --omit=dev --audit-level=high
npm run lint
npm run typecheck
npm run test:unit
AIO_DEPLOYMENT_ENV=development npm run build
```

Pass criteria: no high or critical production dependency finding; all code
checks pass. Moderate findings may remain only when no compatible upstream
patch exists, and must be documented.

### Task 3: Resolve Secret-Scan Gate

**Status:** In progress; owner decision required for history rewrite
**Owner:** Main agent for triage; product owner for credential/history decision
**Files:**

- `.github/workflows/ci.yml`
- optional root `.gitleaks.toml`
- optional root `.gitleaksignore`

**Known result:**

- Full-history scan covered 56 commits and found 779 matches.
- Most matches are examples, fixtures, and vendored Hermes documentation.
- One match is a GitHub fine-grained PAT committed historically in `.mcp.json`.
- Never print or copy the detected token.

**Required actions:**

1. Product owner revokes the historical GitHub PAT in GitHub immediately.
2. Main agent verifies whether the PAT is present in the current tree without
   printing its value.
3. Main agent groups false positives by rule and path.
4. Add only narrow allowlists for proven fixtures or vendored documentation.
   Never allowlist `.mcp.json`, generic source directories, or an entire secret
   rule globally.
5. Ask the owner to choose one remediation:
   - Rewrite Git history and force-push after coordinating every worktree.
   - Keep history, document that the token is revoked, and ignore only the
     exact historical fingerprint.
6. Re-run current-tree and full-history scans.

**Verification:**

```bash
docker run --rm \
  -v /home/swegon/AI_Agent:/home/swegon/AI_Agent \
  zricethezav/gitleaks:latest detect \
  --source=/home/swegon/AI_Agent/Aio_project_r0 \
  --no-banner --redact --log-opts='--all'
```

Pass criteria: exit `0`; no live credential is hidden by a broad allowlist.

### Task 4: Harden CI Workflow

**Status:** In progress
**Owner:** Main agent
**Files:**

- `.github/workflows/ci.yml`
- delete `apps/web/.github/workflows/ci.yml`

**Required jobs:**

- `quality`: Node 24, `npm ci`, lint, typecheck, unit tests, build.
- `security`: Gitleaks, production dependency audit, PR dependency review.
- `database`: clean Supabase startup, all migrations, DB lint with
  `--fail-on warning`, cleanup using `if: always()`.
- `e2e`: Chromium installation and Playwright smoke after quality passes.

**Workflow rules:**

- Trigger pushes and pull requests to `main`.
- Use root `.github/workflows`.
- Cache from `apps/web/package-lock.json`.
- Use `apps/web` as the web command directory.
- Use fake, non-secret development values only.
- Set `AIO_DEPLOYMENT_ENV=development` during build/test jobs.

**Verification:**

```bash
cd /home/swegon/AI_Agent/Aio_project_r0/apps/web
node -e "const fs=require('fs'),YAML=require('yaml');const d=YAML.parse(fs.readFileSync('../../.github/workflows/ci.yml','utf8'));if(!d.on||!d.jobs?.quality||!d.jobs?.security||!d.jobs?.database||!d.jobs?.e2e)process.exit(1)"
```

After push, all GitHub Actions jobs must pass from a clean checkout.

### Task 5: Finish Browser Smoke Coverage

**Status:** Complete
**Owner:** Main agent
**Files:**

- `apps/web/playwright.config.ts`
- `apps/web/e2e/app-smoke.spec.ts`
- `.gitignore`

**Required UI/control-plane flow:**

- Load `/app` with development auth bypass.
- Submit normal chat and verify `mode=auto`.
- switch to Research and verify `mode=research`.
- render approval request and submit approval.
- open Settings and verify Kie provider status.
- activate image creation and verify controls.
- run at `1440x900` and `390x844`.
- assert no horizontal overflow.

**Hardening:**

- Mock only explicitly listed API routes.
- An unexpected `/api/*` request must be recorded and fail the test, not receive
  a silent HTTP 200 empty object.
- Keep this suite labeled as UI/control-plane smoke. It does not replace a real
  Supabase/Hermes integration test.

**Verification:**

```bash
cd /home/swegon/AI_Agent/Aio_project_r0/apps/web
npm run test:e2e
```

Pass criteria: two projects pass with no unexpected API route and no overflow.

**Evidence:** desktop and mobile Chromium both pass with strict API mocks.

### Task 6: Verify Clean Database Migrations

**Status:** Complete
**Owner:** Main agent
**Files:**

- `apps/web/supabase/config.toml`
- `apps/web/supabase/.gitignore`
- `apps/web/supabase/migrations/*.sql`
- `.github/workflows/ci.yml`
- root `.gitignore`

**Required behavior:**

- Generated `supabase/.temp` metadata is ignored and not committed.
- Seed execution is disabled for this migration gate.
- Migrations `0001` through `0008` apply in filename order to an empty local DB.
- DB lint warnings fail the command.
- Local containers are stopped after verification.

**Verification:**

```bash
cd /home/swegon/AI_Agent/Aio_project_r0/apps/web
npx -y supabase@2.101.0 db start
npx -y supabase@2.101.0 db reset
npx -y supabase@2.101.0 db lint --local --level warning --fail-on warning
npx -y supabase@2.101.0 stop --no-backup
```

Pass criteria: every migration applies and lint exits `0`.

**Evidence:** migrations `0001` through `0008` applied after `db reset`; schema
lint returned no errors; local Supabase containers stopped.

### Task 7: Record R0 Baseline

**Status:** Complete
**Owner:** Main agent
**Output file:**

- `docs/operations/R0_BASELINE_2026-06-28.md`

**Measure:**

- Chat: model/provider, prompt type, success, end-to-end latency, first visible
  response latency when measurable, and cost.
- Research: model/provider, query type, success, total latency, source count,
  and cost.
- Image: provider/model, resolution, success, total latency, provider cost,
  and whether Gallery persistence succeeds.
- Automated gates: unit count/duration, E2E count/duration, production build
  duration, clean migration result.

**Rules:**

- Use one small representative run per live workflow.
- Do not place prompts containing private data in the report.
- Do not place API keys, raw auth headers, cookies, or full provider responses
  in the report.
- Separate observed values from estimates.
- Record machine/date/context so later measurements are comparable.

**Pass criteria:** report contains actual results or an explicit measured
failure with cause; no blank metric silently marked complete.

**Evidence:** chat and Research were measured live; the previously verified
image sample is labeled as historical and estimated rather than rerun.

### Task 8: Final Integration And Handoff

**Status:** Not started
**Owner:** Main agent
**Files:**

- this checklist
- `2026-06-28_aio_product_and_production_roadmap.md`
- all files changed by Tasks 1 through 7

**Sequence:**

1. Run `npm ci`.
2. Run lint, typecheck, unit, E2E, build, dependency audit.
3. Run clean migration and DB lint.
4. Run secret scan.
5. Review `git diff --check`.
6. Review full diff for secrets and unrelated edits.
7. Update this checklist and R0 roadmap boxes with evidence.
8. Create small logical commits.
9. Push `feat/r0-ci-production-safety`.
10. Restart or verify the existing Aio app and provide its URL.
11. Do not merge to `main` until owner approves R0 gate.

**Final commands:**

```bash
cd /home/swegon/AI_Agent/Aio_project_r0/apps/web
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
AIO_DEPLOYMENT_ENV=development npm run build
npm audit --omit=dev --audit-level=high

cd /home/swegon/AI_Agent/Aio_project_r0
git diff --check
git status --short
git diff --stat
```

## Delegation Map

Use team agents only when work is independent and bounded.

- **Main/integrator:** Tasks 1-8 ownership, cross-file decisions, verification,
  commits, push, checklist updates.
- **Security reviewer:** read-only review of CI, production guards, dependency
  changes, and secret-scan configuration. Output severity plus file/line.
- **Browser reviewer:** read-only review of E2E selectors, responsive coverage,
  and missing critical UI states. No overlap with implementation files.
- **Worker agent:** allowed only for a disjoint file set named in its prompt.
  Worker must not revert concurrent edits and must report every changed file.

Do not delegate:

- credential handling or reading secret values
- Git history rewrite or force-push
- merge to `main`
- final acceptance decision
- two agents editing the same workflow, lockfile, or test file
