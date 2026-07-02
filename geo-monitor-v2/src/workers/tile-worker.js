/**
 * Tile Worker — offloads geojson-vt index creation and tile generation
 * from the main thread.
 *
 * Vite bundles this as a separate chunk via:
 *   new Worker(new URL('./tile-worker.js', import.meta.url), { type: 'module' })
 *
 * Messages:
 *   { type: 'init', indexId, data: GeoJSON }        -> creates vt index
 *   { type: 'getTile', indexId, z, x, y }            -> returns tile features
 *   { type: 'destroy', indexId }                      -> remove index
 *
 * Responses:
 *   { type: 'ready', indexId }
 *   { type: 'tile', indexId, z, x, y, features, error? }
 *   { type: 'destroyed', indexId }
 */
import geojsonvt from 'geojson-vt';

const vtIndexes = {};

self.onmessage = function (e) {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      vtIndexes[msg.indexId] = geojsonvt(msg.data, {
        maxZoom: 18,
        tolerance: 3,
        extent: 4096,
        buffer: 64,
        indexMaxZoom: 6,
        indexMaxPoints: 100000,
      });
      self.postMessage({ type: 'ready', indexId: msg.indexId });
    } catch (err) {
      self.postMessage({ type: 'ready', indexId: msg.indexId, error: err.message });
    }
    return;
  }

  if (msg.type === 'getTile') {
    const index = vtIndexes[msg.indexId];
    if (!index) {
      self.postMessage({ type: 'tile', indexId: msg.indexId, z: msg.z, x: msg.x, y: msg.y, features: null, error: 'Index not found' });
      return;
    }
    try {
      const tile = index.getTile(msg.z, msg.x, msg.y);
      self.postMessage({
        type: 'tile',
        indexId: msg.indexId,
        z: msg.z,
        x: msg.x,
        y: msg.y,
        features: tile ? tile.features : [],
      });
    } catch (err) {
      self.postMessage({ type: 'tile', indexId: msg.indexId, z: msg.z, x: msg.x, y: msg.y, features: null, error: err.message });
    }
    return;
  }

  if (msg.type === 'destroy') {
    delete vtIndexes[msg.indexId];
    self.postMessage({ type: 'destroyed', indexId: msg.indexId });
  }
};
