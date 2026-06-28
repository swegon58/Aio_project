#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

branch="$(git branch --show-current)"
head_sha="$(git rev-parse --short HEAD)"
origin_main="$(git rev-parse --short origin/main 2>/dev/null || printf 'unavailable')"
tracked_dirty="$(git status --porcelain --untracked-files=no | wc -l | tr -d ' ')"
untracked="$(git status --porcelain | awk '$1 == "??" { count++ } END { print count + 0 }')"

if git rev-parse --verify origin/main >/dev/null 2>&1; then
  read -r ahead behind < <(git rev-list --left-right --count HEAD...origin/main)
else
  ahead="?"
  behind="?"
fi

http_status() {
  local status
  status="$(curl --max-time 2 --silent --output /dev/null --write-out '%{http_code}' "$1" 2>/dev/null || true)"
  if [[ -z "$status" || "$status" == "000" ]]; then
    printf 'offline'
  else
    printf '%s' "$status"
  fi
}

printf 'Aio context\n'
printf '  root: %s\n' "$root"
printf '  branch: %s\n' "$branch"
printf '  HEAD: %s\n' "$head_sha"
printf '  origin/main: %s\n' "$origin_main"
printf '  ahead/behind origin/main: %s/%s\n' "$ahead" "$behind"
printf '  tracked dirty entries: %s\n' "$tracked_dirty"
printf '  untracked entries: %s\n' "$untracked"
printf '  web: %s\n' "$(http_status http://127.0.0.1:3000/app)"
printf '  Hermes: %s\n' "$(http_status http://127.0.0.1:8642/health)"
printf '  LM Studio: %s\n' "$(http_status http://127.0.0.1:1234/v1/models)"
printf '\nWorktrees\n'
git worktree list
printf '\nRead next\n'
printf '  %s/AIO_PROJECT_STATE.md\n' "$root"
printf '  %s/AIO_MASTER_EXECUTION_PLAN.md\n' "$root"
