function initMap() {
  var map = L.map('map', {
    center: APP.config.mapCenter,
    zoom: APP.config.mapZoom,
    minZoom: APP.config.minZoom,
    maxZoom: APP.config.maxZoom,
    maxBounds: APP.config.maxBounds,
    zoomControl: true,
    preferCanvas: true,
  });

  map.zoomControl.setPosition('bottomright');

  Object.keys(APP.config.baseMaps).forEach(function (key) {
    var cfg = APP.config.baseMaps[key];
    APP.state.basemapLayers[key] = L.tileLayer(cfg.url, {
      maxZoom: APP.config.maxZoom,
      attribution: cfg.attr,
    });
  });
  APP.state.basemapLayers.osm.addTo(map);
  APP.state.activeBasemap = 'osm';

  APP.state.map = map;

  document.addEventListener('mousemove', function (e) {
    var lbl = document.getElementById('map-hover-label');
    if (lbl && lbl.classList.contains('visible')) {
      lbl.style.left = (e.clientX + 14) + 'px';
      lbl.style.top = (e.clientY - 10) + 'px';
    }
  });
}

APP.switchBasemap = function (key) {
  if (key === APP.state.activeBasemap) return;
  var map = APP.state.map;
  map.removeLayer(APP.state.basemapLayers[APP.state.activeBasemap]);
  APP.state.basemapLayers[key].addTo(map);
  Object.values(APP.state.layers).forEach(function (l) {
    if (l && l.bringToFront) l.bringToFront();
  });
  APP.state.activeBasemap = key;
  document.querySelectorAll('.basemap-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.layer === key);
  });
};
