#!/usr/bin/env bash
# Runs on every attach. Starts the API (which also serves the built frontend)
# unless it is already running.
set -euo pipefail

cd "$(dirname "$0")/.."

if pgrep -f "node server.js" > /dev/null 2>&1; then
  echo "TSV is already running on port 5000."
  exit 0
fi

mkdir -p .devcontainer/logs
nohup npm --prefix backend start > .devcontainer/logs/api.log 2>&1 &

for _ in $(seq 1 30); do
  if curl -fsS http://localhost:5000/api/health > /dev/null 2>&1; then
    cat <<'BANNER'

  TSV is running on port 5000.
  Open the Ports tab and click the globe icon next to port 5000.

  Sign in with any demo account (password: Password123!):
    manager@demo.test   management -- triage queue, reports, people
    sam@demo.test       staff      -- assigned work
    dana@demo.test      homeowner  -- their own requests

  Logs:    .devcontainer/logs/api.log
  Restart: pkill -f "node server.js" && bash .devcontainer/start.sh

BANNER
    exit 0
  fi
  sleep 1
done

echo "The API did not come up. Check .devcontainer/logs/api.log"
exit 1
