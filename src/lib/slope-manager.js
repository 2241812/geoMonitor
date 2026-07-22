import L from 'leaflet';
import { APP } from './app.js';
import { useMapStore } from '../store/useMapStore.js';
import { fetchSlopeFromSupabase } from './supabase-geo.js';
import { simplify } from '@turf/turf';
import {
  extractOuterRings,
  buildClipPath,
  bindOverlayEvents,
  unbindOverlayEvents,
  showLoadProgress,
  hideLoadProgress,
  ensurePane,
} from './overlay-utils.js';

export const SLOPE_COLORS = { 1: '#50A823', 2: '#8BD100', 3: '#FFFF00', 4: '#FF9A36', 5: '#FF4A4A' };

const LOD_ZOOM = 14;
const SIMPLIFY_TOLERANCE = 0.0005;

function _onZoomStart() {
  const map = APP.state.map;
  if (!map || !APP.state.showSlope) return;
  const pane = map.getPane('slopePane');
  if (pane) { pane.style.willChange = 'transform'; }
}
function _onZoomEnd() {
  const map = APP.state.map;
  if (!map || !APP.state.showSlope) return;
  const pane = map.getPane('slopePane');
  if (pane) { pane.style.willChange = ''; }
  requestAnimationFrame(() => {
    APP.slope.reapplyClip();
  });
}

APP.slope = {
  _layer: null,
  _layerSimplified: null,
  _layerFull: null,
  _rafId: null,
  _clipFeature: null,
  _toggling: false,
  _basinsLoaded: {},

  _ensureLayers() {
    const map = APP.state.map;
    if (!map) return;
    this._ensurePane();
    if (!this._layerSimplified || !this._layerFull) {
      const styleFn = (f) => ({
        fillColor: SLOPE_COLORS[f.properties.gridcode] || '#cccccc',
        fillOpacity: APP.state.slopeOpacity ?? 0.65, stroke: false, weight: 0,
      });
      const canvasRenderer = L.canvas({ pane: 'slopePane', padding: 0.5 });
      canvasRenderer._onClick = function() {};
      canvasRenderer._onMouseMove = function() {};
      this._layerSimplified = L.geoJSON(null, {
        style: styleFn, interactive: false,
        renderer: canvasRenderer,
      });
      this._layerFull = L.geoJSON(null, {
        style: styleFn, interactive: false,
        renderer: canvasRenderer,
      });
      const z = map.getZoom();
      this._layer = z < LOD_ZOOM ? this._layerSimplified : this._layerFull;
    }
  },

  async _loadBasin(code) {
    const quality = APP.state.slopeQuality || 'balanced';
    const cacheKey = code + '::' + quality;
    if (this._basinsLoaded[cacheKey]) return this._basinsLoaded[cacheKey];
    this._basinsLoaded[cacheKey] = (async () => {
      this._showLoadProgress(0, `Fetching slope data for ${code} (${quality})…`);
      try {
        this._ensureLayers();

        const geojson = await fetchSlopeFromSupabase(code, (pct, msg) => {
          this._showLoadProgress(pct, msg);
        }, quality);

        this._showLoadProgress(60, `Processing ${quality} quality tier…`);
        await new Promise(r => setTimeout(r, 0));
        
        let simplifiedFC = geojson;
        let fullFC = geojson;

        if (quality === 'fast') {
          // High Speed: heavy simplification (tolerance = 0.0035) for maximum performance
          const fastFeatures = [];
          for (const f of geojson.features) {
            try {
              fastFeatures.push(simplify(f, { tolerance: 0.0035, highQuality: true }));
            } catch (_) { fastFeatures.push(f); }
          }
          const fastGeoJSON = { type: 'FeatureCollection', features: fastFeatures };
          simplifiedFC = fastGeoJSON;
          fullFC = fastGeoJSON;
        } else if (quality === 'balanced') {
          // Balanced: server-simplified for low zoom, full for high zoom
          const simpFeatures = [];
          for (const f of geojson.features) {
            if (f.properties?._simplified) {
              simpFeatures.push(f);
            } else {
              try {
                simpFeatures.push(simplify(f, { tolerance: 0.0008, highQuality: true }));
              } catch (_) { simpFeatures.push(f); }
            }
          }
          simplifiedFC = { type: 'FeatureCollection', features: simpFeatures };
        } else {
          // Full Detail (raw): 100% raw geometry for all zoom levels (0 tolerance)
          simplifiedFC = geojson;
          fullFC = geojson;
        }

        this._showLoadProgress(85, 'Adding to layers…');
        await new Promise(r => setTimeout(r, 0));
        if (this._layerFull) {
          this._layerFull.clearLayers();
          this._layerFull.addData(fullFC);
        }
        if (this._layerSimplified) {
          this._layerSimplified.clearLayers();
          this._layerSimplified.addData(simplifiedFC);
        }

        const map = APP.state.map;
        if (map && this._layer && map.hasLayer(this._layer)) {
          this.reapplyClip();
        }

        this._showLoadProgress(100, 'Done');
        setTimeout(() => this._hideLoadProgress(), 600);
      } catch (e) {
        this._hideLoadProgress();
        delete this._basinsLoaded[cacheKey];
        throw e;
      }
    })();
    return this._basinsLoaded[cacheKey];
  },

  async toggle() {
    if (this._toggling) return;
    this._toggling = true;
    try {
      APP.state.showSlope = !APP.state.showSlope;
      useMapStore.setState({ showSlope: APP.state.showSlope });
      const map = APP.state.map;
      if (!map) return;

      if (APP.state.showSlope) {
        this._ensureLayers();
        useMapStore.setState({ slopeLoading: false });
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

  _onZoomSwap() {
    const map = APP.state.map;
    if (!map || !this._layerSimplified || !this._layerFull) return;
    const z = map.getZoom();
    const target = z < LOD_ZOOM ? this._layerSimplified : this._layerFull;
    if (target === this._layer) return;
    const wasActive = map.hasLayer(this._layer);
    map.removeLayer(this._layer);
    this._layer = target;
    if (wasActive) {
      map.addLayer(this._layer);
      this.reapplyClip();
    }
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
      onZoomStart: _onZoomStart,
      onZoomEnd: _onZoomEnd,
      onZoomSwap: this._onZoomSwap,
    }, this);
  },

  _unbindMapEvents(map) {
    unbindOverlayEvents(map, {
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
      this._clipZoom = null;
      return;
    }

    const zoom = map.getZoom();
    if (this._clipFeature === feature && this._clipZoom === zoom && pane.style.clipPath) {
      return;
    }

    this._clipFeature = feature;
    this._clipZoom = zoom;

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
    this._clipZoom = null;
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
      if (this._layerSimplified) map.removeLayer(this._layerSimplified);
      if (this._layerFull) map.removeLayer(this._layerFull);
      const pane = map.getPane('slopePane');
      if (pane && pane.parentNode) pane.parentNode.removeChild(pane);
    }
    this._layer = null;
    this._layerSimplified = null;
    this._layerFull = null;
    this._clipFeature = null;
    this._basinsLoaded = {};
    this.removeClip();
    APP.state.showSlope = false;
    useMapStore.setState({ showSlope: false });
    const slopeCtrl = document.getElementById('slope-controls');
    if (slopeCtrl) slopeCtrl.style.display = 'none';
  },

  setQuality(quality) {
    APP.state.slopeQuality = quality;
    useMapStore.setState({ slopeQuality: quality });
    const code = APP.state.hydroSelectedBasin?.code;
    if (code && APP.state.showSlope) {
      useMapStore.setState({ slopeLoading: true });
      this._loadBasin(code).then(() => {
        useMapStore.setState({ slopeLoading: false });
        this.reapplyClip();
      }).catch(() => {
        useMapStore.setState({ slopeLoading: false });
      });
    }
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
    const apply = (layer) => {
      if (!layer || !layer.eachLayer) return;
      layer.eachLayer((l) => {
        const code = l.feature?.properties?.gridcode;
        if (l.setStyle && code != null) {
          l.setStyle({ fillColor: palette[code] || '#cccccc' });
        }
      });
    };
    apply(this._layerSimplified);
    apply(this._layerFull);
  },
};
