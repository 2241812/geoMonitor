import { APP } from './app.js';
import { useMapStore } from '../store/useMapStore.js';
import { fetchSlopeFromSupabase } from './supabase-geo.js';
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
 * Strategy: fetch ALL basins ONCE on first toggle, keep the single layer
 * alive, and clip via CSS clip-path based on the current drill level.
 * No re-fetching on drill-in/out — instant transitions.
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
  APP.slope.reapplyClip();
}

/* No-op placeholder so bindOverlayEvents doesn't log "wrong listener type: undefined"
   when we omit onZoomSwap (no LOD swap needed with single-layer strategy). */
function _noop() {}

APP.slope = {
  _layer: null,
  _rafId: null,
  _clipFeature: null,
  _toggling: false,
  _basinsLoaded: {},

  async _loadBasin(code) {
    if (this._basinsLoaded[code]) return this._basinsLoaded[code];
    this._basinsLoaded[code] = (async () => {
      this._showLoadProgress(0, `Fetching slope data for ${code}…`);
      try {
        const geojson = await fetchSlopeFromSupabase(code, (pct, msg) => {
          this._showLoadProgress(pct, msg);
        });
        this._showLoadProgress(90, 'Adding to layer…');
        await new Promise(r => setTimeout(r, 0));
        if (this._layer && this._layer.addData) {
          this._layer.addData(geojson);
        }
        this._showLoadProgress(100, 'Done');
        setTimeout(() => this._hideLoadProgress(), 600);
      } catch (e) {
        this._hideLoadProgress();
        delete this._basinsLoaded[code];
        throw e;
      }
    })();
    return this._basinsLoaded[code];
  },

  async toggle() {
    if (this._toggling) return;
    this._toggling = true;
    try {
      APP.state.showSlope = !APP.state.showSlope;
      useMapStore.setState({ showSlope: APP.state.showSlope });
      const map = APP.state.map;
      if (!map) return;

      if (APP.state.showSlope && !this._layer) {
        useMapStore.setState({ slopeLoading: false });
        this._ensurePane();
        const styleFn = (f) => ({
          fillColor: SLOPE_COLORS[f.properties.gridcode] || '#cccccc',
          fillOpacity: 0.65, stroke: false, weight: 0,
        });
        this._layer = L.geoJSON(null, {
          style: styleFn,
          interactive: false,
          renderer: L.canvas({ pane: 'slopePane' }),
        });
      }

      if (!this._layer) {
        APP.state.showSlope = false;
        useMapStore.setState({ showSlope: false });
        return;
      }

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

      const slopeCtrl = document.getElementById('slope-controls');
      if (slopeCtrl) slopeCtrl.style.display = APP.state.showSlope ? 'block' : 'none';

      APP._updateHydroLegend();
    } finally {
      this._toggling = false;
    }
  },

  /**
   * Build a single L.geoJSON layer from all-basins data.
   * No LOD swapping, no duplicate — we clip with CSS instead.
   */
  _buildLayer(geojson) {
    const map = APP.state.map;
    this._ensurePane();
    const styleFn = (f) => ({
      fillColor: SLOPE_COLORS[f.properties.gridcode] || '#cccccc',
      fillOpacity: 0.65, stroke: false, weight: 0,
    });
    this._layer = L.geoJSON(geojson, {
      style: styleFn,
      interactive: false,
      renderer: L.canvas({ pane: 'slopePane' }),
      onEachFeature: (f, l) => { l.options.pane = 'slopePane'; },
    });
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
      onZoomSwap: _noop,
    }, this);
  },

  _unbindMapEvents(map) {
    unbindOverlayEvents(map, {
      onMapMove: _onMapMove,
      onZoomStart: _onZoomStart,
      onZoomEnd: _onZoomEnd,
      onZoomSwap: _noop,
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
      this.removeClip();
      return;
    }
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      const map = APP.state.map;
      if (!map) return;

      if (map._animatingZoom) return;

      if (APP.state.hydroSelectedZone) {
        this.updateClip(APP.state.hydroSelectedZone);
      } else if (APP.state.hydroSelectedBasin && APP.state.hydroSelectedBasin.feature) {
        this.updateClip(APP.state.hydroSelectedBasin.feature);
      } else {
        this.removeClip();
      }

      const code = APP.state.hydroSelectedBasin?.code;
      if (code && !this._basinsLoaded[code]) {
        this._loadBasin(code).catch(e => {
          if (import.meta.env.DEV) console.error('Slope load error:', e);
        });
      }
    });
  },

  /** Hide from map without destroying. Layer + data stay in memory. */
  hide() {
    const map = APP.state.map;
    if (!map || !this._layer) return;
    if (map.hasLayer(this._layer)) {
      map.removeLayer(this._layer);
    }
    this._unbindMapEvents(map);
    this.removeClip();
  },

  /** Re-show after hide. Instant — no fetch, no rebuild. */
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
      if (this._layer) map.removeLayer(this._layer);
      const pane = map.getPane('slopePane');
      if (pane && pane.parentNode) pane.parentNode.removeChild(pane);
    }
    this._layer = null;
    this._clipFeature = null;
    this._basinsLoaded = {};
    this.removeClip();
    APP.state.showSlope = false;
    useMapStore.setState({ showSlope: false });
    const slopeCtrl = document.getElementById('slope-controls');
    if (slopeCtrl) slopeCtrl.style.display = 'none';
  },

  _setOpacity(val) {
    if (!this._layer || !this._layer.eachLayer) return;
    this._layer.eachLayer((l) => { if (l.setStyle) l.setStyle({ fillOpacity: val }); });
  },

  _setColorScheme(scheme) {
    const palette = scheme === 'terrain'
      ? { 1: '#1a9850', 2: '#66bd63', 3: '#a6d96a', 4: '#d9ef8b', 5: '#fee08b' }
      : scheme === 'heat'
      ? { 1: '#2b83ba', 2: '#abdda4', 3: '#ffffbf', 4: '#fdae61', 5: '#d7191c' }
      : SLOPE_COLORS;
    if (!this._layer || !this._layer.eachLayer) return;
    this._layer.eachLayer((l) => {
      const code = l.feature?.properties?.gridcode;
      if (l.setStyle && code != null) {
        l.setStyle({ fillColor: palette[code] || '#cccccc' });
      }
    });
  },
};
