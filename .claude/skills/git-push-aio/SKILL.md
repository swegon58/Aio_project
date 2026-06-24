---
name: git-push-aio
description: Use when someone asks to push the Aio project to GitHub, "git push aio", "push aio lên github", sync Aio repo, or commit+push for Aio_project specifically. Stages all changes, generates commit message, pushes origin main for /home/swegon/AI_Agent/Aio_project.
argument-hint: "[optional commit message]"
---

## What This Skill Does

Fast commit + push for the Aio project repo only. Stages all changes, auto-generates commit message from diff, pushes to origin main.

## Steps

1. **cd into repo** — `/home/swegon/AI_Agent/Aio_project` (remote: `github.com/swegon58/Aio_project`).

2. **Check status** — `git status --short` and `git diff --stat HEAD`.

3. **Stage all** — `git add -A`. Never stage `.claude/channels/discord/.env` or other secret files — `.gitignore` already excludes `.claude/channels/discord/.env`; trust it.

4. **Generate commit message** — if an argument was given, use it. Otherwise derive a short message from staged changes (format: `chore: sync [area]` or `feat: [what changed]`, under 72 chars). No need to ask — pick the best message and proceed.

5. **Commit**:
   ```
   git commit -m "<message>

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
   ```
   If nothing staged (clean tree), report "Nothing to commit" and stop.

6. **Push** — `git push origin main`. Report success or error.

7. **Confirm** — report commit hash.

## Notes

- Do NOT push `.env`, `node_modules/`, `.next/`, `.venv/` — `.gitignore` covers these.
- If push fails due to diverged history, report the error — do NOT force push without user confirmation.
- Fire-and-forget — no confirmation needed before committing.
- This skill is scoped to Aio_project only. For the unrelated `AI_Autonomous_Project` repo, use the global `git-push` skill instead.
