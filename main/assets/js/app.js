const APP = {

  state: {
    map: null,
    layers: {},
    rawData: {},
    drillStack: [],
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

    levelNames: ['Region', 'Province', 'Municipality', 'Barangay'],

    layerDefs: [
      {
        key: 'namria-boundary',
        path: 'geoJSON/CAR NAMRIA Boundary.geojson',
        level: 0,
        label: 'CAR Boundary (NAMRIA)',
        nameProp: ['Region', 'NAME_1'],
        style: { fill: '#ff7f0e', stroke: '#c2570a', weight: 3, fillOpacity: 0.1 },
        interactive: false,
      },
      {
        key: 'namria-province',
        path: 'geoJSON/CAR NAMRIA Provincial Boundary.geojson',
        level: 1,
        label: 'Provinces (NAMRIA)',
        nameProp: ['PROVINCE', 'NAME_1'],
        style: { fill: '#1f77b4', stroke: '#0a3d6b', weight: 2, fillOpacity: 0.25 },
      },
      {
        key: 'namria-municipality',
        path: 'geoJSON/CAR NAMRIA Municipal Boundary.geojson',
        level: 2,
        label: 'Municipalities (NAMRIA)',
        nameProp: ['Municipali', 'NAME_2'],
        style: { fill: '#2ca02c', stroke: '#1a6b1a', weight: 1.5, fillOpacity: 0.25 },
      },
      {
        key: 'namria-barangay',
        path: 'geoJSON/CAR NAMRIA Barangay Boundary.geojson',
        level: 3,
        label: 'Barangays (NAMRIA)',
        nameProp: ['NAME_3', 'NAME_2'],
        style: { fill: '#9467bd', stroke: '#5a3e7a', weight: 0.8, fillOpacity: 0.25 },
        lazy: true,
      },
      {
        key: 'cad-boundary',
        path: 'geoJSON/CAR CAD Boundary.geojson',
        level: 0,
        label: 'CAR Boundary (CAD)',
        nameProp: ['Region', 'NAME_1'],
        style: { fill: '#e377c2', stroke: '#a04d8c', weight: 3, fillOpacity: 0.1 },
        interactive: false,
      },
      {
        key: 'cad-province',
        path: 'geoJSON/CAR CAD Provincial Boundary.geojson',
        level: 1,
        label: 'Provinces (CAD)',
        nameProp: ['Province', 'PROVINCE', 'NAME_1'],
        style: { fill: '#8c564b', stroke: '#5a3836', weight: 2, fillOpacity: 0.25 },
      },
      {
        key: 'cad-municipality',
        path: 'geoJSON/CAR CAD Municipal Boundary.geojson',
        level: 2,
        label: 'Municipalities (CAD)',
        nameProp: ['Municipali', 'NAME_2'],
        style: { fill: '#bcbd22', stroke: '#8b8d1a', weight: 1.5, fillOpacity: 0.25 },
      },
    ],

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

  /* ── Init ────────────────────────────────── */
  init() {
    var map = L.map('map', {
      center: this.config.mapCenter,
      zoom: this.config.mapZoom,
      minZoom: this.config.minZoom,
      maxZoom: this.config.maxZoom,
      maxBounds: this.config.maxBounds,
      zoomControl: true,
      preferCanvas: true,
    });
    map.zoomControl.setPosition('bottomright');

    Object.entries(this.config.baseMaps).forEach((function (entry) {
      this.state.basemapLayers[entry[0]] = L.tileLayer(entry[1].url, {
        maxZoom: this.config.maxZoom,
        attribution: entry[1].attr,
      });
    }).bind(this));
    this.state.basemapLayers.osm.addTo(map);
    this.state.activeBasemap = 'osm';
    this.state.map = map;

    map.on('click', (function () {
      if (this.state.drillStack.length > 0) {
        this.drillUp();
      }
    }).bind(this));
  },

  /* ── Basemap ─────────────────────────────── */
  switchBasemap(key) {
    if (key === this.state.activeBasemap) return;
    var map = this.state.map;
    map.removeLayer(this.state.basemapLayers[this.state.activeBasemap]);
    this.state.basemapLayers[key].addTo(map);
    Object.values(this.state.layers).forEach(function (l) { if (l) l.bringToFront(); });
    this.state.activeBasemap = key;
    document.querySelectorAll('.basemap-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.layer === key);
    });
  },

  /* ── Layer loading ───────────────────────── */
  async loadAllLayers() {
    var defs = this.config.layerDefs;

    for (var i = 0; i < defs.length; i++) {
      var def = defs[i];
      if (def.lazy) continue;
      await this._loadLayer(def);
    }

    /* Add Leaflet layer control for manual toggling */
    var overlays = {};
    for (var j = 0; j < defs.length; j++) {
      var d = defs[j];
      /* Build a display label with visual grouping */
      var groupLabel = d.key.indexOf('namria') === 0 ? 'NAMRIA' : 'CAD';
      overlays[d.key] = this.state.layers[d.key] || L.geoJSON(null, { interactive: false });
    }

    /* Build custom overlay panel */
    this._buildOverlayPanel();

    /* Load lazy layers on demand */
    this._setupLazyLoad();
  },

  async _loadLayer(def) {
    var self = this;

    /* Fetch + cache */
    if (!this.state.rawData[def.key]) {
      var resp = await fetch(def.path);
      if (!resp.ok) throw new Error('Failed to load ' + def.key);
      this.state.rawData[def.key] = await resp.json();
    }
    var data = this.state.rawData[def.key];

    var style = def.style;
    var useHover = data.features && data.features.length <= 300;

    var layer = L.geoJSON(data, {
      style: function () { return {
        fillColor: style.fill,
        fillOpacity: style.fillOpacity,
        color: style.stroke,
        weight: style.weight,
        opacity: 0.9,
      }; },
      onEachFeature: function (feature, leafletLayer) {
        if (def.interactive === false || def.level === 0) return;

        var name = self._featureName(feature, def.key);

        if (useHover) {
          leafletLayer.on('mouseover', function (e) {
            e.target.setStyle({ fillOpacity: 0.55, weight: style.weight + 1 });
            e.target.bringToFront();
            self._showHoverLabel(name, def.level);
          });
          leafletLayer.on('mouseout', function (e) {
            e.target.setStyle({
              fillColor: style.fill,
              fillOpacity: style.fillOpacity,
              color: style.stroke,
              weight: style.weight,
              opacity: 0.9,
            });
            self._hideHoverLabel();
          });
        }

        leafletLayer.on('click', function (e) {
          L.DomEvent.stopPropagation(e);

          /* Determine the active drill level */
          var activeLevel = 1;
          if (self.state.drillStack.length > 0) {
            var top = self.state.drillStack[self.state.drillStack.length - 1];
            var topDef = self._defByKey(top.key);
            if (topDef) activeLevel = topDef.level + 1;
          }
          if (def.level !== activeLevel) return;

          self.openPanel(feature, def.key);

          if (def.level < 3) {
            self.drillDown(feature, leafletLayer, def);
          }
        });
      },
    });

    layer.addTo(this.state.map);
    this.state.layers[def.key] = layer;
  },

  /* ── Drill Down ──────────────────────────── */
  drillDown(feature, leafletLayer, def) {
    var self = this;

    /* Record in drill stack */
    this.state.drillStack.push({ key: def.key, feature: feature, bounds: leafletLayer.getBounds() });

    /* Highlight selected, dim others at this level */
    this._dimLayer(def.key, feature);

    /* Find child layer */
    var childDef = this._childDef(def);
    if (!childDef) return;

    var childLayer = this.state.layers[childDef.key];
    if (!childLayer) return;

    /* Hide all features in child layer, then show only matching ones */
    this._filterChildLayer(childDef.key, feature, def.key);

    /* Also hide siblings (other layers at same level as child) */
    this._hideSiblingLayers(childDef.key);

    /* Update breadcrumb */
    this._updateBreadcrumb();

    /* Zoom */
    this.state.map.fitBounds(leafletLayer.getBounds(), { padding: [60, 60], maxZoom: 14 });

    this._showToast('Click a ' + this.config.levelNames[def.level + 1] + ' to drill in');
  },

  /* ── Drill Up ────────────────────────────── */
  drillUp() {
    if (this.state.drillStack.length === 0) return;

    var entry = this.state.drillStack.pop();
    var parentKey = entry.key;
    var parentDef = this._defByKey(parentKey);

    /* Restore parent layer (un-dim all features) */
    this._resetLayer(parentKey);

    /* Hide child layer features */
    var childDef = this._childDef(parentDef);
    if (childDef) {
      var childLayer = this.state.layers[childDef.key];
      if (childLayer) {
        childLayer.eachLayer(function (ll) {
          ll.setStyle({ fillOpacity: 0, opacity: 0, weight: 0 });
        });
      }
      /* Show sibling layers if any were hidden */
      this._showSiblingLayers(childDef.key);
    }

    /* Update breadcrumb */
    this._updateBreadcrumb();
    this.closePanel();

    /* Zoom to the parent feature's bounds (stored on drill-down) */
    if (this.state.drillStack.length === 0) {
      var boundLayer = this.state.layers['namria-boundary'] || this.state.layers['cad-boundary'];
      if (boundLayer) boundLayer.getBounds() && this.state.map.fitBounds(boundLayer.getBounds(), { padding: [60, 60] });
    } else {
      var parentEntry = this.state.drillStack[this.state.drillStack.length - 1];
      if (parentEntry.bounds) {
        this.state.map.fitBounds(parentEntry.bounds, { padding: [60, 60], maxZoom: 14 });
      }
    }
  },

  /* ── Layer helpers ────────────────────────── */
  _defByKey(key) {
    var defs = this.config.layerDefs;
    for (var i = 0; i < defs.length; i++) {
      if (defs[i].key === key) return defs[i];
    }
    return null;
  },

  _childDef(def) {
    var defs = this.config.layerDefs;
    var targetLevel = def.level + 1;
    for (var i = 0; i < defs.length; i++) {
      if (defs[i].level === targetLevel && defs[i].key.indexOf('namria') === 0) {
        return defs[i];
      }
    }
    return null;
  },

  _dimLayer(key, selectedFeature) {
    var layer = this.state.layers[key];
    if (!layer) return;
    var def = this._defByKey(key);
    var cfg = def.style;
    layer.eachLayer(function (ll) {
      if (ll.feature !== selectedFeature) {
        ll.setStyle({
          fillColor: '#9ca3af',
          fillOpacity: 0.05,
          color: '#d1d5db',
          weight: cfg.weight * 0.5,
          opacity: 0.3,
        });
      } else {
        ll.setStyle({
          fillColor: '#ffdd57',
          fillOpacity: 0.5,
          color: '#e60000',
          weight: 3,
          opacity: 1,
        });
        ll.bringToFront();
      }
    });
  },

  _resetLayer(key) {
    var layer = this.state.layers[key];
    if (!layer) return;
    var def = this._defByKey(key);
    var cfg = def.style;
    layer.eachLayer(function (ll) {
      ll.setStyle({
        fillColor: cfg.fill,
        fillOpacity: cfg.fillOpacity,
        color: cfg.stroke,
        weight: cfg.weight,
        opacity: 0.9,
      });
    });
  },

  _filterChildLayer(childKey, parentFeature, parentKey) {
    var childLayer = this.state.layers[childKey];
    if (!childLayer) return;
    var parentDef = this._defByKey(parentKey);
    var childDef = this._defByKey(childKey);
    var childCfg = childDef.style;
    var self = this;

    childLayer.eachLayer(function (ll) {
      if (self._isChildOf(ll.feature, parentFeature, childDef.level)) {
        ll.setStyle({
          fillColor: childCfg.fill,
          fillOpacity: childCfg.fillOpacity,
          color: childCfg.stroke,
          weight: childCfg.weight,
          opacity: 0.9,
        });
      } else {
        ll.setStyle({ fillOpacity: 0, opacity: 0, weight: 0 });
      }
    });
  },

  _isChildOf(childFeature, parentFeature, childLevel) {
    var cp = childFeature.properties;
    var pp = parentFeature.properties;

    if (childLevel === 2) {
      var provinceName = (pp.PROVINCE || pp.Province || '').toUpperCase();
      var childProvince = (cp.Province || cp.PROVINCE || cp.NAME_1 || '').toUpperCase();
      return childProvince === provinceName;
    }

    if (childLevel === 3) {
      var munName = (pp.Municipali || pp.NAME_2 || '').toUpperCase();
      var childMun = (cp.NAME_2 || cp.Municipali || '').toUpperCase();
      return childMun === munName;
    }

    return false;
  },

  _hideSiblingLayers(key) {
    var def = this._defByKey(key);
    if (!def) return;
    var defs = this.config.layerDefs;
    for (var i = 0; i < defs.length; i++) {
      if (defs[i].level === def.level && defs[i].key !== key) {
        var l = this.state.layers[defs[i].key];
        if (l && this.state.map.hasLayer(l)) {
          this.state.map.removeLayer(l);
          l._hiddenByDrill = true;
        }
      }
    }
  },

  _showSiblingLayers(key) {
    var def = this._defByKey(key);
    if (!def) return;
    var defs = this.config.layerDefs;
    for (var i = 0; i < defs.length; i++) {
      if (defs[i].level === def.level && defs[i].key !== key) {
        var l = this.state.layers[defs[i].key];
        if (l && l._hiddenByDrill) {
          this.state.map.addLayer(l);
          l._hiddenByDrill = false;
        }
      }
    }
  },

  /* ── Overlay panel ────────────────────────── */
  _buildOverlayPanel() {
    var container = L.DomUtil.create('div', 'overlay-panel');
    container.innerHTML = '<div class="overlay-header">Layers</div>';
    var self = this;

    var groups = { 'NAMRIA': [], 'CAD': [] };
    this.config.layerDefs.forEach(function (def) {
      var g = def.key.indexOf('namria') === 0 ? 'NAMRIA' : 'CAD';
      groups[g].push(def);
    });

    Object.keys(groups).forEach(function (groupName) {
      var groupHtml = '<div class="overlay-group"><div class="overlay-group-label">' + groupName + '</div>';
      groups[groupName].forEach(function (def) {
        var checked = def.lazy ? '' : ' checked';
        groupHtml += '<label class="overlay-item">' +
          '<input type="checkbox" data-layer="' + def.key + '"' + checked + '> ' +
          '<span>' + def.label + '</span></label>';
      });
      groupHtml += '</div>';
      container.innerHTML += groupHtml;
    });

    document.querySelector('.map-app').appendChild(container);

    /* Wire checkboxes */
    container.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var key = this.dataset.layer;
        var def = self._defByKey(key);
        if (this.checked) {
          if (def.lazy && !self.state.layers[key]) {
            self._loadLayer(def).then(function () {
              /* Restore drill state visibility if needed */
            });
          } else if (self.state.layers[key]) {
            self.state.map.addLayer(self.state.layers[key]);
          }
        } else {
          if (self.state.layers[key]) {
            self.state.map.removeLayer(self.state.layers[key]);
          }
        }
      });
    });
  },

  _setupLazyLoad() {
    /* Lazy layers handled in checkbox change handler */
  },

  /* ── Feature name ─────────────────────────── */
  _featureName(feature, layerKey) {
    var p = feature.properties;
    if (!p) return 'Unknown';
    var def = this._defByKey(layerKey);
    if (def) {
      for (var i = 0; i < def.nameProp.length; i++) {
        if (p[def.nameProp[i]]) return p[def.nameProp[i]];
      }
    }
    var candidates = [p.NAME_3, p.NAME_2, p.NAME_1, p.Municipali, p.PROVINCE, p.Province, p.Region].filter(Boolean);
    return candidates[0] || 'Unknown';
  },

  /* ── Info Panel ───────────────────────────── */
  openPanel(feature, layerKey) {
    var panel = document.getElementById('info-panel');
    var content = document.getElementById('info-panel-content');
    if (!panel || !content) return;

    var def = this._defByKey(layerKey);
    var level = def ? def.level : 0;
    var name = this._featureName(feature, layerKey);
    var levelLabel = this.config.levelNames[level];
    var props = feature.properties || {};

    var details = this._resolveDetails(props, level, name);

    var html = '';

    html += '<div class="panel-hero">';
    html += '<div class="panel-level-badge">' + this._escHtml(levelLabel) + '</div>';
    html += '<h2 class="panel-title">' + this._escHtml(name) + '</h2>';
    html += '<p class="panel-subtitle">' + this._escHtml(this._heroSubtitle(props, level)) + '</p>';
    html += '</div>';

    if (level < 3) {
      html += '<div class="panel-drill-hint">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>' +
        ' Click a ' + this.config.levelNames[level + 1] + ' on the map to drill in' +
      '</div>';
    }

    html += '<div class="panel-section"><div class="panel-section-title">Details</div>';
    Object.entries(details).forEach((function (entry) {
      html += '<div class="panel-row"><span class="panel-row-label">' + this._escHtml(entry[0]) + '</span><span class="panel-row-value">' + this._escHtml(entry[1]) + '</span></div>';
    }).bind(this));
    html += '</div>';

    var chartData = this._resolveChartData(props);
    if (chartData.values.length > 0) {
      html += '<div class="panel-section"><div class="panel-section-title">Measurements</div><div class="chart-wrap"><canvas id="panel-chart"></canvas></div></div>';
    }

    content.innerHTML = html;
    panel.classList.add('open');
    this.state.panelOpen = true;

    if (chartData.values.length > 0) {
      var ctx = document.getElementById('panel-chart');
      if (ctx) {
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: chartData.labels,
            datasets: [{
              data: chartData.values,
              backgroundColor: ['#059669', '#0d9488', '#0891b2', '#7c3aed'],
              borderRadius: 5,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, ticks: { font: { size: 10 }, color: '#6b7280' }, grid: { color: 'rgba(0,0,0,0.05)' } },
              x: { ticks: { font: { size: 10 }, color: '#6b7280' }, grid: { display: false } },
            },
          },
        });
      }
    }
  },

  closePanel() {
    var panel = document.getElementById('info-panel');
    if (panel) panel.classList.remove('open');
    this.state.panelOpen = false;
  },

  /* ── Breadcrumb ───────────────────────────── */
  _updateBreadcrumb() {
    var bc = document.getElementById('map-breadcrumb');
    if (!bc) return;

    var html = '';
    var atRoot = this.state.drillStack.length === 0;
    html += '<button class="breadcrumb-item ' + (atRoot ? 'active' : 'clickable') + '" onclick="APP.drillUp()">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' +
      ' CAR Region</button>';

    this.state.drillStack.forEach(function (item, idx) {
      var isLast = idx === this.state.drillStack.length - 1;
      var def = this._defByKey(item.key);
      var name = this._featureName(item.feature, item.key);
      html += '<span class="breadcrumb-sep">›</span>';
      html += '<button class="breadcrumb-item ' + (isLast ? 'active' : 'clickable') + '" onclick="APP.drillUpTo(' + (idx + 1) + ')">' + this._escHtml(name) + '</button>';
    }.bind(this));

    bc.innerHTML = html;
  },

  drillUpTo(targetLength) {
    while (this.state.drillStack.length > targetLength) {
      this.drillUp();
    }
  },

  /* ── Hover label ──────────────────────────── */
  _showHoverLabel(name, level) {
    var lbl = document.getElementById('map-hover-label');
    if (!lbl) return;
    lbl.innerHTML = '<span class="label-level">' + this.config.levelNames[level] + '</span>' + this._escHtml(name);
    lbl.classList.add('visible');
  },

  _hideHoverLabel() {
    var lbl = document.getElementById('map-hover-label');
    if (lbl) lbl.classList.remove('visible');
  },

  /* ── Detail resolvers ─────────────────────── */
  _resolveDetails(props, level, name) {
    var d = {};
    if (level === 3) {
      d['Barangay'] = props.NAME_3 || name;
      if (props.NAME_2 || props.Municipali) d['Municipality'] = props.NAME_2 || props.Municipali;
      if (props.NAME_1 || props.PROVINCE) d['Province'] = props.NAME_1 || props.PROVINCE;
      if (props.TYPE_3) d['Type'] = props.TYPE_3;
    } else if (level === 2) {
      d['Municipality/City'] = props.Municipali || name;
      if (props.Province || props.PROVINCE) d['Province'] = props.Province || props.PROVINCE;
      if (props.PSGC) d['PSGC'] = props.PSGC;
    } else if (level === 1) {
      d['Province'] = props.PROVINCE || props.Province || name;
      if (props.PSGC_P) d['PSGC'] = props.PSGC_P;
    } else {
      d['Region'] = props.Region || 'Cordillera Administrative Region';
      if (props.PSGC) d['PSGC'] = props.PSGC;
    }
    var area = this._resolveArea(props);
    if (area) d['Area'] = area;
    return d;
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
    for (var k = 0; k < ['Shape_Area', 'Shape_Length', 'AREA', 'Area', 'Hectares', 'PERIMETER'].length; k++) {
      var key = ['Shape_Area', 'Shape_Length', 'AREA', 'Area', 'Hectares', 'PERIMETER'][k];
      var v = parseFloat(props[key]);
      if (!isNaN(v) && v > 0) { labels.push(key.replace(/_/g, ' ')); values.push(v); }
    }
    return { labels: labels, values: values };
  },

  _heroSubtitle(props, level) {
    if (level === 3) return (props.NAME_2 || props.Municipali || '') + ', ' + (props.NAME_1 || '');
    if (level === 2) return props.Province || props.PROVINCE || 'Province';
    if (level === 1) return 'Province \u2014 Cordillera Administrative Region';
    return 'Watershed Cradle of Northern Luzon';
  },

  /* ── Toast ────────────────────────────────── */
  _showToast(msg) {
    var toast = document.getElementById('drill-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'drill-toast';
      toast.className = 'drill-hint-toast';
      document.querySelector('.map-app').appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3000);
  },

  /* ── Utils ────────────────────────────────── */
  _escHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  },
};
