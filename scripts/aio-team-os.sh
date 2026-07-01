#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

ACTIVE_CHUNK="${AIO_TEAM_OS_ACTIVE_CHUNK:-.claude/agents/coordination/ACTIVE_CHUNK.md}"
HANDOFF_LOG="${AIO_TEAM_OS_HANDOFF_LOG:-.claude/agents/coordination/HANDOFF_LOG.md}"
TEAM_SPEC="${AIO_TEAM_OS_TEAM_SPEC:-.claude/agents/TEAM_SPEC.md}"
PLAYBOOK="${AIO_TEAM_OS_PLAYBOOK:-.claude/agents/OPERATING_PLAYBOOK.md}"
CHECKLIST="${AIO_TEAM_OS_CHECKLIST:-.claude/agents/AIO_TEAM_OS_CHECKLIST.md}"
GRILL_DECISION_MAP="${AIO_TEAM_OS_GRILL_DECISION_MAP:-.claude/agents/GRILL_DECISION_MAP.md}"
GRILL_PROGRESS="${AIO_TEAM_OS_GRILL_PROGRESS:-.claude/agents/GRILL_PROGRESS.md}"
ROLE_EVIDENCE_LOG="${AIO_TEAM_OS_ROLE_EVIDENCE_LOG:-.claude/agents/ROLE_EVIDENCE_LOG.md}"
ACTIVE_CHUNK_TEMPLATE="${AIO_TEAM_OS_ACTIVE_CHUNK_TEMPLATE:-.claude/agents/templates/ACTIVE_CHUNK_TEMPLATE.md}"

usage() {
  cat <<'EOF'
usage: scripts/aio-team-os.sh <command> [args]

commands:
  status
      Show the current Team OS chunk and local working context.

  progress
      Show only the grill-plan progress summary.

  doctor
      Validate that the Team OS local operating surface is healthy.

  start-chunk <chunk_id> [owner]
      Re-seed ACTIVE_CHUNK.md from template with a new chunk id.
      Refuses to overwrite an in-progress chunk.
EOF
}

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    printf 'missing required file: %s\n' "$path" >&2
    exit 1
  fi
}

markdown_value_after_heading() {
  local file="$1"
  local heading="$2"
  awk -v heading="$heading" '
    $0 == heading { found=1; next }
    found && NF { print; exit }
  ' "$file"
}

strip_markdown_value() {
  sed -E 's/^[-*] +//; s/^`//; s/`$//'
}

chunk_id() {
  markdown_value_after_heading "$ACTIVE_CHUNK" "## Mã Chunk" | strip_markdown_value
}

chunk_status() {
  markdown_value_after_heading "$ACTIVE_CHUNK" "## Trạng Thái Hiện Tại" | strip_markdown_value
}

chunk_owner() {
  markdown_value_after_heading "$ACTIVE_CHUNK" "## Owner Của Chunk" | strip_markdown_value
}

grill_progress() {
  markdown_value_after_heading "$GRILL_PROGRESS" "## Tiến Độ Tổng" | strip_markdown_value
}

computed_grill_progress() {
  awk '
    /- trạng thái: `xong`/ { score += 1; total += 1; next }
    /- trạng thái: `đang chạy`/ { score += 0.5; total += 1; next }
    /- trạng thái: `đang làm`/ { score += 0.5; total += 1; next }
    /- trạng thái: `chưa tới`/ { total += 1; next }
    /- trạng thái: `chưa có đủ evidence`/ { total += 1; next }
    END {
      if (total == 0) {
        print "unknown"
      } else {
        printf "%.0f%%", (score / total) * 100
      }
    }
  ' "$GRILL_PROGRESS"
}

grill_score_line() {
  awk '
    /^Điểm hiện tại:/ { found=1; next }
    found && NF { print; exit }
  ' "$GRILL_PROGRESS" | strip_markdown_value
}

tracked_dirty_count() {
  git status --porcelain --untracked-files=no | wc -l | tr -d ' '
}

untracked_count() {
  git status --porcelain | awk '$1 == "??" { count++ } END { print count + 0 }'
}

check_local_only() {
  local path="$1"
  local abs_root abs_path repo_path

  abs_root="$(cd "$ROOT" && pwd -P)"
  if [[ "$path" = /* ]]; then
    abs_path="$path"
  else
    abs_path="$ROOT/$path"
  fi

  case "$abs_path" in
    "$abs_root"/*)
      repo_path="${abs_path#"$abs_root"/}"
      git check-ignore -q "$repo_path"
      ;;
    *)
      return 1
      ;;
  esac
}

status_cmd() {
  require_file "$ACTIVE_CHUNK"

  printf 'Aio Team OS\n'
  printf '  root: %s\n' "$ROOT"
  printf '  branch: %s\n' "$(git branch --show-current)"
  printf '  chunk: %s\n' "$(chunk_id)"
  printf '  owner: %s\n' "$(chunk_owner)"
  printf '  status: %s\n' "$(chunk_status)"
  if [[ -f "$GRILL_PROGRESS" ]]; then
    printf '  grill progress: %s\n' "$(grill_progress)"
    printf '  grill progress computed: %s\n' "$(computed_grill_progress)"
  fi
  printf '  tracked dirty entries: %s\n' "$(tracked_dirty_count)"
  printf '  untracked entries: %s\n' "$(untracked_count)"

  if check_local_only "$ACTIVE_CHUNK"; then
    printf '  active chunk local-only: yes\n'
  else
    printf '  active chunk local-only: no\n'
  fi

  if check_local_only "$HANDOFF_LOG"; then
    printf '  handoff log local-only: yes\n'
  else
    printf '  handoff log local-only: no\n'
  fi

  printf '\nRead next\n'
  printf '  %s\n' "$TEAM_SPEC"
  printf '  %s\n' "$GRILL_DECISION_MAP"
  printf '  %s\n' "$GRILL_PROGRESS"
  printf '  %s\n' "$ROLE_EVIDENCE_LOG"
  printf '  %s\n' "$PLAYBOOK"
  printf '  %s\n' "$CHECKLIST"
}

progress_cmd() {
  require_file "$GRILL_PROGRESS"

  printf 'Aio Team OS progress\n'
  printf '  declared: %s\n' "$(grill_progress)"
  printf '  computed: %s\n' "$(computed_grill_progress)"
  printf '  score: %s\n' "$(grill_score_line)"
  printf '\nRemaining\n'
  awk '
    /^### / {
      title=$0
      sub(/^### [0-9]+\. /, "", title)
      next
    }
    /- trạng thái: `đang chạy`/ {
      print "  - " title " — đang chạy"
      next
    }
    /- trạng thái: `chưa tới`/ {
      print "  - " title " — chưa tới"
      next
    }
    /- trạng thái: `chưa có đủ evidence`/ {
      print "  - " title " — chưa có đủ evidence"
      next
    }
  ' "$GRILL_PROGRESS"
}

doctor_cmd() {
  local failures=0
  local warnings=0
  local current_chunk
  local current_status

  for path in \
    "$TEAM_SPEC" \
    "$PLAYBOOK" \
    "$CHECKLIST" \
    "$GRILL_DECISION_MAP" \
    "$GRILL_PROGRESS" \
    "$ROLE_EVIDENCE_LOG" \
    "$ACTIVE_CHUNK" \
    "$HANDOFF_LOG" \
    "$ACTIVE_CHUNK_TEMPLATE"
  do
    if [[ -f "$path" ]]; then
      printf '[ok] %s exists\n' "$path"
    else
      printf '[fail] %s is missing\n' "$path"
      failures=$((failures + 1))
    fi
  done

  current_chunk="$(chunk_id 2>/dev/null || true)"
  current_status="$(chunk_status 2>/dev/null || true)"

  if [[ -n "$current_chunk" && "$current_chunk" != "YYYY-MM-DD_<phase>_<mô-tả-ngắn>" ]]; then
    printf '[ok] active chunk id is seeded: %s\n' "$current_chunk"
  else
    printf '[fail] ACTIVE_CHUNK.md still has a placeholder chunk id\n'
    failures=$((failures + 1))
  fi

  case "$current_status" in
    "chưa bắt đầu"|"đang làm"|"chờ xác minh"|"đã xong"|"bị chặn")
      printf '[ok] active chunk status is valid: %s\n' "$current_status"
      ;;
    *)
      printf '[fail] active chunk status is invalid or missing: %s\n' "${current_status:-<empty>}"
      failures=$((failures + 1))
      ;;
  esac

  if check_local_only "$ACTIVE_CHUNK"; then
    printf '[ok] ACTIVE_CHUNK.md stays local-only\n'
  else
    printf '[fail] ACTIVE_CHUNK.md is not ignored locally\n'
    failures=$((failures + 1))
  fi

  if check_local_only "$HANDOFF_LOG"; then
    printf '[ok] HANDOFF_LOG.md stays local-only\n'
  else
    printf '[fail] HANDOFF_LOG.md is not ignored locally\n'
    failures=$((failures + 1))
  fi

  if grep -Fq "$(chunk_id)" "$HANDOFF_LOG"; then
    printf '[ok] handoff log references the current chunk id\n'
  else
    printf '[warn] handoff log does not mention the current chunk id yet\n'
    warnings=$((warnings + 1))
  fi

  if grep -Fq 'YYYY-MM-DD_<phase>_<mô-tả-ngắn>' "$ACTIVE_CHUNK_TEMPLATE"; then
    printf '[ok] active-chunk template still preserves the seed placeholder\n'
  else
    printf '[warn] active-chunk template no longer exposes the seed placeholder\n'
    warnings=$((warnings + 1))
  fi

  if [[ -f "$GRILL_PROGRESS" ]]; then
    declared_progress="$(grill_progress)"
    computed_progress="$(computed_grill_progress)"
    if [[ "$declared_progress" == "$computed_progress" ]]; then
      printf '[ok] grill progress matches computed score: %s\n' "$computed_progress"
    else
      printf '[fail] grill progress mismatch: declared %s, computed %s\n' "$declared_progress" "$computed_progress"
      failures=$((failures + 1))
    fi
  fi

  printf '\nSummary: %s fail, %s warn\n' "$failures" "$warnings"
  if (( failures > 0 )); then
    return 1
  fi
}

start_chunk_cmd() {
  local new_chunk_id="${1:-}"
  local owner="${2:-main coding agent}"
  local current_status

  if [[ -z "$new_chunk_id" ]]; then
    printf 'start-chunk requires <chunk_id>\n' >&2
    exit 1
  fi

  if [[ ! "$new_chunk_id" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}_[a-z0-9-]+_[a-z0-9-]+$ ]]; then
    printf 'invalid chunk id format: %s\n' "$new_chunk_id" >&2
    printf 'expected: YYYY-MM-DD_phase_short-slug\n' >&2
    exit 1
  fi

  require_file "$ACTIVE_CHUNK_TEMPLATE"
  require_file "$ACTIVE_CHUNK"
  current_status="$(chunk_status)"

  if [[ "$current_status" != "đã xong" && "$current_status" != "chưa bắt đầu" && "$current_status" != "chưa bắt đầu / đang làm / chờ xác minh / đã xong / bị chặn" ]]; then
    printf 'refusing to overwrite ACTIVE_CHUNK.md while status is: %s\n' "$current_status" >&2
    printf 'close the current chunk first or update the file manually if this is intentional.\n' >&2
    exit 1
  fi

  cp "$ACTIVE_CHUNK_TEMPLATE" "$ACTIVE_CHUNK"
  perl -0pi -e 's/`YYYY-MM-DD_<phase>_<mô-tả-ngắn>`/`'"$new_chunk_id"'`/' "$ACTIVE_CHUNK"
  perl -0pi -e 's/## Owner Của Chunk\n\n- \s*\n/## Owner Của Chunk\n\n- '"$owner"'\n\n/' "$ACTIVE_CHUNK"
  perl -0pi -e 's/- chưa bắt đầu \/ đang làm \/ chờ xác minh \/ đã xong \/ bị chặn/- đang làm/' "$ACTIVE_CHUNK"

  printf 'seeded %s from template\n' "$ACTIVE_CHUNK"
  status_cmd
}

case "${1:-status}" in
  status)
    status_cmd
    ;;
  progress)
    progress_cmd
    ;;
  doctor)
    doctor_cmd
    ;;
  start-chunk)
    shift
    start_chunk_cmd "$@"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
