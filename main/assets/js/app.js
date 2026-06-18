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
    watershedsActive: false,
    watershedLayer: null,
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
      0: { fill: '#059669', stroke: '#000000', weight: 3 },
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

    const map = L.map('map', {
      center: this.config.mapCenter,
      zoom: this.config.mapZoom,
      minZoom: this.config.minZoom,
      maxZoom: this.config.maxZoom,
      maxBounds: this.config.maxBounds,
      zoomAnimation: true,
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
    });

    /* Click empty space → drill up one level (both modes) */
    map.on('click', () => {
      if (this.state._drilling) return;
      
      /* If currently viewing a watershed, clicking empty space should just deselect the watershed and return to boundary view */
      if (this.state.lastViewed && this.state.lastViewed.isWatershed) {
         if (this.state.selectedPath && this.state.selectedPath.length > 0) {
           const lastBoundary = this.state.selectedPath[this.state.selectedPath.length - 1];
           this._clearWatershedHighlightAndReturn(lastBoundary.level);
         }
         return;
      }
      
      if (this.state.currentLevel === 1 && this.state.selectedPath.length === 0) {
        this.closePanel();
        return;
      }
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
    const wasOpen = this.state.panelState === 'open' || this.state.panelState === 'peek';

    this._resetWatershedState();
    
    this.state.activeSource = name;
    this._loadHierarchy();
    this._updateBreadcrumb();
    
    document.querySelectorAll('.source-toggle-btn').forEach(btn => {
      if (btn.id === `btn-${name}`) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    window.initLayers().then(() => {
      if (wasOpen) {
        const carData = this.state.rawData[0];
        if (carData && carData.features && carData.features[0]) {
          this.openPanel(carData.features[0], 0);
        }
      }
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
    
    const opts = document.getElementById('basemap-options');
    if (!opts) return;
    opts.classList.toggle('show');
  },

  /* ── Drill DOWN ──────────────────────────────── */
  async drillDown(feature, leafletLayer) {
    if (this.state._drilling) return;
    this.state._drilling = true;
    this._hideHoverLabel();
    try {
      const currentLevel = this.state.currentLevel;
      if (currentLevel >= this._src().maxLevel) return;

      const nextLevel = currentLevel + 1;
      const name = this._featureName(feature, currentLevel);

      this.state.selectedPath = this.state.selectedPath.filter(item => item.level < currentLevel);
      this.state.selectedPath.push({ level: currentLevel, feature, name });

      /* Clear selection state so it doesn't leak into the deeper level */
      this.state._selectedFeature = null;
      this.state._selectedLevel = null;
      this.state._selectedLeafletLayer = null;

      this._resetWatershedState();

      this.state.currentLevel = nextLevel;

      /* Parent context → thin dashed outline ("you are inside this boundary") */
      if (currentLevel > 0 && this.state.layers[currentLevel]) {
        if (currentLevel === 1) {
          this._updateSmartFilters(feature.properties._id);
        }
        
        const cfg = this.config.colors[currentLevel];
        this.state.layers[currentLevel].eachLayer(function(lf) {
          if (lf.feature === feature) {
            lf.setStyle({ fillOpacity: 0, color: cfg.fill, weight: 2.5, opacity: 0.7, dashArray: '8 4' });
            lf.bringToFront();
          } else {
            lf.setStyle({ fillOpacity: 0, opacity: 0, weight: 0 });
          }
        });
        this.state.layers[currentLevel]._hiddenByDrill = true;
      }

      /* At max level: remove level 0 (CAR boundary) so it doesn't clutter */
      if (nextLevel >= this._src().maxLevel && this.state.layers[0]) {
        this.state.map.removeLayer(this.state.layers[0]);
        this.state.layers[0] = null;
      }

      this._updateBreadcrumb();

      /* Fly into the selected feature with smooth animation */
      if (leafletLayer && leafletLayer.getBounds) {
        this.state.map.flyToBounds(leafletLayer.getBounds(), {
          ...this._getPaddingOpts(),
          duration: 0.8,
          easeLinearity: 0.25,
        });
      }

      /* Delayed child reveal: render children after zoom starts settling */
      await new Promise(r => setTimeout(r, 800));
      await this._showLevel(nextLevel, feature, currentLevel);

      this._updateOutlines();
    } finally {
      this.state._drilling = false;
    }
  },

  /* ── Drill UP (both modes) ─────────────────── */
  async drillUp(targetLevel) {
    if (this.state._drilling) return;
    this.state._drilling = true;
    this._hideHoverLabel();
    try {
      if (typeof targetLevel !== 'number' || targetLevel < 0) targetLevel = 0;

      /* Clear selection state */
      this.state._selectedFeature = null;
      this.state._selectedLevel = null;
      this.state._selectedLeafletLayer = null;

      this._resetWatershedState();

      if (targetLevel === 0) {
        this._updateSmartFilters(null);
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
        /* Jump back to CAR bounds without animation */
        if (this.state.layers[0]) {
          this.state.map.flyToBounds(this.state.layers[0].getBounds(), {
            ...this._getPaddingOpts(),
            duration: 0.8,
            easeLinearity: 0.25
          });
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
      if (targetLevel <= 1) {
        this._updateSmartFilters(null);
      } else {
        const provItem = this.state.selectedPath.find(i => i.level === 1);
        if (provItem) this._updateSmartFilters(provItem.feature.properties._id);
      }

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

      /* Jump to target without animation */
      if (targetLevel > 0 && this.state.selectedPath.length > 0) {
        const lastItem = this.state.selectedPath[this.state.selectedPath.length - 1];
        const levelLayer = this.state.layers[targetLevel];
        if (levelLayer) {
          levelLayer.eachLayer((lf) => {
            if (lf.feature === lastItem.feature) {
              const targetBounds = lf.getBounds();
              this.state.map.flyToBounds(targetBounds, {
                ...this._getPaddingOpts(),
                duration: 0.8,
                easeLinearity: 0.25
              });
            }
          });
        }
      } else if (targetLevel === 0 && this.state.layers[0]) {
        /* Jump to region reset */
        const regionBounds = this.state.layers[0].getBounds();
        this.state.map.flyToBounds(regionBounds, {
          ...this._getPaddingOpts(),
          duration: 0.8,
          easeLinearity: 0.25
        });
      }

      /* Show the feature at target level in panel and KEEP IT HIGHLIGHTED */
      if (targetLevel > 0 && this.state.selectedPath.length > 0) {
        const lastItem = this.state.selectedPath[this.state.selectedPath.length - 1];
        this.openPanel(lastItem.feature, lastItem.level);
        
        this.state._selectedFeature = lastItem.feature;
        this.state._selectedLevel = lastItem.level;

        const layer = this.state.layers[targetLevel];
        if (layer) {
          /* Restore normal un-highlighted state for all first */
          this._resetLevelStyle(targetLevel);
          layer._hiddenByDrill = false;
          
          /* Highlight the active one with a dashed colored outline (parent context style) */
          const cfg = this.config.colors[targetLevel];
          layer.eachLayer((lf) => {
            if (lf.feature === lastItem.feature) {
              this.state._selectedLeafletLayer = lf;
              lf.setStyle({ fillOpacity: 0, color: cfg.fill, weight: 2.5, opacity: 0.7, dashArray: '8 4' });
              lf.bringToFront();
            }
          });
        }
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
        fillOpacity: 0,
        color: styleConfig.stroke,
        weight: styleConfig.weight,
        opacity: 0.9,
        className: 'fade-in-path',
        dashArray: null,
      }),

      onEachFeature(feature, leafletLayer) {
        if (level === 0) return;

        const name = self._featureName(feature, level);

        if (useHover) {
          leafletLayer.on('mouseover', function (e) {
            if (level !== self.state.currentLevel) return;
            if (e.target._hiddenByIsolation) return;
            if (self.state.activeOutline === level) return;
            
            self._showHoverLabel(name, level);
            
            /* Do not alter style if this feature is currently selected */
            if (self.state._selectedFeature === feature) return;

            e.target.setStyle({ fillColor: styleConfig.fill, fillOpacity: 0.35, weight: styleConfig.weight + 1, dashArray: null });
            e.target.bringToFront();
          });
          leafletLayer.on('mouseout', function (e) {
            if (level !== self.state.currentLevel) return;
            if (e.target._hiddenByIsolation) return;
            if (self.state.activeOutline === level) return;
            
            self._hideHoverLabel();

            /* Do not clear highlight if this feature is currently selected */
            if (self.state._selectedFeature === feature) return;

            e.target.setStyle({
              fillColor: styleConfig.fill,
              fillOpacity: 0,
              color: styleConfig.stroke,
              weight: styleConfig.weight,
              opacity: 0.9,
              dashArray: null,
            });
          });
        }

          leafletLayer.on('click', function (e) {
            L.DomEvent.stopPropagation(e);
            
            /* If currently viewing a watershed, clicking a map feature should just deselect the watershed and return to boundary view */
            if (self.state.lastViewed && self.state.lastViewed.isWatershed) {
              if (self.state.selectedPath && self.state.selectedPath.length > 0) {
                const lastBoundary = self.state.selectedPath[self.state.selectedPath.length - 1];
                self._clearWatershedHighlightAndReturn(lastBoundary.level);
              }
              return;
            }
            
            if (self.state.activeWatershedIds && self.state.activeWatershedIds.length > 0) return;
            if (self.state.activeOutline === level) return;
            /* Clicked on a parent level → drill up to it */
            if (level < self.state.currentLevel) {
              self.drillUp(level);
              return;
            }
            if (level !== self.state.currentLevel) return;
            if (e.target._hiddenByIsolation) {
              /* Clicking a dimmed feature at deepest level → drill up */
              self.drillUp(level - 1);
              return;
            }

            /* If a feature is already selected at this level, and we click a DIFFERENT one, 
               treat it as 'clicking outside' to deselect and drill up, rather than instantly switching. */
            if (self.state._selectedFeature && self.state._selectedFeature !== feature) {
              self.drillUp(level - 1);
              return;
            }

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
          fillColor: cfg.fill,
          fillOpacity: 0.65,
          color: '#000000',
          weight: 3,
          opacity: 1,
          dashArray: null,
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

    /* Zoom to selected feature (gentler, capped zoom with smooth animation) */
    if (leafletLayer && leafletLayer.getBounds) {
      this.state.map.flyToBounds(leafletLayer.getBounds(), {
        padding: [150, 150],
        maxZoom: 10,
        duration: 0.8,
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

  _resetLevelStyle(level) {
    const layer = this.state.layers[level];
    if (!layer) return;
    const cfg = this.config.colors[level];
    layer.eachLayer(function(leafletLayer) {
      delete leafletLayer._hiddenByIsolation;
      leafletLayer.setStyle({
        fillColor: cfg.fill,
        color: cfg.stroke,
        weight: cfg.weight,
        opacity: 0.9,
        fillOpacity: 0.25,
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
      this.state.map.flyToBounds(this.state.layers[0].getBounds(), {
        ...this._getPaddingOpts(),
        duration: 0.8,
        easeLinearity: 0.25,
      });
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
          self._showHoverLabel(name, level);
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
          self.openPanel(feature, level);
          if (self.state.activeMode === 'boundary' && level === self.state.currentLevel) {
            if (level < self._src().maxLevel) {
              self.drillDown(feature, layer);
            } else {
              self._highlightAndDim(feature, layer, level);
            }
          } else if (layer && layer.getBounds) {
            self.state.map.flyToBounds(layer.getBounds(), {
              padding: [40, 40],
              duration: 0.8,
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
  openPanel(feature, level) {
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('info-panel-content');
    if (!panel || !content) return;

    document.body.classList.add('panel-open');
    document.body.classList.remove('panel-expanded');
    panel.classList.remove('expanded');
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

    /* Add Map Legend to Side Panel */
    html += `<div class="panel-section">
      <div class="panel-section-title">Legend</div>
      <div class="panel-legend">
        <div class="legend-item"><span class="legend-dot region-dot"></span>Region</div>
        <div class="legend-item"><span class="legend-dot province-dot"></span>Province</div>
        <div class="legend-item"><span class="legend-dot muni-dot"></span>Municipality</div>
      </div>
    </div>`;

    /* Add Show More Button and Expanded Content */
    let expandedHtml = '';
    const id = props._id;
    if (level >= 1 && this.state.watershedIntersections && id && this.state.watershedIntersections[id]) {
      const intersectingWs = this.state.watershedIntersections[id];
      if (intersectingWs.length > 0) {
        expandedHtml = `<div class="expanded-content">
          <div class="panel-section-title">Intersecting Watersheds</div>
          <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 12px; margin-top: -4px;">The following watersheds have been highlighted on the map:</p>
          <div class="watershed-list">
            ${intersectingWs.map(ws => `
              <div class="watershed-list-item">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; width: 100%;">
                  <input type="checkbox" class="panel-ws-checkbox" value="${this._escHtml(ws)}" onchange="APP.updateWatersheds(this)" ${this.state.activeWatershedIds && this.state.activeWatershedIds.includes(ws) ? 'checked' : ''} style="accent-color: #0284c7; width: 16px; height: 16px;">
                  <span style="font-weight: 500;">${this._escHtml(ws)}</span>
                </label>
              </div>
            `).join('')}
          </div>
        </div>`;
      }
    }

    if (expandedHtml) {
      html += `<div class="panel-show-more">
        <button class="show-more-btn view-ws-btn" onclick="APP.toggleExpandedPanel()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          View Watersheds on Map
        </button>
      </div>`;
      html += expandedHtml;
    }

    content.innerHTML = html;
    panel.classList.remove('open');
    panel.classList.add('open');
    this.state.panelState = 'open';

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
              y: { type: 'logarithmic', ticks: { font: { size: 10 }, color: '#6b7280' }, grid: { color: 'rgba(0,0,0,0.05)' } },
              x: { ticks: { font: { size: 10 }, color: '#6b7280' }, grid: { display: false } },
            },
          },
        });
      }
    }
  },

  closePanel() {
    const panel = document.getElementById('info-panel');
    if (!panel) return;
    
    /* If it was expanded, reset to non-expanded without panning */
    if (panel.classList.contains('expanded')) {
      this.toggleExpandedPanel(true);
    }
    
    document.body.classList.remove('panel-open', 'panel-expanded');
    panel.classList.remove('open', 'peek', 'expanded');
    this.state.panelState = 'closed';
    
    /* Show toggle tab */
    const tab = document.getElementById('panel-toggle-tab');
    if (tab) tab.classList.remove('hidden');
    
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
          this.openPanel(this.state.lastViewed.feature, this.state.lastViewed.level);
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
          this.openPanel(this.state.lastViewed.feature, this.state.lastViewed.level);
        }
      } else {
        /* Default: show CAR region details */
        const carData = this.state.rawData[0];
        if (carData && carData.features && carData.features[0]) {
          this.openPanel(carData.features[0], 0);
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
            duration: 0.8,
            easeLinearity: 0.25
          });
        } else if (this.state.map) {
          this.state.map.panBy([58, 0], {animate: true, duration: 0.3});
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
          const bounds = this.state.watershedLayer.getBounds();
          if (bounds && bounds.isValid()) {
            this.state.map.flyToBounds(bounds, {
              ...this._getPaddingOpts(),
              duration: 0.8,
              easeLinearity: 0.25
            });
          }
        } else if (this.state.map) {
          this.state.map.panBy([-58, 0], {animate: true, duration: 0.3});
        }
      });
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
      if (level === 1) {
        d['Municipality/City'] = props.Muni_City || name;
        if (props.Province) d['Province'] = props.Province;
      } else {
        d['Region'] = props.Region || 'Cordillera Administrative Region';
      }
      if (props.Region || props.REGION) d['Region'] = props.Region || props.REGION;
      if (props.Remarks && props.Remarks.trim()) d['Remarks'] = props.Remarks.trim();
    } else {
      if (level === 2) {
        d['Municipality/City'] = props.Municipali || name;
        if (props.Province || props.PROVINCE) d['Province'] = props.Province || props.PROVINCE;
        if (props.CENR_Cov) d['CENRO'] = props.CENR_Cov;
        if (props.X_Coord && props.Y_Coord) {
          d['Coordinates'] = `${(+props.Y_Coord).toFixed(4)}, ${(+props.X_Coord).toFixed(4)}`;
        }
      } else if (level === 1) {
        d['Province'] = props.PROVINCE || props.Province || name;
        if (props.REGION) d['Region'] = props.REGION;
        const cc = childCount(props._id);
        if (cc !== null) d['Municipalities'] = String(cc);
      } else {
        d['Region'] = props.Region || 'Cordillera Administrative Region';
        const cc = childCount(props._id);
        if (cc !== null) d['Provinces'] = String(cc);
      }
    }
    
    const sqMeters = parseFloat(props.Shape_Area || props.AREA || 0);
    if (sqMeters > 0) d['Square Meters'] = sqMeters.toLocaleString(undefined, { maximumFractionDigits: 2 });
    
    let hectares = parseFloat(props.Hectares || props.Area || 0);
    if (hectares <= 0 && sqMeters > 0) hectares = sqMeters / 10000;
    if (hectares > 0) d['Hectares'] = hectares.toLocaleString(undefined, { maximumFractionDigits: 2 });
    
    const perimeter = parseFloat(props.Shape_Length || props.PERIMETER || 0);
    if (perimeter > 0) d['Perimeter'] = perimeter.toLocaleString(undefined, { maximumFractionDigits: 2 });
    
    return d;
  },

  _resolveChartData(props) {
    const labels = [], values = [];
    const sqMeters = parseFloat(props.Shape_Area || props.AREA || 0);
    if (sqMeters > 0) { labels.push('Square Meters'); values.push(sqMeters); }
    
    let hectares = parseFloat(props.Hectares || props.Area || 0);
    if (hectares <= 0 && sqMeters > 0) hectares = sqMeters / 10000;
    if (hectares > 0) { labels.push('Hectares'); values.push(hectares); }
    
    const perimeter = parseFloat(props.Shape_Length || props.PERIMETER || 0);
    if (perimeter > 0) { labels.push('Perimeter'); values.push(perimeter); }
    
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
  },

  /* ── Watershed Overlay Toggle ───────────── */
  toggleWatershedMenu() {
    const baseOpts = document.getElementById('basemap-options');
    if (baseOpts) baseOpts.classList.remove('show');
    
    const opts = document.getElementById('watershed-options');
    if (!opts) return;
    opts.classList.toggle('show');
  },

  _resetWatershedState() {
    this.state.activeWatershedIds = [];
    if (this.state.watershedLayer) {
      this.state.map.removeLayer(this.state.watershedLayer);
      this.state.watershedLayer = null;
    }
    const wsBtn = document.getElementById('watershed-btn');
    if (wsBtn) wsBtn.classList.remove('active');
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
  },

  async updateWatersheds(checkbox) {
    const val = checkbox.value;

    /* Sync all checkboxes with this value across the DOM */
    document.querySelectorAll(`input[type="checkbox"][value="${val}"]`).forEach(cb => {
      if (cb !== checkbox) cb.checked = checkbox.checked;
    });

    if (checkbox.checked) {
      if (!this.state.activeWatershedIds.includes(val)) {
        this.state.activeWatershedIds.push(val);
      }
    } else {
      this.state.activeWatershedIds = this.state.activeWatershedIds.filter(id => id !== val);
    }

    const btn = document.getElementById('watershed-btn');
    if (btn) btn.classList.toggle('active', this.state.activeWatershedIds.length > 0);

    // Initial load if needed
    if (!this.state.watershedLayer && this.state.activeWatershedIds.length > 0) {
      if (this.state._fetchingWatersheds) {
        await this.state._fetchingWatersheds;
      } else {
        this.state._fetchingWatersheds = (async () => {
          try {
            const response = await fetch('geoJSON/CAR Watersheds.geojson');
            const data = await response.json();
            this.state.rawData['watershed'] = data;

            // Instantiate all layers once, without a filter
            this.state.watershedLayer = L.geoJSON(data, {
              style: this.config.colors.watershed,
              onEachFeature: (feature, layer) => {
                layer.on({
                  mouseover: (e) => {
                    if (e.target._isHidden) return; // Ignore hidden layers
                    if (this.state._outlineHighlight !== e.target) {
                      const style = Object.assign({}, this.config.colors.watershedHighlight);
                      style.weight = 3;
                      e.target.setStyle(style);
                    }
                    const p = feature.properties;
                    const name = p.Name || p.Old_Name || 'Unknown Watershed';
                    const lbl = document.getElementById('map-hover-label');
                    if (lbl) {
                      lbl.innerHTML = `<span class="label-level">Watershed</span>${this._escHtml(name)}`;
                      lbl.classList.add('visible');
                      lbl.style.display = ''; /* Clear any inline display */
                    }
                  },
                  mouseout: (e) => {
                    if (e.target._isHidden) return;
                    if (this.state._outlineHighlight !== e.target) {
                      this.state.watershedLayer.resetStyle(e.target);
                    }
                    const lbl = document.getElementById('map-hover-label');
                    if (lbl) {
                      lbl.classList.remove('visible');
                      lbl.style.display = ''; /* Clear any inline display */
                    }
                  },
                  click: (e) => {
                    if (e.target._isHidden) return;
                    L.DomEvent.stopPropagation(e);
                    if (this.state._outlineHighlight) {
                      this.state.watershedLayer.resetStyle(this.state._outlineHighlight);
                    }
                    this.state._outlineHighlight = e.target;
                    e.target.setStyle(this.config.colors.watershedHighlight);
                    this.state.map.flyToBounds(e.target.getBounds(), {
                      ...this._getPaddingOpts(),
                      duration: 0.6,
                      easeLinearity: 0.25
                    });
                    this._openWatershedPanel(feature);
                  }
                });
              }
            });

            // Store array of all child layers for quick filtering
            this.state._allWatershedChildLayers = [];
            this.state.watershedLayer.eachLayer(layer => {
              layer._isHidden = true; // default to hidden
              this.state._allWatershedChildLayers.push(layer);
            });

          } catch (err) {
            console.error("Failed to load watersheds:", err);
          }
        })();
        await this.state._fetchingWatersheds;
        this.state._fetchingWatersheds = null;
      }
    }

    if (this.state.watershedLayer) {
      if (this.state.activeWatershedIds.length > 0) {
        if (!this.state.map.hasLayer(this.state.watershedLayer)) {
          this.state.map.addLayer(this.state.watershedLayer);
        }
        
        // Fast layer toggling
        this.state.watershedLayer.clearLayers();
        this.state._allWatershedChildLayers.forEach(layer => {
          const name = layer.feature.properties.Name || layer.feature.properties.Old_Name || '';
          if (this.state.activeWatershedIds.includes(name)) {
            layer._isHidden = false;
            this.state.watershedLayer.addLayer(layer);
          } else {
            layer._isHidden = true;
          }
        });
        
        this.state.watershedLayer.bringToFront();
      } else {
        this.state.map.removeLayer(this.state.watershedLayer);
        // Clear highlighted outline from watershed if any
        if (this.state._outlineHighlight) {
          this.state.watershedLayer.resetStyle(this.state._outlineHighlight);
          this.state._outlineHighlight = null;
        }
      }
      
      if (this.state.lastViewed && this.state.lastViewed.isWatershed) {
        this.closePanel();
      }
    }
  },

  _updateSmartFilters(provinceId) {
    if (!this.state.watershedIntersections) return;
    let allowed = null;
    if (provinceId && this.state.watershedIntersections[provinceId]) {
      allowed = this.state.watershedIntersections[provinceId];
    }
    
    const options = document.querySelectorAll('.watershed-option');
    options.forEach(opt => {
      const checkbox = opt.querySelector('input');
      if (!checkbox) return;
      
      if (allowed) {
        if (allowed.includes(checkbox.value)) {
          opt.classList.remove('dimmed');
        } else {
          opt.classList.add('dimmed');
          if (checkbox.checked) {
            checkbox.checked = false;
            this.updateWatersheds(checkbox);
          }
        }
      } else {
        opt.classList.remove('dimmed');
      }
    });
  },

  _clearWatershedHighlightAndReturn(level) {
    if (this.state._outlineHighlight && this.state.watershedLayer) {
      this.state.watershedLayer.resetStyle(this.state._outlineHighlight);
      this.state._outlineHighlight = null;
    }
    const lastBoundary = this.state.selectedPath.find(p => p.level === level);
    if (lastBoundary) {
      this.openPanel(lastBoundary.feature, lastBoundary.level);
      if (this.state._wasExpandedBeforeWatershed) {
        this.toggleExpandedPanel();
      } else if (this.state._selectedLeafletLayer && this.state._selectedLeafletLayer.getBounds) {
        this.state.map.flyToBounds(this.state._selectedLeafletLayer.getBounds(), {
          ...this._getPaddingOpts(),
          duration: 0.8,
          easeLinearity: 0.25
        });
      }
    }
  },

  _openWatershedPanel(feature) {
    const p = feature.properties;
    const name = p.Name || p.Old_Name || 'Unknown Watershed';
    const id = p.WSID || p.UNQ_ID || '';
    const connectsTo = this.config.watershedConnections[name] || 'Unknown';
    
    // Store in global state for chart and panel toggle
    this.state.lastViewed = { feature, isWatershed: true };
    
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('info-panel-content');
    
    this.state._wasExpandedBeforeWatershed = panel.classList.contains('expanded');
    
    let backButtonHTML = '';
    if (this.state.selectedPath && this.state.selectedPath.length > 0) {
      const lastBoundary = this.state.selectedPath[this.state.selectedPath.length - 1];
      backButtonHTML = `<button onclick="APP._clearWatershedHighlightAndReturn(${lastBoundary.level})" style="background:none;border:none;color:#0ea5e9;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;gap:4px;padding:0;margin-bottom:12px;font-weight:500;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back to ${this._escHtml(lastBoundary.name)}
      </button>`;
    }
    
    const html = `
      <div class="panel-hero">
        ${backButtonHTML}
        <div class="panel-badge-row" style="display:flex; align-items:center;">
          <span class="panel-badge">Watershed</span>
          <span class="panel-id-code" style="margin-left:8px;">${this._escHtml(id)}</span>
        </div>
        <h2 class="panel-title">${this._escHtml(name)}</h2>
        <p class="panel-subtitle">Hydrological Boundary</p>
      </div>

      <div class="panel-section">
        <div class="panel-section-title">Connectivity</div>
        <div class="stat-grid" style="grid-template-columns: 1fr;">
          <div class="stat-box" style="background: #eff6ff; border-color: #bfdbfe;">
            <div class="stat-label" style="color: #1e40af;">Connects To / Outflow</div>
            <div class="stat-value" style="color: #1e3a8a; font-size: 1.1rem;">${this._escHtml(connectsTo)}</div>
          </div>
        </div>
      </div>

      <div class="panel-section">
        <div class="panel-section-title">Details</div>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="stat-label">Area (Ha)</div>
            <div class="stat-value">${p.Area_Ha ? p.Area_Ha.toLocaleString(undefined, {maximumFractionDigits:2}) : 'N/A'}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Size Category</div>
            <div class="stat-value" style="font-size: 0.85rem; line-height: 1.2;">${this._escHtml(p.SIZE_W || 'N/A')}</div>
          </div>
        </div>
        <div style="margin-top: 12px; font-size: 0.9rem; color: #4b5563;">
          <strong>Regions Spanned:</strong> ${this._escHtml(p.Region || 'N/A')}
        </div>
      </div>
      
      <div class="panel-section" style="font-size: 0.95rem; color: #374151; line-height: 1.6; border-top: 1px solid #e5e7eb; padding-top: 16px;">
        <div class="panel-section-title">Basin Overview</div>
        <p>${this._escHtml(this.config.watershedDescriptions[name] || 'Detailed geographical information for this watershed is currently being compiled by the DENR-CAR mapping team.')}</p>
      </div>
    `;

    content.innerHTML = html;
    
    document.body.classList.add('panel-open');
    document.body.classList.remove('panel-expanded');
    panel.classList.remove('expanded');
    panel.classList.remove('open', 'closed', 'peek');
    
    if (window.innerWidth <= 640) {
      panel.classList.add('peek');
      this.state.panelState = 'peek';
    } else {
      panel.classList.add('open');
      this.state.panelState = 'open';
    }
  },
};

const EVENTS = {
  FEATURE_SELECT: 'feature:select',
  FEATURE_CLEAR: 'feature:clear',
};
