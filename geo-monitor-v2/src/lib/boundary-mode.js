/**
 * boundary-mode.js
 * Administrative boundary drill-down, level switching, outline toggles,
 * boundary picker UI, and highlight/isolation logic.
 *
 * Extracted from app.js + dashboard.js so that boundaries mode UI and
 * functionality can be modified independently from watershed/hydro code.
 */
import { APP } from './app.js';

Object.assign(APP, {
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
      this.state.rawData[geoKey] = window.decodeGeo(window.decodeGeo(await resp.json()));
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
  /* ── Filter GeoJSON to parent boundary ─────── */
  _filterToParent(data, childLevel, parentFeature) {
    const parentId = parentFeature.properties._id;
    if (!parentId) return { ...data, features: [] };
    return { ...data, features: data.features.filter(f => f.properties._parentId === parentId) };
  },

  /* ── Dynamic map padding to avoid panel ── */
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
  /* ── Background prefetch ── */
  async _prefetchLevel(level) {
    if (this.state.rawData[level]) return;
    try {
      const src = this._src();
      if (!src.geoJSON[level]) return;
      const resp = await fetch(src.geoJSON[level]);
      if (resp.ok) this.state.rawData[level] = window.decodeGeo(window.decodeGeo(await resp.json()));
    } catch (_) { }
  },

  /* ── Hover label ──────────────────────────── */
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
        data = window.decodeGeo(window.decodeGeo(await resp.json()));
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

  _heroSubtitle(props, level) {
    if (this.state.activeSource === 'cad') {
      if (level === 1) return props.Province || props.REGION || '';
      return 'Cordillera Administrative Region';
    }
    if (level === 2) return props.Province || props.PROVINCE || 'Province';
    if (level === 1) return 'Province — Cordillera Administrative Region';
    return 'Watershed Cradle of Northern Luzon';
  },


  /* ── R1: Boundary Picker Panel (Boundary mode, level 0) ── */
  _showBoundaryPicker(feature, level) {
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('info-panel-content');
    if (!panel || !content) return;

    this.state.lastViewed = null;
    this._updatePanelHeader();

    const src = this._src();
    const data = this.state.rawData[1];
    if (!data || !data.features) return;

    let groupHtml = '';

    if (src.maxLevel >= 2) {
      /* NAMRIA: provinces list — filter to CAR children */
      const provinces = this._filterToParent(data, 1, { properties: { _id: 'CAR' } });
      const header = `Provinces (${provinces.features.length})`;
      let itemsHtml = '';
      provinces.features.forEach(f => {
        const name = this._toTitleCase(this._featureName(f, 1));
        const id = f.properties._id;
        const muniCount = this.state.hierarchy?.children?.[id]?.length || 0;
        const areaM2 = parseFloat(f.properties.Shape_Area || 0);
        const areaStr = areaM2 > 0 ? (areaM2 / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' km²' : '';
        itemsHtml += `
          <button class="basin-picker-item" onclick="APP._drillBoundaryFromPicker('${this._escHtml(name)}', 1)">
            <div class="basin-picker-info">
              <span class="basin-picker-name">${this._escHtml(name)}</span>
              <span class="basin-picker-meta">
                ${muniCount ? `<span class="basin-size">${muniCount} municipalities</span>` : ''}
                ${areaStr ? `<span class="basin-area">${areaStr}</span>` : ''}
              </span>
            </div>
            <svg class="basin-picker-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>`;
      });
      groupHtml += `
        <div class="basin-picker-group">
          <div class="basin-picker-group-title">${this._escHtml(header)}</div>
          ${itemsHtml}
        </div>`;
    } else {
      /* CAD: group municipalities by Province property.
         Skip disputed boundary overlays — features whose Muni_City or Province
         contains " vs " are CADastre dispute polygons, not real municipalities. */
      const isDisputed = (s) => /\s+vs\s+/i.test(s || '');
      const byProvince = {};
      data.features.forEach(f => {
        const prov = (f.properties.Province || '').trim();
        const muni = (f.properties.Muni_City || '').trim();
        if (!prov) return;
        if (isDisputed(muni) || isDisputed(prov)) return;
        if (!byProvince[prov]) byProvince[prov] = [];
        byProvince[prov].push(f);
      });
      Object.keys(byProvince).sort().forEach(provName => {
        const titleProv = this._toTitleCase(provName);
        let itemsHtml = '';
        byProvince[provName].forEach(f => {
          const name = this._toTitleCase(this._featureName(f, 1));
          itemsHtml += `
            <button class="basin-picker-item" onclick="APP._drillBoundaryFromPicker('${this._escHtml(name)}', 1)">
              <div class="basin-picker-info">
                <span class="basin-picker-name">${this._escHtml(name)}</span>
              </div>
              <svg class="basin-picker-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>`;
        });
        groupHtml += `
          <div class="basin-picker-group">
            <div class="basin-picker-group-title">${this._escHtml(titleProv)}</div>
            ${itemsHtml}
          </div>`;
      });
    }

    const hero = document.getElementById('panel-hero');
    if (hero) {
      hero.className = 'panel-hero basin-picker-hero';
      hero.innerHTML = `<div class="panel-level-badge">Administrative Boundaries</div>
        <h2 class="panel-title">Cordillera Administrative Region</h2>
        <p class="panel-subtitle">Tap a province/municipality to drill in</p>`;
    }

    const html = `
      <div class="panel-section basin-picker-section">
        ${groupHtml}
      </div>`;

    content.innerHTML = html;
    document.body.classList.add('panel-open');
    document.body.classList.remove('panel-expanded');
    panel.classList.remove('expanded', 'open', 'closed', 'peek');
    
    if (window.innerWidth <= 640) {
      panel.classList.add('peek');
      this.state.panelState = 'peek';
    } else {
      panel.classList.add('open');
      this.state.panelState = 'open';
    }
    this._updatePanelToggleIcon();
  },


  /* Click handler for boundary picker items — mimics the map polygon click pattern */
  _drillBoundaryFromPicker(childName, childLevel) {
    const childData = this.state.rawData[childLevel];
    if (!childData || !childName) return;
    const lookup = childName.toLowerCase();
    const childFeature = childData.features.find(f => this._featureName(f, childLevel).toLowerCase() === lookup);
    if (!childFeature) return;
    let childLayer = null;
    const layerGroup = this.state.layers[childLevel];
    if (layerGroup) {
      layerGroup.eachLayer(lf => {
        if (lf.feature === childFeature) childLayer = lf;
      });
    }
    this.openPanel(childFeature, childLevel);
    /* Always zoom to the selected feature's bounds */
    if (childLayer && childLayer.getBounds) {
      this.state.map.fitBounds(childLayer.getBounds(), {
        padding: [50, 50],
        maxZoom: 12,
      });
    } else if (childFeature.geometry) {
      try {
        const temp = L.geoJSON(childFeature);
        this.state.map.fitBounds(temp.getBounds(), {
          padding: [50, 50],
          maxZoom: 12,
        });
      } catch (_) {}
    }
    if (childLevel >= this._src().maxLevel) {
      this._highlightAndDim(childFeature, childLayer, childLevel);
    } else {
      this.drillDown(childFeature, childLayer);
    }
  },


  /* Highlight a child boundary on the map when its chip is clicked */
  _highlightBoundaryChild(childId, level, chipEl) {
    /* Toggle active class on chips */
    if (chipEl && chipEl.parentNode) {
      chipEl.parentNode.querySelectorAll('.span-chip.active').forEach(c => c.classList.remove('active'));
    }
    if (chipEl) chipEl.classList.add('active');

    if (!childId) return;
    const layer = this.state.layers[level];
    if (!layer) return;

    /* Reset previous highlights on this level, then highlight the matched feature */
    this._resetLevelStyle(level);
    layer.eachLayer(lf => {
      if (lf.feature && lf.feature.properties && lf.feature.properties._id === childId) {
        lf.setStyle({
          color: '#dc2626',
          weight: 2.5,
          fillOpacity: 0.06,
          dashArray: '5 3',
          lineCap: 'round',
          opacity: 0.9,
        });
        lf.bringToFront();
        if (lf.getBounds) {
          this.state.map.fitBounds(lf.getBounds(), {
            padding: [50, 50],
            maxZoom: 12,
          });
        }
      }
    });
  },

});

console.log('boundary-mode.js loaded');
