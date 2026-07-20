# Project Map

## Modules
- `/src/components` - React UI components
  - `App.jsx`, `main.jsx` - React mounting & routing
  - `LandingPage.jsx`, `MapPage.jsx` - Primary route views
  - `MapContainer.jsx` - Leaflet map mount point
  - `OverlayPanel.jsx`, `OpacityMenu.jsx`, `BottomBar.jsx` - Floating UI overlays
- `/src/lib` - Vanilla JS map logic and API helpers
  - `app.js` - Map singleton (`window.APP`) state manager
  - `hydro-mode.js`, `boundary-mode.js` - Map modes for watersheds and admin boundaries
  - `map-layers.js` - Layer creation and drilling manager
  - `dashboard.js` - Info panel HTML generator
  - `config.js` - CDN pins, constants, basemaps
  - `supabase-geo.js` - Supabase DB queries
  - `lcm-manager.js`, `slope-manager.js`, `vector-tile-layer.js` - Map overlays
- `/src/store` - Zustand stores (`useMapStore.js`)
- `/scripts` - Node.js data processing scripts (GeoJSON/TopoJSON compilation)
- `/public/geoJSON` - Static map geometries

## Responsibilities & Hotspots
- `src/lib/app.js` vs `src/store/useMapStore.js`: The former holds imperative map state and handlers, the latter holds React reactive UI state. Bridging between them is a hotspot.
- **Boundary vs Hydro Modes**: They are mutually exclusive. The transition requires clearing map layers, re-initializing the mode modules, and updating panels.
