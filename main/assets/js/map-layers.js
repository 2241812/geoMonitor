async function initLayers(map, layerControl) {
  const layerConfigs = [
    { key: 'boundary', name: 'CAR Boundary', style: APP.config.colors.boundary },
    { key: 'provinces', name: 'Provinces', style: APP.config.colors.province },
    { key: 'municipalities', name: 'Municipalities', style: APP.config.colors.municipality },
    { key: 'barangays', name: 'Barangays', style: APP.config.colors.barangay },
  ];

  for (const cfg of layerConfigs) {
    try {
      const { layer } = await loadGeoJSONLayer(map, APP.config.geoJSON[cfg.key], cfg.style);
      layerControl.addOverlay(layer, cfg.name);
      if (cfg.key === 'municipalities') {
        layer.addTo(map);
      }
    } catch (err) {
      console.error('Failed to load ' + cfg.name + ':', err);
    }
  }
}

async function loadGeoJSONLayer(map, filePath, styleConfig) {
  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' loading ' + filePath);
  }
  const data = await response.json();

  const layer = L.geoJSON(data, {
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
    },
  });

  return { layer };
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
