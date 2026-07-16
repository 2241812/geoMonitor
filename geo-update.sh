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

if [ $# -eq 0 ]; then
  echo "========================================"
  echo "   GeoMonitor - Watcher Mode"
  echo "========================================"
  echo ""
  echo "Drop .geojson / .topojson / .json files into:"
  echo "  $PROJECT_DIR/gis-drop/"
  echo ""
  echo "Press Ctrl+C to stop."
  echo "========================================"
  echo ""
  cd "$PROJECT_DIR" && node scripts/update-deploy.mjs --watch
  echo "Watcher stopped unexpectedly."
  read -p "Press Enter to close..."
  exit 0
fi

echo "========================================"
echo "   GeoMonitor - Update Tool"
echo "========================================"
echo ""
for FILE in "$@"; do
  echo "--- Processing: $(basename "$FILE") ---"
  echo ""
  cd "$PROJECT_DIR" && node scripts/update-deploy.mjs "$FILE"
  if [ $? -ne 0 ]; then echo "  FAILED"; fi
  echo ""
done
echo "========================================"
echo "   Done"
echo "========================================"
read -p "Press Enter to close..."
