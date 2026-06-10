# geoMonitor — DENR CAR Watershed Monitoring

Static HTML/CSS/JS web app. No build system, no package manager, no server.

## Quick start

```powershell
# On Windows, use explicit Python path (MS Store alias conflicts with `python`):
& "C:\Users\Gian Marc Domalanta\AppData\Local\Python\bin\python3.exe" -m http.server 8080 -d main
```

Open `http://localhost:8080`. GeoJSON `fetch()` requires a server.

## Pair development

Use **VS Code Live Share** (extension). One person hosts the session; the other joins. Both edit the same files in real time — writes go through the host machine.

To preview, the host runs a server:

```sh
python3 -m http.server 8000 -d main
```

The pair opens `http://localhost:8000` on their side as well (if using Live Share, both see the same browser preview). For cross-device viewing, share the host's local IP (e.g. `http://192.168.x.x:8000`).

## Architecture

- **Entrypoints**: `main/index.html` (landing), `main/map.html` (map + dashboard)
- **Script load order** (in `map.html`): `app.js` → `map-init.js` → `map-layers.js` → `dashboard.js` — do not reorder
- **CDN versions pinned** in `map.html`: Leaflet 1.9.4, Chart.js 4.4.7
- **Global state**: `APP` object (`app.js`) holds config, state, and `EventTarget` for cross-module events
- **Custom events**: `EVENTS.FEATURE_SELECT` / `EVENTS.FEATURE_CLEAR` dispatched by `map-layers.js`, consumed by `dashboard.js`

## Map

- **Default basemap**: Esri World Topo. Alternatives: OSM, Esri Satellite (toggle via layer control)
- **Default overlay**: Municipalities (first loaded in `map-layers.js`). Others: CAR Boundary, Provinces, Barangays
- **View locked** to Philippines (`maxBounds: [[4, 116], [21.5, 128]]`, `minZoom: 7`) — config in `app.js`
- **Click behavior**: highlights polygon yellow, `fitBounds` with `maxZoom: 14`, dispatches `FEATURE_SELECT`

## Data files

GeoJSON files in `main/geoJSON/` (~3.4 MB total) are single-line JSON (no trailing newline, so `wc -l` reports 0 despite being populated). Two sources:
- `NAMRIA` — National Mapping and Resource Information Authority
- `CAD` — Cadastral

## Dashboard

- Feature name resolved from properties in priority order: `NAME_3` → `Municipali` → `PROVINCE` → `Region` → `NAME_2` → `NAME_1` (`dashboard.js:resolveName`)
- DOM built via inline string concatenation + `escapeHtml()` helper. Uses `var` throughout (no `let`/`const`)
- Chart.js bar chart of numeric properties (`Shape_Area`, `Shape_Length`, `AREA`, `Area`, `PERIMETER`, `Hectares`)

No tests, CI, linter, or formatter configured.
