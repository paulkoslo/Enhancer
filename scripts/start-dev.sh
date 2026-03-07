#!/bin/zsh

set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"
API_HEALTH_URL="http://127.0.0.1:${API_PORT}/health"
WEB_URL="http://127.0.0.1:${WEB_PORT}"

DEV_DIR="$ROOT_DIR/var/dev"
PID_FILE="$DEV_DIR/enhancer-dev.pids"
API_LOG="$DEV_DIR/api.log"
WEB_LOG="$DEV_DIR/web.log"

mkdir -p "$DEV_DIR"

function require_path() {
  local path="$1"
  local message="$2"
  if [[ ! -e "$path" ]]; then
    echo "$message"
    exit 1
  fi
}

function stop_existing_launcher() {
  if [[ ! -f "$PID_FILE" ]]; then
    return
  fi

  local api_pid=""
  local web_pid=""
  IFS=' ' read -r api_pid web_pid < "$PID_FILE" || true

  for pid in "$web_pid" "$api_pid"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done

  rm -f "$PID_FILE"
}

function ensure_port_free() {
  local port="$1"
  if lsof -ti "tcp:${port}" >/dev/null 2>&1; then
    echo "Port ${port} is already in use. Stop the existing process or close the previous launcher first."
    exit 1
  fi
}

function wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts=60

  until curl -fsS "$url" >/dev/null 2>&1; do
    (( attempts-- )) || {
      echo "${label} did not start in time."
      return 1
    }
    sleep 1
  done

  return 0
}

function cleanup() {
  trap - EXIT INT TERM

  for pid in "${WEB_PID:-}" "${API_PID:-}"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done

  wait "${WEB_PID:-}" 2>/dev/null || true
  wait "${API_PID:-}" 2>/dev/null || true
  rm -f "$PID_FILE"
}

require_path "$ROOT_DIR/.venv/bin/uvicorn" "Missing backend virtualenv. Run 'python3 -m venv .venv' and install the backend dependencies first."
require_path "$ROOT_DIR/apps/web/package.json" "The web app directory is missing."

if [[ ! -d "$ROOT_DIR/node_modules" ]] && [[ ! -d "$ROOT_DIR/apps/web/node_modules" ]]; then
  echo "Missing frontend dependencies. Run 'npm install' from the repo root first."
  exit 1
fi

stop_existing_launcher
ensure_port_free "$API_PORT"
ensure_port_free "$WEB_PORT"

export ENHANCER_ENCRYPTION_SECRET="${ENHANCER_ENCRYPTION_SECRET:-dev-secret}"
export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:${API_PORT}/api}"

: > "$API_LOG"
: > "$WEB_LOG"

"$ROOT_DIR/.venv/bin/uvicorn" app.main:app --reload --app-dir "$ROOT_DIR/apps/api" >"$API_LOG" 2>&1 &
API_PID=$!

(
  cd "$ROOT_DIR/apps/web"
  NEXT_PUBLIC_API_BASE_URL="$NEXT_PUBLIC_API_BASE_URL" npm run dev >"$WEB_LOG" 2>&1
) &
WEB_PID=$!

echo "$API_PID $WEB_PID" > "$PID_FILE"
trap cleanup EXIT INT TERM

wait_for_url "$API_HEALTH_URL" "API" || {
  echo "Backend logs: $API_LOG"
  exit 1
}

wait_for_url "$WEB_URL" "Web app" || {
  echo "Frontend logs: $WEB_LOG"
  exit 1
}

echo ""
echo "Enhancer development is running."
echo "App: http://localhost:${WEB_PORT}"
echo "API health: http://localhost:${API_PORT}/health"
echo "Backend log: $API_LOG"
echo "Frontend log: $WEB_LOG"
echo "Press Ctrl+C in this window to stop both services."
echo ""

open "http://localhost:${WEB_PORT}" >/dev/null 2>&1 || true

while true; do
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "The API process stopped. Last backend log lines:"
    tail -n 40 "$API_LOG" || true
    exit 1
  fi

  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo "The web process stopped. Last frontend log lines:"
    tail -n 40 "$WEB_LOG" || true
    exit 1
  fi

  sleep 2
done
