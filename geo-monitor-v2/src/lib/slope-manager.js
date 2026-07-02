import { APP } from './app.js';

/**
 * slope-manager.js
 *
 * Manages the slope overlay layer independently of hydro drill-down logic.
 * Handles: layer creation/destruction, watershed-boundary clipping via CSS
 * clip-path on a custom Leaflet pane, and responsive clip updates during
 * map move/zoom animations (throttled via requestAnimationFrame).
 *
 * Bugs fixed vs inline approach:
 *  - Slope layer was destroyed every drill-up/clear (had to retoggle)
 *  - Event listeners leaked when toggle-off ran with null layer
 *  - Clip lagged during animations (only updated on moveend/zoomend)
 */

const COLORS = { 1: '#50A823', 2: '#8BD100', 3: '#FFFF00', 4: '#FF9A36', 5: '#FF4A4A' };

APP.slope = {
  _layer: null,
  _rafId: null,

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
        this._layer = L.geoJSON(geojson, {
          style: (f) => ({
            fillColor: COLORS[f.properties.gridcode] || '#cccccc',
            fillOpacity: 0.65,
            stroke: false,
            weight: 0,
          }),
          interactive: false,
          onEachFeature: (f, l) => { l.options.pane = 'slopePane'; },
        });
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
      map.on('move', this.reapplyClip, this);
      map.on('moveend', this.reapplyClip, this);
      map.on('zoomend', this.reapplyClip, this);
    } else {
      map.off('move', this.reapplyClip, this);
      map.off('moveend', this.reapplyClip, this);
      map.off('zoomend', this.reapplyClip, this);
      map.removeLayer(this._layer);
      this.removeClip();
    }
    APP._updateHydroLegend();
  },

  _ensurePane() {
    const map = APP.state.map;
    if (!map) return;
    if (!map.getPane('slopePane')) {
      map.createPane('slopePane');
      map.getPane('slopePane').style.zIndex = 250;
    }
  },

  /** Clip slope layer to a watershed boundary polygon via CSS clip-path. */
  updateClip(feature) {
    const map = APP.state.map;
    if (!map) return;
    const pane = map.getPane('slopePane');
    if (!pane || !feature || !feature.geometry) return;
    const coords = feature.geometry.coordinates;
    const outer = coords[0];
    if (!outer || !outer.length) return;
    try {
      const pixels = outer.map(c => map.latLngToContainerPoint([c[1], c[0]]));
      const points = pixels.map(p => `${Math.round(p.x)}px ${Math.round(p.y)}px`).join(',');
      pane.style.clipPath = `polygon(${points})`;
    } catch (_) { /* skip on malformed geometry */ }
  },

  /** Remove the clip-path so the full slope layer is visible. */
  removeClip() {
    const map = APP.state.map;
    if (!map) return;
    const pane = map.getPane('slopePane');
    if (pane) pane.style.clipPath = '';
  },

  /**
   * Reapply clip based on current hydro state.
   * Uses requestAnimationFrame to batch updates to paint cycles for
   * smooth tracking during map move/zoom animations.
   */
  reapplyClip() {
    if (!APP.state.showSlope) return;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (APP.state.hydroSelectedZone) {
        this.updateClip(APP.state.hydroSelectedZone);
      } else if (APP.state.hydroSelectedBasin && APP.state.hydroSelectedBasin.feature) {
        this.updateClip(APP.state.hydroSelectedBasin.feature);
      } else {
        this.removeClip();
      }
    });
  },

  /** Full teardown: unbind events, remove layer, clear clip, reset state. */
  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    const map = APP.state.map;
    if (map) {
      map.off('move', this.reapplyClip, this);
      map.off('moveend', this.reapplyClip, this);
      map.off('zoomend', this.reapplyClip, this);
      if (this._layer) map.removeLayer(this._layer);
    }
    this._layer = null;
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
