async function initLayers() {
  await APP._showLevel(0, null, null);
  await APP._showLevel(1, null, null);
  APP._updateBreadcrumb();
}

APP._showLevel = async function (level, parentFeature, parentLevel) {
  if (APP.state.layers[level]) {
    APP.state.map.removeLayer(APP.state.layers[level]);
    APP.state.layers[level] = null;
  }

  for (var l = level + 1; l <= 3; l++) {
    if (APP.state.layers[l]) {
      APP.state.map.removeLayer(APP.state.layers[l]);
      APP.state.layers[l] = null;
    }
  }

  if (!APP.state.rawData[level]) {
    var resp = await fetch(APP.config.geoJSON[level]);
    if (!resp.ok) throw new Error('Failed to load level ' + level);
    APP.state.rawData[level] = await resp.json();
  }

  var data = APP.state.rawData[level];

  if (parentFeature && level > 0) {
    data = _filterToParent(data, level, parentFeature);
  }

  var styleConfig = APP.config.colors[level];
  var featureCount = data.features ? data.features.length : 0;
  var useHover = featureCount <= 300;

  var layer = L.geoJSON(data, {
    style: function () {
      return {
        fillColor: styleConfig.fill,
        fillOpacity: level === 0 ? 0.1 : 0.25,
        color: styleConfig.stroke,
        weight: styleConfig.weight,
        opacity: 0.9,
      };
    },

    onEachFeature: function (feature, leafletLayer) {
      var name = APP._featureName(feature, level);

      if (useHover) {
        leafletLayer.on('mouseover', function (e) {
          e.target.setStyle({ fillOpacity: 0.55, weight: styleConfig.weight + 1 });
          e.target.bringToFront();
          _showHoverLabel(name, level);
        });
        leafletLayer.on('mouseout', function (e) {
          e.target.setStyle({
            fillColor: styleConfig.fill,
            fillOpacity: level === 0 ? 0.1 : 0.25,
            color: styleConfig.stroke,
            weight: styleConfig.weight,
            opacity: 0.9,
          });
          _hideHoverLabel();
        });
      }

      leafletLayer.on('click', function (e) {
        L.DomEvent.stopPropagation(e);
        _highlightLayer(leafletLayer);
        APP.openPanel(feature, level);
        if (level < 3) {
          APP.drillDown(feature, leafletLayer);
        }
      });
    },
  });

  layer.addTo(APP.state.map);
  APP.state.layers[level] = layer;
};

function _filterToParent(data, childLevel, parentFeature) {
  var pProps = parentFeature.properties;
  var parentName = APP._featureName(parentFeature, childLevel - 1);

  var filtered = data.features.filter(function (feat) {
    var cProps = feat.properties;
    var checks = [
      cProps.Province === pProps.PROVINCE,
      cProps.Province === pProps.Province,
      cProps.PROVINCE === pProps.PROVINCE,
      cProps.Province === parentName,
      cProps.NAME_1 === pProps.PROVINCE,
      cProps.NAME_1 === pProps.Province,
      cProps.NAME_1 === parentName,
      cProps.NAME_2 === pProps.Municipali,
      cProps.NAME_2 === pProps.NAME_2,
    ];
    for (var i = 0; i < checks.length; i++) {
      if (checks[i]) return true;
    }
    return false;
  });

  return { type: data.type, features: filtered };
}

APP.drillDown = async function (feature, leafletLayer) {
  var currentLevel = APP.state.currentLevel;
  if (currentLevel >= 3) return;

  var nextLevel = currentLevel + 1;
  var name = APP._featureName(feature, currentLevel);

  APP.state.selectedPath.push({ level: currentLevel, feature: feature, name: name, layer: leafletLayer });

  _updateBreadcrumb();

  await APP._showLevel(nextLevel, feature, currentLevel);

  APP.state.currentLevel = nextLevel;

  var bounds = leafletLayer.getBounds();
  APP.state.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });

  _showToast('Click a ' + APP.config.levelNames[nextLevel] + ' to drill in');
};

APP.drillUp = async function (targetLevel) {
  if (typeof targetLevel === 'string' && targetLevel === 'region') targetLevel = 0;

  if (APP.state.currentLevel === 0 && targetLevel === 0) return;

  APP.state.selectedPath = APP.state.selectedPath.slice(0, targetLevel);
  APP.state.currentLevel = targetLevel;

  for (var lvl = 3; lvl > targetLevel; lvl--) {
    if (APP.state.layers[lvl]) {
      APP.state.map.removeLayer(APP.state.layers[lvl]);
      APP.state.layers[lvl] = null;
    }
  }

  var parentFeature = targetLevel > 0 ? APP.state.selectedPath[targetLevel - 1].feature : null;
  var parentLevel = targetLevel > 0 ? targetLevel - 1 : null;

  await APP._showLevel(targetLevel, parentFeature, parentLevel);

  _updateBreadcrumb();
  APP.closePanel();

  if (targetLevel === 0) {
    APP.state.map.setView(APP.config.mapCenter, APP.config.mapZoom);
  } else {
    var parentEntry = APP.state.selectedPath[targetLevel - 1];
    if (parentEntry && parentEntry.layer) {
      APP.state.map.fitBounds(parentEntry.layer.getBounds(), { padding: [60, 60] });
    }
  }
};

function _highlightLayer(leafletLayer) {
  leafletLayer.setStyle({
    fillColor: '#ffdd57',
    fillOpacity: 0.5,
    color: '#e60000',
    weight: 3,
    opacity: 1,
  });
  leafletLayer.bringToFront();
}

function _showHoverLabel(name, level) {
  var lbl = document.getElementById('map-hover-label');
  if (!lbl) return;
  lbl.innerHTML = '<span class="label-level">' + APP._escHtml(APP.config.levelNames[level]) + '</span>' + APP._escHtml(name);
  lbl.classList.add('visible');
}

function _hideHoverLabel() {
  var lbl = document.getElementById('map-hover-label');
  if (lbl) lbl.classList.remove('visible');
}

function _updateBreadcrumb() {
  var bc = document.getElementById('map-breadcrumb');
  if (!bc) return;

  var html = '';
  var isAtRoot = APP.state.currentLevel === 0;
  html += '<button class="breadcrumb-item ' + (isAtRoot ? 'active' : 'clickable') + '" onclick="APP.drillUp(0)">'
    + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
    + ' CAR Region</button>';

  for (var i = 0; i < APP.state.selectedPath.length; i++) {
    var item = APP.state.selectedPath[i];
    var isLast = i === APP.state.selectedPath.length - 1;
    html += '<span class="breadcrumb-sep">›</span>';
    html += '<button class="breadcrumb-item ' + (isLast ? 'active' : 'clickable') + '" onclick="APP.drillUp(' + (i + 1) + ')">' + APP._escHtml(item.name) + '</button>';
  }

  bc.innerHTML = html;
}

function _showToast(msg) {
  var toast = document.getElementById('drill-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'drill-toast';
    toast.className = 'drill-hint-toast';
    document.querySelector('.map-app').appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3000);
}
