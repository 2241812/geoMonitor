function initMap() {
  const map = L.map('map', {
    center: APP.config.mapCenter,
    zoom: APP.config.mapZoom,
    zoomControl: true,
    fadeAnimation: true,
  });

  const osm = L.tileLayer(APP.config.baseMaps.osm.url, {
    maxZoom: APP.config.maxZoom,
    attribution: APP.config.baseMaps.osm.attr,
  });

  const topo = L.tileLayer(APP.config.baseMaps.topo.url, {
    maxZoom: APP.config.maxZoom,
    attribution: APP.config.baseMaps.topo.attr,
  });

  const satellite = L.tileLayer(APP.config.baseMaps.satellite.url, {
    maxZoom: APP.config.maxZoom,
    attribution: APP.config.baseMaps.satellite.attr,
  });

  const baseLayers = {
    'OpenStreetMap': osm,
    'Esri World Topo': topo,
    'Esri Satellite': satellite,
  };

  topo.addTo(map);

  const layerControl = L.control.layers(baseLayers, {}, { collapsed: false }).addTo(map);

  return { map, layerControl };
}
