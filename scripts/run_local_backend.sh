#!/usr/bin/env bash
set -e

echo "=================================================="
echo " Starting CareerPilot Backend Local Dev Server"
echo "=================================================="

# Ensure virtual environment exists
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment (.venv)..."
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install dependencies if needed
echo "Verifying backend dependencies..."
pip install --upgrade pip
pip install -r backend/requirements.txt

# Run Uvicorn dev server with hot reload
export PYTHONPATH=$(pwd)
echo "Launching FastAPI server on http://localhost:8000 ..."
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
