#!/usr/bin/env bash
set -e

echo "=================================================="
echo " Running CareerPilot AI Test Suite"
echo "=================================================="

# Ensure virtual environment exists
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment (.venv)..."
    python3 -m venv .venv
fi

source .venv/bin/activate
export PYTHONPATH=$(pwd)

# Run Pytest with coverage and verbose output
pytest -v backend/tests/
