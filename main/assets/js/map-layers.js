/**
 * map-layers.js
 * Layer initialization — starts at level 0 (CAR boundary) and lets
 * the drill-down system in app.js handle the rest.
 */

async function initLayers() {
  const src = APP._src();
  /* Fetch level 0 and 1 GeoJSON in parallel */
  const [geo0, geo1] = await Promise.all([
    fetch(src.geoJSON[0]).then(r => r.json()),
    fetch(src.geoJSON[1]).then(r => r.json()),
  ]);
  APP.state.rawData[0] = geo0;
  APP.state.rawData[1] = geo1;

  /* Render sequentially — level 0 (non-interactive background), then level 1 */
  await APP._showLevel(0, null, null);
  await APP._showLevel(1, null, null);

  /* Set initial active level to provinces (or level 1 for CAD) */
  APP.state.currentLevel = 1;

  /* Prefetch deeper levels in background */
  for (let lvl = 2; lvl <= src.maxLevel; lvl++) {
    APP._prefetchLevel(lvl);
  }

  /* Update breadcrumb to reflect initial state */
  APP._updateBreadcrumb();

  /* Open CAR panel by default */
  if (geo0 && geo0.features && geo0.features[0]) {
    APP.openPanel(geo0.features[0], 0);
  }
}
