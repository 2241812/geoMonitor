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
| Map | `main/map.html` | Drill-down Leaflet map + Chart.js dashboard |

## Landing page (`main/index.html`)

- **CSS**: `main/assets/css/style.css` (~1540 lines) — all landing page styles
- **JS**: `main/assets/js/script.js` — Lenis smooth scroll, fade-in observer, counter animation, header/parallax, arrow logic, basin toggle, lightbox
- **Header**: transparent at top (`scrollY ≤ 50`) with white text + drop-shadow; switches to `rgba(255,255,255,0.95)` + dark text when scrolled. Threshold in JS (`script.js:96`).
- **Nav arrows**: two circular glass buttons (`w-48`, `bg-white/80`, `backdrop-blur`, green icon). Down arrow floats (`navFloat 2.5s`), hides when dashboard is in view. Up arrow appears when scrolled. Bouncy pop transition via `cubic-bezier(0.34, 1.56, 0.64, 1)`.
- **Card names**: 13 hardcoded `<h3 class="basin-card-name">` with "River Basin" suffix. GeoJSON source at `main/geoJSON/CAR Watersheds.geojson` has 14 features with `Name` + `Old_Name` properties (suffix "Watershed", not "Basin").
- **Basin lightbox**: modal triggered by clicking any basin card on desktop.

## Map page (`main/map.html`)

- **CSS**: `main/assets/css/map.css` — all map + dashboard styles
- **CDN versions**: Leaflet 1.9.4, Chart.js 4.4.7 (pinned in `map.html`)
- **Script load order** (strict, do not reorder): `app.js` → `map-layers.js` → `dashboard.js`, then inline `DOMContentLoaded` calls `APP.init()` → `initLayers()`
- **Global state**: `APP` object (`app.js`) — config, state, drill logic, panels, overlays
- **`map-init.js`** exists but **not loaded** (compatibility shim)
- **`EVENTS`** object in `app.js` is **unused** (dead legacy code)
- **`dashboard.js`**: compatibility shim — delegates to `APP.openPanel`/`APP.closePanel`

### Source toggle

Info panel hero has a NAMRIA/CAD toggle button. Switching sources clears all layers, reloads hierarchy, re-initializes the map.

| Source | Levels | Drill path |
|--------|--------|------------|
| NAMRIA | 3 | Region → Province → Municipality |
| CAD | 2 | Region → Municipality |

CAD files have `Province` + `Muni_City` properties; no separate province geometry.

### Drill-down

Levels: 0 = Region (CAR boundary) → 1 = Province → 2 = Municipality

- **`initLayers()`** (`map-layers.js`): calls `APP._showLevel(0)` then `APP._showLevel(1)`, sets `currentLevel = 1`
- **Level 0**: `interactive: false` — prevents CAR polygon from swallowing province clicks
- **`drillDown`**: hides parent layer (`_hiddenByDrill`), loads child filtered to parent, advances `currentLevel` **before** `_showLevel` so click guards work. Max level: NAMRIA 2, CAD 1.
- **`drillUp`**: removes deeper layers, re-adds hidden parent, resets styles, trims `selectedPath`. `drillUp(0)` resets to region-only.
- **Deepest level click**: calls `_dimLevel` — sets `fillOpacity: 0` on others, marks with `_hiddenByIsolation` to suppress hover/click.
- **Click hidden feature**: swallowed — user must click empty space.
- **Map background click**: drills up one level (any level ≥ 1).
- **Zoom**: `fitBounds` with `padding: [40, 40]`, no animation params.
- **Re-entrancy guard**: `state._drilling` flag prevents concurrent drill calls.
- **Hover**: only attached for layers with ≤300 features.
- **Loading**: levels 0+1 fetched in parallel; deeper levels prefetched; raw GeoJSON cached in `state.rawData`.

### Feature name resolution (`_featureName`)

- NAMRIA level 2: `Municipali` > `NAME_2` > candidates
- NAMRIA level 1: `PROVINCE` > `Province` > `NAME_1` > candidates
- CAD level 1: `Muni_City`
- Level 0: hardcoded `'Cordillera Administrative Region'`

### Overlay system

Mutually exclusive radio mode (None / Province / Municipality). Overlay layers are `interactive: true`. Clicking an overlay feature highlights it, opens info panel, and triggers `drillDown()` **only in Boundary mode** if the overlay matches the current drill level. Drill layer is dimmed (`fillOpacity: 0`) when overlay is active. Municipality overlay shows **all** municipalities (no province filter). Overlays refresh on drill up/down.

### Dashboard (info panel)

- Rendered by `APP.openPanel()` — hero header, Details section, Chart.js bar chart of numeric properties (`Shape_Area`, `Shape_Length`, `AREA`, `Area`, `PERIMETER`, `Hectares`)
- DOM built via string concatenation + `escapeHtml()`
- Mobile: bottom sheet with three states — `peek` / `open` / `closed`

### Breadcrumb

- Rendered by `_updateBreadcrumb()`. Root: "CAR Region" → `drillUp(0)`. Path items call `drillUp(item.level)`. `selectedPath` stores `{level, feature, name}`.

### UI layout

Back button (top-left), Fullscreen toggle (top-right), Basemap switcher (bottom-left), Legend (bottom-right), Reset-view pill (above breadcrumb, bottom-center). All use `map-icon-btn` / `map-pill-btn` base classes.

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

CAD `Provincial Boundary.geojson` is identical to Municipal — unused. Coordinate precision: 6 decimal places.

### Watersheds

| File | Description |
|------|-------------|
| `CAR Watersheds.geojson` | Merged 14 watershed features (merged from individual files by `preprocess-watersheds.js`) |
| `Watersheds/*.geojson` | Individual watershed boundaries (14 files: ABR, ABU, AGN, AMB, ARI, BUD, CAB, MLG, NAG, SIF, SMR, UCH, UMT, ZUM) |
| `watershed-intersections.json` | Cross-walk between watersheds and admin boundaries (computed by `preprocess_watersheds.js`) |

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
