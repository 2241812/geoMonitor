import { APP } from './app.js';
/**
 * map-layers.js
 * Layer initialization — starts at level 0 (CAR boundary) and lets
 * the drill-down system in app.js handle the rest.
 */

export async function initLayers() {
  const src = APP._src();
  const isWatersheds = APP.state.viewMode === 'watersheds';

  /* Fetch level 0 and 1 GeoJSON in parallel (cache for boundaries mode) */
  const [geo0, geo1] = await Promise.all([
    fetch(src.geoJSON[0]).then(r => r.json()).then(window.decodeGeo),
    fetch(src.geoJSON[1]).then(r => r.json()).then(window.decodeGeo),
  ]);
  APP.state.rawData[0] = geo0;
  APP.state.rawData[1] = geo1;

  if (!isWatersheds) {
    /* Boundaries mode — render CAR boundary and open panel */
    await APP._showLevel(0, null, null);
    APP.state.currentLevel = 0;

    for (let lvl = 2; lvl <= src.maxLevel; lvl++) {
      APP._prefetchLevel(lvl);
    }
    APP._updateBreadcrumb();

    if (geo0 && geo0.features && geo0.features[0]) {
      APP.openPanel(geo0.features[0], 0);
    }
  } else {
    /* Watersheds mode — skip CAR boundary */
  }
}

window.initLayers = initLayers;