import { APP } from './app.js';
import { VectorTileLayer } from './vector-tile-layer.js';

APP.lcm = {
  _layer: null,
  _clipFeature: null,
  _currentCode: null,
  _rafId: null,

  async toggle() {
    APP.state.showLcm = !APP.state.showLcm;

    if (APP.state.showLcm) {
      const code = APP.state._lcmCode;
      if (!code) {
        if (APP._showToast) APP._showToast('Drill into a basin first to view Land Cover');
        APP.state.showLcm = false;
        return;
      }
      
      this._ensurePane();
      
      if (!this._layer || this._currentCode !== code) {
        await this._loadBasin(code);
      } else {
        if (APP.state.map) {
          APP.state.map.addLayer(this._layer);
          this.reapplyClip();
          this._bindMapEvents(APP.state.map);
        }
      }
    } else {
      if (this._layer && APP.state.map) {
        APP.state.map.removeLayer(this._layer);
      }
      this.removeClip();
      if (APP.state.map) {
        this._unbindMapEvents(APP.state.map);
      }
    }

    if (APP.state.hydroSelectedBasin && APP.state.hydroSelectedBasin.feature) {
      APP._openWatershedPanel(APP.state.hydroSelectedBasin.feature);
    }
  },

  async _loadBasin(code) {
    if (this._layer && APP.state.map) {
      APP.state.map.removeLayer(this._layer);
    }
    
    try {
      const resp = await fetch(`geoJSON/LCM/${code}_LCM.topojson`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const rawData = await resp.json();
      const geojsonData = window.decodeGeo(rawData);

      this._layer = new VectorTileLayer(geojsonData, {
        pane: 'lcmPane',
        interactive: false,
        style: (feature) => {
          const cls = feature.tags?.LCM_CLASS || '';
          const hidden = APP.state.lcmHiddenClasses?.has(cls);
          return {
            fillColor: hidden ? 'transparent' : (APP.config.lcmColors[cls] || '#888888'),
            fillOpacity: hidden ? 0 : 0.7,
            color: '#000000',
            weight: 0,
            opacity: 0,
          };
        }
      });

      if (APP.state.showLcm && APP.state.map) {
        APP.state.map.addLayer(this._layer);
        this.reapplyClip();
        this._bindMapEvents(APP.state.map);
      }
      this._currentCode = code;
    } catch (e) {
      console.error('Failed to load LCM for basin', code, e);
      if (APP._showToast) APP._showToast('Land Cover data not available for this basin');
      APP.state.showLcm = false;
      if (APP.state.hydroSelectedBasin && APP.state.hydroSelectedBasin.feature) {
        APP._openWatershedPanel(APP.state.hydroSelectedBasin.feature);
      }
    }
  },

  toggleClass(className) {
    if (!APP.state.lcmHiddenClasses) {
      APP.state.lcmHiddenClasses = new Set();
    }
    if (APP.state.lcmHiddenClasses.has(className)) {
      APP.state.lcmHiddenClasses.delete(className);
    } else {
      APP.state.lcmHiddenClasses.add(className);
    }

    if (this._layer) {
      this._layer.setStyleGetter((feature) => {
        const cls = feature.tags?.LCM_CLASS || '';
        const hidden = APP.state.lcmHiddenClasses.has(cls);
        return {
          fillColor: hidden ? 'transparent' : (APP.config.lcmColors[cls] || '#888888'),
          fillOpacity: hidden ? 0 : 0.7,
          color: '#000000',
          weight: 0,
          opacity: 0,
        };
      });
      this._layer.redraw();
    }

    if (APP.state.hydroSelectedBasin && APP.state.hydroSelectedBasin.feature) {
      APP._openWatershedPanel(APP.state.hydroSelectedBasin.feature);
    }
  },

  _ensurePane() {
    const map = APP.state.map;
    if (map && !map.getPane('lcmPane')) {
      const pane = map.createPane('lcmPane');
      pane.style.zIndex = 245; // Below slopePane (250) but above basemaps
      pane.style.pointerEvents = 'none';
    }
  },

  _bindMapEvents(map) {
    this._unbindMapEvents(map);
    map.on('move', _onLcmMapMove);
    map.on('moveend', _onLcmMapMove);
    map.on('zoomanim', _onLcmMapMove);
    map.on('zoomend', _onLcmMapMove);
  },

  _unbindMapEvents(map) {
    map.off('move', _onLcmMapMove);
    map.off('moveend', _onLcmMapMove);
    map.off('zoomanim', _onLcmMapMove);
    map.off('zoomend', _onLcmMapMove);
  },

  updateClip(feature) {
    this._clipFeature = feature;
    if (!APP.state.showLcm) return;
    this.reapplyClip();
  },

  removeClip() {
    this._clipFeature = null;
    const pane = APP.state.map?.getPane('lcmPane');
    if (pane) {
      pane.style.clipPath = 'none';
      pane.style.webkitClipPath = 'none';
    }
  },

  reapplyClip() {
    if (!APP.state.showLcm) return;
    const map = APP.state.map;
    if (!map) return;
    const pane = map.getPane('lcmPane');
    if (!pane) return;

    let featureToClip = this._clipFeature;
    if (!featureToClip) {
      if (APP.state.hydroSelectedZone) featureToClip = APP.state.hydroSelectedZone;
      else if (APP.state.hydroSelectedBasin?.feature) featureToClip = APP.state.hydroSelectedBasin.feature;
    }

    if (!featureToClip || !featureToClip.geometry) {
      pane.style.clipPath = 'none';
      pane.style.webkitClipPath = 'none';
      return;
    }

    const mapSize = map.getSize();
    const clipPx = 200;
    const topLeft = map.containerPointToLayerPoint([-clipPx, -clipPx]);
    const bottomRight = map.containerPointToLayerPoint([mapSize.x + clipPx, mapSize.y + clipPx]);
    const mapBounds = L.bounds(topLeft, bottomRight);

    const rings = _extractOuterRings(featureToClip);
    if (!rings.length) return;

    const clipPath = _buildClipPath(rings, map, mapBounds);
    if (clipPath) {
      pane.style.clipPath = clipPath;
      pane.style.webkitClipPath = clipPath;
    }
  },

  hide() {
    if (this._layer && APP.state.map) {
      APP.state.map.removeLayer(this._layer);
    }
    this.removeClip();
    if (APP.state.map) {
      this._unbindMapEvents(APP.state.map);
    }
  },

  show() {
    if (APP.state.showLcm && this._layer && APP.state.map) {
      APP.state.map.addLayer(this._layer);
      this.reapplyClip();
      this._bindMapEvents(APP.state.map);
    }
  },

  destroy() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (APP.state.map) {
      this._unbindMapEvents(APP.state.map);
    }
    this.hide();
    this._layer = null;
    this._clipFeature = null;
    this._currentCode = null;
    APP.state.showLcm = false;
  }
};

function _onLcmMapMove() {
  if (APP.lcm._rafId) return;
  APP.lcm._rafId = requestAnimationFrame(() => {
    APP.lcm._rafId = null;
    APP.lcm.reapplyClip();
  });
}

function _extractOuterRings(feature) {
  const rings = [];
  const geom = feature.geometry;
  if (geom.type === 'Polygon') {
    rings.push(geom.coordinates[0]);
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      rings.push(poly[0]);
    }
  }
  return rings;
}

function _buildClipPath(rings, map, mapBounds) {
  const parts = [];
  for (const ring of rings) {
    let inBounds = false;
    const pts = [];
    for (const coord of ring) {
      const latlng = L.latLng(coord[1], coord[0]);
      const p = map.latLngToLayerPoint(latlng);
      pts.push(p);
      if (!inBounds && mapBounds.contains(p)) inBounds = true;
    }
    if (inBounds && pts.length > 2) {
      const pathStr = pts.map(p => Math.round(p.x) + 'px ' + Math.round(p.y) + 'px').join(', ');
      parts.push(`polygon(${pathStr})`);
    }
  }
  return parts.length ? parts.join(', ') : null;
}

APP._toggleLcm = function() {
  console.warn('APP._toggleLcm() is deprecated — use APP.lcm.toggle()');
  APP.lcm.toggle();
};
