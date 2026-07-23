import { APP } from './app.js';
import { fetchWithCache } from './fetch-cache.js';
/**
 * map-layers.js
 * Layer initialization — starts at level 0 (CAR boundary) and lets
 * the drill-down system in app.js handle the rest.
 *
 * Loading sequence (parallel where possible):
 *   1. Admin levels 0 + 1 (parallel fetch)
 *   2. Admin level 2+ (parallel prefetch, NAMRIA only)
 *   3. Watershed data (parallel from APP.init)
 *   4. Hierarchy + intersections (parallel from APP.init)
 */

function setLoadingText(msg) {
  const el = document.getElementById('loading-text');
  if (el) el.textContent = msg;
}

export async function initLayers() {
  try {
    const src = APP._src();
    const isWatersheds = APP.state.viewMode === 'watersheds';

    setLoadingText('Loading administrative boundaries…');

    /* Fetch level 0 and 1 GeoJSON in parallel */
    const [geo0, geo1] = await Promise.all([
      fetchWithCache('boundary:' + src.activeSource + ':0', src.geoJSON[0], { signal: APP._abortController.signal }),
      fetchWithCache('boundary:' + src.activeSource + ':1', src.geoJSON[1], { signal: APP._abortController.signal }),
    ]);
    if (geo0) APP.state.rawData[0] = geo0;
    if (geo1) APP.state.rawData[1] = geo1;

    if (!isWatersheds) {
      await APP._showLevel(0, null, null);
      APP.state.currentLevel = 0;

      /* Prefetch deeper levels in parallel (maxLevel=2 for NAMRIA, 1 for CAD) */
      if (src.maxLevel >= 2) {
        setLoadingText('Loading municipality boundaries…');
        await Promise.allSettled(
          Array.from({ length: src.maxLevel - 1 }, (_, i) => i + 2)
            .filter(lvl => src.geoJSON[lvl])
            .map(lvl => APP._prefetchLevel(lvl))
        );
      }

      APP._updateBreadcrumb();

      if (geo0 && geo0.features && geo0.features[0]) {
        APP.openPanel(geo0.features[0], 0);
      }
    }
  } catch (err) {
    console.error('Failed to initialize map layers:', err);
  } finally {
    /* Hide loading overlay once all critical data is ready */
    setLoadingText('Ready');
    const loading = document.getElementById('loading-overlay');
    if (loading) loading.classList.add('hidden');
  }
}

window.initLayers = initLayers;