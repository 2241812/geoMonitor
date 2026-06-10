var HOVER_THRESHOLD = 200;

async function initLayers(map, layerControl) {
  var layerConfigs = [
    { key: 'boundary', name: 'CAR Boundary', style: APP.config.colors.boundary },
    { key: 'provinces', name: 'Provinces', style: APP.config.colors.province },
    { key: 'municipalities', name: 'Municipalities', style: APP.config.colors.municipality },
    { key: 'barangays', name: 'Barangays', style: APP.config.colors.barangay, lazy: true },
  ];

  for (var i = 0; i < layerConfigs.length; i++) {
    await setupLayer(map, layerControl, layerConfigs[i]);
  }
}

async function setupLayer(map, layerControl, cfg) {
  try {
    if (cfg.lazy) {
      var emptyLayer = buildEmptyLayer(cfg.style);
      layerControl.addOverlay(emptyLayer, cfg.name);
      emptyLayer.on('add', function () {
        if (!emptyLayer._loaded) {
          emptyLayer._loaded = true;
          fetchAndBuildLayer(map, APP.config.geoJSON[cfg.key], cfg.style).then(function (result) {
            emptyLayer.clearLayers();
            result.layer.eachLayer(function (child) {
              emptyLayer.addLayer(child);
            });
          });
        }
      });
    } else {
      var result = await fetchAndBuildLayer(map, APP.config.geoJSON[cfg.key], cfg.style);
      layerControl.addOverlay(result.layer, cfg.name);
      if (cfg.key === 'municipalities') {
        result.layer.addTo(map);
      }
    }
  } catch (err) {
    console.error('Failed to load ' + cfg.name + ':', err);
  }
}

function buildEmptyLayer(styleConfig) {
  return L.geoJSON(null, {
    style: function () {
      return {
        fillColor: styleConfig.fill,
        fillOpacity: 0.3,
        color: styleConfig.stroke,
        weight: styleConfig.weight,
        opacity: 0.8,
      };
    },
  });
}

async function fetchAndBuildLayer(map, filePath, styleConfig) {
  var response = await fetch(filePath);
  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' loading ' + filePath);
  }
  var data = await response.json();

  var featureCount = data.features ? data.features.length : 0;

  var layer = L.geoJSON(data, {
    style: function () {
      return {
        fillColor: styleConfig.fill,
        fillOpacity: 0.3,
        color: styleConfig.stroke,
        weight: styleConfig.weight,
        opacity: 0.8,
      };
    },
    onEachFeature: function (feature, leafletLayer) {
      leafletLayer.on({
        click: function () {
          onFeatureClick(feature, leafletLayer, map, styleConfig);
        },
      });

      if (featureCount <= HOVER_THRESHOLD) {
        leafletLayer.on({
          mouseover: function (e) {
            if (e.target !== APP.state.selectedLeafletLayer) {
              e.target.setStyle({
                fillOpacity: 0.6,
                weight: styleConfig.weight + 1,
              });
              e.target.bringToFront();
            }
          },
          mouseout: function (e) {
            if (e.target !== APP.state.selectedLeafletLayer) {
              resetLayerStyle(e.target, styleConfig);
            }
          },
        });
      }
    },
  });

  return { layer: layer };
}

function onFeatureClick(feature, leafletLayer, map, styleConfig) {
  if (APP.state.selectedLeafletLayer) {
    resetLayerStyle(APP.state.selectedLeafletLayer, APP.state.selectedStyle);
  }

  leafletLayer.setStyle({
    fillColor: APP.config.colors.highlight.fill,
    fillOpacity: 0.6,
    color: APP.config.colors.highlight.stroke,
    weight: APP.config.colors.highlight.weight,
    opacity: 1,
  });
  leafletLayer.bringToFront();

  APP.state.selectedFeature = feature;
  APP.state.selectedLeafletLayer = leafletLayer;
  APP.state.selectedStyle = styleConfig;

  map.fitBounds(leafletLayer.getBounds(), { padding: [40, 40], maxZoom: 14 });

  APP.events.dispatchEvent(new CustomEvent(EVENTS.FEATURE_SELECT, {
    detail: { feature: feature },
  }));
}

function resetLayerStyle(layer, styleConfig) {
  layer.setStyle({
    fillColor: styleConfig.fill,
    fillOpacity: 0.3,
    color: styleConfig.stroke,
    weight: styleConfig.weight,
    opacity: 0.8,
  });
}
