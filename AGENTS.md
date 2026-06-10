# geoMonitor — DENR CAR Watershed Monitoring

Static HTML/CSS/JS web app. No build system, no package manager, no server.

## Quick start

Open `main/index.html` in a browser. No server needed. For GeoJSON `fetch()` to work, serve locally:

```sh
python3 -m http.server 8000 -d main
```

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
- **Global state**: `APP` object (`app.js`) holds config, state, and `EventTarget` for cross-module events
- **Custom events**: `EVENTS.FEATURE_SELECT` / `EVENTS.FEATURE_CLEAR` dispatched by `map-layers.js`, consumed by `dashboard.js`

## Data files

GeoJSON files in `main/geoJSON/` (~3.4 MB total) are single-line JSON (no trailing newline, so `wc -l` reports 0 despite being populated). Two sources:
- `NAMRIA` — National Mapping and Resource Information Authority
- `CAD` — Cadastral

No tests, CI, linter, or formatter configured.
