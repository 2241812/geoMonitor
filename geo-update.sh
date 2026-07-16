#!/bin/sh
# geo-update.sh — Drag-and-drop GeoJSON/TopoJSON files to update + deploy
# Works on Cinnamon, KDE, GNOME: drop a file onto this script.
# Usage: ./geo-update.sh /path/to/file.geojson [file2 ...]

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ $# -eq 0 ]; then
  echo "=== GeoMonitor Update ==="
  echo "No files dropped."
  echo "Drag a .geojson / .topojson / .json file onto this script."
  echo ""
  echo "Watcher mode available:"
  echo "  cd $PROJECT_DIR"
  echo "  npm run deploy:watch"
  echo ""
  read -p "Press Enter to close..."
  exit 1
fi

echo "========================================"
echo "   GeoMonitor — GeoJSON Update Tool"
echo "========================================"
echo ""

for FILE in "$@"; do
  echo "--- Processing: $(basename "$FILE") ---"
  echo ""
  node "$PROJECT_DIR/scripts/update-deploy.mjs" "$FILE"
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "  FAILED (exit code $EXIT_CODE)"
  fi
  echo ""
done

echo "========================================"
echo "   Done! Check the output above."
echo "========================================"
echo ""
echo "Tip: Run 'npm run deploy:watch' in the"
echo "project directory for automatic processing."
read -p "Press Enter to close..."
