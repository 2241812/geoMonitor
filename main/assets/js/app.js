const APP = {
  state: {
    selectedFeature: null,
    selectedLeafletLayer: null,
    selectedStyle: null,
    activeOverlays: {},
  },

  config: {
    mapCenter: [17.3, 121.0],
    mapZoom: 8,
    minZoom: 7,
    maxZoom: 18,
    maxBounds: [
      [4.0, 116.0],
      [21.5, 128.0],
    ],

    geoJSON: {
      boundary: 'geoJSON/CAR NAMRIA Boundary.geojson',
      provinces: 'geoJSON/CAR NAMRIA Provincial Boundary.geojson',
      municipalities: 'geoJSON/CAR NAMRIA Municipal Boundary.geojson',
      barangays: 'geoJSON/CAR NAMRIA Barangay Boundary.geojson',
    },

    colors: {
      boundary: { fill: '#ff7f0e', stroke: '#d62728', weight: 3 },
      province: { fill: '#1f77b4', stroke: '#0a3d6b', weight: 2 },
      municipality: { fill: '#2ca02c', stroke: '#1a6b1a', weight: 1.5 },
      barangay: { fill: '#9467bd', stroke: '#5a3e7a', weight: 0.5 },
      highlight: { fill: '#ffdd57', stroke: '#e60000', weight: 3 },
    },

    baseMaps: {
      osm: {
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attr: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      },
      topo: {
        name: 'Esri World Topo',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        attr: 'Tiles &copy; <a href="https://esri.com">Esri</a>',
      },
      satellite: {
        name: 'Esri Satellite',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attr: 'Tiles &copy; <a href="https://esri.com">Esri</a>',
      },
    },
  },

  events: new EventTarget(),
};

const EVENTS = {
  FEATURE_SELECT: 'feature:select',
  FEATURE_CLEAR: 'feature:clear',
};
