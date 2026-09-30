#!/usr/bin/env bash
# ==============================================================================
# CareerPilot AI — Self-Hosted Local n8n Community Edition Launcher
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Ensure persistent storage directory exists
N8N_DATA_DIR="${PROJECT_ROOT}/data/n8n"
mkdir -p "${N8N_DATA_DIR}"

# Configuration
export N8N_PORT="${N8N_PORT:-5678}"
export N8N_HOST="${N8N_HOST:-127.0.0.1}"
export N8N_PROTOCOL="http"
export N8N_WEBHOOK_URL="http://localhost:${N8N_PORT}/"
export WEBHOOK_URL="http://localhost:${N8N_PORT}/"
export N8N_USER_FOLDER="${N8N_DATA_DIR}"
export N8N_RUNNERS_MODE="internal"
export N8N_DIAGNOSTICS_ENABLED="false"
export N8N_VERSION_NOTIFICATIONS_ENABLED="false"
export N8N_HIRING_BANNER_ENABLED="false"
export N8N_METRICS_ENABLED="false"
export N8N_DEFAULT_BINARY_DATA_MODE="filesystem"

echo "=================================================="
echo "Starting Local n8n Community Edition for CareerPilot"
echo "URL:         http://localhost:${N8N_PORT}"
echo "Persistence: ${N8N_DATA_DIR}"
echo "=================================================="

# Locate n8n binary or fallback to npx
if [ -f "${HOME}/.npm/_npx/a8a7eec953f1f314/node_modules/n8n/bin/n8n" ]; then
  exec node "${HOME}/.npm/_npx/a8a7eec953f1f314/node_modules/n8n/bin/n8n" start
elif command -v n8n >/dev/null 2>&1; then
  exec n8n start
else
  exec npx -y n8n start
fi
