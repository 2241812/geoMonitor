var APP = {
  state: {
    map: null,
    currentLevel: 0,
    selectedPath: [],
    layers: {},
    rawData: {},
    hoverLayer: null,
    activeBasemap: 'osm',
    basemapLayers: {},
    panelOpen: false,
  },

  config: {
    mapCenter: [17.3, 121.0],
    mapZoom: 8,
    minZoom: 7,
    maxZoom: 18,
    maxBounds: [[4.0, 116.0], [21.5, 128.0]],

    geoJSON: {
      0: 'geoJSON/CAR NAMRIA Boundary.geojson',
      1: 'geoJSON/CAR NAMRIA Provincial Boundary.geojson',
      2: 'geoJSON/CAR NAMRIA Municipal Boundary.geojson',
      3: 'geoJSON/CAR NAMRIA Barangay Boundary.geojson',
    },

    levelNames: ['Region', 'Province', 'Municipality', 'Barangay'],

    colors: {
      0: { fill: '#ff7f0e', stroke: '#c2570a', weight: 3 },
      1: { fill: '#1f77b4', stroke: '#0a3d6b', weight: 2 },
      2: { fill: '#2ca02c', stroke: '#1a6b1a', weight: 1.5 },
      3: { fill: '#9467bd', stroke: '#5a3e7a', weight: 0.8 },
      highlight: { fill: '#ffdd57', stroke: '#e60000', weight: 3 },
    },

    baseMaps: {
      osm: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attr: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      },
      topo: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        attr: 'Tiles &copy; <a href="https://esri.com">Esri</a>',
      },
      satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attr: 'Tiles &copy; <a href="https://esri.com">Esri</a>',
      },
    },
  },

  events: new EventTarget(),

  _featureName(feature, level) {
    var p = feature.properties;
    if (!p) return 'Unknown';
    var candidates = [p.NAME_3, p.NAME_2, p.NAME_1, p.Municipali, p.PROVINCE, p.Province, p.Region].filter(Boolean);
    if (level === 3) return p.NAME_3 || p.Municipali || candidates[0] || 'Unknown';
    if (level === 2) return p.Municipali || p.NAME_2 || candidates[0] || 'Unknown';
    if (level === 1) return p.PROVINCE || p.Province || p.NAME_1 || candidates[0] || 'Unknown';
    return p.Region || p.NAME_1 || candidates[0] || 'CAR Region';
  },

  _escHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  },

  _resolveArea(props) {
    for (var k = 0; k < ['Hectares', 'Area', 'AREA', 'Shape_Area', 'PERIMETER'].length; k++) {
      var key = ['Hectares', 'Area', 'AREA', 'Shape_Area', 'PERIMETER'][k];
      var v = props[key];
      if (v != null && v !== '') {
        var n = parseFloat(v);
        if (!isNaN(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
      }
    }
    return null;
  },

  _resolveChartData(props) {
    var labels = [], values = [];
    var keys = ['Shape_Area', 'Shape_Length', 'AREA', 'Area', 'Hectares', 'PERIMETER'];
    for (var k = 0; k < keys.length; k++) {
      var v = parseFloat(props[keys[k]]);
      if (!isNaN(v) && v > 0) {
        labels.push(keys[k].replace(/_/g, ' '));
        values.push(v);
      }
    }
    return { labels: labels, values: values };
  },

  _heroSubtitle(props, level) {
    if (level === 3) return (props.NAME_2 || props.Municipali || '') + ', ' + (props.NAME_1 || '');
    if (level === 2) return props.Province || props.PROVINCE || 'Province';
    if (level === 1) return 'Province — Cordillera Administrative Region';
    return 'Watershed Cradle of Northern Luzon';
  },
};

var EVENTS = {
  FEATURE_SELECT: 'feature:select',
  FEATURE_CLEAR: 'feature:clear',
};
