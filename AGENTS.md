# geoMonitor — DENR CAR Watershed Monitoring

Static HTML/CSS/JS web app. No build system, no linter, no tests, no CI.

## Quick start

```sh
python3 -m http.server 8000 -d main
```

Open `http://localhost:8000`. A server is required (GeoJSON `fetch()`).

## Entrypoints

| Page | File | Purpose |
|------|------|---------|
| Landing | `main/index.html` | Gallery with hero, stats, river basins, CTA |
| Map | `main/map.html` | Dual-mode Leaflet map: Watersheds (default) + Boundaries |

## Map page (`main/map.html`)

- **CSS**: `main/assets/css/map.css` — all map + dashboard styles
- **CDN versions**: Leaflet 1.9.4, Chart.js 4.4.7 (pinned in `map.html`)
- **Script load order** (strict, do not reorder): `app.js` → `map-layers.js` → `dashboard.js`, then inline `DOMContentLoaded` calls `APP.init()` → `initLayers()`
- **Global state**: `APP` object (`app.js`) — config, state, drill logic, panels, overlays
- **`map-init.js`** exists but **not loaded** (compatibility shim)
- **`EVENTS`** object in `app.js` is **unused** (dead legacy code)
- **`dashboard.js`**: compatibility shim — delegates to `APP.openPanel`/`APP.closePanel`
- **`package.json`**: empty `{}` — no npm dependencies

## View modes

Two mutually exclusive modes controlled by `state.viewMode`.

### Watersheds mode (default)

Renders 14 colored basin polygons. Click a basin → `_hydroDrillDown()` fetches sub-watersheds + stream order from `geoJSON/Watersheds/{folder}/{CODE}_SW.geojson` and `{CODE}_StreamOrder.geojson`. Drill levels: 0 = basins overview, 1 = inside a specific basin. `_enterHydroMode()` starts this flow.

- **Zone isolation**: clicking a sub-watershed polygon calls `_selectSubWatershed()` — dims others, zooms in, opens sub-watershed panel, updates breadcrumb
- **Map background click** (reverse drill): zone selected → fly to parent basin; at basin level → `_hydroDrillUp(0)` to all basins
- **Stream Order**: `hydroLayers[2]` loaded per basin but only added to map when `showStreamOrder` toggle is ON (toggle in info panel under "Map Overlays")
- **Boundary overlays**: dropdown in bottom-left with checkboxes for Region/Province/Municipality; layers stored in `state.adminLayers`
- **16 new state fields** not present in the original admin-only version: `viewMode`, `activeMode`, `hydroDrillLevel`, `hydroSelectedBasin`, `hydroLayers[0-2]`, `hydroShowBoundary`, `hydroBoundaryLayer`, `hydroAdminOutlineLayer`, `hydroActiveFilterIds`, `hydroSelectedZone`, `hydroSelectedZoneLayer`, `zoneIntersections`, `showStreamOrder`, `adminLayers`, `boundaryMenuOpen`
- Info panel renders `_openWatershedPanel()` (basin info) or `_openSubWatershedPanel()` (zone detail) — both include Spans chips and overlay toggles
- Basin picker panel shown at level 0 via `_showBasinPickerPanel()`

### Boundaries mode (admin drill-down)

NAMRIA/CAD source toggle at bottom-center. Switching sources clears all layers, reloads hierarchy, re-inits map.

| Source | Levels | Drill path |
|--------|--------|------------|
| NAMRIA | 3 | Region → Province → Municipality |
| CAD | 2 | Region → Municipality |

CAD files have `Province` + `Muni_City` properties; no separate province geometry. CAD `Provincial Boundary.geojson` is identical to Municipal — unused.

- `initLayers()` (`map-layers.js`): parallel-fetches levels 0+1 into `rawData[0]`/`rawData[1]`; in Boundaries mode calls `_showLevel(0)`, prefetches deeper, opens CAR panel; in Watersheds mode hides admin header and returns early
- Level 0: `interactive: false` — prevents CAR polygon from swallowing province clicks
- `drillDown`: hides parent layer (`_hiddenByDrill`), loads child filtered to parent, advances `currentLevel` **before** `_showLevel` so click guards work. Max level: NAMRIA 2, CAD 1.
- `drillUp`: removes deeper layers, re-adds hidden parent, resets styles, trims `selectedPath`. `drillUp(0)` resets to region-only.
- Deepest level click: calls `_dimLevel` — sets `fillOpacity: 0` on others, marks with `_hiddenByIsolation` to suppress hover/click.
- Click hidden feature: swallowed — user must click empty space.
- Map background click: drills up one level (any level ≥ 1).
- Re-entrancy guard: `state._drilling` flag prevents concurrent drill calls.
- Hover: only attached for layers with ≤300 features.

### Feature name resolution (`_featureName`)

- NAMRIA level 2: `Municipali` > `NAME_2` > candidates
- NAMRIA level 1: `PROVINCE` > `Province` > `NAME_1` > candidates
- CAD level 1: `Muni_City`
- Level 0: hardcoded `'Cordillera Administrative Region'`

### Outline toggle system

Rendered by `_renderOutlineToggles()` — radio-style toggle (None / Province / Municipality) at top-center. Mutually exclusive. Overlays refresh on drill up/down. Separate from the bottom-left boundary dropdown.

### Breadcrumb

Rendered by `_updateBreadcrumb()`. Two code paths:
- **Hydro mode**: `Watersheds › Basin Name › Zone N`
- **Boundary mode**: includes Explore/Boundary mode toggle buttons, then `CAR › Province › Municipality`

### Dashboard (info panel)

- Admin mode: `APP.openPanel()` — hero header, Details section, Chart.js bar chart of numeric properties (`Shape_Area`, `Shape_Length`, `AREA`, `Area`, `PERIMETER`, `Hectares`)
- Hydro mode: `_openWatershedPanel()` or `_openSubWatershedPanel()` — includes connectivity, Spans chips, stream order toggle, basin descriptions
- DOM built via string concatenation + `escapeHtml()`
- Mobile: bottom sheet with three states — `peek` / `open` / `closed`

### UI layout

Bottom-left controls (basemap, boundary dropdown, watershed filter), Bottom-center controls (view mode, source, breadcrumb), top-left (back), top-right (fullscreen), legend (bottom-right), reset-view pill (above breadcrumb). Basemap/boundary/watershed dropdowns are mutually exclusive (opening one closes the others).

## GeoJSON

Files in `main/geoJSON/` are single-line JSON (no trailing newline).

### Administrative boundaries

| Source | Level | File |
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
| `CAR Watersheds.geojson` | Merged 14 watershed features (merged from individual files by `preprocess-watersheds.js`) |
| `Watersheds/*.geojson` | Individual watershed boundaries (14 files) |
| `watershed-intersections.json` | Cross-walk between watersheds and admin boundaries |
| `zone-intersections.json` | Cross-walk between sub-watershed zones and admin boundaries |

### Missing data

Cabicungan River (`CAB/`) has only `CAB_Boundary.geojson` — no `CAB_SW.geojson` or `CAB_StreamOrder.geojson`. All other 13 basins have all three files.

## Preprocessing scripts

```sh
node preprocess-hierarchy.js       # Cross-walks NAMRIA/CAD GeoJSON → hierarchy-*.json + _id/_parentId
node preprocess-watersheds.js      # Merges Watersheds/*.geojson into CAR Watersheds.geojson
node preprocess_watersheds.js      # Computes watershed-intersections.json (requires @turf/turf)
```

The hierarchy script strips diacritics and applies a manual name map (`LANGIDEN`→`LAGIDEN`, `LICUAN-BAAY`→`BAAY-LICUAN`). Run and re-deploy if GeoJSON source files change.

## Patch scripts

`src/mapEngine/patch_app.js` and `src/mapEngine/patch_notify.js` are Node.js scripts that inject `_notify()` calls and state-change callbacks into `app.js`. Run them when extending the APP state model.

## Deployment

```sh
vercel --prod --yes
```

- `vercel.json`: `buildCommand: null`, `outputDirectory: "main"`
- Auto-deploys from GitHub at `https://geo-monitor-ten.vercel.app`
- Vercel CLI 54.x, Node.js 18

## Do not

- Reorder script tags in `map.html`
- Rely on `map-init.js` or `EVENTS` — dead code
- Use NAMRIA + CAD GeoJSON together (incompatible property schemas)
- Make level 0 interactive (blocks province clicks)
- Advance `currentLevel` after `_showLevel` (must be before)
- Remove `L.DomEvent.stopPropagation` from feature click handlers (prevents map background double-fire)
- Delete existing panel data sections to add toggle controls — `_openWatershedPanel()` includes a "Map Overlays" section for this
