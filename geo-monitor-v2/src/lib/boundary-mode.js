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
        const layer = this.state.layers[currentLevel];
        layer.eachLayer((lf) => {
          if (lf.getTooltip()) {
            lf.unbindTooltip();
            lf._labelBound = false;
          }
          if (lf.feature === feature) {
            this.state._selectedLeafletLayer = lf;
            lf.setStyle({ fillOpacity: 0, color: cfg.stroke, weight: 2.5, opacity: 0.7, dashArray: '8 4' });
            lf.bringToFront();
          } else {
            /* Dim siblings instead of hiding them completely */
            lf.setStyle({ fillOpacity: 0, opacity: 0.25, weight: 1.0 });
          }
        });
        this.state.layers[currentLevel]._hiddenByDrill = true;
      }

      /* Ensure level 0 stays visible to frame the region at all levels */

      this._updateBreadcrumb();

      if (leafletLayer && leafletLayer.getBounds) {
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
        if (this.state.layers[0]) {
          this._resetLevelStyle(0);
          this.state.layers[0]._hiddenByDrill = false;
        }
        
        this.state.selectedPath = [];
        this.state.currentLevel = 0;
        
        /* Only rebuild if layers don't exist yet (avoids visual flicker) */
        if (!this.state.layers[0]) await this._showLevel(0);
        this.state.currentLevel = 0;
        
        if (this.state.layers[0]) {
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

      /* Update state to properly reflect drill-up */
      this.state.currentLevel = targetLevel;
      this.state.selectedPath = this.state.selectedPath.slice(0, targetLevel);
      
      /* Clear any isolation state since we are stepping back */
      this.state._selectedFeature = null;
      this.state._selectedLevel = null;
      this.state._selectedLeafletLayer = null;

      /* Restore context layer style (was dimmed during drillDown) */
      if (targetLevel > 0 && this.state.layers[targetLevel]) {
        this._resetLevelStyle(targetLevel);
        this.state.layers[targetLevel]._hiddenByDrill = false;
        
        /* Force interactivity instantly to prevent swallows */
        this.state.layers[targetLevel].eachLayer(lf => {
           lf.bringToFront();
           if (lf._path) lf._path.style.pointerEvents = 'auto';
        });
      }

      /* Update sidebar and fly to parent bounds */
      if (targetLevel === 1) {
        this._updateSmartFilters(null);
        const carData = this.state.rawData[0];
        if (carData && carData.features && carData.features[0]) {
          this.openPanel(carData.features[0], 0);
        }
        if (this.state.layers[0]) {
          this.state.map.flyToBounds(this.state.layers[0].getBounds(), {
            padding: [20, 20],
            duration: 0.45,
            easeLinearity: 0.25
          });
        }
      } else if (targetLevel > 1 && this.state.selectedPath.length > 0) {
        const p = this.state.selectedPath[this.state.selectedPath.length - 1];
        if (p.layer) {
          this.state.map.flyToBounds(p.layer.getBounds(), {
            padding: [20, 20],
            duration: 0.45,
            easeLinearity: 0.25
          });
        }
        this.openPanel(p.feature, p.level);
      }

      /* Rebind tooltips for target level */
      if (targetLevel >= 1 && this.state.layers[targetLevel]) {
        this.state.layers[targetLevel].eachLayer(lf => {
          if (!lf.getTooltip()) {
            lf.bindTooltip(this._featureName(lf.feature, targetLevel), {
              permanent: true,
              direction: 'center',
              className: 'watershed-label',
            });
          }
        });
      }

      /* Re-add level 0 (CAR) if it was removed at maxLevel */
      if (targetLevel < this._src().maxLevel && !this.state.layers[0]) {
        this._showLevel(0);
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
      this.state.rawData[geoKey] = window.decodeGeo(await resp.json());
    }

    let data = this.state.rawData[geoKey];

    if (parentFeature && level > 0) {
      data = this._filterToParent(data, level, parentFeature);
    }

    const styleConfig = this.config.colors[level];
    /* Check for custom admin level color */
    const customFill = this.state.customColors ? this.state.customColors['adminLevel' + level] : null;
    const fillColor = customFill || styleConfig.fill;
    const self = this;
    const featureCount = data.features ? data.features.length : 0;
    const useHover = featureCount <= 300;

    const layer = L.geoJSON(data, {
      interactive: true,
      style: () => ({
        fillColor: fillColor,
        fillOpacity: 0,
        color: styleConfig.stroke,
        weight: styleConfig.weight,
        opacity: 0.9,
        className: 'fade-in-path',
        dashArray: null,
      }),

      onEachFeature(feature, leafletLayer) {
        if (level >= 1) {
          const labelName = self._featureName(feature, level);
          leafletLayer.bindTooltip(labelName, {
            permanent: true,
            direction: 'center',
            className: 'watershed-label',
          });
          leafletLayer._labelBound = true;
        }

        if (useHover) {
          leafletLayer.on('mouseover', function (e) {
            if (level !== self.state.currentLevel) return;
            if (self.state.activeOutline === level) return;

            /* Kill hover bleed on dimmed siblings */
            if (e.target._hiddenByIsolation) return;
            
            if (level >= 1) {
              leafletLayer.unbindTooltip();
              leafletLayer._labelBound = false;
            }
            
            self._showHoverLabel(feature, level);
            
            /* Do not alter style if this feature is currently selected */
            if (self.state._selectedFeature === feature) return;

            /* Subtle gray highlight on hover */
            e.target.setStyle({ fillColor: '#9ca3af', fillOpacity: 0.15, weight: styleConfig.weight + 1, dashArray: null });
            e.target.bringToFront();
          });
          leafletLayer.on('mouseout', function (e) {
            if (level !== self.state.currentLevel) return;
            if (self.state.activeOutline === level) return;

            /* Kill hover bleed on dimmed siblings */
            if (e.target._hiddenByIsolation) return;

            /* Restore permanent label if it's not isolated */
            if (level >= 1 && !leafletLayer._labelBound) {
              leafletLayer.bindTooltip(self._featureName(feature, level), {
                permanent: true,
                direction: 'center',
                className: 'watershed-label',
              });
              leafletLayer._labelBound = true;
            }
            
            self._hideHoverLabel();

            /* Do not alter style if this feature is currently selected */
            if (self.state._selectedFeature === feature) return;

            e.target.setStyle({
              fillOpacity: 0,
              opacity: 0.9,
              weight: styleConfig.weight,
              dashArray: null
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
              /* Clicking a dimmed feature at deepest level → deselect but stay on level */
              if (self.state._selectedFeature) {
                self._clearIsolation(level);
                self.state._selectedFeature = null;
                self.state.selectedPath.pop();
                if (self.state.selectedPath.length > 0) {
                  const p = self.state.selectedPath[self.state.selectedPath.length - 1];
                  if (p.layer) self.state.map.flyToBounds(p.layer.getBounds(), { padding: [20, 20], duration: 0.8 });
                  self.openPanel(p.feature, p.level);
                } else {
                  self._goHome();
                }
                self._updateBreadcrumb();
              }
              return;
            }

            /* If a feature is already selected at this level, and we click a DIFFERENT one, 
               treat it as 'clicking outside' to deselect and drill up, rather than instantly switching. */
            if (self.state._selectedFeature && self.state._selectedFeature !== feature) {
              self._clearIsolation(level);
              self.state._selectedFeature = null;
              self.state.selectedPath.pop();
              if (self.state.selectedPath.length > 0) {
                const p = self.state.selectedPath[self.state.selectedPath.length - 1];
                if (p.layer) self.state.map.flyToBounds(p.layer.getBounds(), { padding: [20, 20], duration: 0.8 });
                self.openPanel(p.feature, p.level);
              } else {
                self._goHome();
              }
              self._updateBreadcrumb();
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
    this._applyCustomColors();

    /* Hook: dynamic framework overlays re-fetch */
    if (this.state.frameworkOverlays) {
      if (this.state.frameworkOverlays.namriaActive) this._toggleNamriaOverlay(true);
      if (this.state.frameworkOverlays.cadActive) this._toggleCadOverlay(true);
    }
  },

  /* ── Filter GeoJSON to parent boundary ─────── */
  /* ── Filter GeoJSON to parent boundary ─────── */
  _filterToParent(data, childLevel, parentFeature) {
    if (!parentFeature) return data;
    if (childLevel === 1) {
      // Level 1 is Province. All provinces belong to Region (Level 0).
      return data;
    }
    if (childLevel === 2) {
      // Level 2 is Municipality. Parent is Province.
      const parentName = this._featureName(parentFeature, 1).toLowerCase();
      return { 
        ...data, 
        features: data.features.filter(f => {
          const prov = (f.properties.Province || f.properties.PROVINCE || '').toLowerCase();
          return prov === parentName;
        }) 
      };
    }
    return data;
  },

  /* ── Dynamic map padding to avoid panel ── */
  /* ── Isolate selected feature: highlight it, hide all others at this level ── */
  _dimLevel(level, selectedFeature) {
    const layer = this.state.layers[level];
    if (!layer) return;
    const cfg = this.config.colors[level];
    layer.eachLayer(function(leafletLayer) {
      if (leafletLayer.getTooltip()) {
        leafletLayer.unbindTooltip();
        leafletLayer._labelBound = false;
      }
      if (leafletLayer.feature !== selectedFeature) {
        leafletLayer._hiddenByIsolation = true;
        leafletLayer.setStyle({
          fillOpacity: 0,
          opacity: 0.25,
          weight: 1.0,
        });
        if (leafletLayer._path) leafletLayer._path.style.pointerEvents = 'none';
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
        if (leafletLayer._path) leafletLayer._path.style.pointerEvents = 'auto';
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

  _clearIsolation(level) {
    this._resetLevelStyle(level);
    const layer = this.state.layers[level];
    if (layer) {
      layer.eachLayer(lf => {
        lf.bringToFront();
        if (lf._path) lf._path.style.pointerEvents = 'auto';
      });
    }

    /* Restore parent province dashed style if returning to State D */
    if (level === 2 && this.state.selectedPath && this.state.selectedPath.length > 0) {
      const parentNode = this.state.selectedPath.find(p => p.level === 1);
      if (parentNode && this.state.layers[1]) {
        this.state.layers[1].eachLayer(lf => {
          if (lf.feature === parentNode.feature) {
            const cfg = this.config.colors[1];
            lf.setStyle({ color: cfg.stroke, weight: 2.5, opacity: 0.7, dashArray: '8 4' });
            if (lf._path) lf._path.style.pointerEvents = 'none';
          }
        });
      }
    }
  },

  /* ── Highlight selection via dim (max-level click) ── */
  _highlightAndDim(feature, leafletLayer, level) {
    this._dimLevel(level, feature);
    this.state._selectedFeature = feature;
    this.state._selectedLevel = level;
    this.state._selectedLeafletLayer = leafletLayer;

    /* Ensure parent boundary remains visible as a structural outline */
    if (level === 2 && this.state.selectedPath && this.state.selectedPath.length > 0) {
      const parentNode = this.state.selectedPath.find(p => p.level === 1);
      if (parentNode && this.state.layers[1]) {
        this.state.layers[1].eachLayer(lf => {
          if (lf.feature === parentNode.feature) {
            lf.setStyle({ color: '#1e293b', weight: 2.5, opacity: 0.8, dashArray: null });
            lf.bringToFront();
            if (lf._path) lf._path.style.pointerEvents = 'none';
          }
        });
      }
    }

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
  _clearSelection(skipClosePanel = false) {
    this._hideHoverLabel();
    if (this.state._selectedLevel !== null) {
      this._clearIsolation(this.state._selectedLevel);
    }
    if (this.state._wsHighlightLayer && this.state.map) {
      this.state.map.removeLayer(this.state._wsHighlightLayer);
      this.state._wsHighlightLayer = null;
    }
    this.state._selectedFeature = null;
    this.state._selectedLevel = null;
    this.state._selectedLeafletLayer = null;
    if (!skipClosePanel) this.closePanel();
  },

  _resetLevelStyle(level) {
    const layer = this.state.layers[level];
    if (!layer) return;
    const cfg = this.config.colors[level];
    const self = this;
    layer.eachLayer(function(leafletLayer) {
      delete leafletLayer._hiddenByIsolation;
      leafletLayer.setStyle({
        fillColor: cfg.fill,
        color: cfg.stroke,
        weight: cfg.weight,
        opacity: 0.9,
        fillOpacity: 0,
      });
      if (leafletLayer._path) leafletLayer._path.style.pointerEvents = 'auto';
      if (level >= 1 && !leafletLayer.getTooltip()) {
        leafletLayer.bindTooltip(self._featureName(leafletLayer.feature, level), {
          permanent: true,
          direction: 'center',
          className: 'watershed-label',
        });
        leafletLayer._labelBound = true;
      }
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
      if (resp.ok) this.state.rawData[level] = window.decodeGeo(await resp.json());
    } catch (_) { }
  },

  /* ── Hover label ──────────────────────────── */
  /* ── Home / Reset ─────────────────────────── */
  _goHome(skipFly = false) {
    this._clearSelection(true);
    
    this.state._selectedFeature = null;
    this.state._selectedLevel = null;
    this.state._selectedLeafletLayer = null;
    this.state.selectedPath = [];
    this.state.currentLevel = 0;
    
    /* Completely reset outline layers */
    this.state.activeOutline = null;
    const outlineToggles = document.querySelectorAll('input[name="outline-toggle"]');
    if (outlineToggles.length) {
      outlineToggles.forEach(r => { if (r.value === 'none') r.checked = true; });
    }
    if (this.state.outlineLayers) {
      Object.values(this.state.outlineLayers).forEach(l => {
        if (l && this.state.map.hasLayer(l)) this.state.map.removeLayer(l);
      });
    }
    this.state.outlineLayers = {};
    if (this.state._outlineHighlight) {
      this.state.map.removeLayer(this.state._outlineHighlight);
      this.state._outlineHighlight = null;
    }

    for (let lvl = this._src().maxLevel; lvl > 0; lvl--) {
      if (this.state.layers[lvl]) {
        this.state.map.removeLayer(this.state.layers[lvl]);
        this.state.layers[lvl] = null;
      }
    }
    this._showLevel(0);
    this.state.currentLevel = 0;
    if (!skipFly && this.state.layers[0]) {
      this.state.map.flyToBounds(this.state.layers[0].getBounds(), {
        ...this._getPaddingOpts(),
        duration: 0.45,
        easeLinearity: 0.25,
      });
    }
    /* Always show the standard panel for the region */
    const carData = this.state.rawData[0];
    if (carData && carData.features && carData.features[0]) {
      this.openPanel(carData.features[0], 0);
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

  /* ── Legacy outline toggles removed ── */

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
        data = window.decodeGeo(await resp.json());
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

    /* After adding admin boundary overlays, reorder layers so hydro features
       remain visually on top:
       - Bring basin outlines (hydroLayers[0]) to front within the Canvas renderer
         so the selected basin's thick black outline isn't buried under admin polygons
       - Bring stream order lines (hydroLayers[2]) to front
       - Bring slope (hydroLayers[3]) and LCM (hydroLayers[4]) to front so they
         render above admin lines */
    if (this.state.viewMode === 'watersheds') {
      [0, 2, 3, 4].forEach(i => {
        const l = this.state.hydroLayers[i];
        if (l) { try { l.bringToFront(); } catch (_) {} }
      });
    }
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

  /* Sidebar-only red highlight for pills */
  _highlightSidebarSelection(childName, childLevel, chipEl) {
    if (this.state._selectedSidebarItem === childName) {
      /* UNSELECT LOGIC (Toggle off) */
      if (chipEl && chipEl.parentNode) {
        chipEl.parentNode.querySelectorAll('.span-chip.active').forEach(c => c.classList.remove('active'));
      }
      this.state._selectedSidebarItem = null;
      this._resetLevelStyle(childLevel);
      
      const parentNode = this.state.selectedPath && this.state.selectedPath.find(p => p.level === childLevel - 1);
      if (parentNode && parentNode.feature) {
        /* Fly back to parent bounds */
        if (this.state.layers[childLevel - 1]) {
          this.state.layers[childLevel - 1].eachLayer(lf => {
            if (lf.feature === parentNode.feature && lf.getBounds) {
              this.state.map.flyToBounds(lf.getBounds(), { padding: [50, 50], duration: 0.8 });
            }
          });
        }
      }
      return;
    }

    this.state._selectedSidebarItem = childName;

    /* Toggle active class on chips */
    if (chipEl && chipEl.parentNode) {
      chipEl.parentNode.querySelectorAll('.span-chip.active').forEach(c => c.classList.remove('active'));
    }
    if (chipEl) chipEl.classList.add('active');

    const childData = this.state.rawData[childLevel];
    if (!childData || !childName) return;
    const lookup = childName.toLowerCase();
    const childFeature = childData.features.find(f => this._featureName(f, childLevel).toLowerCase() === lookup);
    if (!childFeature) return;
    
    const layer = this.state.layers[childLevel];
    if (!layer) return;

    /* Reset previous sidebar highlights by resetting the level style,
       but DO NOT dim siblings or change isolation state */
    this._resetLevelStyle(childLevel);
    layer.eachLayer(lf => {
      if (lf.feature === childFeature) {
        lf.setStyle({
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.2,
          weight: 2,
          opacity: 1,
          dashArray: '5, 8'
        });
        lf.bringToFront();
        if (lf.getBounds) {
          this.state.map.flyToBounds(lf.getBounds(), {
            padding: [50, 50],
            maxZoom: 12,
            duration: 0.8
          });
        }
      }
    });

    /* Ensure parent boundary remains visible as a structural outline over the highlighted pill */
    if (childLevel === 2 && this.state.selectedPath && this.state.selectedPath.length > 0) {
      const parentNode = this.state.selectedPath.find(p => p.level === 1);
      if (parentNode && this.state.layers[1]) {
        this.state.layers[1].eachLayer(lf => {
          if (lf.feature === parentNode.feature) {
            lf.bringToFront();
            if (lf._path) lf._path.style.pointerEvents = 'none';
          }
        });
      }
    }
  },

  /* ── Dynamic Framework Overlays ── */
  async _toggleNamriaOverlay(checked) {
    if (!this.state.frameworkOverlays) return;
    this.state.frameworkOverlays.namriaActive = checked;
    if (this.state.frameworkOverlays.namriaLayer) {
      this.state.map.removeLayer(this.state.frameworkOverlays.namriaLayer);
      this.state.frameworkOverlays.namriaLayer = null;
    }
    if (!checked) return;
    const levelMap = ['region', 'province', 'municipality'];
    const levelStr = levelMap[this.state.currentLevel] || 'region';
    try {
      const resp = await fetch(`geoJSON/Overlays/namria_${levelStr}.json`);
      if (!resp.ok) return;
      const rawData = await resp.json();
      const geoData = window.decodeGeo(rawData);
      this.state.frameworkOverlays.namriaLayer = L.geoJSON(geoData, {
        interactive: false,
        style: {
          color: '#ff3366',
          weight: 2.5,
          opacity: 0.9,
          fillOpacity: 0,
          dashArray: '5, 5'
        }
      }).addTo(this.state.map);
    } catch(e) {
      console.error("Failed to load NAMRIA overlay", e);
    }
  },

  async _toggleCadOverlay(checked) {
    if (!this.state.frameworkOverlays) return;
    this.state.frameworkOverlays.cadActive = checked;
    if (this.state.frameworkOverlays.cadLayer) {
      this.state.map.removeLayer(this.state.frameworkOverlays.cadLayer);
      this.state.frameworkOverlays.cadLayer = null;
    }
    if (!checked) return;
    const levelMap = ['region', 'province', 'municipality'];
    const levelStr = levelMap[this.state.currentLevel] || 'region';
    try {
      const resp = await fetch(`geoJSON/Overlays/cad_${levelStr}.json`);
      if (!resp.ok) return;
      const rawData = await resp.json();
      const geoData = window.decodeGeo(rawData);
      this.state.frameworkOverlays.cadLayer = L.geoJSON(geoData, {
        interactive: false,
        style: {
          color: '#33ccff',
          weight: 2.5,
          opacity: 0.9,
          fillOpacity: 0,
          dashArray: '5, 5'
        }
      }).addTo(this.state.map);
    } catch(e) {
      console.error("Failed to load CAD overlay", e);
    }
  },

});

console.log('boundary-mode.js loaded');
