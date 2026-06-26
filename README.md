# DENR CAR Watershed Monitoring (geoMonitor)

Interactive web map for exploring watersheds and administrative boundaries of the Cordillera Administrative Region (CAR), Philippines — built for DENR.

**Live**: https://geo-monitor-ten.vercel.app

## Quick Start

```sh
cd geo-monitor-v2
npm install
npm run dev
```

Open the URL shown by Vite (default `http://localhost:5173`).

## Tech Stack

- **Framework**: React + Vite (SPA with React Router)
- **Mapping**: Leaflet 1.9.4 (Canvas renderer), Esri World Topo / OSM / Satellite basemaps
- **Charts**: Chart.js 4.4.7
- **State**: Zustand (React UI state) + `window.APP` global (Leaflet/interaction state)
- **Smooth Scroll**: Lenis 1.0.42
- **Font**: Inter + Outfit via Google Fonts
- **Build**: Vite 8.x — `npm run build` outputs to `dist/`
- **Data**: TopoJSON (converted from ArcGIS Shapefiles via GeoJSON)

## What It Does

Dual-mode map with two views:

### Watersheds mode (default)
Renders 14 colored basin polygons. Click a basin to drill into sub-watersheds + stream order. Supports zone isolation, Spans chips (admin boundaries within a watershed), and admin outline overlays.

### Boundaries mode
Drill-down of CAR administrative boundaries with two data sources:

| Source | Levels | Drill Path |
|--------|--------|------------|
| **NAMRIA** | 3 | Region → Province → Municipality |
| **CAD** | 2 | Region → Municipality |

Click any polygon to open an info panel with property details + bar chart of numeric measurements. Click empty space to drill back up. Toggle data sources via the NAMRIA/CAD toggle.

## Repository Structure

```
├── geo-monitor-v2/
│   ├── src/
│   │   ├── components/        # React components (LandingPage, MapPage, MapContainer)
│   │   ├── lib/               # Leaflet logic (app.js, config.js, dashboard.js, hydro-mode.js, map-layers.js)
│   │   ├── store/             # Zustand store (useMapStore.js)
│   │   └── assets/css/        # Styles (map.css, style.css)
│   ├── public/
│   │   ├── assets/js/script.js  # Landing page JS (Lenis, scroll animations, lightbox, counters)
│   │   └── geoJSON/             # TopoJSON + GeoJSON boundary/watershed data
│   ├── index.html             # Vite entry point
│   ├── vite.config.js
│   └── package.json
├── dist/                      # Build output (synced from geo-monitor-v2/dist)
├── archive/                   # Legacy static HTML/CSS/JS (pre-Vite)
└── VERCEL_DEPLOYMENT.md
```

## Map Architecture

- **Global state**: `window.APP` object (Leaflet map, layers, drill state, panel state)
- **View modes**: Two mutually exclusive modes controlled by `state.viewMode` (`watersheds` | `boundaries`)
- **Script load order**: `index.html` loads Vite bundle → React mounts → `MapContainer` calls `APP.init()` → `initLayers()`
- **Data request modal**: Click the Request Data button (top-right) to open an enquiry form that populates a `mailto:` link with feature details
- **Security**: Screenshot/print prevention, app blur on focus loss

## Deployment

```sh
cd geo-monitor-v2
npm run build
vercel --prod --yes
```

Auto-deploys from GitHub via Vercel CLI (v54.x, Node.js 18). See `VERCEL_DEPLOYMENT.md` for details.

## Development Notes

- TopoJSON files are in `public/geoJSON/` — the `replace.cjs` script handles `.geojson` → `.topojson` conversion
- GeoJSON source files live in `archive/main/geoJSON/` and `main/geoJSON/` (git-main branch)
- No tests, CI, linter, or formatter configured
- `package.json` in root is empty `{}` — all dependencies are in `geo-monitor-v2/`
