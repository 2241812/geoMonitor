# Guardrails & Validation

## Commands
- **Dev**: `npm run dev`
- **Build**: `npm run build` (Includes `scripts/compress-geojson.mjs` post-build compression step)
- **Lint**: `npm run lint` (ESLint zero-warning policy)
- **Format**: `npm run format` (Prettier)

## Constraints & Rules (MUST FOLLOW)
1. **Do NOT spawn subagents**: Complete all tasks directly using built-in tools.
2. **Level 0 Interactive**: Level 0 (CAR polygon) must be `interactive: false` to avoid swallowing child clicks.
3. **Drill Down State**: Advance `currentLevel` *before* calling `_showLevel`. Re-entrancy guard `state._drilling` must be respected.
4. **GeoJSON Property Schemas**: NAMRIA and CAD GeoJSON property schemas are incompatible, do not mix them.
5. **Event Bubbling**: Never remove `L.DomEvent.stopPropagation` from feature click handlers.
6. **Info Panel**: Use the existing watershed panel "Map Overlays" section; do not delete existing panel data sections to add toggle controls.
7. **HTML Head**: Do not reorder script tags in `index.html` (Chart.js / topojson / Lenis must load before bundle).
