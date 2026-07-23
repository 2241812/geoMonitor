import L from 'leaflet';

/*
 * VectorTileLayer — an L.GridLayer that renders polygon features to canvas tiles
 * using geojson-vt via a Web Worker for off-thread index creation + tile generation.
 *
 * During initial zoom/drill-down the worker takes ~10–50ms to create the index;
 * subsequent tile requests are served from a cache so panning/zooming is instant.
 *
 * Usage:
 *   const vtLayer = new VectorTileLayer(geoJSONdata, {
 *     style: function(feature) { return { fillColor: 'red', fillOpacity: 0.2, color: '#000', weight: 1 }; },
 *   });
 *   map.addLayer(vtLayer);
 *
 * To update styles at runtime:
 *   vtLayer.setStyleGetter(function(feature) { return { ... }; });
 *   vtLayer.redraw();
 *
 * The layer is NOT interactive by default — attach a transparent overlay
 * L.geoJSON for click/hover events.
 */

export const VectorTileLayer = L.GridLayer.extend({
  initialize: function (data, options) {
    this._featureData = data;
    this._styleFn = options.style || function () { return {}; };
    this._workerReady = false;
    this._pendingTiles = new Map();  // reqId → { canvas, ctx, tileKey, done }
    this._tileCache = new Map();     // key = "z/x/y" → features[]
    this._reqId = 0;
    this._indexId = 'vt_' + Math.random().toString(36).slice(2, 9);
    this._tileSize = 512;

    L.GridLayer.prototype.initialize.call(this, options);

    // Spawn the worker — Vite bundles it as a separate chunk
    this._worker = new Worker(
      new URL('../workers/tile-worker.js', import.meta.url),
      { type: 'module' }
    );

    this._worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.indexId !== this._indexId) return;

      if (msg.type === 'ready') {
        this._workerReady = true;
        this.redraw();
        return;
      }

      if (msg.type === 'tile') {
        // Cache the tile features
        const tileKey = msg.z + '/' + msg.x + '/' + msg.y;
        if (msg.features) {
          this._tileCache.set(tileKey, msg.features);
        }

        // Resolve any pending createTile for this tile coordinate
        const pending = this._pendingTiles.get(tileKey);
        if (pending) {
          this._renderTileToCanvas(pending.ctx, msg.features || [], pending.canvas.width);
          this._pendingTiles.delete(tileKey);
          pending.done(null, pending.canvas);
        }
        return;
      }
    };

    // Send data to worker to create the index
    this._worker.postMessage({
      type: 'init',
      indexId: this._indexId,
      data: data,
    });
  },

  createTile: function (coords, done) {
    const tileSize = this.getTileSize();
    const canvas = L.DomUtil.create('canvas', 'leaflet-tile');
    canvas.width = tileSize.x;
    canvas.height = tileSize.y;
    const ctx = canvas.getContext('2d');
    const tileKey = coords.z + '/' + coords.x + '/' + coords.y;

    // Check cache first
    const cached = this._tileCache.get(tileKey);
    if (cached) {
      this._renderTileToCanvas(ctx, cached, tileSize.x);
      done(null, canvas);
      return canvas;
    }

    // Not cached — request from worker and store pending callback
    if (this._workerReady) {
      this._pendingTiles.set(tileKey, { canvas, ctx, tileKey, done });
      this._worker.postMessage({
        type: 'getTile',
        indexId: this._indexId,
        z: coords.z,
        x: coords.x,
        y: coords.y,
      });
    } else {
      // Worker not ready yet — return empty canvas, will redraw when ready
      done(null, canvas);
    }

    return canvas;
  },

  _renderTileToCanvas: function (ctx, features, tileSize) {
    const scale = tileSize / 4096;  // geojson-vt default extent
    ctx.clearRect(0, 0, tileSize, tileSize);

    for (const f of features) {
      const style = this._styleFn(f);
      this._drawFeature(ctx, f, scale, style);
    }
  },

  _drawFeature: function (ctx, feature, scale, style) {
    /* geojson-vt types: 1=Point, 2=LineString, 3=Polygon */
    if (feature.type !== 3) return;

    const geom = feature.geometry;
    if (!geom) return;

    ctx.save();
    ctx.beginPath();
    for (const ring of geom) {
      for (let i = 0; i < ring.length; i++) {
        const x = ring[i][0] * scale;
        const y = ring[i][1] * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    if (style.fillColor && (style.fillOpacity == null || style.fillOpacity > 0)) {
      ctx.fillStyle = style.fillColor;
      ctx.globalAlpha = style.fillOpacity != null ? style.fillOpacity : 0.15;
      ctx.fill();
    }
    if (style.color && style.weight > 0) {
      ctx.strokeStyle = style.color;
      ctx.lineWidth = style.weight || 1;
      ctx.globalAlpha = style.opacity != null ? style.opacity : 0.9;
      ctx.stroke();
    }
    ctx.restore();
  },

  /* Replace the style getter and re-render */
  setStyleGetter: function (fn) {
    this._styleFn = fn;
  },

  /* Invalidate tile cache and redraw all visible tiles */
  redraw: function () {
    this._tileCache.clear();
    if (this._map) {
      this._map._panes.tilePane.childNodes.forEach(function (child) {
        if (child.tagName === 'CANVAS') {
          child.parentNode.removeChild(child);
        }
      });
    }
    return L.GridLayer.prototype.redraw.call(this);
  },

  onRemove: function (map) {
    if (this._worker) {
      this._worker.postMessage({ type: 'destroy', indexId: this._indexId });
      this._worker.terminate();
      this._worker = null;
    }
    this._pendingTiles.clear();
    L.GridLayer.prototype.onRemove.call(this, map);
  },
});

export default VectorTileLayer;
