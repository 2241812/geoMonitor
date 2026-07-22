/**
 * overlay-utils.js
 *
 * Shared utilities for overlay managers (Slope, LCM).
 * Extracted to eliminate duplication between slope-manager.js and lcm-manager.js.
 *
 * Covers:
 *  - CSS clip-path geometry extraction + building
 *  - Map event bind/unbind patterns
 *  - Load progress bar UI
 */

/* ── Clip-path geometry helpers ── */

/**
 * Extract all outer rings from a GeoJSON geometry, handling both
 * Polygon and MultiPolygon types.
 * Returns an array of coordinate rings (each ring is [[lng,lat], ...]).
 */
export function extractOuterRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    return geometry.coordinates[0] ? [geometry.coordinates[0]] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map(poly => poly[0])
      .filter(Boolean);
  }
  return [];
}

/**
 * Build a CSS polygon() clip-path string from an array of coordinate
 * rings projected through the map's latLngToLayerPoint.
 *
 * For a single ring → polygon(x1 y1, x2 y2, ...)
 * For multiple rings → uses the largest ring (CSS clip-path doesn't
 *   support multi-polygon natively); falls back to the bounding hull.
 */
export function buildClipPath(map, rings) {
  if (!rings.length) return '';
  let ring = rings[0];
  if (rings.length > 1) {
    ring = rings.reduce((a, b) => a.length >= b.length ? a : b);
  }
  try {
    const points = ring.map(c => {
      const p = map.latLngToLayerPoint([c[1], c[0]]);
      if (!isFinite(p.x) || !isFinite(p.y)) return null;
      return `${Math.round(p.x)}px ${Math.round(p.y)}px`;
    }).filter(Boolean).join(',');
    if (!points) return '';
    return `polygon(${points})`;
  } catch (_) {
    return '';
  }
}

/* ── Map event binding ── */

/**
 * Bind standard overlay events (move, zoom, zoom-swap) to a Leaflet map.
 * Returns the bound handler references so they can be unbound later.
 *
 * @param {L.Map} map
 * @param {Object} handlers
 * @param {Function} handlers.onMapMove - called on move/moveend/zoomanim/zoomend
 * @param {Function} handlers.onZoomStart - called on zoomstart
 * @param {Function} handlers.onZoomEnd - called on zoomend
 * @param {Function} handlers.onZoomSwap - called on zoomend (LOD swap)
 * @param {Object} context - the `this` context for bindng
 */
export function bindOverlayEvents(map, handlers, context) {
  if (!map || !handlers) return;
  if (handlers.onMapMove) {
    map.off('move', handlers.onMapMove);
    map.off('moveend', handlers.onMapMove);
    map.off('zoomanim', handlers.onMapMove);
    map.off('zoomend', handlers.onMapMove);
    map.on('zoomend', handlers.onMapMove);
  }
  if (handlers.onZoomStart) {
    map.off('zoomstart', handlers.onZoomStart);
    map.on('zoomstart', handlers.onZoomStart);
  }
  if (handlers.onZoomEnd) {
    map.off('zoomend', handlers.onZoomEnd);
    map.on('zoomend', handlers.onZoomEnd);
  }
  if (handlers.onZoomSwap) {
    map.off('zoomend', handlers.onZoomSwap);
    map.on('zoomend', handlers.onZoomSwap, context);
  }
}

/**
 * Unbind standard overlay events from a Leaflet map.
 */
export function unbindOverlayEvents(map, handlers, context) {
  if (!map || !handlers) return;
  if (handlers.onMapMove) {
    map.off('move', handlers.onMapMove);
    map.off('moveend', handlers.onMapMove);
    map.off('zoomanim', handlers.onMapMove);
    map.off('zoomend', handlers.onMapMove);
  }
  if (handlers.onZoomStart) map.off('zoomstart', handlers.onZoomStart);
  if (handlers.onZoomEnd) map.off('zoomend', handlers.onZoomEnd);
  if (handlers.onZoomSwap) map.off('zoomend', handlers.onZoomSwap, context);
}

/* ── Load progress bar ── */

/**
 * Show the load progress bar for an overlay.
 * @param {string} elementId - DOM element ID (e.g. 'slope-load-progress' or 'lcm-load-progress')
 * @param {number} pct - percentage (0-100)
 * @param {string} label - status text
 */
export function showLoadProgress(elementId, pct, label) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.style.display = 'block';
  const fillEl = el.querySelector('.slope-load-fill, .lcm-load-fill');
  if (fillEl) fillEl.style.width = pct + '%';
  const labelEl = el.querySelector('.slope-load-label, .lcm-load-label');
  if (labelEl) labelEl.textContent = label || '';
}

/**
 * Hide the load progress bar for an overlay.
 * @param {string} elementId - DOM element ID
 */
export function hideLoadProgress(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.style.display = 'none';
  const fillEl = el.querySelector('.slope-load-fill, .lcm-load-fill');
  if (fillEl) fillEl.style.width = '0%';
  const labelEl = el.querySelector('.slope-load-label, .lcm-load-label');
  if (labelEl) labelEl.textContent = '';
}

/* ── Pane management ── */

/**
 * Ensure a Leaflet pane exists with the given name and z-index.
 * @param {L.Map} map
 * @param {string} paneName
 * @param {number} zIndex
 */
export function ensurePane(map, paneName, zIndex) {
  if (!map) return;
  if (!map.getPane(paneName)) {
    map.createPane(paneName);
    const pane = map.getPane(paneName);
    pane.style.zIndex = String(zIndex);
    pane.style.transition = 'opacity 0.15s ease-out';
    pane.style.willChange = 'transform';
    pane.style.transform = 'translateZ(0)';
    pane.style.backfaceVisibility = 'hidden';
    pane.style.pointerEvents = 'none';
  }
}
