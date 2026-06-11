/**
 * map-layers.js
 * Layer initialization — starts at level 0 (CAR boundary) and lets
 * the drill-down system in app.js handle the rest.
 */

async function initLayers() {
  /* Fetch level 0 and 1 GeoJSON in parallel */
  const [geo0, geo1] = await Promise.all([
    fetch(APP.config.geoJSON[0]).then(r => r.json()),
    fetch(APP.config.geoJSON[1]).then(r => r.json()),
  ]);
  APP.state.rawData[0] = geo0;
  APP.state.rawData[1] = geo1;

  /* Render sequentially — level 0 (non-interactive background), then level 1 */
  await APP._showLevel(0, null, null);
  await APP._showLevel(1, null, null);

  /* Set initial active level to provinces */
  APP.state.currentLevel = 1;

  /* Update breadcrumb to reflect initial state */
  APP._updateBreadcrumb();
}
