#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/swegon/AI_Agent/Aio_project"
UNIT_SRC_DIR="$ROOT/config/systemd"
UNIT_DST_DIR="$HOME/.config/systemd/user"
SERVICES=(
  aio-hermes.service
  aio-hermes-supervisor.service
  aio-job-worker.service
  aio-app.service
)

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-60}"
  local i
  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "warning: $label did not become ready at $url" >&2
  return 1
}

install_units() {
  mkdir -p "$UNIT_DST_DIR"
  install -m 0644 "$UNIT_SRC_DIR/aio-hermes.service" "$UNIT_DST_DIR/aio-hermes.service"
  install -m 0644 "$UNIT_SRC_DIR/aio-hermes-supervisor.service" "$UNIT_DST_DIR/aio-hermes-supervisor.service"
  install -m 0644 "$UNIT_SRC_DIR/aio-job-worker.service" "$UNIT_DST_DIR/aio-job-worker.service"
  install -m 0644 "$UNIT_SRC_DIR/aio-app.service" "$UNIT_DST_DIR/aio-app.service"
  install -m 0644 "$UNIT_SRC_DIR/aio-online.target" "$UNIT_DST_DIR/aio-online.target"
  chmod +x \
    "$ROOT/scripts/run-aio-app.sh" \
    "$ROOT/scripts/run-aio-hermes.sh" \
    "$ROOT/scripts/run-aio-hermes-supervisor.sh" \
    "$ROOT/scripts/run-aio-job-worker.sh"
  systemctl --user daemon-reload
}

start_stack() {
  systemctl --user enable aio-online.target
  systemctl --user enable "${SERVICES[@]}"
  systemctl --user start aio-hermes.service
  systemctl --user start aio-hermes-supervisor.service
  systemctl --user start aio-job-worker.service
  systemctl --user start aio-app.service
  wait_for_http "http://127.0.0.1:8642/health" "Hermes health"
  wait_for_http "http://127.0.0.1:3000/app" "Aio web"
}

stop_stack() {
  systemctl --user stop aio-app.service aio-job-worker.service aio-hermes-supervisor.service aio-hermes.service
}

status_stack() {
  systemctl --user --no-pager --full status "${SERVICES[@]}" || true
  "$ROOT/scripts/aio-context.sh" || true
}

logs_stack() {
  journalctl --user -u aio-hermes.service -u aio-hermes-supervisor.service -u aio-job-worker.service -u aio-app.service -n 200 --no-pager
}

restart_stack() {
  systemctl --user restart aio-hermes.service aio-hermes-supervisor.service aio-job-worker.service aio-app.service
}

case "${1:-install}" in
  install)
    install_units
    start_stack
    status_stack
    ;;
  start)
    start_stack
    status_stack
    ;;
  stop)
    stop_stack
    ;;
  restart)
    restart_stack
    status_stack
    ;;
  status)
    status_stack
    ;;
  logs)
    logs_stack
    ;;
  *)
    echo "usage: $0 {install|start|stop|restart|status|logs}" >&2
    exit 1
    ;;
esac
