import { APP } from './app.js';
/**
 * dashboard.js
 * The floating info panel and detail rendering methods.
 */

Object.assign(APP, {
  /* ── Info Panel ───────────────────────────── */
  openPanel(feature, level) {
    if (level === 0 && this.state.viewMode === 'boundaries') {
      this._showBoundaryPicker(feature, level);
      return;
    }

    const panel = document.getElementById('info-panel');
    const content = document.getElementById('info-panel-content');
    if (!panel || !content) return;
    
    this._updatePanelHeader();
    document.body.classList.add('panel-open');
    this.state.lastViewed = { feature, level };

    const name = this._toTitleCase(this._featureName(feature, level));
    const p = feature.properties || {};

    const hero = document.getElementById('panel-hero');
    if (hero) {
      hero.className = 'panel-hero';
      hero.innerHTML = `<div class="panel-level-badge">${this._src().levelNames[level]}</div>
        <h2 class="panel-title">${this._escHtml(name)}</h2>
        <p class="panel-subtitle">${this._src().levelNames[level]}</p>`;
    }

    /* Details Section */
    const isCAD = this.state.activeMode === 'cad';
    let html = `<div class="panel-section">
      <div class="panel-section-title">Details</div>
      <div class="stat-grid">`;
    
    const details = this._resolveDetails(p, level, name);
    Object.entries(details).forEach(([k, v]) => {
      html += `<div class="stat-box">
        <div class="stat-label">${this._escHtml(k)}</div>
        <div class="stat-value">${this._escHtml(v)}</div>
      </div>`;
    });

    html += `</div></div>`;

    const chartData = this._resolveChartData(p);
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
        <div class="legend-item"><span class="legend-dot watershed-dot"></span>Watershed</div>
      </div>
    </div>`;

    /* Watershed summary — always visible for level 0 (region) and level 1+ with intersections */
    const id = p._id;
    let intersectingWs = null;
    if (level >= 1 && this.state.watershedIntersections && id && this.state.watershedIntersections[id]) {
      intersectingWs = this.state.watershedIntersections[id];
    } else if (level === 0 && this.state.rawData['watershed']) {
      /* Show all watersheds for the region */
      intersectingWs = this.state.rawData['watershed'].features
        .map(f => f.properties.Name || f.properties.Old_Name)
        .filter(Boolean);
    }

    if (intersectingWs && intersectingWs.length > 0) {
      html += `<div class="panel-section">
        <div class="panel-section-title">Watersheds <span style="background:#e0f2fe; color:#0369a1; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; margin-left: 6px; vertical-align: middle;">${intersectingWs.length}</span></div>
        <div class="watershed-summary-list">
          ${intersectingWs.slice(0, 5).map(ws => {
            let areaText = '';
            let outflowText = '';
            if (this.state.rawData['watershed']) {
              const wsFeature = this.state.rawData['watershed'].features.find(f => {
                const n = f.properties.Name || f.properties.Old_Name || '';
                return n === ws;
              });
              if (wsFeature && wsFeature.properties.Area_Ha) {
                areaText = `<span class="ws-area">${wsFeature.properties.Area_Ha.toLocaleString(undefined, {maximumFractionDigits:0})} Ha</span>`;
              }
              outflowText = this.config.watershedConnections[ws] || '';
            }
            return `<div class="watershed-summary-item">
              <div class="ws-summary-name">${this._escHtml(ws)}</div>
              <div class="ws-summary-meta">${areaText}${outflowText ? `<span class="ws-outflow-inline">→ ${this._escHtml(outflowText)}</span>` : ''}</div>
            </div>`;
          }).join('')}
          ${intersectingWs.length > 5 ? `<div class="watershed-summary-more">+ ${intersectingWs.length - 5} more watersheds</div>` : ''}
        </div>
      </div>`;
    }

    /* Add Show More Button and Expanded Content — for drilling into specific admin boundaries */
    let expandedHtml = '';
    if (level >= 1 && this.state.watershedIntersections && id && this.state.watershedIntersections[id]) {
      const wsForCheckboxes = this.state.watershedIntersections[id];
      if (wsForCheckboxes.length > 0) {
        expandedHtml = `<div class="expanded-content">
          <div class="panel-section-title">Overlay on Map <span style="background:#e0f2fe; color:#0369a1; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; margin-left: 6px; vertical-align: middle;">${wsForCheckboxes.length}</span></div>
          <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 12px; margin-top: -4px;">Toggle watersheds to highlight them on the map:</p>
          <div class="watershed-list">
            ${wsForCheckboxes.map(ws => {
              let areaText = '';
              if (this.state.rawData['watershed']) {
                const wsFeature = this.state.rawData['watershed'].features.find(f => {
                  const n = f.properties.Name || f.properties.Old_Name || '';
                  return n === ws;
                });
                if (wsFeature && wsFeature.properties.Area_Ha) {
                  areaText = `<span style="font-size: 0.8rem; color: #6b7280; margin-left: auto;">${wsFeature.properties.Area_Ha.toLocaleString(undefined, {maximumFractionDigits:0})} Ha</span>`;
                }
              }
              return `
              <div class="watershed-list-item">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; width: 100%;">
                  <input type="checkbox" class="panel-ws-checkbox" value="${this._escHtml(ws)}" onchange="APP.updateWatersheds(this)" ${this.state.activeWatershedIds && this.state.activeWatershedIds.includes(ws) ? 'checked' : ''} style="accent-color: #0284c7; width: 16px; height: 16px;">
                  <span style="font-weight: 500;">${this._escHtml(ws)}</span>
                  ${areaText}
                </label>
              </div>`;
            }).join('')}
          </div>
        </div>`;

        html += `<div class="panel-show-more">
          <button class="show-more-btn view-ws-btn" onclick="APP.toggleExpandedPanel()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View Watersheds on Map (${wsForCheckboxes.length})
          </button>
        </div>`;
        html += expandedHtml;
      }
    }

    content.innerHTML = html;
    panel.classList.remove('open', 'closed', 'peek');
    panel.classList.add('open');
    this.state.panelState = 'open';
    document.body.classList.add('panel-open');

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
    
    panel.classList.remove('open', 'expanded', 'peek');
    panel.classList.add('closed');
    this.state.panelState = 'closed';
    document.body.classList.remove('panel-open', 'panel-expanded');
    const tab = document.getElementById('panel-toggle-tab');
    if (tab) tab.classList.remove('hidden');

    this._updatePanelToggleIcon();
  },

  togglePanel() {
    const panel = document.getElementById('info-panel');
    if (!panel) return;
    const isMobile = window.innerWidth <= 640;
    
    if (isMobile) {
      if (panel.classList.contains('open')) {
        this.closePanel();
      } else if (panel.classList.contains('peek')) {
        panel.classList.remove('peek', 'closed');
        panel.classList.add('open');
        document.body.classList.add('panel-open');
      } else {
        panel.classList.remove('closed');
        panel.classList.add('peek');
        this.state.panelState = 'peek';
        this._updatePanelToggleIcon();
      }
    } else {
      if (panel.classList.contains('open')) {
        this.closePanel();
      } else {
        // Just slide it open without destroying the DOM
        panel.classList.remove('closed', 'peek');
        panel.classList.add('open');
        this.state.panelState = 'open';
        document.body.classList.add('panel-open');
        this._updatePanelToggleIcon();
        
        // If the panel is completely empty (e.g. first load), show default fallback
        const content = document.getElementById('info-panel-content');
        if (!content || !content.innerHTML.trim()) {
          const carData = this.state.rawData[0];
          if (carData && carData.features) {
            this.openPanel(carData.features[0], 0);
          }
        }
      }
    }
  },

  /* Sync the left-edge toggle tab visibility with current panel state.
     Tab is visible when panel is closed; hidden when open or peeking. */
  _updatePanelToggleIcon() {
    const tab = document.getElementById('panel-toggle-tab');
    if (!tab) return;
    const panel = document.getElementById('info-panel');
    const isOpen = panel && (panel.classList.contains('open') || panel.classList.contains('peek'));
    tab.classList.toggle('hidden', isOpen);
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
    if (hectares > 0) d['Area (Ha)'] = hectares.toLocaleString(undefined, { maximumFractionDigits: 2 });
    
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

  /* Build a summary of the currently selected feature for the data request form */
  _buildDataSummary(feature, level, panelType) {
    const p = feature.properties || {};
    const src = this._src();
    let typeLabel = '', name = '', details = [];

    if (panelType === 'watershed') {
      typeLabel = 'Watershed Basin';
      name = p.Name || p.Old_Name || 'Unknown Watershed';
      if (p.WSID) details.push('ID: ' + p.WSID);
      if (p.Area_Ha) details.push('Area: ' + p.Area_Ha.toLocaleString(undefined, {maximumFractionDigits:2}) + ' Ha');
      if (p.SIZE_W) details.push('Size: ' + p.SIZE_W);
      const outflow = this.config.watershedConnections[name];
      if (outflow) details.push('Outflow: ' + outflow);
    } else if (panelType === 'subwatershed') {
      typeLabel = 'Sub-watershed Zone';
      const gc = p.gridcode != null ? p.gridcode : '?';
      name = 'Zone ' + gc;
      if (this.state.hydroSelectedBasin) {
        details.push('Basin: ' + this.state.hydroSelectedBasin.name);
      }
      const areaM2 = parseFloat(p.Shape_Area || 0);
      if (areaM2 > 0) details.push('Area: ' + (areaM2 / 10000).toLocaleString(undefined, {maximumFractionDigits:2}) + ' Ha');
      if (gc != null) details.push('Zone Code: ' + gc);
    } else if (panelType === 'general') {
      typeLabel = 'General Map Data';
      name = 'General Enquiry';
      details.push('Please specify exactly what data you need in the notes below.');
    } else {
      typeLabel = src.levelNames[level] || 'Boundary';
      name = this._toTitleCase(this._featureName(feature, level));
      details.push('Source: ' + src.label);
      details.push('Data Level: ' + src.levelNames[level]);
      const areaM2 = parseFloat(p.Shape_Area || p.AREA || 0);
      if (areaM2 > 0) details.push('Area: ' + (areaM2 / 10000).toLocaleString(undefined, {maximumFractionDigits:2}) + ' Ha');
      const hectares = parseFloat(p.Hectares || p.Area || 0);
      if (hectares > 0) details.push('Area (Ha): ' + hectares.toLocaleString(undefined, {maximumFractionDigits:2}));
      if (p._id) details.push('Reference ID: ' + p._id);
    }

    return { typeLabel, name, details };
  },

  /* Open the data request form for the currently selected feature */
  _openRequestFromToolbar() {
    if (this.state.viewMode === 'watersheds') {
      if (this.state.hydroSelectedZone && this.state.hydroSelectedZone.feature) {
        return this._showDataRequestForm(this.state.hydroSelectedZone.feature, 0, 'subwatershed');
      }
      if (this.state.hydroSelectedBasin && this.state.hydroSelectedBasin.feature) {
        return this._showDataRequestForm(this.state.hydroSelectedBasin.feature, 0, 'watershed');
      }
    } else {
      const lastSelected = this.state.selectedPath && this.state.selectedPath[this.state.selectedPath.length - 1];
      if (lastSelected && lastSelected.feature) {
        return this._showDataRequestForm(lastSelected.feature, this.state.currentLevel, 'boundary');
      }
    }
    this._showDataRequestForm({}, 0, 'general');
  },

  _showDataRequestForm(feature, level, panelType) {
    var existing = document.querySelector('.data-request-overlay');
    if (existing) existing.remove();

    var summary = this._buildDataSummary(feature, level, panelType);
    var self = this;

    /* ── Spatial Extent options based on context ── */
    var extentOptions = [
      { id: 'dr-extent-car', value: 'Entire CAR', label: 'Entire CAR', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' },
      { id: 'dr-extent-view', value: 'Current Map View', label: 'Current Map View', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' }
    ];
    if (panelType === 'watershed' || panelType === 'subwatershed') {
      extentOptions.splice(1, 0, { id: 'dr-extent-basin', value: 'Selected Basin', label: self.state.hydroSelectedBasin ? (self.state.hydroSelectedBasin.name || 'Selected Basin') : 'Selected Basin', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>' });
    }
    if (panelType === 'subwatershed') {
      extentOptions.splice(2, 0, { id: 'dr-extent-zone', value: 'Selected Zone', label: self.state.hydroSelectedZone ? (self.state.hydroSelectedZone.name || 'Selected Zone') : 'Selected Zone', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>' });
    }

    var extentHtml = extentOptions.map(function(opt, i) {
      return '<label class="dr-radio-card" for="' + opt.id + '">' +
        '<input type="radio" name="dr-extent" id="' + opt.id + '" value="' + self._escHtml(opt.value) + '"' + (i === 0 ? ' checked' : '') + '>' +
        '<span class="dr-radio-indicator"></span>' +
        '<span class="dr-radio-icon">' + opt.icon + '</span>' +
        '<span class="dr-radio-label">' + self._escHtml(opt.label) + '</span>' +
      '</label>';
    }).join('');

    var detailsHtml = summary.details.map(function(d) { return '<span>' + self._escHtml(d) + '</span>'; }).join('');

    var html = [
      '<div class="data-request-modal">',
      '<div class="data-request-header">',
        '<h3>Request Data<small>Submit an enquiry to obtain this geographic data</small></h3>',
        '<button class="data-request-close" onclick="APP._closeDataRequest()" aria-label="Close">',
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
        '</button>',
      '</div>',
      '<div class="data-request-body">',

      '<div class="data-request-object">',
        '<div class="data-request-object-label">Selected Object</div>',
        '<div class="data-request-object-name">' + this._escHtml(summary.name) + '</div>',
        '<div class="data-request-object-meta">',
          '<span>Type: ' + this._escHtml(summary.typeLabel) + '</span>',
          detailsHtml,
        '</div>',
      '</div>',

      '<div class="dr-section">',
        '<div class="dr-section-title">Data Layers <span class="dr-required">*</span></div>',
        '<div class="dr-chip-grid">',
          self._drChip('dr-layer-watershed', 'Watershed Boundaries', 'Watershed Boundaries', true),
          self._drChip('dr-layer-subwatershed', 'Sub-watershed Zones', 'Sub-watershed Zones', true),
          self._drChip('dr-layer-stream', 'Stream Order', 'Stream Order', true),
          self._drChip('dr-layer-slope', 'Slope Data', 'Slope Data', true),
          self._drChip('dr-layer-lcm', 'Land Cover (LCM)', 'Land Cover (LCM)', true),
          self._drChip('dr-layer-admin', 'Administrative Boundaries', 'Administrative Boundaries', false),
        '</div>',
      '</div>',

      '<div class="dr-section">',
        '<div class="dr-section-title">Data Format</div>',
        '<div class="dr-radio-grid">',
          '<label class="dr-radio-card" for="dr-fmt-geojson">',
            '<input type="radio" name="dr-format" id="dr-fmt-geojson" value="GeoJSON" checked>',
            '<span class="dr-radio-indicator"></span>',
            '<span class="dr-radio-label">GeoJSON</span>',
            '<span class="dr-radio-desc">Web-friendly, lightweight</span>',
          '</label>',
          '<label class="dr-radio-card" for="dr-fmt-shape">',
            '<input type="radio" name="dr-format" id="dr-fmt-shape" value="Shapefile">',
            '<span class="dr-radio-indicator"></span>',
            '<span class="dr-radio-label">Shapefile</span>',
            '<span class="dr-radio-desc">GIS software compatible</span>',
          '</label>',
          '<label class="dr-radio-card" for="dr-fmt-csv">',
            '<input type="radio" name="dr-format" id="dr-fmt-csv" value="CSV">',
            '<span class="dr-radio-indicator"></span>',
            '<span class="dr-radio-label">CSV</span>',
            '<span class="dr-radio-desc">Tabular data</span>',
          '</label>',
          '<label class="dr-radio-card" for="dr-fmt-all">',
            '<input type="radio" name="dr-format" id="dr-fmt-all" value="All Formats">',
            '<span class="dr-radio-indicator"></span>',
            '<span class="dr-radio-label">All Formats</span>',
            '<span class="dr-radio-desc">Everything above</span>',
          '</label>',
        '</div>',
      '</div>',

      '<div class="dr-section">',
        '<div class="dr-section-title">Spatial Extent</div>',
        '<div class="dr-radio-grid">' + extentHtml + '</div>',
      '</div>',

      '<div class="dr-section">',
        '<div class="dr-section-title">Requestor Information</div>',
        '<div class="dr-form-row">',
          '<div class="dr-field">',
            '<label class="dr-label">Full Name <span class="dr-required">*</span></label>',
            '<input type="text" id="dr-name" class="dr-input" placeholder="e.g. Juan Dela Cruz">',
          '</div>',
          '<div class="dr-field">',
            '<label class="dr-label">Email Address <span class="dr-required">*</span></label>',
            '<input type="email" id="dr-email" class="dr-input" placeholder="e.g. juan@example.com">',
          '</div>',
        '</div>',
        '<div class="dr-form-row">',
          '<div class="dr-field">',
            '<label class="dr-label">Organization</label>',
            '<input type="text" id="dr-org" class="dr-input" placeholder="e.g. DENR, NAMRIA, University">',
          '</div>',
          '<div class="dr-field">',
            '<label class="dr-label">Contact Number</label>',
            '<input type="tel" id="dr-phone" class="dr-input" placeholder="e.g. 0917 123 4567">',
          '</div>',
        '</div>',
      '</div>',

      '<div class="dr-section">',
        '<div class="dr-section-title">Purpose of Request <span class="dr-required">*</span></div>',
        '<div class="dr-chip-grid">',
          self._drRadioChip('dr-purpose', 'Academic Research', 'Academic Research'),
          self._drRadioChip('dr-purpose', 'Environmental Planning', 'Environmental Planning'),
          self._drRadioChip('dr-purpose', 'Policy Development', 'Policy Development'),
          self._drRadioChip('dr-purpose', 'Infrastructure Project', 'Infrastructure Project'),
          self._drRadioChip('dr-purpose', 'Disaster Risk Reduction', 'Disaster Risk Reduction'),
          self._drRadioChip('dr-purpose', 'Resource Management', 'Resource Management'),
          self._drRadioChip('dr-purpose', 'Personal / Educational', 'Personal / Educational'),
          self._drRadioChip('dr-purpose', 'Other', 'Other'),
        '</div>',
      '</div>',

      '<div class="dr-section">',
        '<div class="dr-section-title">Additional Notes</div>',
        '<textarea id="dr-notes" class="dr-textarea" placeholder="Describe specific data requirements, coordinate system, time period, etc."></textarea>',
      '</div>',

      '</div>',
      '<div class="data-request-footer">',
        '<button class="btn-secondary" onclick="APP._closeDataRequest()">Cancel</button>',
        '<button class="btn-primary" onclick="APP._submitDataRequest()">',
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
          ' Submit Request',
        '</button>',
      '</div>',
    '</div>'
    ].join('');

    var overlay = document.createElement('div');
    overlay.className = 'data-request-overlay';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    overlay.offsetHeight;
    overlay.classList.add('show');

    /* Close on overlay background click */
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) self._closeDataRequest();
    });
  },

  /* ── Form helper: checkbox chip ── */
  _drChip(id, value, label, checked) {
    return '<label class="dr-chip" for="' + id + '">' +
      '<input type="checkbox" id="' + id + '" value="' + this._escHtml(value) + '"' + (checked ? ' checked' : '') + '>' +
      '<span class="dr-chip-check">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' +
      '</span>' +
      '<span class="dr-chip-label">' + this._escHtml(label) + '</span>' +
    '</label>';
  },

  /* ── Form helper: radio chip (purpose) ── */
  _drRadioChip(name, value, label) {
    var id = 'dr-' + name.replace(/\s+/g, '-') + '-' + value.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    return '<label class="dr-chip dr-chip-radio" for="' + id + '">' +
      '<input type="radio" name="' + name + '" id="' + id + '" value="' + this._escHtml(value) + '">' +
      '<span class="dr-chip-radio-dot"></span>' +
      '<span class="dr-chip-label">' + this._escHtml(label) + '</span>' +
    '</label>';
  },

  _closeDataRequest() {
    var overlay = document.querySelector('.data-request-overlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(function() { overlay.remove(); }, 250);
    }
  },

  _submitDataRequest() {
    var nameEl = document.getElementById('dr-name');
    var emailEl = document.getElementById('dr-email');
    var orgEl = document.getElementById('dr-org');
    var phoneEl = document.getElementById('dr-phone');
    var notesEl = document.getElementById('dr-notes');

    /* Validate required fields */
    var valid = true;
    [nameEl, emailEl].forEach(function(el) {
      if (!el || !el.value.trim()) {
        if (el) { el.focus(); el.style.borderColor = '#dc2626'; }
        valid = false;
      } else {
        el.style.borderColor = '';
      }
    });
    if (!valid) return;

    if (!emailEl.value.includes('@')) {
      emailEl.focus();
      emailEl.style.borderColor = '#dc2626';
      return;
    }

    /* Collect selected data layers */
    var layers = [];
    document.querySelectorAll('.dr-chip input[type="checkbox"]:checked').forEach(function(cb) {
      layers.push(cb.value);
    });
    if (layers.length === 0) {
      var firstChip = document.querySelector('.dr-chip-grid .dr-chip');
      if (firstChip) firstChip.style.borderColor = '#dc2626';
      return;
    }

    /* Collect format */
    var formatEl = document.querySelector('input[name="dr-format"]:checked');
    var format = formatEl ? formatEl.value : 'GeoJSON';

    /* Collect extent */
    var extentEl = document.querySelector('input[name="dr-extent"]:checked');
    var extent = extentEl ? extentEl.value : 'Entire CAR';

    /* Collect purpose */
    var purposeEl = document.querySelector('input[name="dr-purpose"]:checked');
    if (!purposeEl) {
      var firstPurpose = document.querySelector('.dr-chip-radio');
      if (firstPurpose) firstPurpose.style.borderColor = '#dc2626';
      return;
    }

    /* Object info */
    var objNameEl = document.querySelector('.data-request-object-name');
    var objMetaEl = document.querySelector('.data-request-object-meta');
    var objectName = objNameEl ? objNameEl.textContent.trim() : 'Unspecified';
    var objectMeta = objMetaEl ? objMetaEl.textContent.trim() : '';

    var payload = {
      objectName: objectName,
      objectMeta: objectMeta,
      dataLayers: layers,
      format: format,
      extent: extent,
      name: nameEl.value.trim(),
      email: emailEl.value.trim(),
      organization: orgEl ? orgEl.value.trim() : '',
      contactNumber: phoneEl ? phoneEl.value.trim() : '',
      purpose: purposeEl.value,
      notes: notesEl ? notesEl.value.trim() : '',
      timestamp: new Date().toISOString(),
      sourceUrl: window.location.href
    };

    var endpoint = this.config.dataRequestEndpoint;

    if (endpoint) {
      var submitBtn = document.querySelector('.data-request-footer .btn-primary');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending...'; }

      fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function() {
        alert('Request submitted successfully! You will receive a confirmation at ' + payload.email + '.');
        APP._closeDataRequest();
      }).catch(function() {
        alert('Request submitted. Thank you!');
        APP._closeDataRequest();
      });
    } else {
      /* Fallback: open mailto with structured body */
      var subject = encodeURIComponent('Data Request: ' + objectName + ' \u2014 DENR CAR GeoPortal');
      var bodyLines = [
        'Good day,',
        '',
        'I would like to request geographic data from the DENR CAR Watershed Monitoring portal.',
        '',
        '--- Request Details ---',
        'Requested Object: ' + objectName,
        'Object Info: ' + objectMeta,
        'Data Layers: ' + layers.join(', '),
        'Format: ' + format,
        'Spatial Extent: ' + extent,
        '',
        '--- Requestor Information ---',
        'Name: ' + payload.name,
        'Email: ' + payload.email,
        'Organization: ' + (payload.organization || 'Not specified'),
        'Contact: ' + (payload.contactNumber || 'Not specified'),
        'Purpose: ' + payload.purpose,
        '',
        '--- Additional Notes ---',
        (payload.notes || 'None'),
        '',
        '---',
        'Submitted via DENR CAR Watershed Monitoring GeoPortal.',
        'https://geo-monitor-ten.vercel.app',
      ];
      var body = encodeURIComponent(bodyLines.join('\n'));
      var recipient = this.config.dataRequestEmail || 'renzoj156@gmail.com';
      window.location.href = 'mailto:' + recipient + '?subject=' + subject + '&body=' + body;
      this._closeDataRequest();
    }
  },

  /* Force Zone A (the white header bar) to match the current global mode.
     Called at the top of every panel-open method so the header is never stale. */
  _updatePanelHeader() {
    const mode = this.state.viewMode;
    const labelEl = document.getElementById('panel-header-label');
    if (labelEl) {
      labelEl.textContent = mode === 'watersheds' ? 'Watershed Monitor' : 'Boundary Explorer';
    }
    const iconEl = document.getElementById('panel-header-icon');
    if (iconEl) {
      iconEl.innerHTML = mode === 'watersheds'
        ? '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'
        : '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>';
    }
  }
});

// Legacy shims
function initDashboard() {}
function updateDashboard(feature) { if (feature && APP) APP.openPanel(feature, APP.state.currentLevel); }
function clearDashboard() { APP.closePanel(); }
