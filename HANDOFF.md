# Agent Handoff — Boundary Picker + Source Toggle + Watershed Outline + Overlay Fix

**Branch:** `main`
**Date:** 2026-06-25
**Status:** Implementation IN PROGRESS — preprocessing done, R1–R4 code changes not yet started.

This is a handoff for a 4-part feature change to the geoMonitor map page
(`main/map.html`). The plan was approved by the user. One preprocessing step
and its data file are complete; the four code changes (R1–R4) remain.

---

## The four requirements (R1–R4)

All changes target the **`main`** branch.

1. **R1 — Boundary-mode picker panel.** In Boundary mode at level 0 (CAR region),
   the side panel should show a tappable **list of provinces** (NAMRIA) or
   **list of municipalities grouped by Province property** (CAD), mirroring the
   Watersheds basin picker. Tapping an item drills in.
2. **R2 — Source switcher visibility.** The NAMRIA/CAD source toggle button
   (`#source-toggle-control`) should be **visible only in Boundary mode**,
   hidden in Watersheds mode.
3. **R3 — Single merged outline on first load.** On first load (Watersheds mode,
   the default), the map should show **one merged outline** of all CAR watersheds
   (no colored fills), like Boundary mode shows the CAR admin outline at level 0.
4. **R4 — Fix boundary overlays in Watersheds mode.** The bottom-left Region/
   Province/Municipality overlay checkboxes silently do nothing in Watersheds
   mode (Municipality especially). Make them work.

---

## User-confirmed design decisions (from AskUserQuestion)

These three answers shape the implementation:

1. **Watersheds mode stays as-is.** Only build the new picker for **Boundary**
   mode. Do NOT rewrite the existing Watersheds basin picker or its Region panel.
2. **Single merged outline** (not 14 outline-only basins) for the Watersheds
   start view — a real dissolved/envelope outline, like the CAR admin outline.
3. **CAD municipalities grouped by `Province` property** under province-name
   headers (Abra, Apayao, …), mirroring how the watershed picker groups by
   river system.

---

## ✅ COMPLETED

### 1. Preprocessing script + merged outline data file

**Files created (committed-ready):**
- `preprocess-watershed-outline.js` — Node script that dissolves the 14 watersheds
  into a single outline using JSTS (already in `node_modules/jsts`).
- `main/geoJSON/CAR Watersheds Outline.geojson` — the generated output.

**How to regenerate:**
```sh
node preprocess-watershed-outline.js
```

**Key implementation notes (important gotchas):**
- JSTS path: `require('jsts/dist/jsts.min.js')`. Exports under `jsts.io`
  (`GeoJSONReader`, `GeoJSONWriter`), `jsts.operation.union.UnaryUnionOp`,
  `jsts.simplify.DouglasPeuckerSimplifier`.
- **Source polygons have topology errors** (non-noded self-intersections) for
  ~4 of the 14 watersheds. MUST clean each geometry with `.buffer(0)` before
  unioning, or the union throws.
- **`UnaryUnionOp.union()` expects a JSTS `GeometryCollection`, NOT a JS array.**
  Build it via: `factory.createGeometryCollection(geoms)` where
  `factory = geoms[0].getFactory()`. Passing a plain array throws.
- **Adjacent watersheds touch at edges**, so the union returns a single `Polygon`
  with many interior rings (holes) — NOT a MultiPolygon. This is CORRECT for our
  purpose: the outer ring is the CAR-wide envelope, the "holes" are internal
  divisions invisible when rendered with `fillOpacity: 0` (outline only).
- **Simplification is applied** at tolerance 0.002 (~200 m) via
  `DouglasPeuckerSimplifier`, reducing the file from 2.2 MB to **~60 KB**
  (33 rings). Visually identical to the unsimplified version.
- **Output is deterministic** — re-running produces identical output.
- **All validation checks pass:** outer ring closed, all 32 holes closed,
  all rings ≥ 4 points, bbox covers source, Leaflet-compatible structure.

**Script structure (current state of `preprocess-watershed-outline.js`):**
- Reads `main/geoJSON/CAR Watersheds.geojson`.
- For each feature: `reader.read(f.geometry).buffer(0)` → collect into `geoms[]`.
- `merged = UnaryUnionOp.union(factory.createGeometryCollection(geoms))`.
- `merged = DouglasPeuckerSimplifier.simplify(merged, 0.002)`.
- Writes via `writer.write(merged)` as a one-feature FeatureCollection with
  properties `{ Name, Region }`.

**Output stats:** single Polygon, 33 rings (1 outer + 32 holes), 1307 outer-ring
points, bbox `120.1035,15.1539 → 121.8353,18.6221`, 59.8 KB.

---

## ⏳ PENDING

### R1 — Boundary-mode picker panel

**New functions in `main/assets/js/app.js`:**

1. **`_showAdminPickerPanel()`** — model on `_showBasinPickerPanel()`
   (app.js:2281-2349). Reads `state.rawData[1]`.
   - **NAMRIA (maxLevel 2):** filter `rawData[1].features` to
     `_parentId === 'CAR'` (use `_filterToParent` at app.js:807-811). Single
     header "Provinces (N)". Each item: province name + municipality count from
     `hierarchy.children[feature._id].length` (pattern at app.js:1556-1560) +
     area (`Shape_Area`/10000 → km²).
   - **CAD (maxLevel 1):** "go straight to municipalities." Group
     `rawData[1].features` by their `Province` property into province-name
     headers, mirroring `hydroBasinGroups` grouping.
   - Hero: level badge "Administrative Boundaries", title "Cordillera
     Administrative Region", subtitle "Tap a province/municipality to drill in".
   - **Reuse existing CSS**: `.basin-picker-item`, `.basin-picker-info`,
     `.basin-picker-meta`, `.basin-picker-arrow` — no new CSS needed.
   - Copy panel open/peek logic from app.js:2335-2348.

2. **`_adminDrillDownByName(name)`** — model on `_hydroDrillDownByName()`
   (app.js:2352-2361). Resolves name → `(feature, leafletLayer)` by scanning
   `state.layers[1]`, then calls the **existing** `drillDown(feature, leafletLayer)`
   (app.js:480-542). `drillDown` already loads children filtered to parent via
   `_filterToParent` — no new child-loading logic needed.

**Wiring:**
- In `drillUp(targetLevel)` (app.js:561-590), at the `targetLevel === 0` branch,
  replace `openPanel(carData.features[0], 0)` (app.js:584-587) with
  `_showAdminPickerPanel()`.
- In `map-layers.js` `initLayers()` `!isWatersheds` branch (map-layers.js:29-31),
  call `_showAdminPickerPanel()` instead of `openPanel(geo0.features[0], 0)`.

### R2 — Source switcher visible only in Boundary mode

**`main/assets/css/map.css`** — add:
```css
body.mode-watersheds .source-toggle-control { display: none; }
```

**`main/assets/js/app.js`** — in `_setViewMode(mode)` (app.js:1674-1717):
- `mode === 'watersheds'` → `document.body.classList.add('mode-watersheds')` /
  `remove('mode-boundaries')`.
- `mode === 'boundaries'` → reverse.
- Same body-class pattern already exists as `mode-explore` (app.js:158).

Also set the body class on initial load matching `state.viewMode === 'watersheds'`
(in `init()` around app.js:158).

**Note:** In Watersheds mode the source still matters (Spans chips, overlays).
We only hide the *button*; `switchSource` refresh logic (app.js:345-360) is
untouched. The Spans panel's internal NAMRIA/CAD toggle
(`_renderSourceToggleHTML`) remains the way to switch source in Watersheds mode.

### R3 — Single merged outline on first load

**`main/assets/js/app.js`** — modify `_enterHydroMode()` (app.js:1720-1753) and
`_renderHydroBasins()` (app.js:1762-1817):

- Add `state.hydroShowOutlineLevel0 = true` to state (app.js:27-40 region).
- **Level 0 (outline):** render the merged outline from
  `main/geoJSON/CAR Watersheds Outline.geojson`. Lazy-load like other data:
  ```js
  if (!this.state.rawData['watershedOutline']) {
    const resp = await fetch('geoJSON/CAR Watersheds Outline.geojson');
    this.state.rawData['watershedOutline'] = await resp.json();
  }
  ```
  Render with `interactive: false`, `fillOpacity: 0`, dark-green outline.
  Store as `state.hydroLayers['outline']` (or reuse index `-1`). Set
  `hydroDrillLevel = 0`.
- **Level 0 → drill transition:** the 14 colored basins should render when the
  user first drills. Defer `_renderHydroBasins()` (the filled colored basins)
  to run on first `_hydroDrillDown` / `_hydroDrillDownByName` call, OR render
  them filled underneath the outline on first interaction.
- **`_hydroDrillUp(0)` (app.js:2163-2205):** returning to level 0 should show
  the merged outline + basin picker panel again (hide/remove the filled basins
  or keep them outline-only).

**Interaction flow:**
1. First load → merged outline only + basin picker panel.
2. Tap basin in picker → `_hydroDrillDownByName` → `_hydroDrillDown` (app.js:1854)
   → existing drill logic (dim others, fly in, load sub-watersheds).
3. `_hydroDrillUp(0)` → back to merged outline + picker.

### R4 — Fix boundary overlays in Watersheds mode

**Root cause (confirmed):** `_addBoundaryLayer(type)` (app.js:2123-2153) reads
`state.rawData[lvl]` synchronously and silently returns when null
(`if (!data) return;` at app.js:2141). In Watersheds mode, `rawData[2]`
(municipalities) is **never loaded** — `initLayers()` (map-layers.js) only
fetches levels 0 and 1; level-2 prefetch is boundary-mode-only (map-layers.js:24-26).
So "Municipality" silently does nothing in Watersheds mode. Province/Region work
only incidentally.

**Fix — make `_addBoundaryLayer` self-fetching** (mirror the WORKING
`_outlineAdminUnit` at app.js:2531-2620, which already does this correctly):

- Change `_addBoundaryLayer(type)` from sync to **async**.
- When `state.rawData[lvl]` is null, `fetch(src.geoJSON[lvl])`, store it, then
  render — instead of silently returning.
- Use a **source-prefixed cache key** (`cacheKey = (useCad ? 'cad:' : 'namria:') + lvl`)
  to avoid stale cross-source data — the proven pattern at app.js:2559.
- Update `_toggleBoundaryLayer(type, checkbox)` (app.js:2115) to
  `await this._addBoundaryLayer(type)`.
- `_refreshBoundaryOverlays` (app.js:393+) already re-fetches on source switch
  — compatible with the async path.

### Final tasks

- **Cache versions**: bump `map.css?v=9` → `?v=10`, `app.js?v=8` → `?v=9` in
  `main/map.html` (lines 13, 176). Also bump `map-layers.js?v=4` if touched.
- **Smoke test** in browser: `python3 -m http.server 8000 -d main` →
  http://localhost:8000/map.html. Verify:
  - R3: first load shows merged outline + basin picker (not 14 filled basins).
  - R1: switch to Boundary → province picker list; tap province → drill; back → picker.
  - R1 CAD: switch to CAD in Boundary → municipality list grouped by province.
  - R2: source toggle hidden in Watersheds, visible in Boundary.
  - R4: in Watersheds, toggle Municipality overlay → outlines appear.
- **Commit + push to `main`** (user explicitly asked to push to main).

---

## Files touched (final summary)

| File | Change |
|------|--------|
| `preprocess-watershed-outline.js` | **DONE** — JSTS dissolve script. Add simplification step. |
| `main/geoJSON/CAR Watersheds Outline.geojson` | **DONE** — generated; re-gen after simplification. |
| `main/assets/js/app.js` | R1 (picker), R2 (body class), R3 (outline level 0), R4 (async overlay). |
| `main/assets/js/map-layers.js` | R1 (call `_showAdminPickerPanel()` at boundary init). |
| `main/assets/css/map.css` | R2 (`.mode-watersheds .source-toggle-control { display:none }`). |
| `main/map.html` | Cache version bumps. |

---

## Do NOT touch

- Existing Watersheds basin picker / `_showBasinPickerPanel` / Region panel
  (user said Watersheds stays as-is).
- Spans chips system, stream order toggle, security features.
- Hierarchy GeoJSON or feature schemas.

## Quick reference — key code locations in `main/assets/js/app.js`

| What | Lines |
|------|-------|
| `state` object | 3-41 |
| `config.sources` (namria/cad) | 50-72 |
| `config.hydroBasinGroups` | 146-162 |
| `config.hydroBasinFolderMap` | 121-136 |
| `init()` | ~158, 190-289 |
| `_loadHierarchy()` | 315-320 |
| `switchSource(name)` | 323-389 |
| `_refreshBoundaryOverlays()` | 393-460 |
| `drillDown(feature, leafletLayer)` | 480-542 |
| `drillUp(targetLevel)` | 545-605 |
| `_showLevel(level, parentFeature)` | 683-804 |
| `_filterToParent(data, childLevel, parentFeature)` | 807-811 |
| `_setViewMode(mode)` | 1674-1717 |
| `_enterHydroMode()` | 1720-1753 |
| `_renderHydroBasins()` | 1762-1817 |
| `_hydroDrillDown()` | 1854-1898 |
| `_hydroDrillUp(targetLevel)` | 2163-2205 |
| `_clearHydroState(keepViewMode)` | 2217-2241 |
| `_toggleHydroBoundary()` | 2244-2278 |
| `_showBasinPickerPanel()` | 2281-2349 |
| `_hydroDrillDownByName(name)` | 2352-2361 |
| `_toggleBoundaryMenu/Close()` | 2099-2113 |
| `_toggleBoundaryLayer()` | 2115-2121 |
| `_addBoundaryLayer()` (BUG) | 2123-2153 |
| `_removeBoundaryLayer()` | 2155-2160 |
| `_outlineAdminUnit()` (working pattern) | 2531-2620 |
| `_resolveDetails()` / `childCount()` | 1553-1589 |
| `_featureName(feature, level)` | 823-841 |
| `_escHtml(str)` | 1643-1648 |
| `_getPaddingOpts()` | 814-820 |
