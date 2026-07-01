import L from 'leaflet';
import { APP } from './app.js';
window.L = L;
import './config.js';
import './dashboard.js';
import './boundary-mode.js';
import './hydro-mode.js';
import './map-layers.js';

/* leaflet.vectorgrid registers itself on L.vectorGrid — no named export needed */
import 'leaflet.vectorgrid';

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

