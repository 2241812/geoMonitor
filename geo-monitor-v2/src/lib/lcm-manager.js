import { APP } from './app.js';
import { simplify } from '@turf/turf';

const LCM_COLORS = {
  'Closed Forest':     '#006400',
  'Open Forest':       '#228B22',
  'Mangrove Forest':   '#004d40',
  'Brush/Shrubs':      '#8FBC8F',
  'Grassland':         '#90EE90',
  'Annual Crop':       '#FFD700',
  'Perennial Crop':    '#DAA520',
  'Marshland/Swamp':   '#4682B4',
  'Open/Barren':       '#D2B48C',
  'Built-up':          '#DC143C',
  'Fishpond':          '#00BFFF',
  'Inland Water':      '#1E90FF',
};

const PANE_NAME = 'lcmPane';
const LOD_ZOOM = 10;

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

function _buildClipPath(map, rings) {
  if (!rings.length) return '';
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

function _lcmOnMapMove() {
  APP.lcm.reapplyClip();
}

function _lcmOnZoomStart() {
  const map = APP.state.map;
  if (!map || !APP.state.showLCM) return;
  const pane = map.getPane(PANE_NAME);
  if (pane) {
    pane.style.willChange = 'transform';
    pane.style.opacity = '0';
  }
}

function _lcmOnZoomEnd() {
  const map = APP.state.map;
  if (!map || !APP.state.showLCM) return;
  const pane = map.getPane(PANE_NAME);
  if (pane) {
    pane.style.opacity = '';
    pane.style.willChange = '';
  }
  APP.lcm.reapplyClip();
}

APP.lcm = {
  _layer: null,
  _layerSimplified: null,
  _layerFull: null,
  _rafId: null,
  _clipFeature: null,
  _basinCache: {},
  _currentCode: null,

  async loadBasin(code, geojson) {
    const map = APP.state.map;
    if (!map) return;

    this.destroy();
    this._currentCode = code;

    if (!APP.state.showLCM) return;

    this._ensurePane();

    const styleFn = (f) => ({
      fillColor: LCM_COLORS[f.properties.LCM_CLASS] || '#cccccc',
      fillOpacity: APP.state.lcmOpacity || 0.65,
      stroke: false,
      weight: 0,
    });

    const simplified = { type: 'FeatureCollection', features: [] };
    const total = geojson.features.length;
    for (let i = 0; i < total; i++) {
      try {
        simplified.features.push(simplify(geojson.features[i], { tolerance: 0.002, highQuality: true }));
      } catch (_) { simplified.features.push(geojson.features[i]); }
      if (i % 20 === 0) await new Promise(r => setTimeout(r, 0));
    }

    this._layerSimplified = L.geoJSON(simplified, {
      style: styleFn,
      interactive: false,
      renderer: L.canvas({ pane: PANE_NAME }),
      onEachFeature: (f, l) => { l.options.pane = PANE_NAME; },
    });

    this._layerFull = L.geoJSON(geojson, {
      style: styleFn,
      interactive: false,
      renderer: L.canvas({ pane: PANE_NAME }),
      onEachFeature: (f, l) => { l.options.pane = PANE_NAME; },
    });

    const z = map.getZoom();
    this._layer = z < LOD_ZOOM ? this._layerSimplified : this._layerFull;

    map.addLayer(this._layer);
    this.reapplyClip();
    this._bindMapEvents(map);
  },

  _ensurePane() {
    const map = APP.state.map;
    if (!map) return;
    if (!map.getPane(PANE_NAME)) {
      map.createPane(PANE_NAME);
      const pane = map.getPane(PANE_NAME);
      pane.style.zIndex = 260;
      pane.style.transition = 'opacity 0.15s ease-out';
    }
  },

  _bindMapEvents(map) {
    map.off('move', _lcmOnMapMove);
    map.off('moveend', _lcmOnMapMove);
    map.off('zoomanim', _lcmOnMapMove);
    map.off('zoomend', _lcmOnMapMove);
    map.off('zoomstart', _lcmOnZoomStart);
    map.off('zoomend', _lcmOnZoomEnd);
    map.on('move', _lcmOnMapMove);
    map.on('moveend', _lcmOnMapMove);
    map.on('zoomanim', _lcmOnMapMove);
    map.on('zoomend', _lcmOnMapMove);
    map.on('zoomstart', _lcmOnZoomStart);
    map.on('zoomend', _lcmOnZoomEnd);

    map.off('zoomend', this._onZoomSwap, this);
    map.on('zoomend', this._onZoomSwap, this);
  },

  _unbindMapEvents(map) {
    map.off('move', _lcmOnMapMove);
    map.off('moveend', _lcmOnMapMove);
    map.off('zoomanim', _lcmOnMapMove);
    map.off('zoomend', _lcmOnMapMove);
    map.off('zoomstart', _lcmOnZoomStart);
    map.off('zoomend', _lcmOnZoomEnd);
    map.off('zoomend', this._onZoomSwap, this);
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

  updateClip(feature) {
    const map = APP.state.map;
    if (!map) return;
    const pane = map.getPane(PANE_NAME);
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

  removeClip() {
    const map = APP.state.map;
    if (!map) return;
    const pane = map.getPane(PANE_NAME);
    if (pane) pane.style.clipPath = '';
    this._clipFeature = null;
  },

  reapplyClip() {
    if (!APP.state.showLCM) return;
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
    });
  },

  hide() {
    const map = APP.state.map;
    if (!map || !this._layer) return;
    if (map.hasLayer(this._layer)) {
      map.removeLayer(this._layer);
    }
    this._unbindMapEvents(map);
    this.removeClip();
  },

  show() {
    const map = APP.state.map;
    if (!map || !this._layer || !APP.state.showLCM) return;
    if (!map.hasLayer(this._layer)) {
      map.addLayer(this._layer);
    }
    this.reapplyClip();
    this._bindMapEvents(map);
  },

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
    this._currentCode = null;
    this.removeClip();
  },

  _setOpacity(val) {
    const apply = (layer) => {
      if (!layer || !layer.eachLayer) return;
      layer.eachLayer((l) => { if (l.setStyle) l.setStyle({ fillOpacity: val }); });
    };
    apply(this._layerSimplified);
    apply(this._layerFull);
  },
};
