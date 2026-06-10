/**
 * map-layers.js
 * Layer initialization — starts at level 0 (CAR boundary) and lets
 * the drill-down system in app.js handle the rest.
 */

async function initLayers() {
  /* Show the region boundary first (level 0) */
  await APP._showLevel(0, null, null);

  /* Then auto-show provinces as the default "clickable" level */
  await APP._showLevel(1, null, null);

  /* Update breadcrumb to reflect initial state */
  APP._updateBreadcrumb();
}
