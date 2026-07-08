# DENR CAR Watershed Monitoring · geoMonitor

> Interactive web map for exploring watersheds and administrative boundaries of the **Cordillera Administrative Region (CAR), Philippines** — built for DENR.

[![Live](https://img.shields.io/badge/Live-geo--monitor--ten.vercel.app-blue?style=flat-square)](https://geo-monitor-ten.vercel.app)
[![Deploy](https://img.shields.io/badge/Deployed%20with-Vercel-black?style=flat-square)](https://vercel.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](#license)

![App screenshot](Screenshot%20from%202026-06-30%2013-07-29.png)

geoMonitor is a single-page application that lets researchers, government staff, and the public visualize and drill into the 14 major watersheds of CAR and the region's administrative boundaries (NAMRIA / CAD sources). It pairs a fast Leaflet/Canvas map engine with a React UI, vector-tile rendering, and on-the-fly geometry analysis.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🗺️ **Dual-mode map** | Switch between *Watersheds* (basin → sub-watershed → stream order) and *Boundaries* (Region → Province → Municipality) views. |
| 🔍 **Drill-down navigation** | Click a basin or polygon to zoom in; click empty space to drill back up. Breadcrumb tracks your path. |
| 🧩 **Zone isolation** | Dim sibling sub-watersheds and focus a single zone with its admin cross-walk (Spans chips). |
| 🛰️ **Vector tiles + PMTiles** | Large datasets (land cover, slope) rendered via `geojson-vt` / `pmtiles` / `protomaps-leaflet` for smooth pan/zoom. |
| 📊 **Data panels** | Per-feature info panel with property details and a Chart.js bar chart of numeric measurements. |
| 🤖 **OCR extraction** | `tesseract.js` pipeline extracts text/values from map imagery (`color_extractor.py`, `eng.traineddata`). |
| 🎨 **Polished UI** | Lenis smooth scroll, animated landing page, responsive bottom-sheet panels, Inter/Outfit typography. |

---

## 🚀 Quick Start

```sh
npm install
npm run dev
```

Open the URL printed by Vite (defaults to `http://localhost:5173`).

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Production build → `dist/` + GeoJSON compression (gzip/brotli) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint (zero-warning policy) |
| `npm run format` | Prettier write pass over `src/` |

---

## 🧱 Tech Stack

| Layer | Choice |
|-------|--------|
| **UI framework** | React 19 + React Router 7 (SPA) |
| **Build tool** | Vite 8 (with `vite-plugin-compression` for gzip/brotli) |
| **Mapping** | Leaflet 1.9.4, `react-leaflet` 5, Canvas renderer |
| **Vector tiles** | `geojson-vt`, `pmtiles`, `protomaps-leaflet` |
| **Geometry** | `@turf/turf`, `topojson-client` / `topojson-server` |
| **State** | Zustand 5 (`useMapStore`) + `window.APP` global for Leaflet/interaction state |
| **Charts** | Chart.js 4.4.7 |
| **OCR** | `tesseract.js` 7 |
| **Smooth scroll** | Lenis 1.0.42 |
| **Quality** | ESLint 9, oxlint, Prettier 3 |
| **Data source** | Supabase (REST) for boundary/watershed queries |

---

## 📂 Repository Structure

The application lives at the **repository root** (no `geo-monitor-v2/` subfolder).

```
├── src/
│   ├── components/        # React UI (LandingPage, MapPage, MapContainer, BottomBar, OverlayPanel…)
│   ├── lib/               # Leaflet/interaction logic (app.js, config.js, hydro-mode.js, map-layers.js, boundary-mode.js, lcm-manager.js, slope-manager.js, supabase-geo.js)
│   ├── store/             # Zustand store (useMapStore.js)
│   ├── workers/           # Web workers (tile-worker.js)
│   ├── assets/css/        # Styles (map.css, style.css, bottom-bar.css)
│   ├── App.jsx / main.jsx # App shell + entry point
│   └── index.css / App.css
├── public/
│   ├── geoJSON/           # Watershed + boundary + LCM/slope TopoJSON/GeoJSON data
│   ├── assets/            # Images, JS (script.js: Lenis, scroll, lightbox, counters)
│   ├── index.html         # Vite entry
│   └── web.config
├── scripts/               # Data pipeline (convert-pmtiles, convert-topojson, seed-*, compress-geojson, process-stream-order…)
├── supabase/              # Migrations + local config
├── index.html             # Vite entry point
├── vite.config.js         # Vite + compression config
├── package.json           # Dependencies & scripts
└── vercel.json            # Vercel: build → dist/
```

---

## 🏗️ Architecture

- **Global state**: a `window.APP` object holds the Leaflet map, layer references, drill state, and panel state. React UI state is managed separately by the Zustand `useMapStore`.
- **View modes**: two mutually exclusive modes driven by `state.viewMode` — `watersheds` (default) and `boundaries`.
- **Boot sequence**: `index.html` loads the Vite bundle → React mounts → `MapContainer` calls `APP.init()` → `initLayers()`.
- **Data flow**: boundary/watershed metadata is served from Supabase (REST); heavy geometry (land cover, slope) is pre-tiled into PMTiles/vector tiles and rendered client-side.
- **Data request**: a "Request Data" button opens an enquiry form that builds a `mailto:` link pre-filled with the active feature's details.
- **Security**: screenshot/print prevention and app blur on focus loss.

### Watersheds mode (default)
Renders 14 colored basin polygons. Click a basin to drill into sub-watersheds + stream order. Supports zone isolation, Spans chips (admin boundaries intersecting a watershed), and admin outline overlays.

### Boundaries mode
Administrative drill-down with two data sources:

| Source | Levels | Drill Path |
|--------|--------|------------|
| **NAMRIA** | 3 | Region → Province → Municipality |
| **CAD** | 2 | Region → Municipality |

---

## 🚢 Deployment

The app deploys to Vercel from the repository root.

```sh
npm run build
vercel --prod --yes
```

`vercel.json` runs `npm run build` and serves the `dist/` output. CI auto-deploys from the configured production branch.

---

## 📝 Development Notes

- TopoJSON/GeoJSON data lives in `public/geoJSON/`. The `scripts/` folder holds the conversion & seeding pipeline (`convert-topojson.cjs`, `compress-geojson.mjs`, `seed-*.mjs`, `process-stream-order.cjs`).
- OCR utilities (`color_extractor.py`, `eng.traineddata`, `read_img.cjs`, `replace.cjs`, `test.cjs`) support the Tesseract text-extraction feature.
- No tests or CI linter gates are configured; `npm run lint` enforces a zero-warning ESLint policy locally.

## License

MIT — see repository for details.
