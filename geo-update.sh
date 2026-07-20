#!/usr/bin/env bash
# Source profile so node is found (needed for nvm/non-login shells)
[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"
[ -f "$HOME/.profile" ] && . "$HOME/.profile"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found in PATH."
  echo "Install Node.js from https://nodejs.org or via nvm."
  read -p "Press Enter to close..."
  exit 1
fi

# Kill any lingering server on port 3479 (mirrors geoJSONUpdater.bat behavior)
echo "Checking for existing server on port 3479..."
if command -v lsof &>/dev/null; then
  PID=$(lsof -ti:3479 2>/dev/null)
  if [ -n "$PID" ]; then
    echo "  Killing process $PID..."
    kill "$PID" 2>/dev/null
    sleep 1
  fi
fi
if command -v fuser &>/dev/null; then
  fuser -k 3479/tcp 2>/dev/null
  sleep 0.5
fi

echo ""
echo "========================================"
echo "   GeoMonitor - Deploy GUI"
echo "========================================"
echo ""

cd "$PROJECT_DIR" && node geoJSONUpdater/server.mjs

echo ""
read -p "Press Enter to close..."
