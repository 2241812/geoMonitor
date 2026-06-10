# DENR CAR Watershed Monitoring (geoMonitor)

An interactive web map for monitoring the 14 major watersheds of the Cordillera Administrative Region (CAR), Philippines.

Built for the Department of Environment and Natural Resources (DENR).

## Current Status

Phase 2–4 scaffolding complete. The web app is functional as a static site:

- **Landing page** (`main/index.html`) — project intro with CTA to the map
- **Map dashboard** (`main/map.html`) — Leaflet map + Chart.js dashboard in a split-pane layout
- **GeoJSON data loaded** — 7 boundary files across two sources (NAMRIA + CAD) covering 4 administrative levels: Region, Province, Municipality, Barangay (~3.4 MB total)
- **Interactive features** — click any polygon to highlight it, zoom to fit, and view its properties and a chart in the side panel
- **Responsive design** — stacks vertically on mobile

### What's implemented

| Feature | Status |
|---------|--------|
| Landing page with branding | Done |
| Leaflet map with 3 basemaps (OSM, Topo, Satellite) | Done |
| GeoJSON layer loading with styling | Done |
| Layer control (show/hide admin levels) | Done |
| Click-to-select with highlight + fitBounds | Done |
| Dashboard panel with property details | Done |
| Chart.js bar chart of numeric attributes | Done |
| Responsive layout (mobile/tablet) | Done |
| Loading overlay during data fetch | Done |

### What's left (from project plan)

- **Phase 1 (ongoing)**: Verify GeoJSON accuracy and attribute completeness; re-simplify if needed for performance
- **Phase 3 (extensions)**: Add watershed boundary, river, cave, contour, and geology layers
- **Phase 4 (extension)**: Add population, geological breakdown, and per-watershed filtering to the dashboard

## Quick Start

```sh
python3 -m http.server 8000 -d main
```

Then open `http://localhost:8000` in a browser. A server is required because `fetch()` is used to load GeoJSON files.

## Tech Stack

- **Mapping**: [Leaflet.js](https://leafletjs.com/) 1.9.4 (CDN)
- **Charts**: [Chart.js](https://www.chartjs.org/) 4.4.7 (CDN)
- **Font**: [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts
- **Data format**: GeoJSON (converted from ArcGIS Shapefiles via Mapshaper/QGIS)

## Repository Structure

```
main/
├── assets/
│   ├── css/style.css         # All styles (landing, map, dashboard, responsive)
│   └── js/
│       ├── app.js            # Global APP object, config, state, EventTarget
│       ├── map-init.js       # initMap() — Leaflet map + basemaps + layer control
│       ├── map-layers.js     # initLayers() — GeoJSON loading, click/hover events
│       └── dashboard.js      # initDashboard() — info panel + Chart.js integration
├── geoJSON/
│   ├── CAR NAMRIA Boundary.geojson
│   ├── CAR NAMRIA Provincial Boundary.geojson
│   ├── CAR NAMRIA Municipal Boundary.geojson
│   ├── CAR NAMRIA Barangay Boundary.geojson
│   ├── CAR CAD Boundary.geojson
│   ├── CAR CAD Provincial Boundary.geojson
│   └── CAR CAD Municipal Boundary.geojson
├── index.html                # Landing page
├── map.html                  # Map + dashboard page
└── src/context/
    └── DENR_Watershed_Monitoring_Plan.md  # Original project plan & learning guide
```

## Data Sources

- **NAMRIA** — National Mapping and Resource Information Authority
- **CAD** — Cadastral (land ownership records)

Both provide CAR administrative boundaries at multiple levels.

## Development Notes

- **No build system** — edit HTML/CSS/JS directly; refresh to see changes
- **Script load order is strict** (in `map.html`): `app.js` → `map-init.js` → `map-layers.js` → `dashboard.js`
- **Global state** lives on the `APP` object (`app.js`); modules communicate via custom events (`EVENTS.FEATURE_SELECT` / `EVENTS.FEATURE_CLEAR`)
- GeoJSON files are single-line JSON (no trailing newline); valid but `wc -l` reports 0
- No tests, CI, linter, or formatter configured
