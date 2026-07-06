import { APP } from './app.js';
/**
 * hydro-mode.js
 * Contains all watershed drill-down, zone isolation, and hydro UI logic.
 */

Object.assign(APP, {
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
      if (this.state.map) {
        this.state.map.setView(this.config.mapCenter, this.config.mapZoom);
      }
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
          this.openPanel(carData.features[0], 0);
        }
      }
      if (this.state.map) {
        this.state.map.setView(this.config.mapCenter, this.config.mapZoom);
      }
    }
  },

  /* Reset view and state to defaults for the current mode */
  _resetAll() {
    if (!this.state.map || this.state._drilling) return;
    const map = this.state.map;
    map.setView(this.config.mapCenter, this.config.mapZoom);
    this.closePanel();

    if (this.state.viewMode === 'watersheds') {
      if (this.state.hydroDrillLevel === 1) {
        [1, 2].forEach(l => {
          if (this.state.hydroLayers[l]) { map.removeLayer(this.state.hydroLayers[l]); this.state.hydroLayers[l] = null; }
        });
        if (this.state.hydroAdminOutlineLayer) { map.removeLayer(this.state.hydroAdminOutlineLayer); this.state.hydroAdminOutlineLayer = null; }
        document.querySelectorAll('.span-chip.active').forEach(c => c.classList.remove('active'));
      }
    this.state.hydroDrillLevel = 0;
    this.state.hydroSelectedBasin = null;
    this.state.hydroSelectedZone = null;
    this.state.hydroSelectedZoneLayer = null;
    APP.slope.destroy();
      this.state.hydroActiveFilterIds = [];
      this.state.showSubWatersheds = false;
      this.state.showStreamOrder = false;
      this.state.showSlope = false;
      this._clearHydroLayers();
      this._renderHydroBasins();
      this._showBasinPickerPanel();
      this._updateBreadcrumb();
      this._updateHydroLabels();
    } else {
      this.state.currentLevel = 0;
      this.state.selectedPath = [];
      this._showLevel(0);
      if (this.state.rawData[0] && this.state.rawData[0].features && this.state.rawData[0].features[0]) {
        this.openPanel(this.state.rawData[0].features[0], 0);
      }
    }
  },

  /* ── Hydro Mode: enter, render basins ── */
  async _enterHydroMode() {
    /* Defensive cleanup: ensure no residual admin boundary layers remain */
    for (let lvl = this._src().maxLevel; lvl >= 0; lvl--) {
      if (this.state.layers[lvl]) {
        this.state.map.removeLayer(this.state.layers[lvl]);
        this.state.layers[lvl] = null;
      }
    }
    Object.values(this.state.outlineLayers).forEach(l => {
      if (l) this.state.map.removeLayer(l);
    });
    this.state.outlineLayers = {};
    this.state.activeOutline = null;
    this.state._outlineHighlight = null;
    this.state.selectedPath = [];
    this.state.currentLevel = 0;

    if (!this.state.rawData['watershed']) {
      try {
        const resp = await fetch('geoJSON/CAR Watersheds.topojson');
        this.state.rawData['watershed'] = window.decodeGeo(await resp.json());
      } catch (_) {
        this._showToast('Failed to load watershed data');
        return;
      }
    }
    /* R3: Load merged watershed outline if not already cached */
    if (!this.state.rawData['watershedOutline']) {
      try {
        const resp = await fetch('geoJSON/CAR Watersheds Outline.topojson');
        this.state.rawData['watershedOutline'] = window.decodeGeo(await resp.json());
      } catch (_) {}
    }
    
    this.state.hydroDrillLevel = 0;
    this.state.hydroSelectedBasin = null;
    this.state.hydroSelectedZone = null;
    this.state.hydroSelectedZoneLayer = null;
    this._clearHydroLayers();
    this._renderHydroBasins();
    if (this.state.hydroActiveFilterIds && this.state.hydroActiveFilterIds.length > 0) {
      this._applyHydroFilter();
    }
    this._showBasinPickerPanel();
    this._applyCustomColors();
    this._updateBreadcrumb();
    if (this.state.map) {
      this.state.map.on('zoomend', this._onZoomChange, this);
    }
    this._updateHydroLabels();
  },

  /* Index of a basin in hydroBasinFolderMap (for color assignment) */
  _hydroBasinIndex(feature) {
    const name = feature.properties.Name || feature.properties.Old_Name || '';
    return Object.keys(this.config.hydroBasinFolderMap).indexOf(name);
  },

  /* ── Silhouette system (merged outline for level 0) ── */

  /* Compute the dissolved outer boundary of all 14 basins (cached).
     Uses the pre-computed CAR Watersheds Outline.geojson when available. */
  _computeHydroSilhouette() {
    if (this.state._hydroSilhouetteGeo) return this.state._hydroSilhouetteGeo;
    /* Use pre-computed outline if loaded */
    const outline = this.state.rawData['watershedOutline'];
    if (outline && outline.features && outline.features.length > 0) {
      this.state._hydroSilhouetteGeo = outline;
      return outline;
    }
    /* Fallback: try turf dissolve at runtime */
    const data = this.state.rawData['watershed'];
    if (!data || !data.features || data.features.length === 0) return null;
    if (typeof turf === 'undefined') {
      /* No turf and no pre-computed outline — use the raw watershed FeatureCollection as-is */
      this.state._hydroSilhouetteGeo = data;
      return data;
    }
    try {
      const fc = { type: 'FeatureCollection', features: data.features };
      const dissolved = turf.dissolve(fc);
      if (!dissolved) return null;
      this.state._hydroSilhouetteGeo = dissolved;
      return dissolved;
    } catch (e) {
      try {
        let merged = data.features[0];
        for (let i = 1; i < data.features.length; i++) {
          merged = turf.union(merged, data.features[i]);
        }
        this.state._hydroSilhouetteGeo = merged;
        return merged;
      } catch (e2) {
        return null;
      }
    }
  },

  _renderHydroSilhouette(interactive) {
    if (this.state.hydroSilhouetteLayer) return;
    const map = this.state.map;
    if (!map) return;
    const geo = this._computeHydroSilhouette();
    if (!geo) return;
    const self = this;
    const opts = {
      interactive: !!interactive,
      style: {
        color: '#1f2937',
        weight: 2.5,
        opacity: 0.9,
        fillColor: '#3b82f6',
        fillOpacity: 0,
      },
    };
    if (interactive) {
      opts.onEachFeature = function(feature, layer) {
        layer.on('click', function(e) {
          if (self.state._drilling) return;
          if (self.state.hydroDrillLevel !== 0) return;
          L.DomEvent.stopPropagation(e);
          self._silhouetteClick();
        });
        layer.on('mouseover', function() {
          if (self.state.hydroLayers[0]) {
            self.state.hydroLayers[0].eachLayer(function(lf) {
              lf.setStyle({ fillOpacity: 0.55 });
            });
          }
          const lbl = document.getElementById('map-hover-label');
          if (lbl) {
            lbl.innerHTML = '<span class="label-level">Watersheds</span>Click to explore basins';
            lbl.classList.add('visible');
            lbl.style.display = '';
          }
        });
        layer.on('mouseout', function() {
          if (self.state.hydroLayers[0]) {
            self.state.hydroLayers[0].eachLayer(function(lf) {
              lf.setStyle({ fillOpacity: 0.35 });
            });
          }
          self._hideHoverLabel();
        });
      };
    }
    this.state.hydroSilhouetteLayer = L.geoJSON(geo, opts).addTo(map);
  },

  /* Remove the silhouette outline layer */
  _removeHydroSilhouette() {
    if (this.state.hydroSilhouetteLayer) {
      this.state.map.removeLayer(this.state.hydroSilhouetteLayer);
      this.state.hydroSilhouetteLayer = null;
    }
  },

  /* Click on silhouette at Level 0 → reveal 14 individual basins */
  _silhouetteClick() {
    if (this.state._drilling) return;
    this.state._drilling = true;
    this._hideHoverLabel();
    try {
      this.state.hydroSelectedBasin = null;
      this.state.hydroSelectedZone = null;
      this.state.hydroSelectedZoneLayer = null;
      /* Remove silhouette and re-render basins with visible borders */
      this._removeHydroSilhouette();
      this._renderHydroBasins(); /* border mode (no argument = false) */
      /* Apply any pending watershed filters */
      if (this.state.hydroActiveFilterIds && this.state.hydroActiveFilterIds.length > 0) {
        this._applyHydroFilter();
      }
      this._showBasinPickerPanel();
      this._updateBreadcrumb();
    } finally {
      this.state._drilling = false;
    }
  },

  /* Render the 14 major basins as interactive colored polygons (hydro level 0) */
  _renderHydroBasins(silhouetteMode) {
    const map = this.state.map;
    const data = this.state.rawData['watershed'];
    if (!data || !map) return;

    /* Clear previous hydro layers */
    this._clearHydroLayers();

    const colors = this.config.hydroLevelColors;
    const self = this;

    this.state.hydroLayers[0] = L.geoJSON(data, {
      interactive: !silhouetteMode,
      style: (feature) => {
        const idx = self._hydroBasinIndex(feature);
        if (silhouetteMode) {
          /* Silhouette mode: solid fill, no strokes */
          return {
            fillColor: '#d1d5db',
            fillOpacity: 0.35,
            weight: 0,
            opacity: 0,
            className: 'fade-in-path',
          };
        } else {
          /* Border mode: standard view with strokes */
          return {
            fillColor: '#d1d5db',
            fillOpacity: 0.15,
            color: '#000000',
            weight: 2,
            opacity: 0.9,
            className: 'fade-in-path',
          };
        }
      },
      onEachFeature(feature, leafletLayer) {
        if (silhouetteMode) return;
        const name = feature.properties.Name || feature.properties.Old_Name || 'Unknown';
        const labelName = name.replace(/ River Watershed$/, '').replace(/ Watershed$/, '');
        const idx = self._hydroBasinIndex(feature);
        const basinColor = colors[idx] || '#6b7280';
        leafletLayer._labelText = labelName;

        leafletLayer.on('mouseover', function(e) {
          if (self.state.hydroDrillLevel !== 0) return;
          e.target.setStyle({ fillColor: '#d1d5db', fillOpacity: 0.4, weight: 3, opacity: 1 });
          e.target.bringToFront();
          const lbl = document.getElementById('map-hover-label');
          if (lbl) {
            lbl.innerHTML = `<span class="label-level">Basin</span>${self._escHtml(name)}`;
            lbl.classList.add('visible');
            lbl.style.display = '';
          }
        });

        leafletLayer.on('mouseout', function(e) {
          if (self.state.hydroDrillLevel !== 0) return;
          e.target.setStyle({ fillColor: '#d1d5db', fillOpacity: 0.15, color: '#000000', weight: 2, opacity: 0.9 });
          self._hideHoverLabel();
        });

        leafletLayer.on('click', function(e) {
          if (self.state._drilling) return;
          if (self.state.hydroDrillLevel !== 0) return;
          L.DomEvent.stopPropagation(e);
          self._hydroDrillDown(feature, leafletLayer);
        });
      },
    }).addTo(map);
  },

  /* Apply checkbox filter to the basin overview layer.
     - When hydroActiveFilterIds is empty: all basins shown normally.
     - When non-empty: only checked basins keep full color; others are hidden (fillOpacity 0, faint outline). */
  _applyHydroFilter() {
    const layer = this.state.hydroLayers[0];
    if (!layer) return;
    const self = this;
    const filter = this.state.hydroActiveFilterIds;
    const colors = this.config.hydroLevelColors;

    if (filter.length === 0) {
      /* Restore normal overview styles (only if not currently drilled in) */
      if (this.state.hydroDrillLevel === 0) {
        layer.eachLayer(function(lf) {
          const idx = self._hydroBasinIndex(lf.feature);
          const c = colors[idx] || '#6b7280';
          lf.setStyle({ fillColor: c, fillOpacity: 0.15, color: c, weight: 2, opacity: 0.9 });
        });
      }
      return;
    }

    layer.eachLayer(function(lf) {
      const name = lf.feature.properties.Name || lf.feature.properties.Old_Name || '';
      const idx = self._hydroBasinIndex(lf.feature);
      const c = colors[idx] || '#6b7280';
      if (filter.includes(name)) {
        lf.setStyle({ fillColor: c, fillOpacity: 0.4, color: c, weight: 3, opacity: 1 });
      } else {
        lf.setStyle({ fillColor: c, fillOpacity: 0, color: c, weight: 0.5, opacity: 0.15 });
      }
    });
  },

  /* Apply custom colors set via OpacityMenu color pickers */
  _applyCustomColors() {
    if (!this.state.customColors) return;
    const layer = this.state.hydroLayers[0];
    if (!layer) return;

    const isDrilledIn = this.state.hydroDrillLevel === 1;
    const selectedFeature = isDrilledIn && this.state.hydroSelectedBasin ? this.state.hydroSelectedBasin.feature : null;

    if (this.state.showWatershedColors) {
      const colors = this.state.customColors.watersheds;
      layer.eachLayer(function(lf) {
        const idx = this._hydroBasinIndex(lf.feature);
        const c = colors[idx] || '#6b7280';
        if (isDrilledIn) {
          /* When drilled in, only update the selected basin outline color;
             leave dimmed basins untouched so they stay hidden */
          if (lf.feature === selectedFeature) {
            lf.setStyle({ fillColor: c, fillOpacity: 0, color: '#000000', weight: 3, opacity: 1 });
          }
          /* else: skip — preserve the dim state set by _hydroDrillDown */
        } else {
          lf.setStyle({ fillColor: c, fillOpacity: 0.15, color: c, weight: 2, opacity: 0.9 });
        }
      }.bind(this));

      /* Also update sub-watershed layer (hydroLayers[1]) when toggled on */
      if (this.state.hydroLayers[1]) {
        const swColor = this.state.customColors.subWatershed || '#d1d5db';
        this.state.hydroLayers[1].eachLayer(function(lf) {
          const isSelected = (this.state.hydroSelectedZoneLayer === lf);
          if (isSelected) {
            const fillOpa = this.state.selectedFillOpacity !== undefined ? this.state.selectedFillOpacity : 0.55;
            const outOpa = this.state.selectedOutlineOpacity !== undefined ? this.state.selectedOutlineOpacity : 1.0;
            lf.setStyle({ fillColor: swColor, fillOpacity: this.state.showSlope ? 0.15 : fillOpa, color: '#000000', weight: 3, opacity: outOpa });
          } else if (!lf._hiddenByIsolation) {
            lf.setStyle({ fillColor: swColor, fillOpacity: this.state.showSlope ? 0 : 0.3, color: '#000000', weight: 1.2, opacity: 0.8 });
          }
        }.bind(this));
      }
    } else {
      layer.eachLayer(function(lf) {
        if (isDrilledIn) {
          if (lf.feature === selectedFeature) {
            lf.setStyle({ fillColor: '#d1d5db', fillOpacity: 0, color: '#000000', weight: 3, opacity: 1 });
          }
          /* else: skip — preserve the dim state */
        } else {
          lf.setStyle({ fillColor: '#d1d5db', fillOpacity: 0.15, color: '#000000', weight: 2, opacity: 0.9 });
        }
      });

      /* Reset sub-watershed layer to default color when toggled off */
      if (this.state.hydroLayers[1]) {
        this.state.hydroLayers[1].eachLayer(function(lf) {
          if (!lf._hiddenByIsolation) {
            lf.setStyle({ fillColor: '#d1d5db', fillOpacity: this.state.showSlope ? 0 : 0.3, color: '#000000', weight: 1.2, opacity: 0.8 });
          }
        }.bind(this));
      }
    }
  },

  /* Drill into a basin: load sub-watersheds + stream order */
  async _hydroDrillDown(feature, leafletLayer) {
    if (this.state._drilling) return;
    this.state._drilling = true;
    this._hideHoverLabel();
    const self = this;
    try {
      const name = feature.properties.Name || feature.properties.Old_Name || '';
      const mapEntry = this.config.hydroBasinFolderMap[name];
      if (!mapEntry) {
        this._showToast('Basin folder not configured');
        return;
      }
      this.state.hydroDrillLevel = 1;
      this.state.hydroSelectedBasin = { name, folder: mapEntry.folder, code: mapEntry.code, feature };

      /* Hide basin labels when drilling into sub-watersheds */
      if (this.state.hydroLayers[0]) {
        this.state.hydroLayers[0].eachLayer(function(lf) {
          if (lf._labelBound) {
            lf.unbindTooltip();
            lf._labelBound = false;
          }
        });
      }

      /* Dim all basins except the selected one */
      const idx = self._hydroBasinIndex(feature);
      const basinColor = self.config.hydroLevelColors[idx] || '#6b7280';
      if (this.state.hydroLayers[0]) {
        this.state.hydroLayers[0].eachLayer(function(lf) {
          if (lf.feature !== feature) {
            lf.setStyle({ fillOpacity: 0, opacity: 0.15, weight: 0.5 });
          } else {
            lf.setStyle({ fillColor: basinColor, fillOpacity: 0, color: '#000000', weight: 3, opacity: 1 });
            lf.bringToFront();
          }
        });
      }

      /* Fly to selected basin */
      if (leafletLayer && leafletLayer.getBounds) {
        this.state.map.flyToBounds(leafletLayer.getBounds(), {
          ...this._getPaddingOpts(),
          duration: 0.45,
          easeLinearity: 0.25,
        });
        await new Promise(r => setTimeout(r, 450));
      }

      await this._showHydroSubWatersheds(mapEntry.code, mapEntry.folder);
      this._updateBreadcrumb();
      APP.slope.reapplyClip();
    } finally {
      this.state._drilling = false;
    }
  },

  /* Fetch + render sub-watersheds (hydroLayers[1]) and stream order (hydroLayers[2]) */
  async _showHydroSubWatersheds(code, folder) {
    const map = this.state.map;
    const basePath = 'geoJSON/Watersheds/' + encodeURIComponent(folder) + '/';
    const self = this;
    const swPath = basePath + code + '_SW.topojson';
    const soPath = basePath + code + '_StreamOrder.topojson';

    this.state._basinCode = code;
    this.state._basinFolder = folder;
    this.state._lcmCode = ({ ACH: 'UCH' })[code] || code;

    [1, 2, 3, 4].forEach(l => {
      if (this.state.hydroLayers[l]) { map.removeLayer(this.state.hydroLayers[l]); this.state.hydroLayers[l] = null; }
    });

    const results = await Promise.allSettled([
      fetch(swPath).then(r => { if (!r.ok) throw new Error('No SW'); return r.json(); }).then(window.decodeGeo),
      fetch(soPath).then(r => { if (!r.ok) throw new Error('No StreamOrder'); return r.json(); }).then(window.decodeGeo),
    ]);

    /* Sub-watershed polygons — single L.geoJSON for both visual rendering and events.
       Previously used a dual-layer approach (VectorTileLayer canvas + transparent overlay)
       which caused z-order issues and blinking on hover. Reverted to plain L.geoJSON. */
    if (results[0].status === 'fulfilled') {
      this.state.hydroLayers[1] = L.geoJSON(results[0].value, {
        style: () => ({ fillColor: '#d1d5db', fillOpacity: 0.3, color: '#000000', weight: 1.2, opacity: 0.8 }),
        onEachFeature(feature, layer) {
          layer.on('mouseover', function(e) {
            if (layer._hiddenByIsolation) return;
            const isSelected = (self.state.hydroSelectedZoneLayer === layer);
            const fillOpa = isSelected && self.state.selectedFillOpacity !== undefined ? self.state.selectedFillOpacity : 0.55;
            e.target.setStyle({
              fillColor: '#d1d5db',
              fillOpacity: self.state.showSlope ? 0.15 : fillOpa,
              color: '#000000',
              weight: 2.5,
              opacity: 1,
            });
            const lbl = document.getElementById('map-hover-label');
            if (lbl) {
              const p = feature.properties;
              lbl.innerHTML = `<span class="label-level">Sub-watershed</span>Zone ${p.gridcode || '?'}`;
              lbl.classList.add('visible');
              lbl.style.display = '';
            }
          });
          layer.on('mouseout', function(e) {
            if (layer._hiddenByIsolation) return;
            const isSelected = (self.state.hydroSelectedZoneLayer === layer);
            if (isSelected) {
              const fillOpa = self.state.selectedFillOpacity !== undefined ? self.state.selectedFillOpacity : 0.55;
              const outOpa = self.state.selectedOutlineOpacity !== undefined ? self.state.selectedOutlineOpacity : 1.0;
              e.target.setStyle({
                fillColor: '#d1d5db',
                fillOpacity: self.state.showSlope ? 0.15 : fillOpa,
                color: '#000000',
                weight: 3,
                opacity: outOpa,
              });
            } else {
              e.target.setStyle({
                fillColor: '#d1d5db',
                fillOpacity: self.state.showSlope ? 0 : 0.3,
                color: '#000000',
                weight: 1.2,
                opacity: 0.8,
              });
            }
            self._hideHoverLabel();
          });
          layer.on('click', function(e) {
            if (!layer._hiddenByIsolation) {
              L.DomEvent.stopPropagation(e);
            }
            if (layer._hiddenByIsolation) return;
            self._selectSubWatershed(feature, layer);
          });
        },
      });
      if (this.state.showSubWatersheds) {
        this.state.hydroLayers[1].addTo(map);
        this.state.hydroLayers[1].bringToFront();
      }
      this._applyCustomColors();
    } else {
      this._showToast('Sub-watershed data not available for this basin');
    }

    /* Stream order lines — loaded but only added to map if toggled on */
    if (results[1].status === 'fulfilled') {
      this.state.hydroLayers[2] = L.geoJSON(results[1].value, {
        style: (feature) => {
          const order = feature.properties.grid_code || 1;
          const weight = Math.max(2, Math.min(order * 1.2, 4.5));
          return { color: '#0022ff', weight, opacity: 1 };
        },
      });
      if (this.state.showStreamOrder) {
        this.state.hydroLayers[2].addTo(map);
        this.state.hydroLayers[2].bringToFront();
      }
    } else {
      this._showToast('Stream order data not available for this basin');
    }

    /* Open the basin detail panel */
    if (this.state.hydroSelectedBasin && this.state.hydroSelectedBasin.feature) {
      this._openWatershedPanel(this.state.hydroSelectedBasin.feature);
    }
  },

  /* ── Sub-watershed zone isolation ── */

  /* Select a sub-watershed zone: isolate it visually and open its detail panel */
  _selectSubWatershed(feature, leafletLayer) {
    /* If clicking the same zone again, deselect it */
    if (this.state.hydroSelectedZone === feature) {
      this._deselectSubWatershed();
      return;
    }

    this._dimSubWatersheds(feature);
    this.state.hydroSelectedZone = feature;
    this.state.hydroSelectedZoneLayer = leafletLayer;

    /* Zoom to the selected zone */
    if (leafletLayer && leafletLayer.getBounds) {
      this.state.map.flyToBounds(leafletLayer.getBounds(), {
        padding: [150, 150],
        maxZoom: 12,
        duration: 0.45,
        easeLinearity: 0.25,
      });
    }

    this._openSubWatershedPanel(feature);
    this._updateBreadcrumb();
    this._updateStreamOrderStyles();
    APP.slope.reapplyClip();
  },

  /* Deselect the current sub-watershed zone and return to the basin detail panel */
  _deselectSubWatershed() {
    if (!this.state.hydroSelectedZone) return;
    this._restoreSubWatersheds();
    this.state.hydroSelectedZone = null;
    this.state.hydroSelectedZoneLayer = null;
    if (this.state.hydroSelectedBasin && this.state.hydroSelectedBasin.feature) {
      this._openWatershedPanel(this.state.hydroSelectedBasin.feature);
      /* Fly back to the parent basin bounds */
      try {
        const basinLayer = L.geoJSON(this.state.hydroSelectedBasin.feature);
        if (basinLayer.getBounds().isValid()) {
          this.state.map.flyToBounds(basinLayer.getBounds(), {
            ...this._getPaddingOpts(),
            duration: 0.45,
            easeLinearity: 0.25,
          });
        }
      } catch (_) {}
    }
    APP.slope.reapplyClip();
    this._updateBreadcrumb();
    this._updateStreamOrderStyles();
  },





  /* Dim all sub-watershed zones except the selected one */
  _dimSubWatersheds(selectedFeature) {
    const layer = this.state.hydroLayers[1];
    if (!layer) return;
    const self = this;
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
        const fillOpa = self.state.selectedFillOpacity !== undefined ? self.state.selectedFillOpacity : 0.55;
        const outOpa = self.state.selectedOutlineOpacity !== undefined ? self.state.selectedOutlineOpacity : 1.0;
        leafletLayer.setStyle({
          fillColor: '#d1d5db',
          fillOpacity: self.state.showSlope ? 0.15 : fillOpa,
          color: '#000000',
          weight: 3,
          opacity: outOpa,
        });
        leafletLayer.bringToFront();
      }
    });
    /* Keep stream order on top */
    if (this.state.hydroLayers[2]) this.state.hydroLayers[2].bringToFront();
  },

  /* Restore all sub-watershed zones to their normal style */
  _restoreSubWatersheds() {
    const layer = this.state.hydroLayers[1];
    if (!layer) return;
    const self = this;
    layer.eachLayer(function(leafletLayer) {
      delete leafletLayer._hiddenByIsolation;
      leafletLayer.setStyle({
        fillColor: '#d1d5db',
        fillOpacity: self.state.showSlope ? 0 : 0.3,
        color: '#000000',
        weight: 1.2,
        opacity: 0.8,
      });
    });
  },

  _updateSubWatershedStyles() {
    const layer = this.state.hydroLayers[1];
    if (!layer) return;
    const showOverlay = this.state.showSlope;
    const fillColor = this.state.subWatershedFillColor || '#d1d5db';
    const fillOpa = this.state.selectedFillOpacity !== undefined ? this.state.selectedFillOpacity : 0.55;
    const outlineColor = this.state.subWatershedOutlineColor || '#000000';
    const outOpa = this.state.subWatershedOutlineOpacity !== undefined ? this.state.subWatershedOutlineOpacity : 0.8;
    layer.eachLayer(leafletLayer => {
      if (leafletLayer._hiddenByIsolation) {
        leafletLayer.setStyle({
          fillColor: fillColor, fillOpacity: 0, color: outlineColor, opacity: 0, weight: 0
        });
      } else if (this.state.hydroSelectedZoneLayer === leafletLayer) {
        leafletLayer.setStyle({
          fillColor: fillColor,
          fillOpacity: showOverlay ? 0.15 : fillOpa,
          color: outlineColor, weight: 3, opacity: outOpa
        });
      } else {
        leafletLayer.setStyle({
          fillColor: fillColor,
          fillOpacity: showOverlay ? 0 : 0.3,
          color: outlineColor, weight: 1.2, opacity: outOpa
        });
      }
    });
  },

  /* Update stream order lines based on current selected zone */
  _updateStreamOrderStyles() {
    const layer = this.state.hydroLayers[2];
    if (!layer) return;
    const selectedZone = this.state.hydroSelectedZone;
    const color = this.state.streamOrderColor || '#0022ff';
    const baseOpacity = this.state.streamOrderOpacity ?? 1;
    
    layer.eachLayer(leafletLayer => {
      const order = leafletLayer.feature.properties.grid_code || 1;
      const weight = Math.max(2, Math.min(order * 1.2, 4.5));
      let opacity = baseOpacity;
      
      if (selectedZone && leafletLayer.feature.properties.ZoneID) {
        if (leafletLayer.feature.properties.ZoneID !== selectedZone.properties.ID) {
          opacity = 0;
        }
      }
      
      leafletLayer.setStyle({ color: color, weight: weight, opacity: opacity });
    });
  },

  /* ── Zone-level admin boundary spans ── */

  /* Look up zone-specific admin boundary spans from zoneIntersections.
     Key format: "<basinCode>:<gridcode>" e.g. "AGN:27"
     Uses activeSource ('namria' or 'cad') to pick the right intersection set. */
  _zoneSpans(basinCode, gridcode) {
    const data = this.state.zoneIntersections;
    if (!data) return null;
    const key = basinCode + ':' + gridcode;
    const entry = data[key];
    if (!entry) return null;
    const prefix = this.state.activeSource === 'cad' ? 'cad_' : 'namria_';
    return {
      provinces: (entry[prefix + 'provinces'] || []).map(slug => ({ slug, label: this._prettySlug(slug) })),
      municipalities: (entry[prefix + 'municipalities'] || []).map(slug => {
        const parts = slug.split(':');
        return { slug, province: this._prettySlug(parts[0]), label: this._prettySlug(parts[1] || '') };
      }),
    };
  },

  /* Toggle sub-watersheds overlay on/off */
  _toggleSubWatersheds() {
    this.state.showSubWatersheds = !this.state.showSubWatersheds;
    const sl = this.state.hydroLayers[1];
    if (!sl) return;

    const ctrl = document.getElementById('sw-controls');
    if (ctrl) ctrl.style.display = this.state.showSubWatersheds ? 'block' : 'none';

    if (this.state.showSubWatersheds) {
      this.state.map.addLayer(sl);
      sl.bringToFront();
    } else {
      this.state.map.removeLayer(sl);
    }
  },

  /* Toggle stream order overlay on/off */
  _toggleStreamOrder() {
    this.state.showStreamOrder = !this.state.showStreamOrder;
    const sl = this.state.hydroLayers[2];
    if (!sl) return;

    const ctrl = document.getElementById('so-controls');
    if (ctrl) ctrl.style.display = this.state.showStreamOrder ? 'block' : 'none';

    if (this.state.showStreamOrder) {
      this.state.map.addLayer(sl);
      sl.bringToFront();
      this._updateStreamOrderStyles();
    } else {
      this.state.map.removeLayer(sl);
    }
  },

  /* (LCM tile layer removed — was dead code) */

  /* Drill back up to the basins overview */
  _hydroDrillUp(targetLevel) {
    if (this.state._drilling) return;
    if (targetLevel === this.state.hydroDrillLevel) return;
    const self = this;
    const map = this.state.map;

    /* Remove sub-watershed + stream order layers */
    [1, 2].forEach(l => {
      if (self.state.hydroLayers[l]) { map.removeLayer(self.state.hydroLayers[l]); self.state.hydroLayers[l] = null; }
    });
    /* Remove admin outline overlay if active */
    if (self.state.hydroAdminOutlineLayer) { map.removeLayer(self.state.hydroAdminOutlineLayer); self.state.hydroAdminOutlineLayer = null; }
    document.querySelectorAll('.span-chip.active').forEach(c => c.classList.remove('active'));

    this.state.hydroDrillLevel = 0;
    this.state.hydroSelectedBasin = null;
    this.state.hydroSelectedZone = null;
    this.state.hydroSelectedZoneLayer = null;

    /* Re-render basins interactively (no silhouette) */
    this._clearHydroLayers();
    this._renderHydroBasins();
    if (this.state.hydroActiveFilterIds && this.state.hydroActiveFilterIds.length > 0) {
      this._applyHydroFilter();
    }

    /* Fly back to CAR bounds */
    const wsData = this.state.rawData['watershed'];
    if (wsData) {
      try {
        const tempLayer = L.geoJSON(wsData);
        map.flyToBounds(tempLayer.getBounds(), {
          ...this._getPaddingOpts(),
          duration: 0.45,
          easeLinearity: 0.25,
        });
      } catch (_) {}
    }
    this._updateBreadcrumb();
    this._showBasinPickerPanel();
    this._updateHydroLabels();
    APP.slope.reapplyClip();
  },

  /* Remove all hydro layers from the map */
  _clearHydroLayers() {
    const map = this.state.map;
    if (!map) return;
    [0, 1, 2, 4].forEach(l => {  /* index 3 is slope — managed by APP.slope */
      if (this.state.hydroLayers[l]) { map.removeLayer(this.state.hydroLayers[l]); this.state.hydroLayers[l] = null; }
    });
    this._removeHydroSilhouette();
  },

  /* Full reset of hydro state (used when switching to Boundaries mode) */
  _clearHydroState(keepViewMode) {
    APP.slope.destroy();
    if (this.state.map) {
      this.state.map.off('zoomend', this._onZoomChange, this);
    }
    this._clearHydroLayers();
    this._removeHydroSilhouette();
    this.state.hydroDrillLevel = 0;
    this.state.hydroSelectedBasin = null;
    if (this.state.hydroBoundaryLayer && this.state.map) {
      this.state.map.removeLayer(this.state.hydroBoundaryLayer);
      this.state.hydroBoundaryLayer = null;
    }
    if (this.state.hydroAdminOutlineLayer && this.state.map) {
      this.state.map.removeLayer(this.state.hydroAdminOutlineLayer);
      this.state.hydroAdminOutlineLayer = null;
    }
    Object.values(this.state.adminLayers).forEach(l => {
      if (l && this.state.map) this.state.map.removeLayer(l);
    });
    this.state.adminLayers = {};
    this._closeBoundaryMenu();
    this.state.hydroActiveFilterIds = [];
    this.state.showSubWatersheds = false;
    this.state.showStreamOrder = false;
    this.state.showSlope = false;
    this.state.hydroShowBoundary = false;
    this.state.activeOutline = null;
    this.state.outlineLayers = {};
    this.state._outlineHighlight = null;
    if (!keepViewMode) {
      this.state.viewMode = 'boundaries';
    }
    this._updateBreadcrumb();
  },

  /* Zoom-adaptive label visibility */
  _updateHydroLabels() {
    const layer = this.state.hydroLayers[0];
    if (!layer || !this.state.map) return;
    const show = this.state.map.getZoom() >= 8;
    layer.eachLayer(lf => {
      if (show && !lf._labelBound) {
        lf.bindTooltip(lf._labelText || 'Unknown', {
          permanent: true,
          direction: 'center',
          className: 'watershed-label',
        });
        lf._labelBound = true;
      } else if (!show && lf._labelBound) {
        lf.unbindTooltip();
        lf._labelBound = false;
      }
    });
  },

  _onZoomChange() {
    if (this.state.viewMode !== 'watersheds' || this.state.hydroDrillLevel !== 0) return;
    this._updateHydroLabels();
  },

  /* ── Toggle CAR boundary outline in hydro mode ── */
  async _toggleHydroBoundary() {
    if (this.state.viewMode !== 'watersheds') return;
    this.state.hydroShowBoundary = !this.state.hydroShowBoundary;
    const map = this.state.map;
    const btn = document.getElementById('hydro-boundary-btn');
    if (btn) btn.classList.toggle('active', this.state.hydroShowBoundary);

    if (this.state.hydroShowBoundary) {
      /* Lazily create the boundary layer */
      if (!this.state.hydroBoundaryLayer) {
        try {
          if (!this.state.rawData[0]) {
            const resp = await fetch('geoJSON/CAR NAMRIA Boundary.topojson');
            this.state.rawData[0] = window.decodeGeo(await resp.json());
          }
          this.state.hydroBoundaryLayer = L.geoJSON(this.state.rawData[0], {
            interactive: false,
            style: { color: '#0f172a', weight: 2.5, fillOpacity: 0, dashArray: '6 4', opacity: 0.7 },
          }).addTo(map);
          this.state.hydroBoundaryLayer.bringToBack();
        } catch (_) {
          this._showToast('Failed to load CAR boundary');
          this.state.hydroShowBoundary = false;
          if (btn) btn.classList.remove('active');
        }
      } else {
        map.addLayer(this.state.hydroBoundaryLayer);
        this.state.hydroBoundaryLayer.bringToBack();
      }
    } else {
      if (this.state.hydroBoundaryLayer) {
        map.removeLayer(this.state.hydroBoundaryLayer);
      }
    }
  },

  /* ── Basin Picker Panel (mobile-friendly tappable list) ── */
  _showBasinPickerPanel() {
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('info-panel-content');
    if (!panel || !content) return;

    this.state.lastViewed = null;
    this._updatePanelHeader();

    const wsData = this.state.rawData['watershed'];
    const groups = this.config.hydroBasinGroups;

    let groupHtml = '';
    groups.forEach(group => {
      let itemsHtml = '';
      group.basins.forEach(name => {
        /* Find the feature to get area + size */
        let areaHa = null, size = '';
        if (wsData) {
          const f = wsData.features.find(x => (x.properties.Name || x.properties.Old_Name) === name);
          if (f) {
            areaHa = f.properties.Area_Ha;
            size = f.properties.SIZE_W || '';
          }
        }
        const areaStr = areaHa ? (areaHa / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' km²' : '';
        itemsHtml += `
          <button class="basin-picker-item" onclick="APP._hydroDrillDownByName('${this._escHtml(name)}')">
            <div class="basin-picker-info">
              <span class="basin-picker-name">${this._escHtml(name).replace(/ River Watershed$/, '').replace(/ River$/, '')}</span>
              <span class="basin-picker-meta">
                ${size ? `<span class="basin-size">${this._escHtml(size)}</span>` : ''}
                ${areaStr ? `<span class="basin-area">${areaStr}</span>` : ''}
              </span>
            </div>
            <svg class="basin-picker-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>`;
      });
      groupHtml += `
        <div class="basin-picker-group">
          <div class="basin-picker-group-title">${this._escHtml(group.title)}</div>
          ${itemsHtml}
        </div>`;
    });

    const hero = document.getElementById('panel-hero');
    if (hero) {
      hero.className = 'panel-hero basin-picker-hero';
      hero.innerHTML = `<div class="panel-level-badge">Major Basins</div>
        <h2 class="panel-title">Watersheds</h2>
        <p class="panel-subtitle">Tap a basin to explore sub-watersheds &amp; stream networks</p>`;
    }

    const html = `
      <div class="panel-section basin-picker-section">
        ${groupHtml}
      </div>`;

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
    this._updatePanelToggleIcon();
  },

  /* Helper: drill down by basin name (called from basin picker list) */
  _hydroDrillDownByName(name) {
    const wsData = this.state.rawData['watershed'];
    if (!wsData) return;
    if (!this.state.hydroLayers[0]) {
      this._renderHydroBasins();
    }
    if (!this.state.hydroLayers[0]) return;
    let targetFeature = null, targetLayer = null;
    this.state.hydroLayers[0].eachLayer(lf => {
      const lfName = lf.feature.properties.Name || lf.feature.properties.Old_Name || '';
      if (lfName === name) { targetFeature = lf.feature; targetLayer = lf; }
    });
    if (targetFeature && targetLayer) this._hydroDrillDown(targetFeature, targetLayer);
  },

  /* ── Sub-watershed Panel ── */
  _openSubWatershedPanel(feature) {
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('info-panel-content');
    if (!panel || !content) return;

    let wasSpansOpen = false;
    const openProvinces = [];
    let scrollTop = 0;
    if (content) {
      const spansGroup = content.querySelector('.span-group');
      if (spansGroup) wasSpansOpen = !spansGroup.classList.contains('collapsed');
      content.querySelectorAll('.province-accordion:not(.collapsed)').forEach(el => {
        if (el.dataset.provinceSlug) openProvinces.push(el.dataset.provinceSlug);
      });
      scrollTop = content.scrollTop || 0;
    }

    this._updatePanelHeader();

    const p = feature.properties || {};
    const gridcode = p.gridcode != null ? p.gridcode : '?';
    const areaM2 = parseFloat(p.Shape_Area || 0);
    const areaHa = areaM2 > 0 ? (areaM2 / 10000) : 0;
    const basin = this.state.hydroSelectedBasin;
    const basinName = basin ? basin.name : '';
    const basinCode = basin ? basin.code : '';

    this.state.lastViewed = { feature, isSubWatershed: true };

    /* Build the Spans section — prefer zone-specific spans, fall back to basin spans */
    let spansHTML = '';
    if (this.state.viewMode === 'watersheds') {
      let spans = null;
      if (basinCode && gridcode != null) {
        spans = this._zoneSpans(basinCode, gridcode);
      }
      if (!spans && basinName) {
        spans = this._watershedSpans(basinName);
      }
      spansHTML = this._renderSpansSection(spans);
    }

    const hero = document.getElementById('panel-hero');
    if (hero) {
      hero.className = 'panel-hero';
      hero.innerHTML = `<button onclick="APP._backToBasinPanel()" class="panel-back-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to ${this._escHtml(basinName).replace(/ River Watershed$/, '').replace(/ River$/, '')}
        </button>
        <div class="panel-level-badge">Sub-watershed</div>
        <h2 class="panel-title">Zone ${this._escHtml(String(gridcode))}</h2>
        <p class="panel-subtitle">Sub-catchment within ${this._escHtml(basinName).replace(/ River Watershed$/, ' Basin').replace(/ River Basin$/, ' Basin')}</p>`;
    }

    const html = `
      <div class="panel-section">
        <div class="panel-section-title">Details</div>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="stat-label">Zone Code</div>
            <div class="stat-value">${this._escHtml(String(gridcode))}</div>
          </div>
          ${areaHa > 0 ? `<div class="stat-box">
            <div class="stat-label">Area (Ha)</div>
            <div class="stat-value">${areaHa.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>` : ''}
        </div>
      </div>
      <div class="panel-section" style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
        <div class="panel-section-title">Map Overlays</div>
        <div class="toggle-row">
          <span>Sub-watersheds</span>
          <label class="toggle-switch">
            <input type="checkbox" ${this.state.showSubWatersheds ? 'checked' : ''} onchange="APP._toggleSubWatersheds()">
            <span class="toggle-knob"></span>
          </label>
        </div>
        <div class="overlay-controls" id="sw-controls" style="display:${this.state.showSubWatersheds ? 'block' : 'none'}; margin-top: 8px; padding-left: 4px;">
          <div class="overlay-slider-row">
            <label>Fill Opacity</label>
            <input type="range" min="0" max="1" step="0.05" value="${this.state.selectedFillOpacity ?? 0.3}" oninput="APP.state.selectedFillOpacity=parseFloat(this.value);APP._updateSubWatershedStyles()">
          </div>
          <div class="overlay-slider-row">
            <label>Outline Opacity</label>
            <input type="range" min="0" max="1" step="0.05" value="${this.state.subWatershedOutlineOpacity}" oninput="APP.state.subWatershedOutlineOpacity=parseFloat(this.value);APP._updateSubWatershedStyles()">
          </div>
          <div class="overlay-color-row">
            <label>Fill Color</label>
            <input type="color" value="${this.state.subWatershedFillColor}" onchange="APP.state.subWatershedFillColor=this.value;APP._updateSubWatershedStyles()">
          </div>
          <div class="overlay-color-row">
            <label>Outline Color</label>
            <input type="color" value="${this.state.subWatershedOutlineColor}" onchange="APP.state.subWatershedOutlineColor=this.value;APP._updateSubWatershedStyles()">
          </div>
        </div>
        <div class="toggle-row" style="margin-top: 12px;">
          <span>Stream Order</span>
          <label class="toggle-switch">
            <input type="checkbox" ${this.state.showStreamOrder ? 'checked' : ''} onchange="APP._toggleStreamOrder()">
            <span class="toggle-knob"></span>
          </label>
        </div>
        <div class="overlay-controls" id="so-controls" style="display:${this.state.showStreamOrder ? 'block' : 'none'}; margin-top: 0;">
          <div class="overlay-slider-row">
            <label>Opacity</label>
            <input type="range" min="0" max="1" step="0.05" value="${this.state.streamOrderOpacity}" oninput="APP.state.streamOrderOpacity=parseFloat(this.value);APP._updateStreamOrderStyles()">
          </div>
          <div class="overlay-color-row">
            <label>Color</label>
            <input type="color" value="${this.state.streamOrderColor}" onchange="APP.state.streamOrderColor=this.value;APP._updateStreamOrderStyles()">
          </div>
        </div>
        <div class="toggle-row" style="margin-top: 12px;">
          <span>Slope</span>
          <label class="toggle-switch">
            <input type="checkbox" ${this.state.showSlope ? 'checked' : ''} onchange="APP.slope.toggle()">
            <span class="toggle-knob"></span>
          </label>
        </div>
        <div id="slope-load-progress" class="slope-load-progress" style="margin-top: 6px; display: none;">
          <div class="slope-load-bar"><div class="slope-load-fill"></div></div>
          <span class="slope-load-label"></span>
        </div>
        <div class="overlay-controls" id="slope-controls" style="display:${this.state.showSlope ? 'block' : 'none'}; margin-top: 8px; padding-left: 4px;">
          <div class="overlay-slider-row">
            <label>Opacity</label>
            <input type="range" min="0" max="1" step="0.05" value="${this.state.slopeOpacity}" oninput="APP.state.slopeOpacity=parseFloat(this.value);APP.slope._setOpacity(parseFloat(this.value))">
          </div>
          <div class="overlay-color-row">
            <label>Color Scheme</label>
            <select onchange="APP.state.slopeColorScheme=this.value;APP.slope._setColorScheme(this.value)">
              <option value="default" ${this.state.slopeColorScheme === 'default' ? 'selected' : ''}>Default</option>
              <option value="terrain" ${this.state.slopeColorScheme === 'terrain' ? 'selected' : ''}>Terrain</option>
              <option value="heat" ${this.state.slopeColorScheme === 'heat' ? 'selected' : ''}>Heat</option>
            </select>
          </div>
        </div>
      </div>
      ${spansHTML}`;

    content.innerHTML = html;

    if (wasSpansOpen) {
      const newSpans = content.querySelector('.span-group');
      if (newSpans) newSpans.classList.remove('collapsed');
    }
    openProvinces.forEach(slug => {
      const acc = content.querySelector(`.province-accordion[data-province-slug="${slug}"]`);
      if (acc) acc.classList.remove('collapsed');
    });
    if (scrollTop > 0) {
      setTimeout(() => { content.scrollTop = scrollTop; }, 0);
    }

    document.body.classList.add('panel-open');
    document.body.classList.remove('panel-expanded');
    panel.classList.remove('expanded', 'open', 'closed', 'peek');
    if (window.innerWidth <= 640) { panel.classList.add('peek'); this.state.panelState = 'peek'; }
    else { panel.classList.add('open'); this.state.panelState = 'open'; }
  },

  /* Back button from sub-watershed panel → return to basin detail panel */
  _backToBasinPanel() {
    if (this.state.hydroSelectedBasin && this.state.hydroSelectedBasin.feature) {
      this._openWatershedPanel(this.state.hydroSelectedBasin.feature);
    }
  },

  /* Invert watershedIntersections: for the given watershed name, return
     { provinces: [{slug,label}], municipalities: [{slug,label,province}] }
     Uses the new namria/cad per-watershed spans sections when available,
     falling back to the old boundary→watershed inversion for backward compat. */
  _watershedSpans(wsName) {
    const data = this.state.watershedIntersections;
    if (!data) return { provinces: [], municipalities: [] };

    /* Try the new per-watershed spans sections first */
    const prefix = this.state.activeSource === 'cad' ? 'cad' : 'namria';
    if (data[prefix] && data[prefix][wsName]) {
      const entry = data[prefix][wsName];
      return {
        provinces: (entry.provinces || []).map(slug => ({ slug, label: this._prettySlug(slug) })),
        municipalities: (entry.municipalities || []).map(slug => {
          const parts = slug.split(':');
          return { slug, province: this._prettySlug(parts[0]), label: this._prettySlug(parts[1] || '') };
        }),
      };
    }

    /* Fallback: invert the old boundary→watershed arrays */
    const provinces = [];
    const municipalities = [];
    Object.keys(data).forEach(key => {
      if (!Array.isArray(data[key]) || !data[key].includes(wsName)) return;
      if (key.includes(':')) {
        const [provSlug, muniSlug] = key.split(':');
        municipalities.push({ slug: key, province: this._prettySlug(provSlug), label: this._prettySlug(muniSlug) });
      } else {
        provinces.push({ slug: key, label: this._prettySlug(key) });
      }
    });
    municipalities.sort((a, b) => a.province === b.province ? a.label.localeCompare(b.label) : a.province.localeCompare(b.province));
    return { provinces, municipalities };
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

    /* If the same boundary is tapped again, remove the outline and reset zoom */
    const currentSlug = type + ':' + slug;
    if (this.state.hydroAdminOutlineLayer && this.state.hydroAdminOutlineSlug === currentSlug) {
      map.removeLayer(this.state.hydroAdminOutlineLayer);
      this.state.hydroAdminOutlineLayer = null;
      this.state.hydroAdminOutlineSlug = null;
      document.querySelectorAll('.span-chip.active, .province-accordion-header.active').forEach(c => c.classList.remove('active'));
      
      let parentProvSlug = null;
      if (type === 'municipality') {
        const chip = document.querySelector(`.span-chip[onclick*="'${slug}'"]`);
        if (chip) {
          const accordion = chip.closest('.province-accordion');
          if (accordion) parentProvSlug = accordion.getAttribute('data-province-slug');
        }
      }

      if (parentProvSlug) {
        this._outlineAdminUnit('province', parentProvSlug);
        return;
      }

      /* Reset zoom to active watershed or full basins */
      if (this.state._selectedLeafletLayer && this.state._selectedLeafletLayer.getBounds) {
        map.flyToBounds(this.state._selectedLeafletLayer.getBounds(), { ...this._getPaddingOpts(), duration: 0.45, easeLinearity: 0.25 });
      } else if (this.state.hydroLayers && this.state.hydroLayers[0]) {
        map.flyToBounds(this.state.hydroLayers[0].getBounds(), { ...this._getPaddingOpts(), duration: 0.45, easeLinearity: 0.25 });
      }
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
          ? 'geoJSON/CAR CAD Municipal Boundary.topojson'
          : 'geoJSON/CAR NAMRIA ' + (adminLvl === 1 ? 'Provincial' : 'Municipal') + ' Boundary.topojson';
        const resp = await fetch(url);
        this.state.rawData[cacheKey] = window.decodeGeo(await resp.json());
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
    document.querySelectorAll('.span-chip.active, .province-accordion-header.active').forEach(c => c.classList.remove('active'));
    this.state.hydroAdminOutlineSlug = currentSlug;

    this.state.hydroAdminOutlineLayer = L.geoJSON(outlineData, {
      interactive: false,
      style: { color: '#dc2626', weight: 2.5, fillOpacity: 0.06, dashArray: '5 3', opacity: 0.9 },
    }).addTo(map);
    this.state.hydroAdminOutlineLayer.bringToFront();
    
    /* Mark the newly clicked element as active */
    const chip = document.querySelector(`.span-chip[onclick*="'${slug}'"], .province-accordion-header[onclick*="'${slug}'"]`);
    if (chip) chip.classList.add('active');

    /* Fly to the outlined unit */
    try {
      map.flyToBounds(this.state.hydroAdminOutlineLayer.getBounds(), { ...this._getPaddingOpts(), duration: 0.45, easeLinearity: 0.25 });
    } catch (_) {}
  },

  /* ── Watershed Overlay Toggle ───────────── */
  toggleWatershedMenu() {
    const baseOpts = document.getElementById('basemap-options');
    if (baseOpts) baseOpts.classList.remove('show');
    this._closeBoundaryMenu();

    const opts = document.getElementById('watershed-options');
    if (!opts) return;
    
    const list = document.getElementById('watershed-list');
    if (list && list.children.length === 0 && this.state.rawData['watershed']) {
      const features = this.state.rawData['watershed'].features || [];
      const names = features.map(f => f.properties.Name || f.properties.Old_Name || '').filter(Boolean).sort();
      let html = '';
      names.forEach(ws => {
        const isChecked = this.state.activeWatershedIds && this.state.activeWatershedIds.includes(ws);
        html += `
        <label class="watershed-option">
          <input type="checkbox" class="panel-ws-checkbox" value="${this._escHtml(ws)}" onchange="APP.updateWatersheds(this)" ${isChecked ? 'checked' : ''}> 
          ${this._escHtml(ws).replace(/ River Watershed$/, '').replace(/ Watershed$/, '')}
        </label>`;
      });
      list.innerHTML = html;
    }
    
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
    
    // Uncheck all checkboxes in the menu
    document.querySelectorAll('.panel-ws-checkbox').forEach(cb => {
      cb.checked = false;
    });
    
    const clearBtn = document.getElementById('watershed-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    
    if (this.state.viewMode === 'watersheds') {
      this.state.hydroActiveFilterIds = [];
      this._applyHydroFilter();
    }
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
    
    const clearBtn = document.getElementById('watershed-clear-btn');
    if (clearBtn) clearBtn.style.display = this.state.activeWatershedIds.length > 0 ? 'inline-block' : 'none';

    /* ── Hydro mode: filter the basin layer to only checked basins ── */
    if (this.state.viewMode === 'watersheds') {
      this.state.hydroActiveFilterIds = [...this.state.activeWatershedIds];
      this._applyHydroFilter();
      return;
    }

    // Initial load if needed
    if (!this.state.watershedLayer && this.state.activeWatershedIds.length > 0) {
      if (this.state._fetchingWatersheds) {
        await this.state._fetchingWatersheds;
      } else {
        this.state._fetchingWatersheds = (async () => {
          try {
            let data = this.state.rawData['watershed'];
            if (!data) {
              const response = await fetch('geoJSON/CAR Watersheds.topojson');
              data = await response.json();
              this.state.rawData['watershed'] = data;
            }

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
                      duration: 0.45,
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
  }
});
