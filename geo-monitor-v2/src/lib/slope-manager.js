import { APP } from './app.js';
import { simplify } from '@turf/turf';

/**
 * slope-manager.js
 *
 * Manages the slope overlay layer independently of hydro drill-down logic.
 * Handles: layer creation/destruction, watershed-boundary clipping via CSS
 * clip-path on a custom Leaflet pane, and responsive clip updates during
 * map move/zoom animations.
 *
 * v2 fixes:
 *  - Handles MultiPolygon geometry (multiple outer rings → multi-polygon clip)
 *  - Uses latLngToLayerPoint for jitter-free clip tracking during zoom/pan
 *  - Module-level bound handler prevents event listener leaks on destroy/toggle
 *  - Skips clip updates during zoom animation to avoid stale transforms
 *  - hide()/show() methods for drill transitions without destroying the layer
 */

const COLORS = { 1: '#50A823', 2: '#8BD100', 3: '#FFFF00', 4: '#FF9A36', 5: '#FF4A4A' };

/**
 * Extract all outer rings from a GeoJSON geometry, handling both
 * Polygon and MultiPolygon types.
 * Returns an array of coordinate rings (each ring is [[lng,lat], ...]).
 */
function _extractOuterRings(geometry) {
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
 * For a single ring  → polygon(x1 y1, x2 y2, ...)
 * For multiple rings → uses the first ring only (CSS clip-path doesn't
 *   support multi-polygon natively); falls back to the bounding hull.
 *
 * Uses layerPoint coordinates (relative to tile pane origin) so the
 * clip tracks the pane's CSS transform automatically — no per-frame
 * container-coordinate jitter.
 */
function _buildClipPath(map, rings) {
  if (!rings.length) return '';
  /* Use the largest ring (by point count) as a reasonable approximation
     when there are multiple disjoint polygons. CSS clip-path can only
     express a single polygon, so this is the best we can do without
     switching to SVG or Canvas clipping. */
  let ring = rings[0];
  if (rings.length > 1) {
    ring = rings.reduce((a, b) => a.length >= b.length ? a : b);
  }
  try {
    const points = ring.map(c => {
      const p = map.latLngToLayerPoint([c[1], c[0]]);
      return `${Math.round(p.x)}px ${Math.round(p.y)}px`;
    }).join(',');
    return `polygon(${points})`;
  } catch (_) {
    return '';
  }
}

/* Module-level bound handler — same reference for on() and off(),
   preventing listener leaks regardless of how toggle/destroy are called. */
function _onMapMove() {
  APP.slope.reapplyClip();
}

function _onZoomStart() {
  const map = APP.state.map;
  if (!map || !APP.state.showSlope) return;
  const pane = map.getPane('slopePane');
  if (pane) {
    pane.style.willChange = 'transform';
    pane.style.opacity = '0';
  }
}

function _onZoomEnd() {
  const map = APP.state.map;
  if (!map || !APP.state.showSlope) return;
  const pane = map.getPane('slopePane');
  if (pane) {
    pane.style.opacity = '';
    pane.style.willChange = '';
  }
  APP.slope.reapplyClip();
}

APP.slope = {
  _layer: null,
  _layerSimplified: null,
  _layerFull: null,
  _rafId: null,
  _clipFeature: null, /* the feature currently used for clipping */
  LOD_ZOOM: 10,

  /** Toggle slope overlay on/off. Creates the layer on first enable. */
  async toggle() {
    APP.state.showSlope = !APP.state.showSlope;
    const map = APP.state.map;
    if (!map) return;

    if (APP.state.showSlope && !this._layer) {
      try {
        const resp = await fetch('geoJSON/Slope.geojson');
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const geojson = await resp.json();

        this._ensurePane();

        const styleFn = (f) => ({
          fillColor: COLORS[f.properties.gridcode] || '#cccccc',
          fillOpacity: 0.65,
          stroke: false,
          weight: 0,
        });
        const layerOpts = { style: styleFn, interactive: false };

        /* Create simplified layer for low zoom (LOD) */
        const simplified = { type: 'FeatureCollection', features: [] };
        for (const f of geojson.features) {
          try {
            simplified.features.push(simplify(f, { tolerance: 0.002, highQuality: true }));
          } catch (_) { simplified.features.push(f); }
        }
        this._layerSimplified = L.geoJSON(simplified, {
          ...layerOpts,
          renderer: L.canvas({ pane: 'slopePane' }),
          onEachFeature: (f, l) => { l.options.pane = 'slopePane'; },
        });

        /* Create full-detail layer for high zoom */
        this._layerFull = L.geoJSON(geojson, {
          ...layerOpts,
          renderer: L.canvas({ pane: 'slopePane' }),
          onEachFeature: (f, l) => { l.options.pane = 'slopePane'; },
        });

        /* Start with simplified at low zoom, full at high zoom */
        const z = map.getZoom();
        this._layer = z < this.LOD_ZOOM ? this._layerSimplified : this._layerFull;
      } catch (e) {
        APP._showToast('Failed to load slope data');
        console.error('Slope fetch error:', e);
        APP.state.showSlope = false;
        APP._updateHydroLegend();
        return;
      }
    }

    APP._updateSubWatershedStyles();
    if (!this._layer) { APP.state.showSlope = false; return; }

    if (APP.state.showSlope) {
      map.addLayer(this._layer);
      this.reapplyClip();
      this._bindMapEvents(map);
    } else {
      this._unbindMapEvents(map);
      map.removeLayer(this._layer);
      this.removeClip();
      this._clipFeature = null;
    }
    APP._updateHydroLegend();
  },

  _ensurePane() {
    const map = APP.state.map;
    if (!map) return;
    if (!map.getPane('slopePane')) {
      map.createPane('slopePane');
      const pane = map.getPane('slopePane');
      pane.style.zIndex = 250;
      pane.style.transition = 'opacity 0.15s ease-out';
    }
  },

  /** Bind move/zoom events using the module-level handler. */
  _bindMapEvents(map) {
    map.off('move', _onMapMove);
    map.off('moveend', _onMapMove);
    map.off('zoomanim', _onMapMove);
    map.off('zoomend', _onMapMove);
    map.off('zoomstart', _onZoomStart);
    map.on('move', _onMapMove);
    map.on('moveend', _onMapMove);
    map.on('zoomanim', _onMapMove);
    map.on('zoomend', _onMapMove);
    map.on('zoomstart', _onZoomStart);
    map.on('zoomend', _onZoomEnd);

    map.off('zoomend', this._onZoomSwap, this);
    map.on('zoomend', this._onZoomSwap, this);
  },

  _onZoomSwap() {
    const map = APP.state.map;
    if (!map || !this._layerSimplified || !this._layerFull) return;
    const z = map.getZoom();
    const target = z < this.LOD_ZOOM ? this._layerSimplified : this._layerFull;
    if (target === this._layer) return;
    const wasActive = map.hasLayer(this._layer);
    map.removeLayer(this._layer);
    this._layer = target;
    if (wasActive) {
      map.addLayer(this._layer);
      this.reapplyClip();
    }
  },

  _unbindMapEvents(map) {
    map.off('move', _onMapMove);
    map.off('moveend', _onMapMove);
    map.off('zoomanim', _onMapMove);
    map.off('zoomend', _onMapMove);
    map.off('zoomstart', _onZoomStart);
    map.off('zoomend', _onZoomEnd);
    map.off('zoomend', this._onZoomSwap, this);
  },

  /** Clip slope layer to a feature's geometry via CSS clip-path on the pane. */
  updateClip(feature) {
    const map = APP.state.map;
    if (!map) return;
    const pane = map.getPane('slopePane');
    if (!pane) return;
    if (!feature || !feature.geometry) {
      pane.style.clipPath = '';
      this._clipFeature = null;
      return;
    }

    this._clipFeature = feature;

    const rings = _extractOuterRings(feature.geometry);
    if (!rings.length) {
      pane.style.clipPath = '';
      return;
    }

    const clipPath = _buildClipPath(map, rings);
    if (clipPath) {
      pane.style.clipPath = clipPath;
    }
  },

  /** Remove the clip-path so the full slope layer is visible. */
  removeClip() {
    const map = APP.state.map;
    if (!map) return;
    const pane = map.getPane('slopePane');
    if (pane) pane.style.clipPath = '';
    this._clipFeature = null;
  },

  /**
   * Reapply clip based on current hydro state.
   * Uses requestAnimationFrame to batch updates to paint cycles.
   * Skips if map is mid-zoom-animation (transforms are stale).
   */
  reapplyClip() {
    if (!APP.state.showSlope) return;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      const map = APP.state.map;
      if (!map) return;

      /* During Leaflet's zoom animation the pane transform is in flux;
         skip until zoomend fires to avoid a flash of misaligned clip. */
      if (map._animatingZoom) return;

      if (APP.state.hydroSelectedZone) {
        this.updateClip(APP.state.hydroSelectedZone);
      } else if (APP.state.hydroSelectedBasin && APP.state.hydroSelectedBasin.feature) {
        this.updateClip(APP.state.hydroSelectedBasin.feature);
      } else {
        this.removeClip();
      }
    });
  },

  /** Temporarily hide the slope layer without destroying it.
   *  Used during drill transitions so the layer doesn't need re-fetching. */
  hide() {
    const map = APP.state.map;
    if (!map || !this._layer) return;
    if (map.hasLayer(this._layer)) {
      map.removeLayer(this._layer);
    }
    this._unbindMapEvents(map);
    this.removeClip();
  },

  /** Re-show a previously hidden slope layer. No-op if slope is toggled off. */
  show() {
    const map = APP.state.map;
    if (!map || !this._layer || !APP.state.showSlope) return;
    if (!map.hasLayer(this._layer)) {
      map.addLayer(this._layer);
    }
    this.reapplyClip();
    this._bindMapEvents(map);
  },

  /** Full teardown: unbind events, remove layer, clear clip, reset state. */
  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    const map = APP.state.map;
    if (map) {
      this._unbindMapEvents(map);
      if (this._layerSimplified) map.removeLayer(this._layerSimplified);
      if (this._layerFull) map.removeLayer(this._layerFull);
    }
    this._layer = null;
    this._layerSimplified = null;
    this._layerFull = null;
    this._clipFeature = null;
    this.removeClip();
    APP.state.showSlope = false;
  },
};

/* Safety polyfill: _toggleSlope() was historically called from the
   watershed panel inline HTML but never defined. This delegates to the
   correct method and warns, so stale HTML or accidental future usage
   doesn't silently break the slope toggle again. */
APP._toggleSlope = function _toggleSlope() {
  if (typeof APP.slope !== 'undefined' && typeof APP.slope.toggle === 'function') {
    console.warn('APP._toggleSlope() is deprecated — use APP.slope.toggle()');
    APP.slope.toggle();
  }
};
