#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MCP_PORT="${MCP_SERVER_PORT:-8081}"
BACKEND_PORT="${SIMULATOR_PORT:-3001}"
FRONTEND_PORT="${VITE_PORT:-5173}"
MCP_URL="http://127.0.0.1:${MCP_PORT}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"
declare -a STARTED_PIDS=()

if ! command -v npm >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1 || ! command -v java >/dev/null 2>&1 || ! command -v mvn >/dev/null 2>&1; then
  echo "run.sh requires Node.js/npm, Java 21+, Maven, and curl." >&2
  exit 1
fi

cd "$ROOT_DIR"

ensure_dependencies() {
  local directory="$1"
  local check_path="$2"

  if [[ ! -e "${directory}/${check_path}" ]]; then
    echo "Installing dependencies in ${directory}..."
    npm ci --prefix "$directory"
  fi
}

ensure_dependencies "$ROOT_DIR/homepulse/client" "node_modules/.bin/vite"

port_is_open() {
  local port="$1"
  (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1
}

service_body() {
  curl --noproxy '*' --silent --show-error --fail --max-time 10 "$1" 2>/dev/null || true
}

stop_started_services() {
  local pid
  trap - EXIT INT TERM
  for pid in "${STARTED_PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  for pid in "${STARTED_PIDS[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
}

trap stop_started_services EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

start_service() {
  local name="$1"
  local port="$2"
  local url="$3"
  local expected="$4"
  shift 4

  local body
  body="$(service_body "$url")"
  if [[ "$body" == *"$expected"* ]]; then
    echo "$name is already healthy on port $port; reusing it."
    return
  fi

  if port_is_open "$port"; then
    echo "Port $port is occupied, but $name did not pass its health check ($url)." >&2
    echo "Stop the other process or choose another port with the SIMULATOR_PORT, VITE_PORT, or MCP_SERVER_PORT environment variable." >&2
    exit 1
  fi

  echo "Starting $name..."
  "$@" &
  STARTED_PIDS+=("$!")

  for _ in {1..45}; do
    body="$(service_body "$url")"
    if [[ "$body" == *"$expected"* ]]; then
      echo "$name is ready on port $port."
      return
    fi
    sleep 1
  done

  echo "$name did not become ready at $url. Check the startup output above." >&2
  exit 1
}

export MCP_SERVER_PORT="$MCP_PORT"
export PORT="$BACKEND_PORT"
export WEB_ORIGIN="http://localhost:${FRONTEND_PORT}"
export MCP_SERVER_URL="http://127.0.0.1:${MCP_PORT}/mcp"
export SIMULATOR_BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
export VITE_PORT="$FRONTEND_PORT"
export VITE_SIMULATOR_API_URL=""

start_service "MCP server" "$MCP_PORT" "$MCP_URL/health" '"status":"ok"' mvn -f "$ROOT_DIR/pom.xml" spring-boot:run
start_service "Simulator backend" "$BACKEND_PORT" "$BACKEND_URL/api/v1/status" '"mcpServer":"connected"' mvn -f "$ROOT_DIR/homepulse/simulator-java/pom.xml" spring-boot:run
start_service "Web frontend" "$FRONTEND_PORT" "$FRONTEND_URL/" 'id="root"' npm --prefix homepulse/client run dev -- --host 127.0.0.1 --strictPort

echo
echo "FoodPulse is ready: http://localhost:${FRONTEND_PORT}"
echo "Press Ctrl+C to stop services started by this script."

while true; do
  for pid in "${STARTED_PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "A service stopped unexpectedly." >&2
      exit 1
    fi
  done
  sleep 2
done
