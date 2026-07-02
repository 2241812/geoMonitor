# JULY 1, 2026 — Session Handoff

## Summary

Today's session focused on land cover (LCM) and slope overlay fixes, build optimizations, loading indicators, and a deep investigation into the sub-watershed toggle mechanism after the T3 VT canvas optimization broke it.

---

## 1. Build Time Fix

**Problem**: Vercel build was timing out at 60s due to Brotli-compressing `temp_assets/` (large GeoJSON files).

**Fix** (`vite.config.js`):
- Excluded `temp_assets/` from `vite-plugin-compression`:
  ```js
  viteCompression({
    filter: (file) => !file.includes('temp_assets/') && /\.(js|css|html|json|svg)$/.test(file),
  })
  ```

---

## 2. LCM Toggle Visibility

**Problem**: The LCM toggle appeared in the info panel for basins with no LCM data (e.g., Cabicungan `CAB/`).

**Fix**: Check if the `_LCM2025.geojson` file exists before rendering the toggle. In `_openWatershedPanel()`, the LCM toggle is only added when data is available.

---

## 3. LCM Data Corruption

**Problem**: The source LCM `.topojson` had malformed arcs — delta-encoded without a `transform` object, producing globe-wrapping bands.

**Fix**: Pre-processed the source TopoJSON by decoding with `topojson-client`, filtering to CAR bounding box, and saving as filtered GeoJSON in `temp_assets/`. The app loads the pre-filtered `.geojson` instead of the raw `.topojson`.

Files created:
- `temp_assets/ACH_LCM2025.geojson` (and other basin codes)
- Pre-processing pipeline: `topojson-client` → `bbox filter` → `geojson` output

---

## 4. Slope Performance

**Problem**: Slope GeoJSON had ~90k tiny polygons (noise from raster-to-vector conversion), causing browser freezes on render.

**Fix**:
- Filtered polygons with `area < 0.0001` (in degrees²) before serving
- New file: `temp_assets/{CODE}_Slope.geojson` (filtered)
- Added class 5 to color palette (`#FF4A4A` for steepest)

---

## 5. Loading Indicators

Added `loading-text` element in the map panel header. Slope and LCM toggles show `"Loading slope data…"` / `"Loading land cover data…"` while fetching, then clear on completion.

---

## 6. Sub-Watershed Toggle (Major Investigation)

### Root Cause

The sub-watershed toggle was **broken by the T3 commit (`4c48571`)** which introduced VT canvas rendering for performance:

| State | What happened |
|-------|---------------|
| **Pre-T3** | Sub-watersheds rendered as visible `L.geoJSON`. Toggling this layer ON/OFF worked perfectly. |
| **Post-T3** | Visual rendering moved to `VectorTileLayer` (canvas). The original L.geoJSON became **transparent** (events only). The toggle was never updated — it still only toggled the invisible overlay. |
| **T3 also** | Changed `showSubWatersheds = false` (was `true`). VT layer only added to map if `showSubWatersheds` was true. Result: VT layer never added to map by default, toggle adds invisible overlay → nothing visible. |

### 5 Failed Fix Attempts (my commits)

| Commit | Approach | Failure |
|--------|----------|---------|
| `0a28845` | Style getter checks `showSW`, keep VT on map | Redraw no-op — VT wasn't on map initially |
| `4cc93df` | `addTo`/`removeLayer` VT in toggle | `onRemove` terminates Web Worker — re-add produces empty tiles |
| `8d1b52e` | Style getter + no VT remove | Same no-op issue, VT never on map |
| `c6fc576` | One-time `vt.addTo` on first toggle via `!_map` check | Race condition: hover redraw creates stale tile state |
| `ab5a4ed` | Always add VT to map, style getter controls visibility | Hover still calls `redraw()` → flicker + permanent disappearance on rapid hovers |

### Final Fix (`d6b9ea9`)

**Approach: CSS `display` toggle on VT container.**

- VT layer is **always added to the map during drill-down** (tiles rendered once)
- Toggle controls `display:none` / `display:''` on `vt.getContainer()` — NO `addTo`/`removeLayer`, NO `redraw()`
- Style getter no longer checks `showSubWatersheds` — tiles always visible when rendered
- Initial state: VT container hidden via `display:none` when `showSubWatersheds=false`

**Why this works**:
- `VectorTileLayer.onRemove()` calls `this._worker.terminate()` — permanent worker death
- `redraw()` clears `_tileCache`, removes all CANVAS elements, triggers async worker requests — rapid calls create race conditions where stale responses confuse Leaflet's tile state
- CSS display avoids both problems entirely

### Key Files Touched

| File | Purpose |
|------|---------|
| `geo-monitor-v2/src/lib/hydro-mode.js` | Toggle logic, VT sync, drill-down initialization |
| `geo-monitor-v2/src/lib/vector-tile-layer.js` | VT layer implementation (worker, cache, rendering) |
| `geo-monitor-v2/src/workers/tile-worker.js` | Web Worker for geojson-vt processing |

---

## 7. Color Updates

| Overlay | Colors |
|---------|--------|
| **Slope** | 1: `#50A823`, 2: `#8BD100`, 3: `#FFFF00`, 4: `#FF9A36`, 5: `#FF4A4A` |
| **LCM** | Closed Forest: `#016300`, Open Forest: `#02DB00`, Brush: `#FED4C2`, Grassland: `#974749`, Annual Crop: `#FEFAC2`, Perennial Crop: `#FFFF00`, Built-up: `#FF0000`, Open/Barren: `#D2D2D2`, Inland Water: `#281F94`, Fishpond: `#0081FE`, Mangrove: `#BA00FE`, Marshland: `#C2FBFE` |

---

## 8. Open Issues

### Sub-watershed Hover Flicker
**Status**: Not fixed. `_syncSubWatershedVtStyles()` is called on every hover (mouseover/mouseout), which calls `vtLayer.redraw()`. Each redraw clears and recreates all tiles → brief flicker.

**Potential fixes** (choose one):
1. **Remove VT hover entirely** — make the overlay L.geoJSON non-transparent for hover highlights. Revert mouseover to pre-T3 behavior: `e.target.setStyle({ fillColor, fillOpacity, weight })`. Simpler but adds SVG paths.
2. **Debounce redraw** — only redraw VT after hover settles (300ms debounce). Reduces flicker but doesn't eliminate it.
3. **Incremental tile update** — skip `redraw()` and only re-render the tile containing the hovered feature. Complex but best UX.

### VectorTileLayer Limitations
- Worker is terminated on `onRemove` — makes `addTo`/`removeLayer` cycles unsafe
- `redraw()` is destructive: clears global `_tileCache`, removes all CANVAS elements
- No incremental update mechanism for hover effects
- `_tileCache` is module-level (shared across instances) — stale cross-instance data possible

---

## 9. Branch & Deploy

- **Branch**: `renzo`
- **Server**: `http://localhost:5173/` (Vite dev)
- **Deploy**: Vercel at `https://geo-monitor-ten.vercel.app`
- **Deploy command**: `cd geo-monitor-v2 && npm run build && vercel --prod --yes`

### Current Commit
```
d6b9ea9 Fix sub-watershed toggle: CSS display on VT container, no redraw
```

---

## 10. File Structure (Key Files)

```
geo-monitor-v2/
  src/
    lib/
      hydro-mode.js          # Hydro drill, sub-watershed, toggle, LCM, slope
      vector-tile-layer.js    # VT canvas renderer with Web Worker
      app.js                  # Map init, state, panels
      dashboard.js            # Info panel rendering
      map-layers.js           # Layer initialization
    workers/
      tile-worker.js          # geojson-vt processing in Web Worker
    components/               # React components (MapContainer, etc.)
    store/
      useMapStore.js          # Zustand state
  public/
    geoJSON/
      Watersheds/{CODE}/*     # Basin sub-watershed + stream order files
    temp_assets/
      {CODE}_Slope.geojson    # Pre-filtered slope data
      {CODE}_LCM2025.geojson  # Pre-filtered land cover data
```

---

## 11. Next Steps (Recommended)

1. **Verify sub-watershed toggle** — drill into a basin, toggle sub-watersheds off/on, confirm no disappearance or flicker
2. **Test zone isolation** — click a sub-watershed zone, toggle off/on, verify dim state persists correctly
3. **Test hover with toggle** — toggle ON, hover multiple zones rapidly, verify no permanent disappearance
4. **Decide on hover flicker fix** — if the CSS toggle works but hover redraw is annoying, pick one of the hover approaches above
5. **Clean up** — remove dead code (`EVENTS` object in app.js, `map-init.js`)
