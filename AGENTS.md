# geoMonitor — DENR CAR Watershed Monitoring

Static HTML/CSS/JS web app. No build system, no package manager, no server.

## Quick start

```sh
python3 -m http.server 8000 -d main
```

GeoJSON `fetch()` requires a server. Open `http://localhost:8000`.

## Architecture

- **Entrypoints**: `main/index.html` (landing gallery), `main/map.html` (drill-down map + dashboard)
- **CDN versions** pinned in `map.html`: Leaflet 1.9.4, Chart.js 4.4.7
- **Script load order** (in `map.html`, do not reorder): `app.js` → `map-layers.js` → `dashboard.js`, then inline `DOMContentLoaded` handler calls `APP.init()` → `initLayers()`
- **`map-init.js`** exists on disk but is **not loaded** (compatibility shim)
- **`EVENTS`** object exists in `app.js` but is **unused** (stale legacy code)
- **Global state**: `APP` object (`app.js`) — all config, state, and methods live on it
- **`dashboard.js`**: compatibility shim only — delegates to `APP.openPanel`/`APP.closePanel`
- **Source toggle**: breadcrumb has a NAMRIA/CAD toggle button. Switching sources clears all layers, reloads hierarchy, and re-initializes the map.
- **NAMRIA**: 3 levels (Region → Province → Municipality)
- **CAD**: 2 levels (Region → Municipality) — CAD files have `Province` + `Muni_City` properties, no separate province geometry

## Drill-down flow

Drill levels: 0 = Region (CAR boundary) → 1 = Province → 2 = Municipality

- **`initLayers()`** (`map-layers.js`): calls `APP._showLevel(0)` then `APP._showLevel(1)`, sets `currentLevel = 1`
- **Level 0** has `interactive: false` so its polygon doesn't swallow clicks on provinces underneath
- **`drillDown`**: hides parent level (removes from map, marks `_hiddenByDrill`), loads child level filtered to parent via `_filterToParent`, advances `currentLevel` **before** `_showLevel` so click guards work. Max drill level depends on source (NAMRIA: 2, CAD: 1).
- **`drillUp`**: removes deeper layers, re-adds hidden parent, resets styles, trims `selectedPath`. Calling `drillUp(0)` resets to region-only view.
- **Deepest level click**: calls `_dimLevel` to isolate selected feature (`fillOpacity: 0` for others, marks with `_hiddenByIsolation = true` to suppress hover/click).
- **Clicking a hidden feature**: swallows click (no drill-up) — user must click empty space
- **Map background click**: drills up one level (any level ≥ 1). Clicking empty space at province (level 1) goes to region-only view.
- **`_suppressMapClick`** guard prevents Canvas renderer from firing map click after feature click handler (avoids double drill-up)
- **No programmatic zoom**: user controls zoom entirely via scroll/touch. All `fitBounds` calls removed.

### Hierarchy preprocessing

A build-time script (`preprocess-hierarchy.js`) cross-walks all GeoJSON files for both NAMRIA and CAD, computing stable `_id`/`_parentId` for every feature. Outputs `main/geoJSON/hierarchy-namria.json` and `main/geoJSON/hierarchy-cad.json`:

```
{ parents: { childId → parentId }, children: { parentId → [childId, ...] }, names: { id → displayName } }
```

Each GeoJSON file is updated in-place with `_id` and `_parentId` added to `feature.properties`. The preprocessor handles:
- Diacritic stripping (e.g. `PEÑARRUBIA` → `PENARRUBIA`)
- Manual name map for known dataset mismatches (`LANGIDEN` → `LAGIDEN`, `LICUAN-BAAY` → `BAAY-LICUAN`)

The browser fetches the active source's hierarchy file once on init for name lookup. `_filterToParent` is a one-liner:
```js
data.features.filter(f => f.properties._parentId === parentId)
```

Re-run the preprocessor and re-deploy if GeoJSON source files are updated:
```sh
node preprocess-hierarchy.js
```

Feature name resolution priority (`_featureName`):
- NAMRIA level 2: `Municipali` > `NAME_2` > candidates
- NAMRIA level 1: `PROVINCE` > `Province` > `NAME_1` > candidates
- CAD level 1: `Muni_City`
- Level 0: hardcoded `'Cordillera Administrative Region'`

## Map

- **Default basemap**: Esri World Topo (`'topo'`). Alternatives: OSM (`'osm'`), Esri Satellite (`'satellite'`)
- **View locked** to Philippines (`maxBounds: [[4, 116], [21.5, 128]]`, `minZoom: 7`) — config in `app.js`
- **Canvas renderer**: `preferCanvas: true` — faster for many polygons, but `stopPropagation` on feature clicks can fail; use `_suppressMapClick` flag as workaround
- **Re-entrancy guard**: `state._drilling` flag prevents concurrent drillDown/drillUp calls (e.g. from double-click on map background)
- **No programmatic zoom**: all zoom/pan is user-controlled. No `fitBounds`, no zoom buttons.
- **Hover**: only attached for layers with ≤300 features (skipped for barangays, now removed)
- **Loading**: levels 0 and 1 fetched in parallel on init. Deeper levels prefetched in background. All raw GeoJSON cached in `state.rawData` — subsequent `_showLevel` calls skip fetch and go straight to filter + render.
- **Boundary overlay system**: Hydrohub-style mutually exclusive radio mode. Only Province **or** Municipality can be active at a time (never both). Selected boundary renders as a dark floating panel on the right side with three options: None / Province / Municipality.
- **Boundary overlay layers**: `interactive: true` — clicking a feature on the overlay highlights it using `resetStyle()` to clear the previous highlight, opens the info panel, and triggers `drillDown()` if the overlay matches the current drill level. The corresponding drill layer is dimmed (`fillOpacity: 0`) when the overlay is active to prevent visual overlap. Municipality overlay shows **all** municipalities (no province filter). Overlays refresh on drill down/up.

Only **NAMRIA** files are active (referenced by `app.js` config). **CAD** files exist but are unused.

Files in `main/geoJSON/` are single-line JSON (no trailing newline). Six active files:

| Source | Level | File | Size |
|--------|-------|------|------|
| NAMRIA | 0 | `CAR NAMRIA Boundary.geojson` | 80 KB |
| NAMRIA | 1 | `CAR NAMRIA Provincial Boundary.geojson` | 143 KB |
| NAMRIA | 2 | `CAR NAMRIA Municipal Boundary.geojson` | 328 KB |
| CAD | 0 | `CAR CAD Boundary.geojson` | 13 KB |
| CAD | 1 | `CAR CAD Municipal Boundary.geojson` | 193 KB |

Coordinate precision: 6 decimal places (~1 m accuracy). CAD `Provincial Boundary.geojson` is identical to Municipal — unused.

## Dashboard (info panel)

- Rendered by `APP.openPanel()` — hero header (badge + title + subtitle), Details section, Measurements chart
- Chart.js bar chart of numeric properties: `Shape_Area`, `Shape_Length`, `AREA`, `Area`, `PERIMETER`, `Hectares`
- DOM built via string concatenation + `escapeHtml()` helper
- Mobile: bottom sheet with three states — `peek` (shows hero, `translateY(calc(100% - 130px))`) / `open` (40vh, full content) / `closed`
- `togglePanel()` cycles through states; triggered by tap on handle bar

## Drill breadcrumb

- Rendered by `_updateBreadcrumb()` in `app.js`
- Root button: "CAR Region" → `drillUp(0)`, active when `selectedPath.length === 0`
- Each path item shows feature name, calls `drillUp(item.level)`
- `selectedPath` stores `{level, feature, name}` for each drill step

## Deployment

```sh
vercel --prod --yes
```

Auto-deploys from GitHub at `https://geo-monitor-ten.vercel.app`. Vercel CLI 54.x, Node.js 18.

## What NOT to do

- Do not reorder script tags in `map.html`
- Do not rely on `map-init.js` or `EVENTS` — they are dead code
- Do not use NAMRIA + CAD GeoJSON together — property schemas are incompatible
- Do not remove `_suppressMapClick` guard — Canvas renderer needs it
- Do not make level 0 interactive — `interactive: false` on the L.geoJSON layer is required to prevent CAR polygon from blocking province clicks
- Do not advance `currentLevel` after `_showLevel` — must happen before so click guards work
- Do not make outline toggles interactive — they must use `interactive: false` to avoid blocking feature clicks beneath

No tests, CI, linter, or formatter configured. No backend.
