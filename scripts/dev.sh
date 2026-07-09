#!/usr/bin/env bash
# Local dev: boot web (Next.js :3000) + Hermes gateway together, one command.
#
# Coexists with the systemd aio-app.service as an ALTERNATIVE — if that service
# is active it already owns :3000, so stop it first:
#   systemctl --user stop aio-app.service
# Use this script when you want systemd-free local dev with web + hermes in one
# terminal. Ctrl-C stops both.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

trap 'kill 0 2>/dev/null' EXIT INT TERM

echo "[dev] web (:3000) + hermes starting — Ctrl-C stops both"

( bash "$ROOT/scripts/run-aio-app.sh"    ) &
( bash "$ROOT/scripts/run-aio-hermes.sh" ) &

wait
