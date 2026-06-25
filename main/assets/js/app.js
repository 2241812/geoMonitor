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
    activeWatershedIds: [],
    watershedIntersections: null,
    hierarchy: null,
    activeSource: 'namria',
    activeMode: 'explore',
    viewMode: 'watersheds', /* 'watersheds' or 'boundaries' */
    watershedsActive: false,
    watershedLayer: null,
    /* Hydro drill-down state (watersheds view mode only) */
    hydroDrillLevel: 0, /* 0 = basins overview, 1 = drilled into a basin's sub-watersheds */
    hydroSelectedBasin: null, /* { name, folder, code, feature } */
    hydroLayers: [null, null, null],
    watershedOutlineLayer: null, /* L.geoJSON for the merged watershed outline (R3) */
    hydroShowBoundary: true,
    hydroBoundaryLayer: null,
    hydroAdminOutlineLayer: null,
    hydroSilhouetteLayer: null,
    _hydroSilhouetteGeo: null,
    hydroActiveFilterIds: [],
    hydroSelectedZone: null, /* currently isolated sub-watershed zone feature */
    hydroSelectedZoneLayer: null, /* leaflet layer of the isolated zone */
    zoneIntersections: null, /* loaded from zone-intersections.json */
    showStreamOrder: false,
    adminLayers: {},
    boundaryMenuOpen: false,
  },

  config: {
    mapCenter: [17.3, 121.0],
    mapZoom: 8.5,
    minZoom: 5,
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
      0: { fill: '#059669', stroke: '#0f172a', weight: 2.5 },
      1: { fill: '#2563eb', stroke: '#000000', weight: 2 },
      2: { fill: '#d97706', stroke: '#000000', weight: 1.5 },
      highlight: { fill: '#000000', stroke: '#000000', weight: 3 },
      watershed: { fill: '#0ea5e9', stroke: '#0284c7', weight: 2, fillOpacity: 0.35 },
      watershedHighlight: { fill: '#0ea5e9', stroke: '#0369a1', weight: 4, fillOpacity: 0.55 },
    },

    watershedConnections: {
      "Abra River Watershed": "West Philippine Sea",
      "Abulug River Watershed": "Babuyan Channel",
      "Agno River Watershed": "Lingayen Gulf",
      "Amburayan River Watershed": "South China Sea",
      "Aringay River Watershed": "Lingayen Gulf",
      "Bayogao River Watershed": "South China Sea",
      "Bued River Watershed": "Lingayen Gulf",
      "Cabicungan River Watershed": "Babuyan Channel",
      "Mallig River Watershed": "Cagayan River",
      "Naguilian River Watershed": "West Philippine Sea",
      "Santa Maria River Watershed": "West Philippine Sea",
      "Siffu River Watershed": "Cagayan River",
      "Upper Chico River Watershed": "Cagayan River",
      "Upper Magat River Watershed": "Cagayan River",
      "Zumigui-Ziwanan River Watershed": "Babuyan Channel"
    },

    watershedDescriptions: {
      "Upper Chico River Watershed": "The Upper Chico River Watershed is a major headwater system for the Chico River, flowing through the Cordillera mountains and primarily draining into the Cagayan River Basin. It plays a critical role in supporting local agriculture and the region's indigenous communities.",
      "Upper Magat River Watershed": "This watershed forms the upper reaches of the Magat River, a vital tributary of the Cagayan River. It is characterized by steep mountainous terrain and is essential for supplying water to the Magat Dam, which supports large-scale irrigation and hydroelectric power generation.",
      "Siffu River Watershed": "The Siffu River Watershed spans the eastern slopes of the Cordillera Central, eventually draining into the Magat River. It serves as an important agricultural water source for the surrounding lowland communities.",
      "Mallig River Watershed": "A significant sub-basin of the Cagayan River system, the Mallig River Watershed covers portions of Kalinga and Mountain Province, delivering vital surface water to the agricultural plains below.",
      "Zumigui-Ziwanan River Watershed": "Also known as the Pamplona or Manucotae watershed, this river system primarily drains northward towards the Babuyan Channel. It features dense forest cover and is critical for maintaining the region's hydrological balance.",
      "Abra River Watershed": "The Abra River Watershed is the largest river basin in the Ilocos Region, originating from the slopes of Mount Data in the Cordillera Central. It carves a deep valley westward before emptying into the West Philippine Sea.",
      "Naguilian River Watershed": "The Naguilian River Watershed flows westward from the mountains of Benguet, directly draining into the West Philippine Sea. It is a smaller but essential basin supporting local municipalities along the La Union coast.",
      "Aringay River Watershed": "Originating from the rugged terrains of Benguet, the Aringay River Watershed runs westward into the Lingayen Gulf. The basin is characterized by varied topography and supports diverse local ecosystems.",
      "Zumiqui-Ziwanan River Watershed": "Pamplona River",
      "Abulug River Watershed": "The Abulug River Watershed is the second largest river system in the Cagayan Valley region, originating from the Apayao highlands and draining northward into the Babuyan Channel. It plays a critical role in supporting diverse ecosystems and local agricultural irrigation.",
      "Agno River Watershed": "Originating from the slopes of Mount Data, the Agno River Watershed is one of the largest river systems in Luzon. It flows southward through the Cordillera mountains before winding its way across the plains of Pangasinan to drain into the Lingayen Gulf, providing vital hydroelectric power and irrigation.",
      "Amburayan River Watershed": "The Amburayan River flows from the tri-boundary of Benguet, La Union, and Ilocos Sur, serving as a historic natural boundary. It empties into the South China Sea and is essential for the region's agricultural plains and surrounding communities.",
      "Bayogao River Watershed": "The Bayogao River Watershed is a coastal basin situated along the western slopes of the Cordillera mountains, draining directly into the South China Sea. It provides critical water resources for local coastal municipalities.",
      "Bued River Watershed": "The Bued River Watershed originates in the mountains of Baguio City and flows down through Benguet and Pangasinan to the Lingayen Gulf. The basin is characterized by steep slopes and is a key water source for surrounding urban and rural areas.",
      "Cabicungan River Watershed": "The Cabicungan River Watershed spans the northern territories of Apayao, draining towards the Babuyan Channel. It supports dense forest cover and rich biodiversity in the northernmost reaches of the Cordillera.",
      "Santa Maria River Watershed": "The Santa Maria River Watershed flows through the western slopes of the Cordilleras and into the Ilocos region, discharging into the West Philippine Sea. It sustains the agricultural livelihoods of downstream communities."
    },

    /* Maps each watershed Name to its subfolder + code for fetching sub-watershed/stream GeoJSON */
    hydroBasinFolderMap: {
      "Abra River Watershed": { folder: "Abra Riverbasin", code: "ABR" },
      "Abulug River Watershed": { folder: "Apayao-Abulug Riverbasin", code: "ABU" },
      "Agno River Watershed": { folder: "Agno Riverbasin", code: "AGN" },
      "Bayogao River Watershed": { folder: "Amburayan River", code: "AMB" },
      "Aringay River Watershed": { folder: "Aringay River", code: "ARI" },
      "Bued River Watershed": { folder: "Bued River", code: "BUD" },
      "Cabicungan River Watershed": { folder: "Cabicungan River", code: "CAB" },
      "Mallig River Watershed": { folder: "Mallig River", code: "MLG" },
      "Naguilian River Watershed": { folder: "Naguilian River", code: "NAG" },
      "Siffu River Watershed": { folder: "Siffu River", code: "SIF" },
      "Santa Maria River Watershed": { folder: "Santa Maria River (Silag)", code: "SMR" },
      "Upper Chico River Watershed": { folder: "Upper Chico Riverbasin", code: "UCH" },
      "Upper Magat River Watershed": { folder: "Upper Magat River", code: "UMT" },
      "Zumigui-Ziwanan River Watershed": { folder: "Zumigui-Ziwanan River", code: "ZUM" },
    },

    /* 14-color palette — one per basin, indexed by _hydroBasinIndex() */
    hydroLevelColors: [
      '#e11d48', '#0891b2', '#7c3aed', '#d97706',
      '#059669', '#2563eb', '#db2777', '#0d9488',
      '#ca8a04', '#4f46e5', '#ea580c', '#16a34a',
      '#9333ea', '#0284c7',
    ],

    /* Basin picker groups (by outflow destination) */
    hydroBasinGroups: [
      { title: 'Cagayan River Basin', basins: [
        'Upper Chico River Watershed', 'Upper Magat River Watershed',
        'Siffu River Watershed', 'Mallig River Watershed', 'Zumigui-Ziwanan River Watershed',
      ]},
      { title: 'West Philippine Sea', basins: [
        'Abra River Watershed', 'Bayogao River Watershed',
        'Naguilian River Watershed', 'Aringay River Watershed', 'Santa Maria River Watershed',
      ]},
      { title: 'Lingayen Gulf', basins: [
        'Agno River Watershed', 'Bued River Watershed',
      ]},
      { title: 'Babuyan Channel', basins: [
        'Abulug River Watershed', 'Cabicungan River Watershed',
      ]},
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

  _src() {
    return this.config.sources[this.state.activeSource];
  },

  /* ── Init ────────────────────────────────── */
  init() {
    document.body.classList.add('mode-explore');
    document.body.classList.add('mode-' + this.state.viewMode); /* R2: initial body class for source-toggle */

    const map = L.map('map', {
      center: this.config.mapCenter,
      zoom: this.config.mapZoom,
      minZoom: this.config.minZoom,
      maxZoom: this.config.maxZoom,
      maxBounds: this.config.maxBounds,
      zoomAnimation: true,
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
    
    fetch('geoJSON/watershed-intersections.json')
      .then(r => r.json())
      .then(w => { this.state.watershedIntersections = w; })
      .catch(() => {});

    fetch('geoJSON/zone-intersections.json')
      .then(r => r.json())
      .then(z => { this.state.zoneIntersections = z; })
      .catch(() => {});
      
    // Prefetch watershed data for area lookups and hydro mode
    fetch('geoJSON/CAR Watersheds.geojson')
      .then(r => r.json())
      .then(d => {
        if (!this.state.rawData['watershed']) this.state.rawData['watershed'] = d;
        /* If we start in watersheds view mode, enter hydro mode now that data is ready */
        if (this.state.viewMode === 'watersheds') this._enterHydroMode();
      })
      .catch(() => {});

    /* Prevent mobile info-panel swipes from moving the map */
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) {
      L.DomEvent.disableClickPropagation(infoPanel);
      L.DomEvent.disableScrollPropagation(infoPanel);
    }

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

    /* Close dropdowns on any map click */
    map.on('click', () => {
      const opts = document.getElementById('basemap-options');
      if (opts) opts.classList.remove('show');
      const wsOpts = document.getElementById('watershed-options');
      if (wsOpts) wsOpts.classList.remove('show');
      this._closeBoundaryMenu();
    });

    /* Click empty space → drill up one level (both modes) */
    map.on('click', () => {
      if (this.state._drilling) return;

      /* Hydro mode: clicking empty space deselects isolated zone first, then drills back to basin overview */
      if (this.state.viewMode === 'watersheds' && this.state.hydroDrillLevel >= 1) {
        if (this.state.hydroSelectedZone) {
          this._deselectSubWatershed();
          return;
        }
        this._hydroDrillUp(0);
        return;
      }

      /* If currently viewing a watershed overlay in admin mode, clicking empty space deselects */
      if (this.state.lastViewed && this.state.lastViewed.isWatershed) {
         if (this.state.selectedPath && this.state.selectedPath.length > 0) {
           const lastBoundary = this.state.selectedPath[this.state.selectedPath.length - 1];
           this._clearWatershedHighlightAndReturn(lastBoundary.level);
         }
         return;
      }
      
      if (this.state.currentLevel === 0 && this.state.selectedPath.length === 0) {
        return;
      }
      if (this.state.currentLevel >= 1) {
        this.drillUp(this.state.currentLevel - 1);
      }
    });

    /* Keep the map sized correctly when the viewport changes
       (mobile address bar show/hide, fullscreen toggle, orientation). */
    let _resizeTimer = null;
    window.addEventListener('resize', () => {
      if (_resizeTimer) clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(() => {
        if (this.state.map) this.state.map.invalidateSize();
      }, 150);
    });
    /* Also invalidate after the loading overlay is hidden */
    window.addEventListener('load', () => {
      if (this.state.map) this.state.map.invalidateSize();
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

    this.state.activeSource = name;
    this._loadHierarchy();
    this._updateBreadcrumb();

    /* Update the bottom-center source toggle buttons */
    document.querySelectorAll('.source-toggle-btn').forEach(btn => {
      if (btn.id === `btn-${name}`) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    /* In watersheds mode, hydro layers are source-independent (basins +
       sub-watersheds + stream order don't change between NAMRIA/CAD).
       Only the Spans chips and boundary overlay layers depend on source,
       so just refresh the boundary overlays + the current panel. */
    if (this.state.viewMode === 'watersheds') {
      /* Clear any active admin outline from a spans chip click */
      if (this.state.hydroAdminOutlineLayer && this.state.map) {
        this.state.map.removeLayer(this.state.hydroAdminOutlineLayer);
        this.state.hydroAdminOutlineLayer = null;
      }
      document.querySelectorAll('.span-chip.active').forEach(c => c.classList.remove('active'));

      this._refreshBoundaryOverlays();
      /* Re-render the current panel so chips reflect the new source */
      if (this.state.hydroSelectedZone) {
        this._openSubWatershedPanel(this.state.hydroSelectedZone);
      } else if (this.state.hydroSelectedBasin && this.state.hydroSelectedBasin.feature) {
        this._openWatershedPanel(this.state.hydroSelectedBasin.feature);
      }
      return;
    }

    /* Admin boundaries mode: full reload of layers + cached data */
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
    const wasOpen = this.state.panelState === 'open' || this.state.panelState === 'peek';

    this._resetWatershedState();

    window.initLayers().then(() => {
      if (wasOpen) {
        const carData = this.state.rawData[0];
        if (carData && carData.features && carData.features[0]) {
          this._openAdminPanel(carData.features[0], 0);
        }
      }
    });
  },

  /* Refresh admin boundary overlay layers (bottom-left dropdown) to match
     the current activeSource. Used after a source switch in watersheds mode. */
  _refreshBoundaryOverlays() {
    /* Remove existing boundary overlay layers */
    Object.values(this.state.adminLayers).forEach(l => {
      if (l && this.state.map) this.state.map.removeLayer(l);
    });
    this.state.adminLayers = {};

    /* Always clear ALL cached raw admin data — NAMRIA uses levels 0/1/2,
       CAD uses 0/1. Stale levels from the previous source must not linger
       (e.g. NAMRIA's rawData[2] must be wiped when switching to CAD), even
       when no overlay checkbox is currently checked, so that a later Spans
       chip tap doesn't render the other source's geometry. */
    this.state.rawData = {};

    /* Reload raw admin data for the new source, then re-add checked overlays */
    const checkboxes = document.querySelectorAll('#boundary-options input[type="checkbox"]:checked');
    if (checkboxes.length === 0) return;

    const src = this._src();
    const typesToReload = [...new Set([...checkboxes].map(cb => cb.dataset.type).filter(Boolean))];

    /* Collect the unique set of levels we need to load for the new source */
    const levelsToFetch = new Set();
    typesToReload.forEach(type => {
      if (type === 'region') levelsToFetch.add(0);
      else if (type === 'province' && src.maxLevel >= 2) levelsToFetch.add(1);
      else if (type === 'municipality') levelsToFetch.add(src.maxLevel);
    });

    /* In CAD mode, province has no geometry — uncheck it so it doesn't
       silently linger and confuse the UI. */
    if (src.maxLevel < 2) {
      const provCb = document.querySelector('#boundary-options input[data-type="province"]');
      if (provCb) provCb.checked = false;
    }

    /* Fetch each needed level, then re-add overlays once all data is loaded */
    const pending = [...levelsToFetch].filter(lvl => src.geoJSON[lvl]);
    let loaded = 0;
    pending.forEach(lvl => {
      fetch(src.geoJSON[lvl])
        .then(r => r.json())
        .then(d => {
          this.state.rawData[lvl] = d;
          loaded++;
          if (loaded === pending.length) {
            /* All levels loaded — re-add every checked overlay */
            typesToReload.forEach(type => {
              if (type === 'province' && src.maxLevel < 2) return;
              this._addBoundaryLayer(type);
            });
          }
        })
        .catch(() => {});
    });
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
    if (opts) opts.classList.remove('show');
  },

  _toggleBasemap() {
    const wsOpts = document.getElementById('watershed-options');
    if (wsOpts) wsOpts.classList.remove('show');
    this._closeBoundaryMenu();

    const opts = document.getElementById('basemap-options');
    if (!opts) return;
    opts.classList.toggle('show');
  },

  /* ── Drill DOWN ──────────────────────────────── */

  /* ── Drill UP (both modes) ─────────────────── */

  /* ── Show a level (with optional parent filter) ── */

  /* ── Filter GeoJSON to parent boundary ─────── */
  _filterToParent(data, childLevel, parentFeature) {
    const parentId = parentFeature.properties._id;
    if (!parentId) return { ...data, features: [] };
    return { ...data, features: data.features.filter(f => f.properties._parentId === parentId) };
  },

  /* ── Dynamic map padding to avoid panel ── */
  _getPaddingOpts() {
    const isMobile = window.innerWidth <= 640;
    return {
      paddingTopLeft: [isMobile ? 40 : 420, 40],
      paddingBottomRight: [40, isMobile ? (window.innerHeight * 0.4 + 40) : 40]
    };
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
      fillColor: styleConfig ? styleConfig.fill : this.config.colors[level].fill,
      fillOpacity: 0.65,
      color: '#000000',
      weight: 3,
      opacity: 1,
      dashArray: null,
    });
    leafletLayer.bringToFront();
  },

  /* ── Isolate selected feature: highlight it, hide all others at this level ── */

  /* ── Highlight selection via dim (max-level click) ── */
  _highlightAndDim(feature, leafletLayer, level) {
    this._dimLevel(level, feature);
    this.state._selectedFeature = feature;
    this.state._selectedLevel = level;
    this.state._selectedLeafletLayer = leafletLayer;

    /* Zoom to selected feature (gentler, capped zoom with smooth animation) */
    if (leafletLayer && leafletLayer.getBounds) {
      this.state.map.flyToBounds(leafletLayer.getBounds(), {
        padding: [150, 150],
        maxZoom: 10,
        duration: 0.45,
        easeLinearity: 0.25,
      });
    }

    /* Update breadcrumb */
    const name = this._featureName(feature, level);
    this.state.selectedPath = this.state.selectedPath.filter(item => item.level < level);
    this.state.selectedPath.push({ level, feature, name });
    this._updateBreadcrumb();
  },

  /* ── Clear selection ──────────────────────────── */
  _clearSelection() {
    this._hideHoverLabel();
    if (this.state._selectedLevel != null) {
      this._resetLevelStyle(this.state._selectedLevel);
      this.state._selectedFeature = null;
      this.state._selectedLevel = null;
      this.state._selectedLeafletLayer = null;
    }
    this.closePanel();
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
    const fillOpacity = 0;
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

  /* ── Hover label ──────────────────────────── */
  _showHoverLabel(feature, level) {
    const lbl = document.getElementById('map-hover-label');
    if (!lbl) return;
    const name = this._featureName(feature, level);
    lbl.innerHTML = `<span class="label-level">${this._src().levelNames[level]}</span>${this._escHtml(this._toTitleCase(name))}`;
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
    for (let lvl = this._src().maxLevel; lvl > 0; lvl--) {
      if (this.state.layers[lvl]) {
        this.state.map.removeLayer(this.state.layers[lvl]);
        this.state.layers[lvl] = null;
      }
    }
    this._showLevel(0);
    this.state.currentLevel = 0;
    if (this.state.layers[0]) {
      this.state.map.flyToBounds(this.state.layers[0].getBounds(), {
        ...this._getPaddingOpts(),
        duration: 0.45,
        easeLinearity: 0.25,
      });
    }
    /* Show admin picker in boundaries mode, CAR info otherwise */
    if (this.state.viewMode === 'boundaries') {
      const carData = this.state.rawData[0];
      if (carData && carData.features && carData.features[0]) {
        this._showBoundaryPicker(carData.features[0], 0);
      }
    } else {
      const carData = this.state.rawData[0];
      if (carData && carData.features && carData.features[0]) {
        this._openAdminPanel(carData.features[0], 0);
      }
    }
    this._updateBreadcrumb();
    this._updateOutlines();
  },

  /* ── Mode switch ──────────────────────────── */
  _setMode(mode) {
    if (mode === this.state.activeMode) return;
    
    document.body.classList.remove('mode-explore', 'mode-boundary');
    document.body.classList.add('mode-' + mode);
    
    this._clearSelection();
    this.closePanel();

    if (this.state.activeOutline !== null) {
      this._hideOutline(this.state.activeOutline);
      this._restoreDrillLayer(this.state.activeOutline);
    }
    this.state.activeOutline = null;
    this.state._outlineHighlight = null;

    this.state.activeMode = mode;
    if (mode === 'boundary') {
      this._resetLevelStyle(0);
      if (this.state.layers[1]) this._resetLevelStyle(1);
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
      this.state.currentLevel = 0;
    }
    this._updateBreadcrumb();
  },

  /* ── Breadcrumb ───────────────────────────── */
  _updateBreadcrumb() {
    const bc = document.getElementById('map-breadcrumb');
    if (!bc) return;

    let html = '';

    /* ── Hydro mode breadcrumb ── */
    if (this.state.viewMode === 'watersheds') {
      html += `<button class="breadcrumb-item ${this.state.hydroDrillLevel === 0 ? 'active' : 'clickable'}" onclick="APP._hydroDrillUp(0)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
        Basins
      </button>`;

      if (this.state.hydroDrillLevel >= 1 && this.state.hydroSelectedBasin) {
        html += `<span class="breadcrumb-sep">›</span>`;
        const shortName = this.state.hydroSelectedBasin.name.replace(/ River Watershed$/, '');
        const hasZone = !!this.state.hydroSelectedZone;
        html += `<button class="breadcrumb-item ${hasZone ? 'clickable' : 'active'}" ${hasZone ? `onclick="APP._deselectSubWatershed()"` : ''}>${this._escHtml(shortName)}</button>`;
        if (this.state.hydroSelectedZone) {
          const gc = this.state.hydroSelectedZone.properties.gridcode;
          html += `<span class="breadcrumb-sep">›</span>`;
          html += `<button class="breadcrumb-item active">Zone ${gc != null ? gc : '?'}</button>`;
        }
      }

      bc.innerHTML = html;
      return; /* No outline toggles in hydro mode */
    }

    /* ── Admin boundary mode breadcrumb ── */
    const src = this._src();

    /* Mode switch buttons */
    html += `<button class="mode-toggle${this.state.activeMode === 'explore' ? ' active' : ''}" onclick="APP._setMode('explore')" title="Explore mode — click to select, map click deselects">Explore</button>`;
    html += `<button class="mode-toggle${this.state.activeMode === 'boundary' ? ' active' : ''}" onclick="APP._setMode('boundary')" title="Boundary mode — click to drill down through hierarchy">Boundary</button>`;

    /* Breadcrumb trail (both modes) */
    const atRoot = this.state.selectedPath.length === 0;

    /* Root: "CAR" */
    html += `<button class="breadcrumb-item ${atRoot ? 'active' : 'clickable'}" onclick="APP.drillUp(0)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      CAR
    </button>`;

    this.state.selectedPath.forEach((item, idx) => {
      if (item.level === 0) return; /* Skip level 0, root handles it */
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

    const src = this._src();
    const active = this.state.activeOutline;

    const items = [
      { mode: null, label: 'None', icon: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' },
    ];
    if (src.maxLevel >= 1) {
      items.push({ mode: 1, label: src.levelNames[1], icon: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' });
    }
    if (src.maxLevel >= 2) {
      items.push({ mode: 2, label: src.levelNames[2], icon: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="4" y="10" width="16" height="11" rx="1"/><path d="M8 6l4-4 4 4"/></svg>' });
    }

    container.innerHTML =
      '<div class="boundary-controls">' +
      items.map(({ mode, label, icon }) =>
        `<button class="boundary-option${active === mode ? ' active' : ''}" onclick="APP._setBoundaryMode(${mode === null ? 'null' : mode})">${icon}<span>${this._escHtml(label)}</span></button>`
      ).join('') +
      '</div>';
  },

  _setBoundaryMode(level) {
    const src = this._src();
    const max = src.maxLevel;
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
        const name = self._featureName(feature, level);
        
        layer.on('mouseover', function () {
          if (level < self.state.currentLevel) return;
          self._showHoverLabel(feature, level);
        });

        layer.on('mouseout', function () {
          if (level < self.state.currentLevel) return;
          self._hideHoverLabel();
        });

        layer.on('click', function (e) {
          L.DomEvent.stopPropagation(e);
          if (self.state._drilling) return;
          if (self.state._outlineHighlight) {
            self.state.outlineLayers[level].resetStyle(self.state._outlineHighlight);
          }
          const cfg = self.config.colors[level];
          layer.setStyle({ fillColor: cfg.fill, fillOpacity: 0.35, color: '#000000', weight: 3, opacity: 1 });
          layer.bringToFront();
          self.state._outlineHighlight = layer;
          self._openAdminPanel(feature, level);
          if (self.state.activeMode === 'boundary' && level === self.state.currentLevel) {
            if (level < self._src().maxLevel) {
              self.drillDown(feature, layer);
            } else {
              self._highlightAndDim(feature, layer, level);
            }
          } else if (layer && layer.getBounds) {
            self.state.map.flyToBounds(layer.getBounds(), {
              padding: [40, 40],
              duration: 0.45,
              easeLinearity: 0.25,
            });
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
      /* Don't dim drill layer at the same level — let both coexist for full visibility */
      if (this.state.activeOutline !== this.state.currentLevel) {
        this._dimDrillLayer(this.state.activeOutline);
      }
    }
  },

  /* ── Info Panel ───────────────────────────── */

  closePanel() {
    const panel = document.getElementById('info-panel');
    if (!panel) return;
    
    panel.classList.remove('open', 'expanded', 'peek');
    panel.classList.add('closed');
    this.state.panelState = 'closed';
    document.body.classList.remove('panel-open', 'panel-expanded');
    const tab = document.getElementById('panel-toggle-tab');
    if (tab) tab.classList.remove('hidden');

    const hero = document.getElementById('panel-hero');
    if (hero) hero.innerHTML = '';

    this._updatePanelToggleIcon();
    
    if (this.state._chart) {
      this.state._chart.destroy();
      this.state._chart = null;
    }
  },

  togglePanel() {
    const panel = document.getElementById('info-panel');
    if (!panel) return;
    const isMobile = window.innerWidth <= 640;
    
    if (isMobile) {
      if (panel.classList.contains('open')) {
        this.closePanel();
      } else if (panel.classList.contains('peek')) {
        panel.classList.remove('peek');
        panel.classList.add('open');
        document.body.classList.add('panel-open');
      } else if (this.state.lastViewed) {
        if (this.state.lastViewed.isWatershed) {
          this._openWatershedPanel(this.state.lastViewed.feature);
        } else {
          this._openAdminPanel(this.state.lastViewed.feature, this.state.lastViewed.level);
        }
      } else {
        this.closePanel();
      }
    } else {
      if (panel.classList.contains('open')) {
        this.closePanel();
      } else if (this.state.lastViewed) {
        if (this.state.lastViewed.isWatershed) {
          this._openWatershedPanel(this.state.lastViewed.feature);
        } else {
          this._openAdminPanel(this.state.lastViewed.feature, this.state.lastViewed.level);
        }
      } else {
        /* Default: show CAR region details */
        const carData = this.state.rawData[0];
        if (carData && carData.features && carData.features[0]) {
          this._openAdminPanel(carData.features[0], 0);
        }
      }
    }
  },

  toggleExpandedPanel(skipPan = false) {
    const panel = document.getElementById('info-panel');
    const btn = document.querySelector('.show-more-btn');
    if (!panel) return;
    const isExpanded = panel.classList.contains('expanded');
    
    const panelCheckboxes = panel.querySelectorAll('.panel-ws-checkbox');

    if (isExpanded) {
      panel.classList.remove('expanded');
      document.body.classList.remove('panel-expanded');
      if (btn) btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View Watersheds on Map`;
      
      /* Turn off all visible watersheds in the panel */
      const promises = [];
      panelCheckboxes.forEach(cb => {
        if (cb.checked) {
          cb.checked = false;
          cb.dataset.autoChecked = 'false';
          promises.push(this.updateWatersheds(cb));
        }
      });
      
      Promise.all(promises).then(() => {
        if (skipPan) return;
        if (this.state._selectedLeafletLayer && this.state._selectedLeafletLayer.getBounds) {
          this.state.map.flyToBounds(this.state._selectedLeafletLayer.getBounds(), {
            ...this._getPaddingOpts(),
            duration: 0.45,
            easeLinearity: 0.25
          });
        }
      });
    } else {
      panel.classList.add('expanded');
      document.body.classList.remove('panel-expanded');
      document.body.classList.add('panel-expanded');
      if (btn) btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> Hide Watersheds`;
      
      /* Turn on all unchecked watersheds */
      const promises = [];
      panelCheckboxes.forEach(cb => {
        if (!cb.checked) {
          cb.checked = true;
          cb.dataset.autoChecked = 'true';
          promises.push(this.updateWatersheds(cb));
        }
      });
      
      Promise.all(promises).then(() => {
        if (skipPan) return;
        if (this.state.watershedLayer && this.state.activeWatershedIds.length > 0) {
          let activeBounds = L.latLngBounds([]);
          this.state.watershedLayer.eachLayer(layer => {
            const name = layer.feature.properties.Name || layer.feature.properties.Old_Name || '';
            if (this.state.activeWatershedIds.includes(name)) {
              activeBounds.extend(layer.getBounds());
            }
          });
          
          if (activeBounds.isValid()) {
            this.state.map.flyToBounds(activeBounds, {
              ...this._getPaddingOpts(),
              duration: 0.45,
              easeLinearity: 0.25
            });
          }
        }
      });
    }
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
  toggleFullscreen() {
    const btn = document.getElementById('map-fullscreen-btn');
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      if (btn) btn.title = 'Exit fullscreen';
    } else {
      document.exitFullscreen().catch(() => {});
      if (btn) btn.title = 'Enter fullscreen';
    }
    const updateIcon = () => {
      if (btn) {
        const isFull = !!document.fullscreenElement;
        btn.innerHTML = isFull
          ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>'
          : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
        btn.title = isFull ? 'Exit fullscreen' : 'Enter fullscreen';
      }
    };
    document.addEventListener('fullscreenchange', updateIcon, { once: true });
    setTimeout(updateIcon, 100);
    /* Map needs to recalculate its size after entering/leaving fullscreen */
    setTimeout(() => { if (this.state.map) this.state.map.invalidateSize(); }, 250);
  },

  /* ── View Mode Toggle: Watersheds / Boundaries ── */
  _setViewMode(mode) {
    if (mode === this.state.viewMode) return;
    if (this.state._drilling) return;
    this.state.viewMode = mode;

    /* Update body class for source-toggle visibility (R2) */
    document.body.classList.remove('mode-watersheds', 'mode-boundaries');
    document.body.classList.add('mode-' + mode);

    document.querySelectorAll('.view-toggle-btn').forEach(btn => btn.classList.remove('active'));
    const btnId = mode === 'watersheds' ? 'btn-view-watersheds' : 'btn-view-boundaries';
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');

    if (mode === 'watersheds') {
      document.body.classList.add('watersheds-mode');
      document.body.classList.remove('boundaries-mode');
      this._updatePanelHeader();

      this._clearAdminOverlays();
      this._enterHydroMode();
    } else {
      document.body.classList.add('boundaries-mode');
      document.body.classList.remove('watersheds-mode');
      this._updatePanelHeader();

      this._clearHydroState();
      
      /* Only restore if returning to boundaries mode after initial load */
      if (this.state.currentLevel === null && this.state.rawData[0]) {
        this._showLevel(0);
      } else {
        this._showLevel(this.state.currentLevel);
      }
      
      if (this.state.currentLevel === 0 || this.state.currentLevel === null) {
        const carData = this.state.rawData[0];
        if (carData && carData.features && carData.features[0]) {
          this._openAdminPanel(carData.features[0], 0);
        }
      }
    }
  },

  /* ── Hydro Mode: enter, render basins ── */

  /* Index of a basin in hydroBasinFolderMap (for color assignment) */

  /* ── Silhouette system (merged outline for level 0) ── */

  /* Compute the dissolved outer boundary of all 14 basins (cached).
     Uses the pre-computed CAR Watersheds Outline.geojson when available. */


  /* Remove the silhouette outline layer */

  /* Click on silhouette at Level 0 → reveal 14 individual basins */

  /* Render the 14 major basins as interactive colored polygons (hydro level 0) */

  /* Apply checkbox filter to the basin overview layer.
     - When hydroActiveFilterIds is empty: all basins shown normally.
     - When non-empty: only checked basins keep full color; others are hidden (fillOpacity 0, faint outline). */

  /* Drill into a basin: load sub-watersheds + stream order */

  /* Fetch + render sub-watersheds (hydroLayers[1]) and stream order (hydroLayers[2]) */

  /* ── Sub-watershed zone isolation ── */

  /* Select a sub-watershed zone: isolate it visually and open its detail panel */

  /* Deselect the current sub-watershed zone and return to the basin detail panel */

  /* Dim all sub-watershed zones except the selected one */

  /* Restore all sub-watershed zones to their normal style */

  /* ── Zone-level admin boundary spans ── */

  /* Look up zone-specific admin boundary spans from zoneIntersections.
     Key format: "<basinCode>:<gridcode>" e.g. "AGN:27"
     Uses activeSource ('namria' or 'cad') to pick the right intersection set. */

  /* Toggle stream order overlay on/off */

  /* ── Boundary Overlay Menu ── */

  _toggleBoundaryMenu() {
    const baseOpts = document.getElementById('basemap-options');
    if (baseOpts) baseOpts.classList.remove('show');
    const wsOpts = document.getElementById('watershed-options');
    if (wsOpts) wsOpts.classList.remove('show');
    this.state.boundaryMenuOpen = !this.state.boundaryMenuOpen;
    const menu = document.getElementById('boundary-options');
    if (menu) menu.classList.toggle('show', this.state.boundaryMenuOpen);
  },

  _closeBoundaryMenu() {
    this.state.boundaryMenuOpen = false;
    const menu = document.getElementById('boundary-options');
    if (menu) menu.classList.remove('show');
  },

  async _toggleBoundaryLayer(type, checkbox) {
    if (checkbox.checked) {
      await this._addBoundaryLayer(type);
    } else {
      this._removeBoundaryLayer(type);
    }
  },

  async _addBoundaryLayer(type) {
    if (this.state.adminLayers[type]) return;
    let lvl;
    const src = this._src();
    const useCad = this.state.activeSource === 'cad';
    if (type === 'region') {
      lvl = 0;
    } else if (type === 'province') {
      if (src.maxLevel < 2) return;
      lvl = 1;
    } else if (type === 'municipality') {
      lvl = src.maxLevel;
    } else {
      return;
    }
    /* Use source-prefixed cache key to avoid stale cross-source data;
       fall back to plain level key for backward compat with _refreshBoundaryOverlays */
    const cacheKey = (useCad ? 'cad:' : 'namria:') + lvl;
    let data = this.state.rawData[cacheKey] || this.state.rawData[lvl];
    if (!data) {
      try {
        const resp = await fetch(src.geoJSON[lvl]);
        if (!resp.ok) throw new Error('Failed to load');
        data = await resp.json();
        this.state.rawData[cacheKey] = data;
      } catch (_) {
        return;
      }
    }
    const styleMap = {
      region: { color: '#1f2937', weight: 2.5, fillOpacity: 0, opacity: 0.85 },
      province: { color: '#374151', weight: 2, fillOpacity: 0, opacity: 0.85 },
      municipality: { color: '#4b5563', weight: 1.5, fillOpacity: 0, opacity: 0.75 },
    };
    this.state.adminLayers[type] = L.geoJSON(data, {
      style: styleMap[type],
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(this._featureName(feature, lvl), { sticky: true, direction: 'top' });
      },
    }).addTo(this.state.map);
  },

  /* Remove all admin boundary layers */
  _clearAdminOverlays() {
    for (let lvl = this._src().maxLevel; lvl >= 0; lvl--) {
      if (this.state.layers[lvl]) {
        this.state.map.removeLayer(this.state.layers[lvl]);
        this.state.layers[lvl] = null;
      }
    }
    this.state.selectedPath = [];
    this.state.currentLevel = 0;
  },

  _removeBoundaryLayer(type) {
    if (this.state.adminLayers[type]) {
      this.state.map.removeLayer(this.state.adminLayers[type]);
      this.state.adminLayers[type] = null;
    }
  },

  /* Drill back up to the basins overview */

  /* Remove all hydro layers from the map */

  /* Full reset of hydro state (used when switching to Boundaries mode) */

  /* ── Toggle CAR boundary outline in hydro mode ── */

  /* ── Basin Picker Panel (mobile-friendly tappable list) ── */

  /* ── R1: Boundary Picker Panel (Boundary mode, level 0) ── */

  /* Click handler for boundary picker items — mimics the map polygon click pattern */

  /* Highlight a child boundary on the map when its chip is clicked */

  /* Helper: drill down by basin name (called from basin picker list) */

  /* ── Sub-watershed Panel ── */

  /* Back button from sub-watershed panel → return to basin detail panel */

  /* ── Watershed ↔ boundary cross-reference ── */

  /* Convert an ALL-CAPS string to Title Case (e.g. "MOUNTAIN PROVINCE" → "Mountain Province") */
  _toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  },

  /* Force Zone A (the white header bar) to match the current global mode.
     Called at the top of every panel-open method so the header is never stale. */
  _updatePanelHeader() {
    const mode = this.state.viewMode;
    const labelEl = document.getElementById('panel-header-label');
    if (labelEl) {
      labelEl.textContent = mode === 'watersheds' ? 'Watershed Monitor' : 'Administrative Boundaries';
    }
    const iconEl = document.getElementById('panel-header-icon');
    if (iconEl) {
      iconEl.innerHTML = mode === 'watersheds'
        ? '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'
        : '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>';
    }
  },

  /* Title-case a slug like "baay-licuan" → "Baay-Licuan", preserving known acronyms */
  _prettySlug(slug) {
    const acronyms = { car: 'CAR' };
    return slug.split('-').map(part => {
      if (acronyms[part]) return acronyms[part];
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join('-');
  },

  /* Invert watershedIntersections: for the given watershed name, return
     { provinces: [{slug,label}], municipalities: [{slug,label,province}] }
     Uses the new namria/cad per-watershed spans sections when available,
     falling back to the old boundary→watershed inversion for backward compat. */

  /* Render tappable chip list HTML for the Spans section.
     Filters out disputed-area placeholders ("X vs Y") that are not real LGUs. */
  _renderSpansChips(items, type) {
    const clean = items.filter(it => {
      const label = (it.label || '').toLowerCase();
      const slug = (it.slug || '').toLowerCase();
      return !slug.includes(' vs ') && !label.includes(' vs ');
    });
    if (!clean.length) return '<span class="span-empty">—</span>';
    return clean.map(it => {
      const escaped = this._escHtml(it.label).replace(/'/g, '&#39;');
      return `<button class="span-chip" onclick="APP._outlineAdminUnit('${type}','${this._escHtml(it.slug).replace(/'/g, '&#39;')}')">${escaped}</button>`;
    }).join('');
  },

  /* Render a small NAMRIA/CAD toggle for the side panel Spans section */
  _renderSourceToggleHTML() {
    const isNamria = this.state.activeSource === 'namria';
    return `
      <div class="span-source-toggle">
        <button class="source-toggle-pill${isNamria ? ' active' : ''}" onclick="APP._switchPanelSource('namria')">NAMRIA</button>
        <button class="source-toggle-pill${!isNamria ? ' active' : ''}" onclick="APP._switchPanelSource('cad')">CADASTRE</button>
      </div>`;
  },

  /* Switch source from inside the side panel — delegates to switchSource,
     which in watersheds mode refreshes boundary overlays + chips without
     resetting the current watershed/sub-watershed selection. */
  _switchPanelSource(name) {
    this.switchSource(name);
  },

  /* Toggle a province/municipality outline overlay on top of the current hydro view */
  async _outlineAdminUnit(type, slug) {
    const map = this.state.map;
    if (!map) return;

    /* If the same chip is tapped again, remove the outline */
    const chip = document.querySelector(`.span-chip[onclick*="'${type}','${slug}'"]`);
    if (this.state.hydroAdminOutlineLayer && chip && chip.classList.contains('active')) {
      map.removeLayer(this.state.hydroAdminOutlineLayer);
      this.state.hydroAdminOutlineLayer = null;
      chip.classList.remove('active');
      return;
    }

    const useCad = this.state.activeSource === 'cad';
    /* In CAD mode there is no separate province level — province outlines are
       derived by dissolving the municipal features that share the Province.
       CAD municipalities also live at level 1 (maxLevel=1), not level 2.
       Use a source-prefixed cache key so stale data from the other source is
       never reused after a source switch in watershed mode. */
    const adminLvl = useCad ? 1 : (type === 'province' ? 1 : 2);
    const cacheKey = (useCad ? 'cad:' : 'namria:') + adminLvl;

    if (!this.state.rawData[cacheKey]) {
      try {
        const url = useCad
          ? 'geoJSON/CAR CAD Municipal Boundary.geojson'
          : 'geoJSON/CAR NAMRIA ' + (adminLvl === 1 ? 'Provincial' : 'Municipal') + ' Boundary.geojson';
        const resp = await fetch(url);
        this.state.rawData[cacheKey] = await resp.json();
      } catch (_) {
        this._showToast('Failed to load boundary data');
        return;
      }
    }
    const boundaryData = this.state.rawData[cacheKey];

    /* Resolve the target feature(s) for the slug. CAD provinces may need
       multiple municipal features dissolved into one outline. */
    let targetFeature = null;
    let targetFeatures = null;
    const norm = s => (s || '').toLowerCase().replace(/-/g, ' ').trim();
    const wantSlug = type === 'province' ? slug : slug.split(':').pop();

    if (useCad && type === 'province') {
      /* CAD province: gather all municipal features whose Province slug matches */
      const features = (boundaryData.features || []).filter(f => {
        const provSlug = (f.properties || {}).Province.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        return provSlug === slug;
      });
      if (features.length) targetFeatures = features;
    } else {
      const features = (boundaryData.features || []);
      targetFeature = features.find(f => (f.properties || {})._id === slug);
      if (!targetFeature) {
        /* Fallback: match by normalized name */
        const want = norm(wantSlug);
        targetFeature = features.find(f => {
          const p = f.properties || {};
          if (type === 'province') return norm(p.PROVINCE || p.Province || p.NAME_1) === want;
          return norm(p.Municipali || p.NAME_2 || p.Muni_City) === want;
        });
      }
    }

    const outlineData = targetFeatures
      ? { type: 'FeatureCollection', features: targetFeatures }
      : (targetFeature ? targetFeature : null);
    if (!outlineData) {
      this._showToast('Boundary not found for ' + slug);
      return;
    }

    /* Remove previous outline */
    if (this.state.hydroAdminOutlineLayer) {
      map.removeLayer(this.state.hydroAdminOutlineLayer);
    }
    document.querySelectorAll('.span-chip.active').forEach(c => c.classList.remove('active'));

    this.state.hydroAdminOutlineLayer = L.geoJSON(outlineData, {
      interactive: false,
      style: { color: '#dc2626', weight: 2.5, fillOpacity: 0.06, dashArray: '5 3', opacity: 0.9 },
    }).addTo(map);
    this.state.hydroAdminOutlineLayer.bringToFront();
    if (chip) chip.classList.add('active');

    /* Fly to the outlined unit */
    try {
      map.flyToBounds(this.state.hydroAdminOutlineLayer.getBounds(), { ...this._getPaddingOpts(), duration: 0.45, easeLinearity: 0.25 });
    } catch (_) {}
  },


  /* ── Watershed Overlay Toggle ───────────── */





};

const EVENTS = {
  FEATURE_SELECT: 'feature:select',
  FEATURE_CLEAR: 'feature:clear',
};

// ==========================================
// SECURITY FEATURES
// ==========================================

// Prevent common screenshot shortcuts
document.addEventListener('keyup', (e) => {
  if (e.key === 'PrintScreen') {
    if (navigator.clipboard) {
      navigator.clipboard.writeText('');
    }
    alert('Screenshots and screen recording are disabled on this page due to sensitive data.');
  }
});

// Prevent Print (Ctrl+P, Cmd+P) and Save (Ctrl+S, Cmd+S)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
    e.preventDefault();
    alert('Printing is disabled on this page.');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
  }
  
  // Mac screenshot shortcuts (Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) {
    e.preventDefault();
    if (navigator.clipboard) {
      navigator.clipboard.writeText('');
    }
  }
});

// Blur the application when it loses focus (mitigates background screen recording)
window.addEventListener('blur', () => {
  const mapApp = document.querySelector('.map-app');
  if (mapApp) {
    mapApp.style.filter = 'blur(10px)';
    mapApp.style.transition = 'filter 0.2s';
  }
});

window.addEventListener('focus', () => {
  const mapApp = document.querySelector('.map-app');
  if (mapApp) {
    mapApp.style.filter = 'none';
  }
});
