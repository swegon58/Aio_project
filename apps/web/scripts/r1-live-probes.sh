#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="$(cd "${WEB_DIR}/../.." && pwd)"

SUPABASE_CLI="npx -y supabase@2.101.0"
PROBE_PORT="${R1_PROBE_PORT:-3001}"
MAIN_PORT="${AIO_MAIN_PORT:-3000}"
PROBE_URL="http://127.0.0.1:${PROBE_PORT}"
MAIN_URL="http://127.0.0.1:${MAIN_PORT}"
ENV_BACKUP_PATH="${WEB_DIR}/.env.local.r1-probe-backup"
STUB_LOG="${WEB_DIR}/.tmp-r1-stub.log"
PROBE_LOG="${WEB_DIR}/.tmp-r1-probe.log"
MAIN_LOG="${WEB_DIR}/.tmp-r1-main.log"

DEV_PID=""
STUB_PID=""
PROBE_LOCK_PID=""
RESTART_MAIN=0

cleanup() {
  local exit_code=$?

  if [[ -n "${PROBE_LOCK_PID}" ]] && kill -0 "${PROBE_LOCK_PID}" 2>/dev/null; then
    kill "${PROBE_LOCK_PID}" >/dev/null 2>&1 || true
    wait_for_process_exit "${PROBE_LOCK_PID}" >/dev/null 2>&1 || true
  fi

  if [[ -n "${DEV_PID}" ]] && kill -0 "${DEV_PID}" 2>/dev/null; then
    kill "${DEV_PID}" >/dev/null 2>&1 || true
    wait "${DEV_PID}" >/dev/null 2>&1 || true
  fi

  if [[ -n "${STUB_PID}" ]] && kill -0 "${STUB_PID}" 2>/dev/null; then
    kill "${STUB_PID}" >/dev/null 2>&1 || true
    wait "${STUB_PID}" >/dev/null 2>&1 || true
  fi

  if [[ -e "${ENV_BACKUP_PATH}" ]] && [[ ! -e "${WEB_DIR}/.env.local" ]]; then
    mv "${ENV_BACKUP_PATH}" "${WEB_DIR}/.env.local"
  fi

  if [[ "${RESTART_MAIN}" -eq 1 ]]; then
    echo "Restarting Aio on ${MAIN_URL}..."
    (
      cd "${WEB_DIR}"
      setsid bash -lc "npm run dev >\"${MAIN_LOG}\" 2>&1 < /dev/null" >/dev/null 2>&1 &
      for _ in $(seq 1 60); do
        if curl -sfI "${MAIN_URL}/app" >/dev/null 2>&1; then
          echo "Aio is back online at ${MAIN_URL}/app"
          break
        fi
        sleep 1
      done
      if ! curl -sfI "${MAIN_URL}/app" >/dev/null 2>&1; then
        echo "Warning: failed to confirm ${MAIN_URL}/app after restart. See ${MAIN_LOG}."
      fi
    )
  fi

  exit "${exit_code}"
}

trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 2
  fi
}

read_env_value() {
  local key="$1"
  local file="$2"
  sed -n "s/^${key}=//p" "${file}" | head -n 1 | sed -e "s/^['\"]//" -e "s/['\"]$//"
}

wait_for_http_ok() {
  local url="$1"
  local label="$2"
  for _ in $(seq 1 60); do
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' "${url}" || true)"
    if [[ "${code}" == "200" ]]; then
      echo "${label} ready at ${url}"
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for ${label} at ${url}" >&2
  return 1
}

require_command curl
require_command node
require_command sed
require_command lsof

read_next_lock_pid() {
  local lock_path="${WEB_DIR}/.next/dev/lock"
  if [[ ! -f "${lock_path}" ]]; then
    return 0
  fi

  sed -n 's/.*"pid":\([0-9][0-9]*\).*/\1/p' "${lock_path}" | head -n 1
}

wait_for_process_exit() {
  local pid="$1"
  for _ in $(seq 1 30); do
    if ! kill -0 "${pid}" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

cd "${WEB_DIR}"

if [[ -e "${WEB_DIR}/.env.local" ]]; then
  HERMES_DEV_API_SERVER_KEY="$(read_env_value "HERMES_DEV_API_SERVER_KEY" "${WEB_DIR}/.env.local")"
elif [[ -e "${ENV_BACKUP_PATH}" ]]; then
  HERMES_DEV_API_SERVER_KEY="$(read_env_value "HERMES_DEV_API_SERVER_KEY" "${ENV_BACKUP_PATH}")"
else
  echo "Could not find .env.local or ${ENV_BACKUP_PATH} to read HERMES_DEV_API_SERVER_KEY." >&2
  exit 2
fi

if [[ -z "${HERMES_DEV_API_SERVER_KEY:-}" ]]; then
  echo "HERMES_DEV_API_SERVER_KEY is required for the R1 local run-API probe." >&2
  exit 2
fi

echo "Reading local Supabase runtime keys..."
status_env="$(${SUPABASE_CLI} status -o env)"
eval "$(
  printf '%s\n' "${status_env}" | sed -n \
    -e 's/^API_URL=/NEXT_PUBLIC_SUPABASE_URL=/p' \
    -e 's/^ANON_KEY=/NEXT_PUBLIC_SUPABASE_ANON_KEY=/p' \
    -e 's/^SERVICE_ROLE_KEY=/SUPABASE_SERVICE_ROLE_KEY=/p'
)"

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ]] || [[ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]] || [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Failed to resolve local Supabase runtime keys from '${SUPABASE_CLI} status -o env'." >&2
  exit 2
fi

main_pid="$(lsof -tiTCP:${MAIN_PORT} -sTCP:LISTEN || true)"
lock_pid="$(read_next_lock_pid || true)"

if [[ -z "${main_pid}" ]] && [[ -n "${lock_pid}" ]] && kill -0 "${lock_pid}" 2>/dev/null; then
  main_pid="${lock_pid}"
fi

if [[ -n "${main_pid}" ]]; then
  echo "Stopping current Aio dev server on ${MAIN_URL} (pid ${main_pid}) for probe isolation..."
  kill "${main_pid}" >/dev/null 2>&1 || true
  wait_for_process_exit "${main_pid}" || true
  RESTART_MAIN=1
fi

if [[ -e "${WEB_DIR}/.env.local" ]]; then
  echo "Temporarily moving shared .env.local aside so local probe env wins..."
  mv "${WEB_DIR}/.env.local" "${ENV_BACKUP_PATH}"
fi

echo "Starting Hermes stop-route stub on 127.0.0.1:8642..."
node -e 'const http=require("http");const server=http.createServer((req,res)=>{if(req.url==="/health"||req.url==="/v1/health"){res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({status:"ok"}));return;}if(req.method==="POST"&&/^\/v1\/runs\/[^/]+\/stop$/.test(req.url||"")){res.writeHead(404,{"content-type":"application/json"});res.end(JSON.stringify({error:"run_not_found"}));return;}res.writeHead(404,{"content-type":"application/json"});res.end(JSON.stringify({error:"not_found"}));});server.listen(8642,"127.0.0.1",()=>console.log("stub-hermes-8642 ready"));setInterval(()=>{},1<<30);' >"${STUB_LOG}" 2>&1 &
STUB_PID=$!
wait_for_http_ok "http://127.0.0.1:8642/health" "Hermes stub"

echo "Starting isolated Aio probe server on ${PROBE_URL}..."
AIO_DEPLOYMENT_ENV=development \
NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
NEXT_PUBLIC_DEV_AUTH_BYPASS=true \
HERMES_DEV_API_SERVER_KEY="${HERMES_DEV_API_SERVER_KEY}" \
npm run dev -- --port "${PROBE_PORT}" >"${PROBE_LOG}" 2>&1 &
DEV_PID=$!
wait_for_http_ok "${PROBE_URL}/api/runs?limit=1" "Aio probe API"
PROBE_LOCK_PID="$(read_next_lock_pid || true)"

echo "Running R1.4 live repository probe..."
(
  cd "${PROJECT_ROOT}"
  NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
  SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
  npx tsx apps/web/scripts/r1-4-repo-probe.ts
)

echo "Running R1.6 live run API probe..."
(
  cd "${WEB_DIR}"
  NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
  NEXT_PUBLIC_DEV_AUTH_BYPASS=true \
  AIO_BASE_URL="${PROBE_URL}" \
  npx tsx scripts/r1-6-runs-api-probe.ts
)

echo
echo "R1 live probes passed."
echo "- R1.4 repository probe: green"
echo "- R1.6 run API probe: green"
echo "- Temporary probe server logs: ${PROBE_LOG}"
echo "- Temporary Hermes stub log: ${STUB_LOG}"
