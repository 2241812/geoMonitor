# Deep Init Summary

**Repository**: geoMonitor — DENR CAR Watershed Monitoring
**Framework**: React 19 + Vite 8 SPA
**Routing**: React Router 7 (HashRouter)
**State**: Zustand (`src/store/useMapStore.js`)
**Map Engine**: Leaflet 1.9.4 (Vanilla JS embedded in React via `window.APP` in `src/lib/app.js`)
**Data/Backend**: Supabase REST (`src/lib/supabase-geo.js`), local GeoJSON/PMTiles in `public/geoJSON/`

## Architecture Boundaries
1. **UI Layer**: React components in `src/components/` managed via Vite entrypoint.
2. **State Layer**: Zustand for React UI state (`useMapStore.js`).
3. **Map Layer**: Mutating, imperative Leaflet layer isolated mostly in `src/lib/app.js`, `hydro-mode.js`, `boundary-mode.js`. Interacts with UI via global `APP` object events/methods.
4. **Data Layer**: Supabase for metadata, local public files for heavy geometries.

## High-risk Zones
- **Map Instance Synchronization**: `MapContainer.jsx` manages the React<->Leaflet bridge. Avoid tearing down map instances unnecessarily.
- **Drill-down State**: Re-entrancy guards in `state._drilling` (imperative state in map-layers/boundary-mode).
- **Event Listeners**: Passing DOM events like clicks through Leaflet layers. The `L.DomEvent.stopPropagation` is required on feature clicks to avoid map background double-fires.
- **Level 0 (CAR Polygon) interactability**: Hardcoded rule to ensure Level 0 is `interactive: false` so it doesn't swallow province clicks.
