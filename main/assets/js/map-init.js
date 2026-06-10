/**
 * map-init.js
 * Map initialization is now handled entirely by APP.init() in app.js.
 * This file is kept for compatibility — no action needed here.
 */
function initMap() {
  /* No-op: APP.init() in map.html DOMContentLoaded handler does the work */
  return { map: APP.state.map, layerControl: null };
}
