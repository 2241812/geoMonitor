Object.assign(APP, {

// Method _enterHydroMode not found

  _hydroBasinIndex(feature) {
    const name = feature.properties.Name || feature.properties.Old_Name || '';
    return Object.keys(this.config.hydroBasinFolderMap).indexOf(name);
  },

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
          L.DomEvent.stopPropagation(e);
          if (self.state._drilling) return;
          if (self.state.hydroDrillLevel !== 0) return;
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

  _removeHydroSilhouette() {
    if (this.state.hydroSilhouetteLayer) {
      this.state.map.removeLayer(this.state.hydroSilhouetteLayer);
      this.state.hydroSilhouetteLayer = null;
    }
  },

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
            fillColor: colors[idx] || '#6b7280',
            fillOpacity: 0.35,
            weight: 0,
            opacity: 0,
            className: 'fade-in-path',
          };
        } else {
          /* Border mode: standard view with strokes */
          return {
            fillColor: colors[idx] || '#6b7280',
            fillOpacity: 0.15,
            color: colors[idx] || '#6b7280',
            weight: 2,
            opacity: 0.9,
            className: 'fade-in-path',
          };
        }
      },
      onEachFeature(feature, leafletLayer) {
        if (silhouetteMode) return;
        const name = feature.properties.Name || feature.properties.Old_Name || 'Unknown';
        const idx = self._hydroBasinIndex(feature);
        const basinColor = colors[idx] || '#6b7280';

        leafletLayer.on('mouseover', function(e) {
          if (self.state.hydroDrillLevel !== 0) return;
          e.target.setStyle({ fillColor: basinColor, fillOpacity: 0.4, weight: 3, opacity: 1 });
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
          e.target.setStyle({ fillColor: basinColor, fillOpacity: 0.15, color: basinColor, weight: 2, opacity: 0.9 });
          self._hideHoverLabel();
        });

        leafletLayer.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          if (self.state._drilling) return;
          if (self.state.hydroDrillLevel !== 0) return;
          self._hydroDrillDown(feature, leafletLayer);
        });
      },
    }).addTo(map);
  },

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

// Method _hydroDrillDown not found

// Method _showHydroSubWatersheds not found

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
  },

  _deselectSubWatershed() {
    if (!this.state.hydroSelectedZone) return;
    this._restoreSubWatersheds();
    this.state.hydroSelectedZone = null;
    this.state.hydroSelectedZoneLayer = null;
    if (this.state.hydroSelectedBasin && this.state.hydroSelectedBasin.feature) {
      this._openWatershedPanel(this.state.hydroSelectedBasin.feature);
    }
    this._updateBreadcrumb();
  },

  _dimSubWatersheds(selectedFeature) {
    const layer = this.state.hydroLayers[1];
    if (!layer) return;
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
          fillColor: '#0ea5e9',
          fillOpacity: 0.55,
          color: '#0369a1',
          weight: 3,
          opacity: 1,
        });
        leafletLayer.bringToFront();
      }
    });
    /* Keep stream order on top */
    if (this.state.hydroLayers[2]) this.state.hydroLayers[2].bringToFront();
  },

  _restoreSubWatersheds() {
    const layer = this.state.hydroLayers[1];
    if (!layer) return;
    layer.eachLayer(function(leafletLayer) {
      delete leafletLayer._hiddenByIsolation;
      leafletLayer.setStyle({
        fillColor: '#0ea5e9',
        fillOpacity: 0.3,
        color: '#0284c7',
        weight: 1.2,
        opacity: 0.8,
      });
    });
  },

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

  _toggleStreamOrder() {
    this.state.showStreamOrder = !this.state.showStreamOrder;
    const sl = this.state.hydroLayers[2];
    if (!sl) return;
    if (this.state.showStreamOrder) {
      this.state.map.addLayer(sl);
      sl.bringToFront();
    } else {
      this.state.map.removeLayer(sl);
    }
  },

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

    /* Re-render basins in silhouette mode + silhouette border */
    this._clearHydroLayers();
    this._renderHydroBasins(true);
    this._renderHydroSilhouette(true);

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
  },

  _clearHydroLayers() {
    const map = this.state.map;
    if (!map) return;
    [0, 1, 2].forEach(l => {
      if (this.state.hydroLayers[l]) { map.removeLayer(this.state.hydroLayers[l]); this.state.hydroLayers[l] = null; }
    });
    this._removeHydroSilhouette();
  },

  _clearHydroState(keepViewMode) {
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
    this.state.showStreamOrder = false;
    this.state.hydroShowBoundary = false;
    this.state.activeOutline = null;
    this.state.outlineLayers = {};
    this.state._outlineHighlight = null;
    if (!keepViewMode) {
      this.state.viewMode = 'boundaries';
    }
    this._updateBreadcrumb();
  },

// Method _toggleHydroBoundary not found

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
              <span class="basin-picker-name">${this._escHtml(name).replace(/ River Watershed$/, '')}</span>
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
      hero.innerHTML = `<div class="panel-level-badge">14 Major Basins</div>
        <h2 class="panel-title">Watersheds</h2>
        <p class="panel-subtitle">Tap a basin to explore sub-watersheds &amp; stream network</p>`;
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

  _hydroDrillDownByName(name) {
    const wsData = this.state.rawData['watershed'];
    if (!wsData) return;
    /* If basins are in silhouette mode, reveal them first */
    if (this.state.hydroSilhouetteLayer) {
      this._silhouetteClick();
    }
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

  _openSubWatershedPanel(feature) {
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('info-panel-content');
    if (!panel || !content) return;

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
      /* Try zone-specific spans first */
      if (basinCode && gridcode != null) {
        spans = this._zoneSpans(basinCode, gridcode);
      }
      /* Fall back to basin-level spans if zone data not available */
      if (!spans && basinName) {
        spans = this._watershedSpans(basinName);
      }
      if (spans && (spans.provinces.length || spans.municipalities.length)) {
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

    const hero = document.getElementById('panel-hero');
    if (hero) {
      hero.className = 'panel-hero';
      hero.innerHTML = `<button onclick="APP._backToBasinPanel()" class="panel-back-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to ${this._escHtml(basinName).replace(/ River Watershed$/, '')}
        </button>
        <div class="panel-level-badge">Sub-watershed</div>
        <h2 class="panel-title">Zone ${this._escHtml(String(gridcode))}</h2>
        <p class="panel-subtitle">Sub-catchment within ${this._escHtml(basinName).replace(/ River Watershed$/, ' Basin')}</p>`;
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
      ${spansHTML}`;

    content.innerHTML = html;
    document.body.classList.add('panel-open');
    document.body.classList.remove('panel-expanded');
    panel.classList.remove('expanded', 'open', 'closed', 'peek');
    if (window.innerWidth <= 640) { panel.classList.add('peek'); this.state.panelState = 'peek'; }
    else { panel.classList.add('open'); this.state.panelState = 'open'; }
  },

  _backToBasinPanel() {
    if (this.state.hydroSelectedBasin && this.state.hydroSelectedBasin.feature) {
      this._openWatershedPanel(this.state.hydroSelectedBasin.feature);
    }
  },

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

  _resetWatershedState() {
    this.state.activeWatershedIds = [];
    if (this.state.watershedLayer) {
      this.state.map.removeLayer(this.state.watershedLayer);
      this.state.watershedLayer = null;
    }
    const wsBtn = document.getElementById('watershed-btn');
    if (wsBtn) wsBtn.classList.remove('active');
    const wsOpts = document.getElementById('watershed-options');
    if (wsOpts) wsOpts.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
  },

// Method updateWatersheds not found

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

  toggleWatershedMenu() {
    const baseOpts = document.getElementById('basemap-options');
    if (baseOpts) baseOpts.classList.remove('show');
    this._closeBoundaryMenu();

    const opts = document.getElementById('watershed-options');
    if (!opts) return;
    opts.classList.toggle('show');
  },

});
