import { APP } from './app.js';
import { simplify } from '@turf/turf';
import { cacheDelete } from './fetch-cache.js';
import {
  extractOuterRings,
  buildClipPath,
  bindOverlayEvents,
  unbindOverlayEvents,
  showLoadProgress,
  hideLoadProgress,
  ensurePane,
} from './overlay-utils.js';

export const LCM_CLASSES = [
  { name: 'Closed Forest',   color: '#016300' },
  { name: 'Open Forest',     color: '#02DB00' },
  { name: 'Mangrove Forest', color: '#BA00FE' },
  { name: 'Brush/Shrubs',    color: '#FED4C2' },
  { name: 'Grassland',       color: '#974749' },
  { name: 'Annual Crop',     color: '#FEFAC2' },
  { name: 'Perennial Crop',  color: '#FFFF00' },
  { name: 'Marshland/Swamp', color: '#C2FBFE' },
  { name: 'Open/Barren',     color: '#D2D2D2' },
  { name: 'Built-up',        color: '#FF0000' },
  { name: 'Fishpond',        color: '#0081FE' },
  { name: 'Inland Water',    color: '#281F94' },
];

const LCM_COLORS = {};
LCM_CLASSES.forEach(c => { LCM_COLORS[c.name] = c.color; });

const PANE_NAME = 'lcmPane';
const LOD_ZOOM = 10;

function _lcmOnMapMove() { APP.lcm.reapplyClip(); }

function _lcmOnZoomStart() {
  const map = APP.state.map;
  if (!map || !APP.state.showLCM) return;
  const pane = map.getPane(PANE_NAME);
  if (pane) { pane.style.willChange = 'transform'; pane.style.opacity = '0'; }
}

function _lcmOnZoomEnd() {
  const map = APP.state.map;
  if (!map || !APP.state.showLCM) return;
  const pane = map.getPane(PANE_NAME);
  if (pane) { pane.style.opacity = ''; pane.style.willChange = ''; }
  APP.lcm.reapplyClip();
}

APP.lcm = {
  _layer: null,
  _layerSimplified: null,
  _layerFull: null,
  _rafId: null,
  _clipFeature: null,
  _currentCode: null,
  _visibleClasses: null,

  getVisibleClasses() {
    if (!this._visibleClasses) {
      this._visibleClasses = new Set(LCM_CLASSES.map(c => c.name));
    }
    return this._visibleClasses;
  },

  isClassVisible(name) {
    return this.getVisibleClasses().has(name);
  },

  toggleClass(name) {
    const vis = this.getVisibleClasses();
    if (vis.has(name)) vis.delete(name); else vis.add(name);
    this._applyClassVisibility();
    APP._updateLCMControls();
  },

  showAllClasses() {
    this._visibleClasses = new Set(LCM_CLASSES.map(c => c.name));
    this._applyClassVisibility();
    APP._updateLCMControls();
  },

  invalidateCache() {
    const BASIN_CODES = ['ABR', 'ABU', 'ACH', 'AGN', 'AMB', 'ARI', 'BUD', 'CAB', 'MLG', 'NAG', 'SIF', 'SMR', 'UMT', 'ZUM'];
    BASIN_CODES.forEach(code => cacheDelete('lcm:' + code));
    cacheDelete('lcm:UCH'); /* ACH→UCH mapping */
  },

  hideAllClasses() {
    this._visibleClasses = new Set();
    this._applyClassVisibility();
    APP._updateLCMControls();
  },

  _applyClassVisibility() {
    const vis = this.getVisibleClasses();
    const apply = (layer) => {
      if (!layer || !layer.eachLayer) return;
      layer.eachLayer((l) => {
        if (!l.setStyle || !l.feature) return;
        const cls = l.feature.properties.LCM_CLASS;
        if (vis.has(cls)) {
          l.setStyle({ fillOpacity: APP.state.lcmOpacity || 0.65 });
          l._lcmHidden = false;
        } else {
          l.setStyle({ fillOpacity: 0 });
          l._lcmHidden = true;
        }
      });
    };
    apply(this._layerSimplified);
    apply(this._layerFull);
  },

  async loadBasin(code, geojson) {
    const map = APP.state.map;
    if (!map) return;

    this.destroy();
    this._currentCode = code;

    if (!APP.state.showLCM) return;

    this._showLoadProgress(0, 'Processing geometry…');
    await new Promise(r => setTimeout(r, 0));

    this._ensurePane();

    const vis = this.getVisibleClasses();
    const styleFn = (f) => ({
      fillColor: LCM_COLORS[f.properties.LCM_CLASS] || '#cccccc',
      fillOpacity: vis.has(f.properties.LCM_CLASS) ? (APP.state.lcmOpacity || 0.65) : 0,
      stroke: false,
      weight: 0,
    });

    const simplified = { type: 'FeatureCollection', features: [] };
    const total = geojson.features.length;
    for (let i = 0; i < total; i++) {
      try {
        simplified.features.push(simplify(geojson.features[i], { tolerance: 0.002, highQuality: true }));
      } catch (_) { simplified.features.push(geojson.features[i]); }
      if (i % 4 === 0) {
        const pct = Math.round((i / total) * 60);
        this._showLoadProgress(pct, `Simplifying… ${i}/${total}`);
        await new Promise(r => setTimeout(r, 0));
      }
    }

    this._showLoadProgress(65, 'Building layers…');
    await new Promise(r => setTimeout(r, 0));

    this._layerSimplified = L.geoJSON(simplified, {
      style: styleFn,
      interactive: false,
      renderer: L.canvas({ pane: PANE_NAME }),
      onEachFeature: (f, l) => { l.options.pane = PANE_NAME; },
    });

    this._showLoadProgress(80, 'Building full-detail layer…');
    await new Promise(r => setTimeout(r, 0));

    this._layerFull = L.geoJSON(geojson, {
      style: styleFn,
      interactive: false,
      renderer: L.canvas({ pane: PANE_NAME }),
      onEachFeature: (f, l) => { l.options.pane = PANE_NAME; },
    });

    this._showLoadProgress(100, 'Done');
    const z = map.getZoom();
    this._layer = z < LOD_ZOOM ? this._layerSimplified : this._layerFull;

    map.addLayer(this._layer);
    this.reapplyClip();
    this._bindMapEvents(map);

    setTimeout(() => this._hideLoadProgress(), 600);
  },

  _showLoadProgress(pct, label) {
    showLoadProgress('lcm-load-progress', pct, label);
  },

  _hideLoadProgress() {
    hideLoadProgress('lcm-load-progress');
  },

  _ensurePane() {
    ensurePane(APP.state.map, PANE_NAME, 260);
  },

  _bindMapEvents(map) {
    bindOverlayEvents(map, {
      onMapMove: _lcmOnMapMove,
      onZoomStart: _lcmOnZoomStart,
      onZoomEnd: _lcmOnZoomEnd,
      onZoomSwap: this._onZoomSwap,
    }, this);
  },

  _unbindMapEvents(map) {
    unbindOverlayEvents(map, {
      onMapMove: _lcmOnMapMove,
      onZoomStart: _lcmOnZoomStart,
      onZoomEnd: _lcmOnZoomEnd,
      onZoomSwap: this._onZoomSwap,
    }, this);
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
    const rings = extractOuterRings(feature.geometry);
    if (!rings.length) { pane.style.clipPath = ''; return; }
    const clipPath = buildClipPath(map, rings);
    if (clipPath) pane.style.clipPath = clipPath;
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
    if (map.hasLayer(this._layer)) map.removeLayer(this._layer);
    this._unbindMapEvents(map);
    this.removeClip();
  },

  show() {
    const map = APP.state.map;
    if (!map || !this._layer || !APP.state.showLCM) return;
    if (!map.hasLayer(this._layer)) map.addLayer(this._layer);
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
    const vis = this.getVisibleClasses();
    const apply = (layer) => {
      if (!layer || !layer.eachLayer) return;
      layer.eachLayer((l) => {
        if (!l.setStyle || !l.feature) return;
        const cls = l.feature.properties.LCM_CLASS;
        l.setStyle({ fillOpacity: vis.has(cls) ? val : 0 });
      });
    };
    apply(this._layerSimplified);
    apply(this._layerFull);
  },
};

APP._toggleLCMClass = function(name) { APP.lcm.toggleClass(name); };
APP._lcmShowAll = function() { APP.lcm.showAllClasses(); };
APP._lcmHideAll = function() { APP.lcm.hideAllClasses(); };

APP._renderLCMClassToggles = function() {
  const vis = APP.lcm.getVisibleClasses();
  let html = `<div class="lcm-class-toggles">`;
  html += `<div class="lcm-class-header"><b>Land Cover Classes</b>
    <span class="lcm-class-actions">
      <a href="#" onclick="APP._lcmShowAll();return false" style="font-size:11px;cursor:pointer">All</a>
      <span style="color:#ccc;margin:0 2px">|</span>
      <a href="#" onclick="APP._lcmHideAll();return false" style="font-size:11px;cursor:pointer">None</a>
    </span></div>`;
  LCM_CLASSES.forEach(c => {
    const checked = vis.has(c.name) ? 'checked' : '';
    html += `<label class="lcm-class-row">
      <input type="checkbox" ${checked} onchange="APP._toggleLCMClass('${c.name}')">
      <span class="lcm-class-swatch" style="background:${c.color}"></span>
      <span class="lcm-class-label">${c.name}</span>
    </label>`;
  });
  html += `</div>`;
  return html;
};

APP._refetchLCMWithClasses = function() {
  const classes = [...APP.lcm.getVisibleClasses()];
  if (classes.length === 0) {
    APP._showToast('Select at least one land cover class');
    return;
  }
  APP.lcm.invalidateCache();
  if (APP.state.hydroDrillLevel === 0) {
    APP._loadAllLCM();
  } else if (APP.state._basinCode) {
    APP._loadBasinLCM(APP.state._basinCode);
  }
};

APP._updateLCMControls = function() {
  document.querySelectorAll('.lcm-class-toggles').forEach(el => {
    el.outerHTML = APP._renderLCMClassToggles();
  });
};
