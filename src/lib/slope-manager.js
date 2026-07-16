import { APP } from './app.js';
import { simplify } from '@turf/turf';
import { useMapStore } from '../store/useMapStore.js';
import { fetchWithCache } from './fetch-cache.js';
import {
  extractOuterRings,
  buildClipPath,
  bindOverlayEvents,
  unbindOverlayEvents,
  showLoadProgress,
  hideLoadProgress,
  ensurePane,
} from './overlay-utils.js';

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

export const SLOPE_COLORS = { 1: '#50A823', 2: '#8BD100', 3: '#FFFF00', 4: '#FF9A36', 5: '#FF4A4A' };

/* Module-level bound handlers — same references for on() and off(),
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
  /* reapplyClip handled by _onZoomSwap on the same zoomend event */
}

APP.slope = {
  _layer: null,
  _layerSimplified: null,
  _layerFull: null,
  _rafId: null,
  _clipFeature: null, /* the feature currently used for clipping */
  _toggling: false, /* guard against double-toggle race */
  LOD_ZOOM: 10,

  async toggle() {
    if (this._toggling) return; /* prevent concurrent toggles */
    this._toggling = true;
    try {
    APP.state.showSlope = !APP.state.showSlope;
    useMapStore.setState({ showSlope: APP.state.showSlope });
    const map = APP.state.map;
    if (!map) return;

    if (APP.state.showSlope && !this._layer) {
      useMapStore.setState({ slopeLoading: true });
      APP._showToast('Loading slope data… this may take a moment');
      this._showLoadProgress(0, 'Fetching slope data…');
      try {
        const geojson = await fetchWithCache('slope', 'geoJSON/Slope.geojson', { signal: APP._abortController.signal });
        if (!geojson) throw new Error('Failed to load slope data');

        this._showLoadProgress(20, 'Processing geometry…');
        await new Promise(r => setTimeout(r, 0));
        this._ensurePane();

        const styleFn = (f) => ({
          fillColor: SLOPE_COLORS[f.properties.gridcode] || '#cccccc',
          fillOpacity: 0.65,
          stroke: false,
          weight: 0,
        });
        const layerOpts = { style: styleFn, interactive: false };

        const simplified = { type: 'FeatureCollection', features: [] };
        const total = geojson.features.length;
        for (let i = 0; i < total; i++) {
          try {
            simplified.features.push(simplify(geojson.features[i], { tolerance: 0.002, highQuality: true }));
          } catch (_) { simplified.features.push(geojson.features[i]); }
          if (i % 4 === 0) {
            const pct = 20 + Math.round((i / total) * 40);
            this._showLoadProgress(pct, `Simplifying… ${i}/${total}`);
            await new Promise(r => setTimeout(r, 0));
          }
        }

        this._showLoadProgress(65, 'Building layers…');
        await new Promise(r => setTimeout(r, 0));

        this._layerSimplified = L.geoJSON(simplified, {
          ...layerOpts,
          renderer: L.canvas({ pane: 'slopePane' }),
          onEachFeature: (f, l) => { l.options.pane = 'slopePane'; },
        });

        this._showLoadProgress(80, 'Building full-detail layer…');
        await new Promise(r => setTimeout(r, 0));

        this._layerFull = L.geoJSON(geojson, {
          ...layerOpts,
          renderer: L.canvas({ pane: 'slopePane' }),
          onEachFeature: (f, l) => { l.options.pane = 'slopePane'; },
        });

        this._showLoadProgress(100, 'Done');
        const z = map.getZoom();
        this._layer = z < this.LOD_ZOOM ? this._layerSimplified : this._layerFull;
      } catch (e) {
        this._hideLoadProgress();
        APP._showToast('Failed to load slope data');
        if (import.meta.env.DEV) console.error('Slope fetch error:', e);
        APP.state.showSlope = false;
        useMapStore.setState({ showSlope: false, slopeLoading: false });
        APP._updateHydroLegend();
        return; /* finally still runs — _toggling will be cleared */
      }
    }

    APP._updateSubWatershedStyles();
    if (!this._layer) {
      APP.state.showSlope = false;
      useMapStore.setState({ showSlope: false });
      return;
    }

    if (APP.state.showSlope) {
      this._hideLoadProgress();
      useMapStore.setState({ slopeLoading: false });
      APP._showToast('Slope overlay loaded ✓');
      map.addLayer(this._layer);
      this.reapplyClip();
      this._bindMapEvents(map);
    } else {
      this._unbindMapEvents(map);
      map.removeLayer(this._layer);
      this.removeClip();
      this._clipFeature = null;
    }

    const slopeCtrl = document.getElementById('slope-controls');
    if (slopeCtrl) slopeCtrl.style.display = APP.state.showSlope ? 'block' : 'none';

    APP._updateHydroLegend();
    } finally { this._toggling = false; }
  },

  _showLoadProgress(pct, label) {
    showLoadProgress('slope-load-progress', pct, label);
  },

  _hideLoadProgress() {
    hideLoadProgress('slope-load-progress');
  },

  _ensurePane() {
    ensurePane(APP.state.map, 'slopePane', 250);
  },

  _bindMapEvents(map) {
    bindOverlayEvents(map, {
      onMapMove: _onMapMove,
      onZoomStart: _onZoomStart,
      onZoomEnd: _onZoomEnd,
      onZoomSwap: this._onZoomSwap,
    }, this);
  },

  _onZoomSwap() {
    if (!APP.state.showSlope) return;
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
    unbindOverlayEvents(map, {
      onMapMove: _onMapMove,
      onZoomStart: _onZoomStart,
      onZoomEnd: _onZoomEnd,
      onZoomSwap: this._onZoomSwap,
    }, this);
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

    const rings = extractOuterRings(feature.geometry);
    if (!rings.length) {
      pane.style.clipPath = '';
      return;
    }

    const clipPath = buildClipPath(map, rings);
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
    if (!APP.state.showSlope) {
      /* Clear stale clip-path even when slope is off — prevents
         a leftover clip from reappearing on next toggle. */
      this.removeClip();
      return;
    }
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
      const pane = map.getPane('slopePane');
      if (pane && pane.parentNode) pane.parentNode.removeChild(pane);
    }
    this._layer = null;
    this._layerSimplified = null;
    this._layerFull = null;
    this._clipFeature = null;
    this.removeClip();
    APP.state.showSlope = false;
    useMapStore.setState({ showSlope: false });
    const slopeCtrl = document.getElementById('slope-controls');
    if (slopeCtrl) slopeCtrl.style.display = 'none';
  },

  _setOpacity(val) {
    const apply = (layer) => {
      if (!layer || !layer.eachLayer) return;
      layer.eachLayer((l) => { if (l.setStyle) l.setStyle({ fillOpacity: val }); });
    };
    apply(this._layerSimplified);
    apply(this._layerFull);
  },

  _setColorScheme(scheme) {
    const palette = scheme === 'terrain'
      ? { 1: '#1a9850', 2: '#66bd63', 3: '#a6d96a', 4: '#d9ef8b', 5: '#fee08b' }
      : scheme === 'heat'
      ? { 1: '#2b83ba', 2: '#abdda4', 3: '#ffffbf', 4: '#fdae61', 5: '#d7191c' }
      : SLOPE_COLORS;
    [this._layerSimplified, this._layerFull].forEach((layer) => {
      if (!layer || !layer.eachLayer) return;
      layer.eachLayer((l) => {
        const code = l.feature?.properties?.gridcode;
        if (l.setStyle && code != null) {
          l.setStyle({ fillColor: palette[code] || '#cccccc' });
        }
      });
    });
  },
};
