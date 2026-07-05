# LCM Display — UI Design

## Mockup

![LCM panel with per-class visibility toggles](C:/Users/UZNIR/.gemini/antigravity-cli/brain/9e1b2c15-c5a1-4c86-9e66-10e996f3cdb4/lcm_panel_mockup_1783291904949.jpg)

## Recommended UI: Collapsible LCM Section in Side Panel

### How it works

```
┌──────────────────────────────────────┐
│ Map Overlays                         │
│  Sub-watersheds              [━━○  ] │
│  Stream Order                [━━○  ] │
│  Slope                       [━━○  ] │
│                                      │
│ ▼ Land Cover (LCM)          [━━━●━] │  ← master toggle (on/off)
│ ┌──────────────────────────────────┐ │
│ │ ■ Closed Forest           👁     │ │  ← per-class eye toggle
│ │ ■ Open Forest             👁     │ │
│ │ ■ Mangrove Forest         👁̸     │ │  ← hidden (dimmed)
│ │ ■ Brush/Shrubs            👁     │ │
│ │ ■ Grassland               👁     │ │
│ │ ■ Open/Barren             👁     │ │
│ │ ■ Annual Crop             👁     │ │
│ │ ■ Perennial Crop          👁     │ │
│ │ ■ Fishpond                👁̸     │ │  ← hidden
│ │ ■ Built-up                👁     │ │
│ │ ■ Inland Water            👁     │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### Interaction Flow

1. **Master toggle OFF** (default): No LCM data loaded. Class list hidden.
2. **Master toggle ON**: Fetches the basin's LCM TopoJSON, renders all 11 classes. Class list expands below the toggle.
3. **Eye icon click**: Hides/shows that specific class on the map. Hidden classes get dimmed text + crossed eye icon. No refetch needed — just sets `fillOpacity: 0` on matching features.
4. **Master toggle OFF again**: Removes layer from map (keeps cached data). Class list collapses.

### Why This Approach

| Decision | Reasoning |
|----------|-----------|
| **Collapsible class list** | 11 rows is a lot of vertical space — collapse when LCM is off to avoid clutter |
| **Eye toggle (not checkbox)** | Matches GIS conventions (QGIS, ArcGIS layer panels); more intuitive for "visibility" |
| **No per-class refetch** | All classes load in one file. Toggling just changes the style (opacity 0 vs filled). Instant. |
| **Color swatch in panel = legend** | The class list IS the legend — no need for a separate bottom-right legend control |

---

## Rendering Approach: VectorTileLayer (Canvas)

For LCM specifically, **canvas tile rendering** is the best fit:

| Factor | L.geoJSON (SVG) | VectorTileLayer (Canvas) |
|--------|-----------------|--------------------------|
| 20K polygons | Creates 20K SVG paths → slow | Single canvas per tile → fast |
| Click interaction needed? | ❌ No (just visual) | ❌ Not needed |
| Per-class toggle | `setStyle()` on each layer | `setStyleGetter()` + `redraw()` |
| Z-order issues? | No (non-interactive) | No (non-interactive) |
| Memory | High (DOM nodes) | Low (just pixels) |

> [!TIP]
> The sub-watersheds had z-order issues with VectorTileLayer because they needed **click/hover events** (requiring a dual canvas + overlay approach). LCM is purely visual — **no events needed** — so canvas tiles work perfectly.

### Style function with class filtering

```js
// The style getter checks which classes are currently visible
vtLayer.setStyleGetter(function(feature) {
  const cls = feature.tags.LCM_CLASS;
  const hidden = APP.state.lcmHiddenClasses.has(cls);
  return {
    fillColor: hidden ? 'transparent' : LCM_COLORS[cls],
    fillOpacity: hidden ? 0 : 0.7,
    color: '#000',
    weight: 0,       // no stroke — too many polygons
    opacity: 0,
  };
});
vtLayer.redraw();  // re-renders all visible tiles instantly
```

### Color Palette

| Class | Color | Swatch |
|-------|-------|--------|
| Closed Forest | `#1a7a2e` | 🟩 Dark green |
| Open Forest | `#4caf50` | 🟢 Medium green |
| Mangrove Forest | `#00897b` | 🟩 Teal |
| Brush/Shrubs | `#8bc34a` | 🟢 Light olive |
| Grassland | `#c6e567` | 🟡 Yellow-green |
| Open/Barren | `#d4a76a` | 🟤 Tan |
| Annual Crop | `#fdd835` | 🟡 Yellow |
| Perennial Crop | `#ff9800` | 🟠 Orange |
| Fishpond | `#4fc3f7` | 🔵 Light blue |
| Built-up | `#e53935` | 🔴 Red |
| Inland Water | `#1565c0` | 🔵 Blue |

---

## Summary

| Component | Implementation |
|-----------|----------------|
| **Rendering** | `VectorTileLayer` (canvas tiles via Web Worker) — already built |
| **Data** | TopoJSON per basin, fetched on drill-down |
| **Panel UI** | Collapsible section under Map Overlays with master toggle + per-class eye icons |
| **Legend** | Built into the panel (color swatch + class name = legend) |
| **Class filtering** | `Set` of hidden class names → `setStyleGetter()` + `redraw()` |
| **Clipping** | CSS clip-path on custom `lcmPane` (same as slope) |
