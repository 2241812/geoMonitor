const APP = {

  state: {
    map: null,
    currentLevel: 0,
    selectedPath: [],
    layers: {},
    rawData: {},
    hoverLayer: null,
    activeBasemap: 'topo',
    basemapLayers: {},
    panelState: 'closed',
    lastViewed: null,
    _drilling: false,
    _chart: null,
    outlineLayers: {},
    activeOutline: null,
    _outlineHighlight: null,
    hierarchy: null,
    activeSource: 'namria',
    activeMode: 'explore',
  },

  config: {
    mapCenter: [17.3, 121.0],
    mapZoom: 8,
    minZoom: 7,
    maxZoom: 18,
    maxBounds: [[4.0, 116.0], [21.5, 128.0]],

    sources: {
      namria: {
        label: 'NAMRIA',
        geoJSON: {
          0: 'geoJSON/CAR NAMRIA Boundary.geojson',
          1: 'geoJSON/CAR NAMRIA Provincial Boundary.geojson',
          2: 'geoJSON/CAR NAMRIA Municipal Boundary.geojson',
        },
        hierarchy: 'geoJSON/hierarchy-namria.json',
        levelNames: ['Region', 'Province', 'Municipality'],
        maxLevel: 2,
      },
      cad: {
        label: 'CAD',
        geoJSON: {
          0: 'geoJSON/CAR CAD Boundary.geojson',
          1: 'geoJSON/CAR CAD Municipal Boundary.geojson',
        },
        hierarchy: 'geoJSON/hierarchy-cad.json',
        levelNames: ['Region', 'Municipality'],
        maxLevel: 1,
      },
    },

    colors: {
      0: { fill: '#ff7f0e', stroke: '#c2570a', weight: 3 },
      1: { fill: '#1f77b4', stroke: '#0a3d6b', weight: 2 },
      2: { fill: '#2ca02c', stroke: '#1a6b1a', weight: 1.5 },
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

  _src() {
    return this.config.sources[this.state.activeSource];
  },

  /* ── Init ────────────────────────────────── */
  init() {
    const map = L.map('map', {
      center: this.config.mapCenter,
      zoom: this.config.mapZoom,
      minZoom: this.config.minZoom,
      maxZoom: this.config.maxZoom,
      maxBounds: this.config.maxBounds,
      zoomSnap: 0.5,
    });

    /* Basemaps */
    Object.entries(this.config.baseMaps).forEach(([key, cfg]) => {
      this.state.basemapLayers[key] = L.tileLayer(cfg.url, {
        maxZoom: this.config.maxZoom,
        attribution: cfg.attr,
      });
    });
    this.state.basemapLayers.topo.addTo(map);
    this.state.activeBasemap = 'topo';

    this.state.map = map;

    /* Position zoom control bottom-right (beside basemap) */
    if (map.zoomControl) map.zoomControl.setPosition('bottomright');

    /* Load hierarchy for active source */
    this._loadHierarchy();

    /* Mouse move → update hover label position (throttled via RAF) */
    let _hoverX = 0, _hoverY = 0, _hoverPending = false;
    document.addEventListener('mousemove', (e) => {
      _hoverX = e.clientX;
      _hoverY = e.clientY;
      if (_hoverPending) return;
      _hoverPending = true;
      requestAnimationFrame(() => {
        _hoverPending = false;
        const lbl = document.getElementById('map-hover-label');
        if (lbl && lbl.classList.contains('visible')) {
          lbl.style.left = (_hoverX + 14) + 'px';
          lbl.style.top  = (_hoverY - 10) + 'px';
        }
      });
    });

    /* Close basemap dropdown on any map click */
    map.on('click', () => {
      const opts = document.getElementById('basemap-options');
      if (opts) opts.style.display = 'none';
    });

    /* Click empty space → drill up one level (both modes) */
    map.on('click', () => {
      if (this.state._drilling) return;
      if (this.state.currentLevel >= 1) {
        this.drillUp(this.state.currentLevel - 1);
      }
    });
  },

  _loadHierarchy() {
    fetch(this._src().hierarchy)
      .then(r => r.json())
      .then(h => { this.state.hierarchy = h; })
      .catch(() => {});
  },

  /* ── Source toggle ────────────────────────── */
  switchSource(name) {
    if (name === this.state.activeSource) return;
    if (!this.config.sources[name]) return;
    if (this.state._drilling) return;

    /* Clear all layers and cached data */
    Object.values(this.state.layers).forEach(l => {
      if (l) this.state.map.removeLayer(l);
    });
    this.state.layers = {};
    this.state.rawData = {};
    this.state.selectedPath = [];
    this.state.currentLevel = 0;
    this.state.activeOutline = null;
    this.state._outlineHighlight = null;
    Object.values(this.state.outlineLayers).forEach(l => {
      if (l) this.state.map.removeLayer(l);
    });
    this.state.outlineLayers = {};
    this.closePanel();

    this.state.activeSource = name;
    this._loadHierarchy();
    this._updateBreadcrumb();

    window.initLayers();
  },

  /* ── Basemap switcher ─────────────────────── */
  switchBasemap(key) {
    if (key === this.state.activeBasemap) return;
    const map = this.state.map;
    map.removeLayer(this.state.basemapLayers[this.state.activeBasemap]);
    this.state.basemapLayers[key].addTo(map);
    Object.values(this.state.layers).forEach(l => l && l.bringToFront && l.bringToFront());
    this.state.activeBasemap = key;

    /* Update active option */
    document.querySelectorAll('.basemap-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layer === key);
    });

    /* Close dropdown */
    const opts = document.getElementById('basemap-options');
    if (opts) opts.style.display = 'none';
  },

  _toggleBasemap() {
    const opts = document.getElementById('basemap-options');
    if (!opts) return;
    opts.style.display = opts.style.display === 'none' ? '' : 'none';
  },

  /* ── Drill DOWN ──────────────────────────────── */
  async drillDown(feature, leafletLayer) {
    if (this.state._drilling) return;
    this.state._drilling = true;
    try {
      const currentLevel = this.state.currentLevel;
      if (currentLevel >= this._src().maxLevel) return;

      const nextLevel = currentLevel + 1;
      const name = this._featureName(feature, currentLevel);

      this.state.selectedPath = this.state.selectedPath.filter(item => item.level < currentLevel);
      this.state.selectedPath.push({ level: currentLevel, feature, name });

      this.state.currentLevel = nextLevel;

      /* Keep context layers visible — dim parent slightly instead of removing */
      if (currentLevel > 0 && this.state.layers[currentLevel]) {
        this.state.layers[currentLevel].eachLayer(function(lf) {
          lf.setStyle({ fillOpacity: 0.08, opacity: 0.4, weight: 1 });
        });
        this.state.layers[currentLevel]._hiddenByDrill = true;
      }

      /* At max level: remove level 0 (CAR boundary) so it doesn't clutter */
      if (nextLevel >= this._src().maxLevel && this.state.layers[0]) {
        this.state.map.removeLayer(this.state.layers[0]);
        this.state.layers[0] = null;
      }

      this._updateBreadcrumb();

      await this._showLevel(nextLevel, feature, currentLevel);

      /* Zoom to selected feature */
      if (leafletLayer && leafletLayer.getBounds) {
        this.state.map.fitBounds(leafletLayer.getBounds(), { padding: [40, 40] });
      }

      this._updateOutlines();
    } finally {
      this.state._drilling = false;
    }
  },

  /* ── Drill UP (both modes) ─────────────────── */
  async drillUp(targetLevel) {
    if (this.state._drilling) return;
    this.state._drilling = true;
    try {
      if (typeof targetLevel !== 'number' || targetLevel < 0) targetLevel = 0;

      /* Clear selection state */
      this.state._selectedFeature = null;
      this.state._selectedLevel = null;
      this.state._selectedLeafletLayer = null;

      if (targetLevel === 0) {
        for (let lvl = this._src().maxLevel; lvl > 1; lvl--) {
          if (this.state.layers[lvl]) {
            this.state.map.removeLayer(this.state.layers[lvl]);
            this.state.layers[lvl] = null;
          }
        }
        /* Restore levels 0 and 1 to full style */
        if (this.state.layers[1]) this._resetLevelStyle(1);
        if (this.state.layers[0]) this._resetLevelStyle(0);
        this.state.selectedPath = [];
        this.state.currentLevel = 0;
        /* Only rebuild if layers don't exist yet (avoids visual flicker) */
        if (!this.state.layers[0]) await this._showLevel(0);
        if (!this.state.layers[1]) await this._showLevel(1, null, null);
        this.state.currentLevel = 1;
        /* Zoom to CAR bounds */
        if (this.state.layers[0]) {
          this.state.map.fitBounds(this.state.layers[0].getBounds(), { padding: [40, 40] });
        }
        /* Show CAR info in panel */
        const carData = this.state.rawData[0];
        if (carData && carData.features && carData.features[0]) {
          this.openPanel(carData.features[0], 0);
        }
        this._updateBreadcrumb();
        this._updateOutlines();
        return;
      }

      if (this.state.currentLevel === targetLevel && this.state.selectedPath.length === targetLevel) return;

      for (let lvl = this._src().maxLevel; lvl > targetLevel; lvl--) {
        if (this.state.layers[lvl]) {
          this.state.map.removeLayer(this.state.layers[lvl]);
          this.state.layers[lvl] = null;
        }
      }

      /* Restore context layer style (was dimmed during drillDown) */
      if (targetLevel > 0 && this.state.layers[targetLevel]) {
        this._resetLevelStyle(targetLevel);
        this.state.layers[targetLevel]._hiddenByDrill = false;
      }

      /* Re-add level 0 (CAR) if it was removed at maxLevel */
      if (targetLevel < this._src().maxLevel && !this.state.layers[0]) {
        this._showLevel(0);
      }

      this.state.selectedPath = this.state.selectedPath.slice(0, targetLevel);
      this.state.currentLevel = targetLevel;

      /* Zoom to specific feature bounds (not whole level) */
      if (targetLevel > 0 && this.state.selectedPath.length > 0) {
        const lastItem = this.state.selectedPath[this.state.selectedPath.length - 1];
        const levelLayer = this.state.layers[targetLevel];
        if (levelLayer) {
          levelLayer.eachLayer((lf) => {
            if (lf.feature === lastItem.feature) {
              this.state.map.fitBounds(lf.getBounds(), { padding: [40, 40] });
            }
          });
        }
      } else if (targetLevel === 0 && this.state.layers[0]) {
        this.state.map.fitBounds(this.state.layers[0].getBounds(), { padding: [40, 40] });
      }

      /* Show the feature at target level in panel */
      if (targetLevel > 0 && this.state.selectedPath.length > 0) {
        const lastItem = this.state.selectedPath[this.state.selectedPath.length - 1];
        this.openPanel(lastItem.feature, lastItem.level);
      }

      this._updateBreadcrumb();
      this._updateOutlines();
    } finally {
      this.state._drilling = false;
    }
  },

  /* ── Show a level (with optional parent filter) ── */
  async _showLevel(level, parentFeature) {
    if (this.state.layers[level]) {
      this.state.map.removeLayer(this.state.layers[level]);
      this.state.layers[level] = null;
    }

    const geoKey = level;
    if (!this.state.rawData[geoKey]) {
      const src = this._src();
      if (!src.geoJSON[level]) return;
      const resp = await fetch(src.geoJSON[level]);
      if (!resp.ok) throw new Error('Failed to load level ' + level);
      this.state.rawData[geoKey] = await resp.json();
    }

    let data = this.state.rawData[geoKey];

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
        if (level === 0) return;

        const name = self._featureName(feature, level);

        if (useHover) {
          leafletLayer.on('mouseover', function (e) {
            if (level !== self.state.currentLevel) return;
            if (e.target._hiddenByIsolation) return;
            if (self.state.activeOutline === level) return;
            e.target.setStyle({ fillOpacity: 0.55, weight: styleConfig.weight + 1 });
            e.target.bringToFront();
            self._showHoverLabel(name, level);
          });
          leafletLayer.on('mouseout', function (e) {
            if (level !== self.state.currentLevel) return;
            if (e.target._hiddenByIsolation) return;
            if (self.state.activeOutline === level) return;
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

          leafletLayer.on('click', function (e) {
            L.DomEvent.stopPropagation(e);
            if (self.state.activeOutline === level) return;
            /* Clicked on a parent level → drill up to it */
            if (level < self.state.currentLevel) {
              self.drillUp(level);
              return;
            }
            if (level !== self.state.currentLevel) return;
            if (e.target._hiddenByIsolation) return;
            self.openPanel(feature, level);
            if (level >= self._src().maxLevel) {
              self._highlightAndDim(feature, leafletLayer, level);
            } else {
              self.drillDown(feature, leafletLayer);
            }
          });
      },
    });

    layer.addTo(this.state.map);
    this.state.layers[level] = layer;
  },

  /* ── Filter GeoJSON to parent boundary ─────── */
  _filterToParent(data, childLevel, parentFeature) {
    const parentId = parentFeature.properties._id;
    if (!parentId) return { ...data, features: [] };
    return { ...data, features: data.features.filter(f => f.properties._parentId === parentId) };
  },

  /* ── Feature name resolution ─────────────── */
  _featureName(feature, level) {
    const p = feature.properties;
    if (!p) return 'Unknown';

    if (this.state.activeSource === 'cad') {
      if (level === 1) return p.Muni_City || 'Unknown';
      return 'Cordillera Administrative Region';
    }

    const candidates = [
      p.NAME_3, p.NAME_2, p.NAME_1,
      p.Municipali, p.PROVINCE, p.Province,
      p.Region,
    ].filter(Boolean);

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

    if (selectedFeature) {
      layer.eachLayer(function(leafletLayer) {
        if (leafletLayer.feature === selectedFeature) {
          leafletLayer.bringToFront();
        }
      });
    }
  },

  /* ── Highlight selection via dim (max-level click) ── */
  _highlightAndDim(feature, leafletLayer, level) {
    this._dimLevel(level, feature);
    this.state._selectedFeature = feature;
    this.state._selectedLevel = level;
    this.state._selectedLeafletLayer = leafletLayer;

    /* Zoom to selected feature */
    if (leafletLayer && leafletLayer.getBounds) {
      this.state.map.fitBounds(leafletLayer.getBounds(), { padding: [40, 40] });
    }

    /* Update breadcrumb */
    const name = this._featureName(feature, level);
    this.state.selectedPath = this.state.selectedPath.filter(item => item.level < level);
    this.state.selectedPath.push({ level, feature, name });
    this._updateBreadcrumb();
  },

  /* ── Clear selection ──────────────────────────── */
  _clearSelection() {
    if (this.state._selectedLevel != null) {
      this._resetLevelStyle(this.state._selectedLevel);
      this.state._selectedFeature = null;
      this.state._selectedLevel = null;
      this.state._selectedLeafletLayer = null;
    }
    this.closePanel();
  },

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

  _dimDrillLayer(level) {
    const layer = this.state.layers[level];
    if (!layer) return;
    const cfg = this.config.colors[level];
    layer.eachLayer(l => {
      l.setStyle({ fillColor: cfg.fill, fillOpacity: 0, opacity: 0.35, weight: 1.2 });
    });
  },

  _restoreDrillLayer(level) {
    const layer = this.state.layers[level];
    if (!layer) return;
    const cfg = this.config.colors[level];
    const fillOpacity = level === 0 ? 0.1 : 0.25;
    layer.eachLayer(l => {
      l.setStyle({
        fillColor: cfg.fill,
        fillOpacity: fillOpacity,
        color: cfg.stroke,
        weight: cfg.weight,
        opacity: 0.9,
      });
    });
  },

  /* ── Background prefetch ── */
  async _prefetchLevel(level) {
    if (this.state.rawData[level]) return;
    try {
      const src = this._src();
      if (!src.geoJSON[level]) return;
      const resp = await fetch(src.geoJSON[level]);
      if (resp.ok) this.state.rawData[level] = await resp.json();
    } catch (_) { }
  },

  /* ── Hover label ──────────────────────────── */
  _showHoverLabel(name, level) {
    const lbl = document.getElementById('map-hover-label');
    if (!lbl) return;
    lbl.innerHTML = `<span class="label-level">${this._src().levelNames[level]}</span>${this._escHtml(name)}`;
    lbl.classList.add('visible');
  },

  _hideHoverLabel() {
    const lbl = document.getElementById('map-hover-label');
    if (lbl) lbl.classList.remove('visible');
  },

  /* ── Home / Reset ─────────────────────────── */
  _goHome() {
    this.state._selectedFeature = null;
    this.state._selectedLevel = null;
    this.state._selectedLeafletLayer = null;
    this.state.selectedPath = [];
    this.state.currentLevel = 0;
    for (let lvl = this._src().maxLevel; lvl > 1; lvl--) {
      if (this.state.layers[lvl]) {
        this.state.map.removeLayer(this.state.layers[lvl]);
        this.state.layers[lvl] = null;
      }
    }
    this._showLevel(0);
    this._showLevel(1, null, null);
    this.state.currentLevel = 1;
    if (this.state.layers[0]) {
      this.state.map.fitBounds(this.state.layers[0].getBounds(), { padding: [40, 40] });
    }
    /* Show CAR info in panel */
    const carData = this.state.rawData[0];
    if (carData && carData.features && carData.features[0]) {
      this.openPanel(carData.features[0], 0);
    }
    this._updateBreadcrumb();
    this._updateOutlines();
  },

  /* ── Mode switch ──────────────────────────── */
  _setMode(mode) {
    if (mode === this.state.activeMode) return;
    this._clearSelection();
    this.closePanel();
    this.state.activeMode = mode;
    if (mode === 'boundary') {
      this._resetLevelStyle(0);
      this._resetLevelStyle(1);
      this.state.currentLevel = 0;
      this.state.selectedPath = [];
      this.drillUp(0);
    } else {
      this.state.currentLevel = 0;
      for (let lvl = this._src().maxLevel; lvl >= 0; lvl--) {
        if (this.state.layers[lvl]) {
          this.state.map.removeLayer(this.state.layers[lvl]);
          this.state.layers[lvl] = null;
        }
      }
      this.state.selectedPath = [];
      this._showLevel(0);
      this._showLevel(1, null, null);
      this.state.currentLevel = 1;
    }
    this._updateBreadcrumb();
  },

  /* ── Breadcrumb ───────────────────────────── */
  _updateBreadcrumb() {
    const bc = document.getElementById('map-breadcrumb');
    if (!bc) return;

    let html = '';

    const src = this._src();

    /* Mode switch buttons */
    html += `<button class="mode-toggle${this.state.activeMode === 'explore' ? ' active' : ''}" onclick="APP._setMode('explore')" title="Explore mode — click to select, map click deselects">Explore</button>`;
    html += `<button class="mode-toggle${this.state.activeMode === 'boundary' ? ' active' : ''}" onclick="APP._setMode('boundary')" title="Boundary mode — click to drill down through hierarchy">Boundary</button>`;

    /* Breadcrumb trail (both modes) */
    const atRoot = this.state.selectedPath.length === 0;

    /* Source toggle (subtle) */
    const otherSource = this.state.activeSource === 'namria' ? 'cad' : 'namria';
    html += `<button class="source-toggle" onclick="APP.switchSource('${otherSource}')" title="Switch to ${this.config.sources[otherSource].label}">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
    </button>`;

    /* Root: "CAR Region" */
    html += `<button class="breadcrumb-item ${atRoot ? 'active' : 'clickable'}" onclick="APP.drillUp(0)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      CAR Region
    </button>`;

    this.state.selectedPath.forEach((item, idx) => {
      const isLast = idx === this.state.selectedPath.length - 1;
      html += `<span class="breadcrumb-sep">›</span>`;
      html += `<button class="breadcrumb-item ${isLast ? 'active' : 'clickable'}" onclick="APP.drillUp(${item.level})">${this._escHtml(item.name)}</button>`;
    });

    bc.innerHTML = html;
    this._renderOutlineToggles();
  },

  _renderOutlineToggles() {
    const container = document.getElementById('outline-toggles');
    if (!container) return;
    if (this.state.activeMode !== 'boundary') {
      container.innerHTML = '';
      return;
    }
    const src = this._src();
    const items = [
      { mode: null, label: 'None', icon: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' },
    ];
    if (src.maxLevel >= 1) {
      items.push({ mode: 1, label: src.levelNames[1], icon: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' });
    }
    if (src.maxLevel >= 2) {
      items.push({ mode: 2, label: src.levelNames[2], icon: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="4" y="10" width="16" height="11" rx="1"/><path d="M8 6l4-4 4 4"/></svg>' });
    }
    const active = this.state.activeOutline;
    container.innerHTML =
      '<div class="boundary-controls">' +
      items.map(({ mode, label, icon }) =>
        `<button class="boundary-option${active === mode ? ' active' : ''}" onclick="APP._setBoundaryMode(${mode === null ? 'null' : mode})">${icon}<span>${this._escHtml(label)}</span></button>`
      ).join('') +
      '</div>';
  },

  _setBoundaryMode(level) {
    const max = this._src().maxLevel;
    if (level !== null && (level < 1 || level > max)) return;
    if (this.state.activeOutline === level) level = null;
    if (this.state.activeOutline !== null) {
      this._hideOutline(this.state.activeOutline);
      this._restoreDrillLayer(this.state.activeOutline);
    }
    this.state._outlineHighlight = null;
    this.state.activeOutline = level;
    if (level !== null) {
      this._showOutline(level);
      this._dimDrillLayer(level);
    }
    this._renderOutlineToggles();
  },

  _showOutline(level) {
    const map = this.state.map;
    if (!map) return;
    if (this.state.outlineLayers[level]) {
      map.removeLayer(this.state.outlineLayers[level]);
      this.state.outlineLayers[level] = null;
    }
    const raw = this.state.rawData[level];
    if (!raw) return;
    const self = this;

    this.state.outlineLayers[level] = L.geoJSON(raw, {
      interactive: level >= this.state.currentLevel,
      style: { color: '#1e293b', weight: 1.5, opacity: 0.6, fillOpacity: 0 },
      onEachFeature(feature, layer) {
        layer.on('click', function (e) {
          L.DomEvent.stopPropagation(e);
          if (self.state._drilling) return;
          if (self.state._outlineHighlight) {
            self.state.outlineLayers[level].resetStyle(self.state._outlineHighlight);
          }
          layer.setStyle({ fillColor: '#fbbf24', fillOpacity: 0.25, color: '#fbbf24', weight: 3, opacity: 1 });
          layer.bringToFront();
          self.state._outlineHighlight = layer;
          self.openPanel(feature, level);
          if (level === self.state.currentLevel) {
            self.drillDown(feature, layer);
          }
        });
      },
    }).addTo(map);
  },

  _hideOutline(level) {
    if (this.state.outlineLayers[level]) {
      this.state.map.removeLayer(this.state.outlineLayers[level]);
      this.state.outlineLayers[level] = null;
    }
  },

  _updateOutlines() {
    this.state._outlineHighlight = null;
    if (this.state.activeOutline !== null) {
      this._showOutline(this.state.activeOutline);
      this._dimDrillLayer(this.state.activeOutline);
    }
  },

  /* ── Info Panel ───────────────────────────── */
  openPanel(feature, level) {
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('info-panel-content');
    if (!panel || !content) return;

    this.state.lastViewed = { feature, level };
    const name = this._featureName(feature, level);
    const src = this._src();
    const levelLabel = src.levelNames[level];
    const props = feature.properties || {};
    const details = this._resolveDetails(props, level, name);

    let html = '';

    html += `<div class="panel-hero">
      <div class="panel-level-badge">${this._escHtml(levelLabel)}</div>
      <h2 class="panel-title">${this._escHtml(name)}</h2>
      <p class="panel-subtitle">${this._escHtml(this._heroSubtitle(props, level))}</p>
    </div>`;

    if (level < src.maxLevel) {
      const nextName = src.levelNames[level + 1];
      html += `<div class="panel-drill-hint" onclick="void(0)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        Click a ${nextName} on the map to drill in
      </div>`;
    }

    html += `<div class="panel-section">
      <div class="panel-section-title">Details</div>`;

    Object.entries(details).forEach(([k, v]) => {
      html += `<div class="panel-row">
        <span class="panel-row-label">${this._escHtml(k)}</span>
        <span class="panel-row-value">${this._escHtml(v)}</span>
      </div>`;
    });

    html += `</div>`;

    const chartData = this._resolveChartData(props);
    if (chartData.values.length > 0) {
      html += `<div class="panel-section">
        <div class="panel-section-title">Measurements</div>
        <div class="chart-wrap"><canvas id="panel-chart"></canvas></div>
      </div>`;
    }

    const isMobile = window.innerWidth <= 640;

    content.innerHTML = html;
    panel.classList.remove('peek', 'open');
    if (isMobile) {
      panel.classList.add('peek');
      this.state.panelState = 'peek';
    } else {
      panel.classList.add('open');
      this.state.panelState = 'open';
    }

    /* Hide toggle tab when panel is open */
    const tab = document.getElementById('panel-toggle-tab');
    if (tab) tab.classList.add('hidden');

    if (chartData.values.length > 0) {
      const ctx = document.getElementById('panel-chart');
      if (ctx) {
        if (this.state._chart) this.state._chart.destroy();
        this.state._chart = new Chart(ctx, {
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
    if (panel) panel.classList.remove('peek', 'open');
    this.state.panelState = 'closed';
    /* Show toggle tab */
    const tab = document.getElementById('panel-toggle-tab');
    if (tab) tab.classList.remove('hidden');
  },

  togglePanel() {
    const panel = document.getElementById('info-panel');
    if (!panel) return;
    if (this.state.panelState === 'open') {
      this.closePanel();
    } else if (this.state.panelState === 'peek') {
      panel.classList.replace('peek', 'open');
      this.state.panelState = 'open';
      const tab = document.getElementById('panel-toggle-tab');
      if (tab) tab.classList.add('hidden');
    } else if (this.state.lastViewed) {
      this.openPanel(this.state.lastViewed.feature, this.state.lastViewed.level);
    } else {
      /* Default: show CAR region details */
      const carData = this.state.rawData[0];
      if (carData && carData.features && carData.features[0]) {
        this.openPanel(carData.features[0], 0);
      }
    }
  },

  _resolveDetails(props, level, name) {
    const d = {};
    const hierarchy = this.state.hierarchy;
    const childCount = (id) => {
      if (!hierarchy || !hierarchy.children) return null;
      const kids = hierarchy.children[id];
      return kids ? kids.length : null;
    };

    if (this.state.activeSource === 'cad') {
      d[this._src().levelNames[level] || 'Feature'] = name;
      if (props.Province) d['Province'] = props.Province;
      if (props.Region || props.REGION) d['Region'] = props.Region || props.REGION;
      if (props.Remarks && props.Remarks.trim()) d['Remarks'] = props.Remarks.trim();
    } else {
      if (level === 2) {
        d['Municipality/City'] = props.Municipali || name;
        if (props.Province || props.PROVINCE) d['Province'] = props.Province || props.PROVINCE;
        if (props.PSGC) d['PSGC'] = String(props.PSGC);
        if (props.CENR_Cov) d['CENRO'] = props.CENR_Cov;
        if (props.X_Coord && props.Y_Coord) {
          d['Coordinates'] = `${(+props.Y_Coord).toFixed(4)}, ${(+props.X_Coord).toFixed(4)}`;
        }
      } else if (level === 1) {
        d['Province'] = props.PROVINCE || props.Province || name;
        if (props.PSGC_P) d['PSGC'] = String(props.PSGC_P);
        if (props.REGION) d['Region'] = props.REGION;
        const cc = childCount(props._id);
        if (cc !== null) d['Municipalities'] = String(cc);
      } else {
        d['Region'] = props.Region || 'Cordillera Administrative Region';
        if (props.PSGC) d['PSGC'] = String(props.PSGC);
        const cc = childCount(props._id);
        if (cc !== null) d['Provinces'] = String(cc);
      }
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
    if (this.state.activeSource === 'cad') {
      if (level === 1) return props.Province || props.REGION || '';
      return 'Cordillera Administrative Region';
    }
    if (level === 2) return props.Province || props.PROVINCE || 'Province';
    if (level === 1) return 'Province — Cordillera Administrative Region';
    return 'Watershed Cradle of Northern Luzon';
  },

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

  _escHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  },
};

const EVENTS = {
  FEATURE_SELECT: 'feature:select',
  FEATURE_CLEAR: 'feature:clear',
};
