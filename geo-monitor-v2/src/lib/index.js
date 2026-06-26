import { APP } from './app.js';
import './config.js';
import './dashboard.js';
import './hydro-mode.js';
import './map-layers.js';

// Expose APP globally so vanilla Leaflet map can still operate 
// alongside the new React components.
window.APP = APP;

export default APP;
