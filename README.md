# DENR CAR Watershed Monitoring (geoMonitor)

Interactive web map for exploring administrative boundaries of the Cordillera Administrative Region (CAR), Philippines — built for DENR.

**Live**: https://geo-monitor-ten.vercel.app

## Quick Start

```sh
python3 -m http.server 8000 -d main
```

Open `http://localhost:8000`. A server is required (`fetch()` loads GeoJSON).

## Tech Stack

- **Mapping**: Leaflet 1.9.4 (Canvas renderer), Esri World Topo / OSM / Satellite basemaps
- **Charts**: Chart.js 4.4.7
- **Font**: Inter via Google Fonts
- **Build**: None — static HTML/CSS/JS, edit and refresh
- **Data**: GeoJSON (converted from ArcGIS Shapefiles)

## What It Does

Drill-down map of CAR administrative boundaries with two data sources:

| Source | Levels | Drill Path |
|--------|--------|------------|
| **NAMRIA** | 3 | Region → Province → Municipality |
| **CAD** | 2 | Region → Municipality |

Click any polygon to open an info panel with property details + bar chart of numeric measurements. Click empty space to drill back up. Toggle data sources via the NAMRIA/CAD button in the breadcrumb.

Boundary overlays (Province / Municipality outlines) can be toggled as a floating dark panel — mutually exclusive radio mode.

## Repository Structure

```
main/
├── assets/
│   ├── css/map.css           # All styles (landing, map, dashboard, responsive)
│   └── js/
│       ├── app.js            # APP object — state, config, drill logic, panels, overlays
│       ├── map-layers.js     # initLayers() — fetches and renders levels 0 and 1
│       └── dashboard.js      # Compatibility shim — delegates to APP.openPanel / closePanel
├── geoJSON/
│   ├── CAR NAMRIA Boundary.geojson
│   ├── CAR NAMRIA Provincial Boundary.geojson
│   ├── CAR NAMRIA Municipal Boundary.geojson
│   ├── CAR CAD Boundary.geojson
│   ├── CAR CAD Municipal Boundary.geojson
│   ├── hierarchy-namria.json              # Preprocessed parent/child/name lookup
│   └── hierarchy-cad.json                 # Same for CAD source
├── index.html                # Landing page
├── map.html                  # Map + dashboard page
└── preprocess-hierarchy.js   # Build-time script (node) — cross-walks GeoJSON → hierarchy
```

## Data Sources

- **NAMRIA** — National Mapping and Resource Information Authority (3 levels: Region, Province, Municipality)
- **CAD** — Cadastral (2 levels: Region, Municipality; no separate province geometry)

Both cover CAR administrative boundaries at multiple levels with different property schemas.

## Key Architecture

- **Global state** lives on `APP` object (`app.js`) — all config, layers, drill path, panel state
- **No build system** — edit directly, refresh to see changes
- **Script load order** (strict, `map.html`): `app.js` → `map-layers.js` → `dashboard.js`, then inline `DOMContentLoaded` calls `APP.init()` → `initLayers()`
- **No programmatic zoom** — all zoom/pan is user-controlled (scroll, pinch)
- **Canvas renderer** (`preferCanvas: true`) — `_suppressMapClick` flag prevents double drill-up
- **`_drilling` guard** — prevents concurrent drillDown/drillUp calls

### Source Toggle

A NAMRIA/CAD button in the breadcrumb switches data sources. Switching clears all layers, loads the correct hierarchy file, and re-initializes the map.

### Hierarchy Preprocessing

A build-time script cross-walks all GeoJSON files, computing stable `_id` / `_parentId` for every feature:

```sh
node preprocess-hierarchy.js
```

Outputs `hierarchy-namria.json` and `hierarchy-cad.json` with `{ parents, children, names }` maps. Each GeoJSON file is updated in-place with `_id` / `_parentId`. The runtime `_filterToParent` is a simple:

```js
data.features.filter(f => f.properties._parentId === parentId)
```

Run this script and re-deploy if GeoJSON source files are updated.

### Drill-Down Flow

1. **init**: Levels 0 (CAR boundary) and 1 (provinces / municipalities) fetched in parallel
2. **Click a feature**: opens info panel, drills to next level filtered to parent
3. **Deepest level**: isolates the selected feature (dimmed background)
4. **Click hidden feature**: swallowed — no drill-up
5. **Click empty space**: drills up one level (to region from province, to province from municipality, etc.)
6. **Breadcrumb**: click any ancestor to jump back

## Deployment

```sh
vercel --prod --yes
```

Auto-deploys from GitHub via Vercel CLI (v54.x, Node.js 18).

## Development Notes

- GeoJSON files are single-line JSON (no trailing newline)
- `map-init.js` exists on disk but is **not loaded** (compatibility shim)
- `EVENTS` object in `app.js` is **unused** (dead legacy code)
- `dashboard.js` is a **compatibility shim** — all real logic is in `app.js`
- No tests, CI, linter, or formatter configured

<!-- git config test -->
