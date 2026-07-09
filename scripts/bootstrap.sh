#!/usr/bin/env bash
# One-command fresh-clone setup for local dev. Idempotent — safe to re-run.
#
# NOTE: the run-aio-*.sh / dev.sh scripts hardcode the owner's machine paths
# (/home/swegon, fnm node v24). This bootstrap covers deps + env; on a different
# machine, adjust those paths (or source node via your own version manager).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/apps/web"

echo "==> [1/3] Node (requires >=24, see apps/web/package.json#engines)"
node -v

echo "==> [2/3] Install web dependencies"
( cd "$WEB" && npm install )

echo "==> [3/3] Env file"
if [ ! -f "$WEB/.env.local" ]; then
  cp "$WEB/.env.local.example" "$WEB/.env.local"
  echo "    created apps/web/.env.local from .env.local.example"
  echo "    -> EDIT IT: fill the REQUIRED keys (marked in the file)."
else
  echo "    apps/web/.env.local already exists — left untouched."
fi

cat <<EOF

Bootstrap done. Next steps:

  1. Edit apps/web/.env.local — REQUIRED keys are marked; the Supabase target is
     the CLOUD project (xeuvo...), NOT local Docker.
  2. Start dev:
       bash scripts/dev.sh              # web :3000 + Hermes (systemd-free)
       # or keep the systemd aio-app.service for web + run hermes separately.
  3. Tests:
       cd apps/web && npm test          # unit (317)
                       npm run test:watch
                       npm run test:e2e # Playwright (isolated .next-e2e)
EOF
