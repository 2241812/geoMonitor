#!/bin/sh
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ $# -eq 0 ]; then
  # ── Watcher mode (double-click) ──
  echo "========================================"
  echo "   GeoMonitor \342\200\224 Watcher Mode"
  echo "========================================"
  echo ""
  echo "Drop .geojson / .topojson / .json files into:"
  echo "  $PROJECT_DIR/gis-drop/"
  echo ""
  echo "Press Ctrl+C to stop."
  echo "========================================"
  echo ""
  cd "$PROJECT_DIR" && node scripts/update-deploy.mjs --watch
  exit 0
fi

# ── Drag-and-drop mode ──
echo "========================================"
echo "   GeoMonitor \342\200\224 Update Tool"
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
