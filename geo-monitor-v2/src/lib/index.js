import { APP } from './app.js';
import './config.js';
import './dashboard.js';
import './hydro-mode.js';
import './map-layers.js';

// Expose APP globally so vanilla Leaflet map can still operate 
// alongside the new React components.
window.APP = APP;

window.decodeGeo = function(data) {
  if (data && data.type === 'Topology') {
    const key = Object.keys(data.objects)[0];
    return window.topojson.feature(data, data.objects[key]);
  }
  return data;
};

export default APP;
