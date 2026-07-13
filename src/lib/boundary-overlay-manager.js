import { APP } from './app.js';

Object.assign(APP, {
  boundaryOverlay: {
    _defaults: {
      fillOpacity: 0,
      outlineOpacity: 0.9,
      fillColor: '#d1d5db',
      outlineColor: '#1e293b',
      outlineWeight: 2.5,
    },

    _getDefaults() {
      const level = APP.state.currentLevel;
      const cfg = APP.config.colors[level] || APP.config.colors[0];
      return {
        fillOpacity: cfg.fill === 'transparent' ? 0 : (cfg.fillOpacity || 0.25),
        outlineOpacity: cfg.opacity || 0.9,
        fillColor: cfg.fill === 'transparent' ? '#d1d5db' : cfg.fill,
        outlineColor: cfg.stroke || '#1e293b',
        outlineWeight: cfg.weight || 2.5,
      };
    },

    apply() {
      const level = APP.state.currentLevel;
      const layer = APP.state.layers[level];
      if (!layer) return;

      const s = APP.state.boundaryOverlayStyle || this._getDefaults();
      layer.eachLayer(leafletLayer => {
        if (leafletLayer._hiddenByDrill) return;
        leafletLayer.setStyle({
          fillColor: s.fillColor,
          fillOpacity: s.fillOpacity,
          color: s.outlineColor,
          weight: s.outlineWeight,
          opacity: s.outlineOpacity,
        });
      });
    },

    setFillOpacity(val) {
      this._ensureState();
      APP.state.boundaryOverlayStyle.fillOpacity = val;
      this.apply();
    },

    setOutlineOpacity(val) {
      this._ensureState();
      APP.state.boundaryOverlayStyle.outlineOpacity = val;
      this.apply();
    },

    setFillColor(val) {
      this._ensureState();
      APP.state.boundaryOverlayStyle.fillColor = val;
      this.apply();
    },

    setOutlineColor(val) {
      this._ensureState();
      APP.state.boundaryOverlayStyle.outlineColor = val;
      this.apply();
    },

    setOutlineWeight(val) {
      this._ensureState();
      APP.state.boundaryOverlayStyle.outlineWeight = val;
      this.apply();
    },

    reset() {
      APP.state.boundaryOverlayStyle = { ...this._getDefaults() };
      this.apply();
    },

    _ensureState() {
      if (!APP.state.boundaryOverlayStyle) {
        APP.state.boundaryOverlayStyle = this._getDefaults();
      }
    },

    getState() {
      this._ensureState();
      return APP.state.boundaryOverlayStyle;
    },
  },
});
