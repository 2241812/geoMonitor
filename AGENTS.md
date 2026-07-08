# geoMonitor — DENR CAR Watershed Monitoring

React 19 + Vite 8 single-page app for exploring watersheds and administrative boundaries of the Cordillera Administrative Region (CAR), Philippines. Built for DENR. Live at https://geo-monitor-ten.vercel.app.

The application lives at the **repository root** (no `geo-monitor-v2/` subfolder).

## Agent behavior (MUST follow)

- **Do NOT spawn subagents or background agents.** Complete all tasks directly using built-in tools (bash, read, edit, grep, glob, etc.). Delegation slows down deployment on this machine.
- Only delegate if the user explicitly requests it in their message.
- Do NOT fire `explore`/`librarian`/`oracle`/or any other subagent for research, exploration, or any other work. Inspect the codebase directly.

## Quick start

```sh
npm install
npm run dev
```

Open the URL printed by Vite (default `http://localhost:5173`).

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build → `dist/` + GeoJSON gzip/brotli compression |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint (zero-warning policy) |
| `npm run format` | Prettier write pass over `src/` |

## Entrypoints

| Page | Route / File | Purpose |
|------|--------------|---------|
| Landing | `src/components/LandingPage.jsx` (route `/`) | Hero, stats, river-basin gallery, CTA — uses `public/assets/js/script.js` for Lenis/scroll/lightbox |
| Map | `src/components/MapPage.jsx` + `MapContainer.jsx` | Dual-mode Leaflet map: Watersheds (default) + Boundaries |

## Architecture

- **UI**: React 19 + React Router 7. App shell in `src/App.jsx`, entry in `src/main.jsx`.
- **Map engine**: `window.APP` global (defined in `src/lib/app.js`) holds the Leaflet map, layer refs, drill state, and panel state. React UI state is separate, in the Zustand store `src/store/useMapStore.js`.
- **Lib layer** (`src/lib/`):
  - `app.js` — `APP` global: config, state, drill logic, panels, overlays
  - `config.js` — basemaps, CDN pins (Leaflet 1.9.4, Chart.js 4.4.7), constants
  - `map-layers.js` — layer creation / level fetching / drill show-hide
  - `hydro-mode.js` — Watersheds mode (basin → sub-watershed → stream order)
  - `boundary-mode.js` — Boundaries mode (NAMRIA/CAD admin drill-down)
  - `dashboard.js` — info-panel rendering (delegates to `APP.openPanel`/`APP.closePanel`)
  - `lcm-manager.js` — land-cover (LCM) overlay classes/rendering
  - `slope-manager.js` — slope overlay
  - `supabase-geo.js` — Supabase REST queries for boundary/watershed data
  - `vector-tile-layer.js` — PMTiles/geojson-vt rendering
  - `script.js` / `map-init.js` — glue
- **Components** (`src/components/`): `LandingPage`, `MapPage`, `MapContainer`, `BottomBar`, `OverlayPanel`, `OpacityMenu`.
- **Workers** (`src/workers/`): `tile-worker.js` (tile processing off main thread).
- **Boot sequence**: `index.html` (root) loads the Vite bundle → React mounts → `MapContainer` calls `APP.init()` → `initLayers()`.

## View modes

Two mutually exclusive modes controlled by `state.viewMode` (`watersheds` | `boundaries`).

### Watersheds mode (default)

Renders 14 colored basin polygons. Click a basin → fetches sub-watersheds + stream order. Drill levels: 0 = basins overview, 1 = inside a specific basin.

- **Zone isolation**: clicking a sub-watershed dims others, zooms in, opens the sub-watershed panel, updates the breadcrumb.
- **Map background click** (reverse drill): zone selected → fly to parent basin; at basin level → reset to all basins.
- **Stream Order**: loaded per basin but only added to the map when the `showStreamOrder` toggle is ON (info panel → "Map Overlays").
- **Boundary overlays**: bottom-left dropdown with checkboxes for Region/Province/Municipality; layers stored in `state.adminLayers`.
- **Spans chips**: admin boundaries intersecting the active watershed/zone.
- Info panel renders the watershed panel (basin info) or sub-watershed panel (zone detail) — both include Spans chips and overlay toggles.

### Boundaries mode (admin drill-down)

NAMRIA/CAD source toggle at bottom-center. Switching sources clears all layers, reloads the hierarchy, re-inits the map.

| Source | Levels | Drill path |
|--------|--------|------------|
| NAMRIA | 3 | Region → Province → Municipality |
| CAD | 2 | Region → Municipality |

CAD features have `Province` + `Muni_City` properties; no separate province geometry.

- `initLayers()` (`map-layers.js`): parallel-fetches levels 0+1; in Boundaries mode calls `_showLevel(0)`, prefetches deeper, opens the CAR panel; in Watersheds mode hides the admin header and returns early.
- **Level 0 must be `interactive: false`** — prevents the CAR polygon from swallowing province clicks.
- `drillDown`: hides the parent layer, loads the child filtered to the parent, advances `currentLevel` **before** `_showLevel` so click guards work. Max level: NAMRIA 2, CAD 1.
- `drillUp`: removes deeper layers, re-adds the hidden parent, resets styles, trims `selectedPath`. `drillUp(0)` resets to region-only.
- Deepest level click: calls `_dimLevel` — sets `fillOpacity: 0` on others, marks with `_hiddenByIsolation` to suppress hover/click.
- Map background click: drills up one level (any level ≥ 1).
- Re-entrancy guard: `state._drilling` prevents concurrent drill calls.
- Hover: only attached for layers with ≤300 features.

### Feature name resolution (`_featureName`)

- NAMRIA level 2: `Municipali` > `NAME_2` > candidates
- NAMRIA level 1: `PROVINCE` > `Province` > `NAME_1` > candidates
- CAD level 1: `Muni_City`
- Level 0: hardcoded `'Cordillera Administrative Region'`

### Breadcrumb

Rendered by `_updateBreadcrumb()`:
- **Hydro mode**: `Watersheds › Basin Name › Zone N`
- **Boundary mode**: includes Explore/Boundary mode toggle buttons, then `CAR › Province › Municipality`

### Dashboard (info panel)

- Admin mode: `APP.openPanel()` — hero header, Details section, Chart.js bar chart of numeric properties (`Shape_Area`, `Shape_Length`, `AREA`, `Area`, `PERIMETER`, `Hectares`).
- Hydro mode: watershed or sub-watershed panel — includes connectivity, Spans chips, stream order toggle, basin descriptions.
- DOM built via string concatenation + `escapeHtml()`.
- Mobile: bottom sheet with three states — `peek` / `open` / `closed`.

### UI layout

Bottom-left controls (basemap, boundary dropdown, watershed filter), Bottom-center controls (view mode, source, breadcrumb), top-left (back), top-right (fullscreen), legend (bottom-right), reset-view pill (above breadcrumb). Basemap/boundary/watershed dropdowns are mutually exclusive (opening one closes the others).

## Data

### Source files

Located in `public/geoJSON/`. Heavy geometry (land cover `LCM`, `Slope`) is pre-tiled into PMTiles/vector tiles; boundary/watershed metadata is served from Supabase (REST) via `src/lib/supabase-geo.js`.

| Source | Level | File (in `public/geoJSON/`) |
|--------|-------|------|
| NAMRIA | 0 | `CAR NAMRIA Boundary.geojson` |
| NAMRIA | 1 | `CAR NAMRIA Provincial Boundary.geojson` |
| NAMRIA | 2 | `CAR NAMRIA Municipal Boundary.geojson` |
| CAD | 0 | `CAR CAD Boundary.geojson` |
| CAD | 1 | `CAR CAD Municipal Boundary.geojson` |

Additional files: `CAR CAD Provincial Boundary (Dissolved).geojson` (unused), `CAR NAMRIA Barangay Boundary.geojson` (unused). Coordinate precision: 6 decimal places.

### Watersheds

| File | Description |
|------|-------------|
| `CAR Watersheds.geojson` | Merged 14 watershed features |
| `Watersheds/<River>/*.geojson` | Individual watershed boundaries (14 basins) |
| `watershed-intersections.json` | Cross-walk between watersheds and admin boundaries |
| `zone-intersections.json` | Cross-walk between sub-watershed zones and admin boundaries |

### Missing data

Cabicungan River (`CAB/`) has only `CAB_Boundary.geojson` — no `CAB_SW.geojson` or `CAB_StreamOrder.geojson`. All other 13 basins have all three files.

## Data pipeline scripts

In `scripts/` (run with `node`):

- `convert-topojson.cjs` / `quantize-topojson.cjs` — GeoJSON → TopoJSON conversion/quantization
- `convert-pmtiles.mjs` — build PMTiles from GeoJSON for vector-tile rendering
- `compress-geojson.mjs` — run by `npm run build`; gzip/brotli-compresses `public/geoJSON`
- `process-stream-order.cjs` — stream-order layer generation
- `seed-*.mjs` / `migrate.sql` — populate Supabase (LCM, slope, boundaries, watersheds)
- `aggregate-watersheds.cjs`, `simplify-geometry.cjs` — geometry prep
- `patch-vectorgrid.mjs` — postinstall patch for `leaflet.vectorgrid`

OCR utilities at root (`color_extractor.py`, `eng.traineddata`, `read_img.cjs`, `replace.cjs`, `test.cjs`) support the Tesseract (`tesseract.js`) text-extraction feature.

## Deployment

```sh
npm run build
vercel --prod --yes
```

- `vercel.json`: `buildCommand: "npm run build"`, `outputDirectory: "dist"`
- Auto-deploys from the production branch to https://geo-monitor-ten.vercel.app
- Vercel CLI 54.x, Node.js 18

## Do not

- Make level 0 (CAR polygon) interactive — blocks province clicks.
- Advance `currentLevel` after `_showLevel` (must be before).
- Use NAMRIA + CAD GeoJSON together (incompatible property schemas).
- Remove `L.DomEvent.stopPropagation` from feature click handlers (prevents map background double-fire).
- Delete existing panel data sections to add toggle controls — the watershed panel includes a "Map Overlays" section for this.
- Reorder script tags in `index.html` (Chart.js / topojson-client / Lenis must load before the bundle uses them).
