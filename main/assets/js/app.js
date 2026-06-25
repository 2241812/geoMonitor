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

  config: {},

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
          this.openPanel(carData.features[0], 0);
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

      /* Ensure level 0 stays visible to frame the region at all levels */

      this._updateBreadcrumb();

      /* Fly into the selected feature with smooth animation, except for 0->1 where bounds are identical */
      if (currentLevel > 0 && leafletLayer && leafletLayer.getBounds) {
        this.state.map.flyToBounds(leafletLayer.getBounds(), {
          ...this._getPaddingOpts(),
          duration: 0.45,
          easeLinearity: 0.25,
        });
        /* Delayed child reveal: render children after zoom starts settling */
        await new Promise(r => setTimeout(r, 450));
      }

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
      const previousLevel = this.state.currentLevel;

      if (targetLevel === this.state.currentLevel) return;

      /* Clear selection state */
      this.state._selectedFeature = null;
      this.state._selectedLevel = null;
      this.state._selectedLeafletLayer = null;

      this._resetWatershedState();

      if (targetLevel === 0) {
        /* Open level 0 panel */
        const carData = this.state.rawData[0];
        if (carData && carData.features && carData.features[0]) {
          this.openPanel(carData.features[0], 0);
        }
        this._updateSmartFilters(null);
        for (let lvl = this._src().maxLevel; lvl > 0; lvl--) {
          if (this.state.layers[lvl]) {
            this.state.map.removeLayer(this.state.layers[lvl]);
            this.state.layers[lvl] = null;
          }
        }
        /* Restore levels 0 to full style */
        if (this.state.layers[0]) this._resetLevelStyle(0);
        this.state.selectedPath = [];
        this.state.currentLevel = 0;
        /* Only rebuild if layers don't exist yet (avoids visual flicker) */
        if (!this.state.layers[0]) await this._showLevel(0);
        this.state.currentLevel = 0;
        /* Jump back to CAR bounds, except when coming from level 1 where bounds are identical */
        if (this.state.layers[0] && previousLevel > 1) {
          this.state.map.flyTo(this.config.mapCenter, this.config.mapZoom, {
            duration: 0.45,
            easeLinearity: 0.25
          });
        }
        this._updateBreadcrumb();
        this._updateOutlines();
        return;
      }

      for (let lvl = this._src().maxLevel; lvl > targetLevel; lvl--) {
        if (this.state.layers[lvl]) {
          this.state.map.removeLayer(this.state.layers[lvl]);
          this.state.layers[lvl] = null;
        }
      }

      /* Restore context layer style (was dimmed during drillDown) */
      if (targetLevel === 1) {
        const provItem = this.state.selectedPath[0];
        if (provItem) this._updateSmartFilters(provItem.feature.properties._id);
      } else {
        this._updateSmartFilters(null);
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

      /* Jump to target */
      if (targetLevel > 0 && this.state.selectedPath.length > 0) {
        const lastItem = this.state.selectedPath[this.state.selectedPath.length - 1];
        const levelLayer = this.state.layers[targetLevel];
        if (levelLayer) {
          let found = false;
          levelLayer.eachLayer((lf) => {
            if (lf.feature === lastItem.feature) {
              found = true;
              const targetBounds = lf.getBounds();
              this.state.map.flyToBounds(targetBounds, {
                ...this._getPaddingOpts(),
                duration: 0.45,
                easeLinearity: 0.25
              });
            }
          });
          if (!found) {
            /* We are at a level (like level 1) where no specific child is selected */
            this.state.map.flyToBounds(levelLayer.getBounds(), {
              ...this._getPaddingOpts(),
              duration: 0.45,
              easeLinearity: 0.25
            });
          }
        }
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
      interactive: true,
      style: () => ({
        fillColor: styleConfig.fill,
        fillOpacity: level === 0 ? 0.15 : 0,
        color: styleConfig.stroke,
        weight: styleConfig.weight,
        opacity: 0.9,
        className: 'fade-in-path',
        dashArray: null,
      }),

      onEachFeature(feature, leafletLayer) {
        if (useHover) {
          leafletLayer.on('mouseover', function (e) {
            if (level !== self.state.currentLevel) return;
            if (e.target._hiddenByIsolation) return;
            if (self.state.activeOutline === level) return;
            
            self._showHoverLabel(feature, level);
            
            /* Do not alter style if this feature is currently selected */
            if (self.state._selectedFeature === feature) return;

            e.target.setStyle({ fillColor: styleConfig.fill, fillOpacity: level === 0 ? 0.15 : 0.35, weight: styleConfig.weight + 1, dashArray: null });
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
              fillOpacity: level === 0 ? 0.15 : 0,
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
        this.openPanel(carData.features[0], 0);
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

  /* ── Watershed ↔ boundary cross-reference ── */

  /* Convert an ALL-CAPS string to Title Case (e.g. "MOUNTAIN PROVINCE" → "Mountain Province") */
  _toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  },

  /* Title-case a slug like "baay-licuan" → "Baay-Licuan", preserving known acronyms */
  _prettySlug(slug) {
    const acronyms = { car: 'CAR' };
    return slug.split('-').map(part => {
      if (acronyms[part]) return acronyms[part];
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join('-');
  },

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
          duration: 0.45,
          easeLinearity: 0.25
        });
      }
    } else if (level === 0) {
      const carData = this.state.rawData[0];
      if (carData && carData.features && carData.features[0]) {
        this.openPanel(carData.features[0], 0);
        if (this.state.layers[0]) {
          this.state.map.flyToBounds(this.state.layers[0].getBounds(), {
            ...this._getPaddingOpts(),
            duration: 0.45,
            easeLinearity: 0.25
          });
        }
      }
    }
  },

  _openWatershedPanel(feature) {
    const p = feature.properties;
    const name = p.Name || p.Old_Name || 'Unknown Watershed';
    const id = p.WSID || p.UNQ_ID || '';
    const connectsTo = this.config.watershedConnections[name] || 'Unknown';

    /* Build the Spans section (only in hydro mode, where it's most useful) */
    let spansHTML = '';
    if (this.state.viewMode === 'watersheds') {
      const spans = this._watershedSpans(name);
      if (spans.provinces.length || spans.municipalities.length) {
        spansHTML = `
          <div class="panel-section">
            <div class="panel-section-title">Spans — Administrative Boundaries</div>
            ${this._renderSourceToggleHTML()}
            <div class="span-group">
              <div class="span-group-label">Provinces (${spans.provinces.length})</div>
              <div class="span-chip-row">${this._renderSpansChips(spans.provinces, 'province')}</div>
            </div>
            ${spans.municipalities.length ? `
            <div class="span-group">
              <div class="span-group-label">Municipalities (${spans.municipalities.length})</div>
              <div class="span-chip-row span-muni-scroll">${this._renderSpansChips(spans.municipalities, 'municipality')}</div>
            </div>` : ''}
            <p class="span-hint">Tap a unit to overlay its outline on the map.</p>
          </div>`;
      }
    }
    
    this.state.lastViewed = { feature, isWatershed: true };
    
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('info-panel-content');
    
    this.state._wasExpandedBeforeWatershed = panel.classList.contains('expanded');
    this._updatePanelHeader();
    
    let backButtonHTML = '';
    if (this.state.viewMode === 'watersheds' && this.state.hydroDrillLevel === 1) {
      /* In hydro mode — show "Back to Basins" button */
      backButtonHTML = `<button onclick="APP._hydroDrillUp(0)" class="panel-back-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back to All Basins
      </button>`;
    } else if (this.state.selectedPath && this.state.selectedPath.length > 0) {
      const lastBoundary = this.state.selectedPath[this.state.selectedPath.length - 1];
      backButtonHTML = `<button onclick="APP._clearWatershedHighlightAndReturn(${lastBoundary.level})" class="panel-back-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back to ${this._escHtml(lastBoundary.name)}
      </button>`;
    }
    
    const hero = document.getElementById('panel-hero');
    if (hero) {
      hero.className = 'panel-hero';
      hero.innerHTML = `${backButtonHTML}
        <div class="panel-badge-row" style="display:flex; align-items:center;">
          <span class="panel-badge">Watershed</span>
          <span class="panel-id-code" style="margin-left:8px;">${this._escHtml(id)}</span>
        </div>
        <h2 class="panel-title">${this._escHtml(name)}</h2>
        <p class="panel-subtitle">Hydrological Boundary</p>`;
    }

    const html = `
      <div class="panel-section">
        <div class="panel-section-title">Connectivity</div>
        <div class="stat-grid" style="grid-template-columns: 1fr;">
          <div class="stat-box" style="background: #eff6ff; border-color: #bfdbfe;">
            <div class="stat-label" style="color: #1e40af;">Connects To / Outflow</div>
            <div class="stat-value" style="color: #1e3a8a; font-size: 1.1rem;">${this._escHtml(connectsTo)}</div>
          </div>
        </div>
      </div>

      ${spansHTML}

      ${this.state.hydroDrillLevel === 1 ? `
      <div class="panel-section" style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
        <div class="panel-section-title">Map Overlays</div>
        <div class="toggle-row">
          <span>Stream Order</span>
          <label class="toggle-switch">
            <input type="checkbox" ${this.state.showStreamOrder ? 'checked' : ''} onchange="APP._toggleStreamOrder()">
            <span class="toggle-knob"></span>
          </label>
        </div>
      </div>` : ''}

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
