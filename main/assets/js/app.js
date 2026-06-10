/**
 * APP — Central state + controller for CAR Watershed drill-down map
 *
 * Drill levels (in order):
 *   0 = region   (CAR boundary)
 *   1 = province
 *   2 = municipality
 *   3 = barangay
 */

const APP = {

  /* ── State ────────────────────────────────── */
  state: {
    map: null,
    currentLevel: 0,          // 0=region 1=province 2=municipality 3=barangay
    selectedPath: [],          // [{level, feature, name}] breadcrumb trail
    layers: {},                // keyed by level: { 0: L.GeoJSON, 1: L.GeoJSON, … }
    rawData: {},               // cached GeoJSON data by level key
    hoverLayer: null,
    activeBasemap: 'osm',
    basemapLayers: {},
    panelOpen: false,
  },

  /* ── Config ───────────────────────────────── */
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

    /* What property name to use for feature label at each level */
    nameProp: [
      ['Region', 'NAME_1'],
      ['PROVINCE', 'NAME_1'],
      ['Municipali', 'NAME_2', 'NAME_1'],
      ['NAME_3', 'NAME_2'],
    ],

    /* Parent-link: which property on level N matches the selected parent at level N-1 */
    parentFilter: [
      null,                          // level 0 — always show all
      { childProp: 'PROVINCE',   parentProp: 'PROVINCE' },
      { childProp: 'Province',   parentProp: 'PROVINCE', fallback: ['Municipali'] },
      { childProp: 'NAME_1',     parentProp: 'Province', fallback: ['NAME_2'] },
    ],

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

  /* ── Init ────────────────────────────────── */
  init() {
    const map = L.map('map', {
      center: this.config.mapCenter,
      zoom: this.config.mapZoom,
      minZoom: this.config.minZoom,
      maxZoom: this.config.maxZoom,
      maxBounds: this.config.maxBounds,
      zoomControl: true,
      preferCanvas: true,
    });

    /* Position zoom control bottom-right */
    map.zoomControl.setPosition('bottomright');

    /* Basemaps */
    Object.entries(this.config.baseMaps).forEach(([key, cfg]) => {
      this.state.basemapLayers[key] = L.tileLayer(cfg.url, {
        maxZoom: this.config.maxZoom,
        attribution: cfg.attr,
      });
    });
    this.state.basemapLayers.osm.addTo(map);
    this.state.activeBasemap = 'osm';

    this.state.map = map;

    /* Mouse move → update hover label position */
    document.addEventListener('mousemove', (e) => {
      const lbl = document.getElementById('map-hover-label');
      if (lbl && lbl.classList.contains('visible')) {
        lbl.style.left = (e.clientX + 14) + 'px';
        lbl.style.top  = (e.clientY - 10) + 'px';
      }
    });

    /* Click empty space → drill back up one level (level 1 is base — no drill-up) */
    map.on('click', () => {
      if (this.state.currentLevel > 1) {
        this.drillUp(this.state.currentLevel - 1);
      }
    });
  },

  /* ── Basemap switcher ─────────────────────── */
  switchBasemap(key) {
    if (key === this.state.activeBasemap) return;
    const map = this.state.map;
    map.removeLayer(this.state.basemapLayers[this.state.activeBasemap]);
    this.state.basemapLayers[key].addTo(map);
    map.eachLayer(layer => { if (layer !== this.state.basemapLayers[key]) { /* keep */ } });
    /* Re-ensure GeoJSON layers are on top */
    Object.values(this.state.layers).forEach(l => l && l.bringToFront && l.bringToFront());

    this.state.activeBasemap = key;

    document.querySelectorAll('.basemap-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layer === key);
    });
  },

  /* ── Drill DOWN ────────────────────────────── */
  async drillDown(feature, leafletLayer) {
    const currentLevel = this.state.currentLevel;
    if (currentLevel >= 3) return;

    const nextLevel = currentLevel + 1;
    const name = this._featureName(feature, currentLevel);

    /* Record in path with bounds for drill-up zoom */
    const bounds = leafletLayer.getBounds();
    this.state.selectedPath.push({ level: currentLevel, feature, name, bounds });

    /* Advance currentLevel BEFORE _showLevel so its click guard is correct */
    this.state.currentLevel = nextLevel;

    /* Hide parent level completely — remove from map */
    if (currentLevel > 0 && this.state.layers[currentLevel]) {
      this.state.map.removeLayer(this.state.layers[currentLevel]);
      this.state.layers[currentLevel]._hiddenByDrill = true;
    }

    /* Hide CAR boundary (level 0) when drilling past provinces */
    if (nextLevel >= 2 && this.state.layers[0]) {
      this.state.map.removeLayer(this.state.layers[0]);
      this.state.layers[0] = null;
    }

    /* Update breadcrumb */
    this._updateBreadcrumb();

    /* Load next level filtered to this parent */
    await this._showLevel(nextLevel, feature, currentLevel);

    /* Zoom to clicked feature */
    this.state.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });

    this._showToast(`Click a ${this.config.levelNames[nextLevel]} to drill in`);
  },

  /* ── Drill UP ──────────────────────────────── */
  async drillUp(targetLevel) {
    if (typeof targetLevel === 'string' && targetLevel === 'region') targetLevel = 1;
    if (typeof targetLevel !== 'number' || targetLevel < 1) targetLevel = 1;

    /* Already at target — no-op */
    if (this.state.currentLevel === targetLevel && this.state.selectedPath.length === targetLevel - 1) return;

    /* Remove layers deeper than target */
    for (let lvl = 3; lvl > targetLevel; lvl--) {
      if (this.state.layers[lvl]) {
        this.state.map.removeLayer(this.state.layers[lvl]);
        this.state.layers[lvl] = null;
      }
    }

    /* Re-add target level layer if it was hidden during drill-down */
    if (targetLevel > 0 && this.state.layers[targetLevel] && this.state.layers[targetLevel]._hiddenByDrill) {
      this.state.map.addLayer(this.state.layers[targetLevel]);
      this.state.layers[targetLevel]._hiddenByDrill = false;
    }

    /* Reset style of target level — restore all features to default */
    this._resetLevelStyle(targetLevel);

    /* Trim path and update state */
    this.state.selectedPath = this.state.selectedPath.slice(0, targetLevel - 1);
    this.state.currentLevel = targetLevel;

    this._updateBreadcrumb();
    this.closePanel();

    /* Re-show level 0 CAR boundary if coming back to province view */
    if (targetLevel === 1 && !this.state.layers[0]) {
      await this._showLevel(0, null, null);
    }

    /* Zoom to show the full parent context */
    if (targetLevel === 1) {
      if (this.state.layers[0]) {
        this.state.map.fitBounds(this.state.layers[0].getBounds(), { padding: [60, 60] });
      }
    } else {
      /* targetLevel > 1: zoom to the parent feature (item at index targetLevel - 2) */
      const parentEntry = this.state.selectedPath[targetLevel - 2];
      if (parentEntry && parentEntry.bounds) {
        this.state.map.fitBounds(parentEntry.bounds, { padding: [60, 60] });
      }
    }
  },

  /* ── Show a level (with optional parent filter) ── */
  async _showLevel(level, parentFeature, parentLevel) {
    /* Remove this level's layer if present */
    if (this.state.layers[level]) {
      this.state.map.removeLayer(this.state.layers[level]);
      this.state.layers[level] = null;
    }

    /* Load GeoJSON (cache) */
    const geoKey = level;
    if (!this.state.rawData[geoKey]) {
      const resp = await fetch(this.config.geoJSON[level]);
      if (!resp.ok) throw new Error('Failed to load level ' + level);
      this.state.rawData[geoKey] = await resp.json();
    }

    let data = this.state.rawData[geoKey];

    /* Filter features to parent */
    if (parentFeature && level > 0) {
      data = this._filterToParent(data, level, parentFeature);
    }

    const styleConfig = this.config.colors[level];
    const self = this;
    const featureCount = data.features ? data.features.length : 0;
    const useHover = featureCount <= 300;

    const layer = L.geoJSON(data, {
      interactive: level !== 0,
      style: () => ({
        fillColor: styleConfig.fill,
        fillOpacity: level === 0 ? 0.1 : 0.25,
        color: styleConfig.stroke,
        weight: styleConfig.weight,
        opacity: 0.9,
      }),

      onEachFeature(feature, leafletLayer) {
        /* Level 0 is visual reference only — no interaction */
        if (level === 0) return;

        const name = self._featureName(feature, level);

        /* Hover effects (only when this level is the active one) */
        if (useHover) {
          leafletLayer.on('mouseover', function (e) {
            if (level !== self.state.currentLevel) return;
            if (e.target._hiddenByIsolation) return;
            e.target.setStyle({ fillOpacity: 0.55, weight: styleConfig.weight + 1 });
            e.target.bringToFront();
            self._showHoverLabel(name, level);
          });
          leafletLayer.on('mouseout', function (e) {
            if (level !== self.state.currentLevel) return;
            if (e.target._hiddenByIsolation) return;
            e.target.setStyle({
              fillColor: styleConfig.fill,
              fillOpacity: 0.25,
              color: styleConfig.stroke,
              weight: styleConfig.weight,
              opacity: 0.9,
            });
            self._hideHoverLabel();
          });
        }

        /* Click: drill down or isolate at deepest level */
        leafletLayer.on('click', function (e) {
          L.DomEvent.stopPropagation(e);
          if (level !== self.state.currentLevel) return;
          self.openPanel(feature, level);
          if (level < 3) {
            self.drillDown(feature, leafletLayer);
          } else {
            /* Level 3: hide other barangays, highlight this one */
            self._dimLevel(level, feature);
          }
        });
      },
    });

    layer.addTo(this.state.map);
    this.state.layers[level] = layer;
  },

  /* ── Filter GeoJSON to parent boundary ─────── */
  _filterToParent(data, childLevel, parentFeature) {
    const pProps = parentFeature.properties;

    const filtered = data.features.filter(feat => {
      const cProps = feat.properties;

      /* Level 2 (municipalities): match by province name (case-insensitive) */
      if (childLevel === 2) {
        const provinceName = (pProps.PROVINCE || pProps.Province || '').toUpperCase();
        const childProvince = (cProps.Province || cProps.PROVINCE || cProps.NAME_1 || '').toUpperCase();
        return childProvince === provinceName;
      }

      /* Level 3 (barangays): match by municipality name (case-insensitive) */
      if (childLevel === 3) {
        const munName = (pProps.Municipali || pProps.NAME_2 || '').toUpperCase();
        const childMun = (cProps.NAME_2 || cProps.Municipali || '').toUpperCase();
        return childMun === munName;
      }

      return true;
    });

    return { ...data, features: filtered };
  },

  /* ── Feature name resolution ─────────────── */
  _featureName(feature, level) {
    const p = feature.properties;
    if (!p) return 'Unknown';

    const candidates = [
      p.NAME_3, p.NAME_2, p.NAME_1,
      p.Municipali, p.PROVINCE, p.Province,
      p.Region,
    ].filter(Boolean);

    /* Level-specific preference */
    if (level === 3) return p.NAME_3 || p.Municipali || candidates[0] || 'Unknown';
    if (level === 2) return p.Municipali || p.NAME_2 || candidates[0] || 'Unknown';
    if (level === 1) return p.PROVINCE || p.Province || p.NAME_1 || candidates[0] || 'Unknown';
    return 'Cordillera Administrative Region';
  },

  /* ── Highlight selected layer ─────────────── */
  _highlightLayer(leafletLayer, styleConfig, level) {
    leafletLayer.setStyle({
      fillColor: '#ffdd57',
      fillOpacity: 0.5,
      color: '#e60000',
      weight: 3,
      opacity: 1,
    });
    leafletLayer.bringToFront();
  },

  /* ── Isolate selected feature: highlight it, hide all others at this level ── */
  _dimLevel(level, selectedFeature) {
    const layer = this.state.layers[level];
    if (!layer) return;
    const cfg = this.config.colors[level];
    layer.eachLayer(function(leafletLayer) {
      if (leafletLayer.feature !== selectedFeature) {
        leafletLayer._hiddenByIsolation = true;
        leafletLayer.setStyle({
          fillOpacity: 0,
          opacity: 0,
          weight: 0,
        });
      } else {
        leafletLayer._hiddenByIsolation = false;
        leafletLayer.setStyle({
          fillColor: '#ffdd57',
          fillOpacity: 0.5,
          color: '#e60000',
          weight: 3,
          opacity: 1,
        });
        leafletLayer.bringToFront();
      }
    });
  },

  /* ── Restore default styles for all features at a level ── */
  _resetLevelStyle(level) {
    const layer = this.state.layers[level];
    if (!layer) return;
    const cfg = this.config.colors[level];
    const fillOpacity = level === 0 ? 0.1 : 0.25;
    layer.eachLayer(function(leafletLayer) {
      delete leafletLayer._hiddenByIsolation;
      leafletLayer.setStyle({
        fillColor: cfg.fill,
        fillOpacity: fillOpacity,
        color: cfg.stroke,
        weight: cfg.weight,
        opacity: 0.9,
      });
    });
  },

  /* ── Hover label ──────────────────────────── */
  _showHoverLabel(name, level) {
    const lbl = document.getElementById('map-hover-label');
    if (!lbl) return;
    lbl.innerHTML = `<span class="label-level">${this.config.levelNames[level]}</span>${this._escHtml(name)}`;
    lbl.classList.add('visible');
  },

  _hideHoverLabel() {
    const lbl = document.getElementById('map-hover-label');
    if (lbl) lbl.classList.remove('visible');
  },

  /* ── Breadcrumb ───────────────────────────── */
  _updateBreadcrumb() {
    const bc = document.getElementById('map-breadcrumb');
    if (!bc) return;

    let html = '';

    /* Root: "CAR Region" always clickable if we're deeper than province level,
       active when we're at province level (currentLevel === 1) */
    const atRoot = this.state.selectedPath.length === 0;
    html += `<button class="breadcrumb-item ${atRoot ? 'active' : 'clickable'}" onclick="APP.drillUp(1)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      CAR Region</button>`;

    /* Each item in selectedPath is a level the user drilled from.
       selectedPath[0].level = 1 means user clicked a Province → to return to province view, call drillUp(1).
       selectedPath[1].level = 2 means user clicked a Municipality → to return there, call drillUp(2). */
    this.state.selectedPath.forEach((item, idx) => {
      const isLast = idx === this.state.selectedPath.length - 1;
      html += `<span class="breadcrumb-sep">›</span>`;
      html += `<button class="breadcrumb-item ${isLast ? 'active' : 'clickable'}" onclick="APP.drillUp(${item.level})">${this._escHtml(item.name)}</button>`;
    });

    bc.innerHTML = html;
  },

  /* ── Info Panel ───────────────────────────── */
  openPanel(feature, level) {
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('info-panel-content');
    if (!panel || !content) return;

    const name = this._featureName(feature, level);
    const levelLabel = this.config.levelNames[level];
    const props = feature.properties || {};

    /* Build details */
    const details = this._resolveDetails(props, level, name);

    let html = '';

    /* Hero header */
    html += `<div class="panel-hero">
      <div class="panel-level-badge">${this._escHtml(levelLabel)}</div>
      <h2 class="panel-title">${this._escHtml(name)}</h2>
      <p class="panel-subtitle">${this._escHtml(this._heroSubtitle(props, level))}</p>
    </div>`;

    /* Drill-down hint if not at barangay */
    if (level < 3) {
      const nextName = this.config.levelNames[level + 1];
      html += `<div class="panel-drill-hint" onclick="void(0)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        Click a ${nextName} on the map to drill in
      </div>`;
    }

    /* Properties section */
    html += `<div class="panel-section">
      <div class="panel-section-title">Details</div>`;

    Object.entries(details).forEach(([k, v]) => {
      html += `<div class="panel-row">
        <span class="panel-row-label">${this._escHtml(k)}</span>
        <span class="panel-row-value">${this._escHtml(v)}</span>
      </div>`;
    });

    html += `</div>`;

    /* Chart section if numeric data available */
    const chartData = this._resolveChartData(props);
    if (chartData.values.length > 0) {
      html += `<div class="panel-section">
        <div class="panel-section-title">Measurements</div>
        <div class="chart-wrap"><canvas id="panel-chart"></canvas></div>
      </div>`;
    }

    content.innerHTML = html;
    panel.classList.add('open');
    this.state.panelOpen = true;

    /* Render chart */
    if (chartData.values.length > 0) {
      const ctx = document.getElementById('panel-chart');
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
    const panel = document.getElementById('info-panel');
    if (panel) panel.classList.remove('open');
    this.state.panelOpen = false;
  },

  /* ── Detail resolvers ─────────────────────── */
  _resolveDetails(props, level, name) {
    const d = {};
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
    const area = this._resolveArea(props);
    if (area) d['Area'] = area;
    return d;
  },

  _resolveArea(props) {
    for (const k of ['Hectares', 'Area', 'AREA', 'Shape_Area', 'PERIMETER']) {
      const v = props[k];
      if (v != null && v !== '') {
        const n = parseFloat(v);
        if (!isNaN(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
      }
    }
    return null;
  },

  _resolveChartData(props) {
    const labels = [], values = [];
    for (const k of ['Shape_Area', 'Shape_Length', 'AREA', 'Area', 'Hectares', 'PERIMETER']) {
      const v = parseFloat(props[k]);
      if (!isNaN(v) && v > 0) { labels.push(k.replace(/_/g, ' ')); values.push(v); }
    }
    return { labels, values };
  },

  _heroSubtitle(props, level) {
    if (level === 3) return `${props.NAME_2 || props.Municipali || ''}, ${props.NAME_1 || ''}`.replace(/^,\s*/, '').replace(/,\s*$/, '');
    if (level === 2) return props.Province || props.PROVINCE || 'Province';
    if (level === 1) return 'Province — Cordillera Administrative Region';
    return 'Watershed Cradle of Northern Luzon';
  },

  /* ── Toast ────────────────────────────────── */
  _showToast(msg) {
    let toast = document.getElementById('drill-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'drill-toast';
      toast.className = 'drill-hint-toast';
      document.querySelector('.map-app').appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  },

  /* ── Utils ────────────────────────────────── */
  _escHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  },
};

/* Events namespace (kept for compatibility) */
const EVENTS = {
  FEATURE_SELECT: 'feature:select',
  FEATURE_CLEAR: 'feature:clear',
};
