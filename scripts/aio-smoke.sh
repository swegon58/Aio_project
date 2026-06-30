#!/usr/bin/env bash
# Post-deploy smoke for the Aio self-hosted stack.
#
# Pings the three health endpoints aio-online.sh waits on (web, Hermes, LM Studio)
# and reports PASS/FAIL per check. Exits non-zero if any CRITICAL endpoint is not
# healthy. LM Studio is ADVISORY (the model supply may be OpenRouter, not local),
# so a down LM Studio prints WARN but does not fail the script.
#
# Override targets via env: AIO_SMOKE_WEB_URL / AIO_SMOKE_HERMES_URL / AIO_SMOKE_LM_URL
# Usage: scripts/aio-smoke.sh

set -uo pipefail

WEB_URL="${AIO_SMOKE_WEB_URL:-http://127.0.0.1:3000/app}"
HERMES_URL="${AIO_SMOKE_HERMES_URL:-http://127.0.0.1:8642/health}"
LM_URL="${AIO_SMOKE_LM_URL:-http://127.0.0.1:1234/v1/models}"

# Reuses aio-context.sh's http_status pattern: short timeout, write-out the code,
# 'offline' when curl can't connect.
http_status() {
  local status
  status="$(curl --max-time 2 --silent --output /dev/null --write-out '%{http_code}' "$1" 2>/dev/null || true)"
  if [[ -z "$status" || "$status" == "000" ]]; then
    printf 'offline'
  else
    printf '%s' "$status"
  fi
}

is_2xx() {
  local s="$1"
  [[ "$s" =~ ^2[0-9][0-9]$ ]]
}

critical_failures=0

# check <severity> <label> <url>  -> prints "PASS/FAIL/WARN  label  url  (status)"
check() {
  local severity="$1" label="$2" url="$3"
  local status
  status="$(http_status "$url")"
  if is_2xx "$status"; then
    printf 'PASS  %-10s  %s  (%s)\n' "$label" "$url" "$status"
    return 0
  fi
  if [[ "$severity" == "advisory" ]]; then
    printf 'WARN  %-10s  %s  (%s)\n' "$label" "$url" "$status"
    return 0
  fi
  printf 'FAIL  %-10s  %s  (%s)\n' "$label" "$url" "$status"
  critical_failures=$((critical_failures + 1))
}

printf 'Aio post-deploy smoke\n'
check critical  web     "$WEB_URL"
check critical  hermes  "$HERMES_URL"
check advisory  lmstudio "$LM_URL"

if (( critical_failures > 0 )); then
  printf '\nSMOKE FAILED: %d critical endpoint(s) unhealthy.\n' "$critical_failures" >&2
  exit 1
fi
printf '\nSMOKE OK: critical endpoints healthy.\n'
