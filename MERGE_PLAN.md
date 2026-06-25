# Merge Plan: Cherry-pick yanji features into main

## Summary

Manual port of yanji's UI improvements and bug fixes into main, while preserving main's R2–R4 features that yanji lacks. This plan directly resolves the click-blocking issue on the watershed outline.

## What We're Taking from Yanji (commit `64eb603`)

### 1. `map.html` — Panel architecture (hardcoded `#panel-hero`)
- Add `id="panel-header-icon"` to the header SVG
- Add `id="panel-header-label"` to the header `<span>`
- Add `<div class="panel-hero" id="panel-hero"></div>` between header and handle
- Remove the close button from header (yanji removed it)
- Start panel as `class="info-panel closed"` (yanji starts closed)

### 2. `map.css` — Minor CSS additions
- `.panel-hero`: add `min-height: 128px` + `flex-shrink: 0`
- `.basin-picker-item + .basin-picker-item { margin-top: 10px; }`
- **Keep**: main's `body.mode-watersheds .source-toggle-control { display: none; }` (R2)

### 3. `app.js` — New functions from yanji
- **`_toTitleCase(str)`** — Title Case converter
- **`_updatePanelHeader()`** — Syncs header label/icon with viewMode
- **`_showBoundaryPicker(feature, level)`** — Replaces `_showAdminPickerPanel()`
- **`_drillBoundaryFromPicker(childName, childLevel)`** — Picker click handler
- **`_highlightBoundaryChild(childId, level, chipEl)`** — Chip click → zoom + highlight

### 4. `app.js` — Hover mouseout fix (critical bug fix)
- `mouseover` in `_showLevel`: only change `fillOpacity` (not 6 properties)
- `mouseout` in `_showLevel`: use `layers[level].resetStyle(e.target)` instead of manual style reset

### 5. `app.js` — Panel hero architecture update
All panel functions need to write hero to `#panel-hero` instead of including in `content.innerHTML`:
- `openPanel()` — redirect level 0 to `_showBoundaryPicker()`, move hero to `#panel-hero`
- `_showBasinPickerPanel()` — hero to `#panel-hero`
- `_openWatershedPanel()` — hero to `#panel-hero`
- `_openSubWatershedPanel()` — hero to `#panel-hero`
- `closePanel()` — clear `#panel-hero` innerHTML

### 6. `app.js` — Text Casing fixes
- `_showHoverLabel` Title Case: Wrap name with `_toTitleCase()` in hover label display
- `_addBoundaryLayer` tooltip Title Case: Wrap tooltip text with `_toTitleCase()` (already on yanji)

### 7. `app.js` — Cleanup
- `_setViewMode()`: Use `_updatePanelHeader()` instead of inline header update. Remove `header.style.display = 'none'` in watersheds branch. Add `closePanel()` in boundaries branch before `_showLevel`.
- `_enterHydroMode()`: Don't call `_showBasinPickerPanel()` at end of `_enterHydroMode()` so panel stays closed on initial load.

## What We're Keeping from Main (not on yanji)

### R2 — Source toggle hiding via body class
- CSS rule: `body.mode-watersheds .source-toggle-control { display: none; }`
- JS: `document.body.classList.add('mode-' + mode)` in `_setViewMode()` and `init()`

### R3 — Merged watershed outline → REPLACE with yanji's silhouette system
**Main's implementation is the bug source.** The `_showWatershedOutline()` click handler only toggles outline color; it never renders the basins.

**Solution**: Replace main's outline system with yanji's 3-level silhouette approach:
- Level 0: uniform blue fill (non-interactive) + silhouette border (interactive, click to reveal basins)
- Click silhouette → `_silhouetteClick()` → render 14 colored basins at level 1
- This fixes the blocking bug completely
- *Important note:* We will adapt Yanji's `_computeHydroSilhouette()` to use the pre-computed `CAR Watersheds Outline.geojson` that you added to main, instead of relying on `turf.js` which is not present in main.

### R4 — Async `_addBoundaryLayer` (self-fetching)
- Keep main's async version with source-prefixed cache keys.
- We will just add `_toTitleCase()` to the tooltip binding (from yanji).

## What We're Removing from Main
- `_showWatershedOutline()` — replaced by yanji's `_renderHydroSilhouette()`
- `_removeWatershedOutline()` — replaced by yanji's `_removeHydroSilhouette()`
- `_showAdminPickerPanel()` — replaced by yanji's `_showBoundaryPicker()`
- `_adminDrillDownByName()` — replaced by yanji's `_drillBoundaryFromPicker()`
- State fields: `watershedOutlineLayer`, `watershedOutlineSelected` → replaced by `hydroSilhouetteLayer`, `_hydroSilhouetteGeo`

## `map-layers.js` changes
- Remove the `else` branch that hides admin header in watersheds mode (yanji removed it).
