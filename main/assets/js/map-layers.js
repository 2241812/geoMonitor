/**
 * map-layers.js
 * Layer initialization — loads all GeoJSON files as overlay layers,
 * then sets up the layer control and lazy loading for barangays.
 */

async function initLayers() {
  await APP.loadAllLayers();

  APP._updateBreadcrumb();
}
