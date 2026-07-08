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
        <p class="panel-subtitle">Administrative Boundary</p>`;
    }

    let html = '';


    /* 2. Details Section (Stats) */
    html += `<div class="panel-section">
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

    /* Resolve ID for lookups */
    let id = p._id;
    if (!id && level >= 1) {
      const name = this._featureName(feature, level).toLowerCase().replace(/\s+/g, '-');
      if (level === 1) {
        id = name;
      } else if (level === 2) {
        const prov = (p.Province || p.PROVINCE || '').toLowerCase().replace(/\s+/g, '-');
        id = prov ? `${prov}:${name}` : name;
      }
    } else if (level === 0) {
      id = "CAR";
    }

    /* 3. Sub-Features Accordion */
    if (level < this._src().maxLevel && this.state.hierarchy && this.state.hierarchy.children && id && this.state.hierarchy.children[id]) {
      const childrenIds = this.state.hierarchy.children[id];
      if (childrenIds.length > 0) {
        const childLevelName = this._src().levelNames[level + 1];
        const pluralName = childLevelName === 'Municipality' ? 'Municipalities' : `${childLevelName}s`;
        html += `<div class="panel-section">
          <div class="span-group collapsed">
            <div class="span-group-label" onclick="this.parentElement.classList.toggle('collapsed')">
              ${pluralName}
              <span class="span-count-badge">${childrenIds.length}</span>
            </div>
            <div class="span-group-wrapper">
              <div class="span-group-content">
                <div class="span-group-enclosed province-accordion-list">
                  ${childrenIds.map(childId => {
                    const childName = this.state.hierarchy.names[childId] || childId;
                    return `<button class="span-chip" onclick="APP._highlightSidebarSelection('${this._escHtml(childName)}', ${level + 1}, this)">
                      ${this._escHtml(this._toTitleCase(childName))}
                    </button>`;
                  }).join('')}
                </div>
              </div>
            </div>
          </div>
          <p class="span-hint">Tap an item to explore its boundaries.</p>
        </div>`;
      }
    }

    let intersectingWs = null;
    if (level >= 1 && this.state.watershedIntersections && id && this.state.watershedIntersections[id]) {
      intersectingWs = this.state.watershedIntersections[id];
    } else if (level === 0 && this.state.rawData['watershed']) {
      /* Show all watersheds for the region */
      intersectingWs = this.state.rawData['watershed'].features
        .map(f => f.properties.Name || f.properties.Old_Name)
        .filter(Boolean);
    }

    /* 4. Overview Section */
    const overviewTitle = `${this._src().levelNames[level]} Overview`;
    const pop = (level === 0) ? '1.8 million' : (level === 1 ? '200,000' : '50,000');
    html += `<div class="panel-section" style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
      <div class="panel-section-title">${overviewTitle}</div>`;
      
    if (intersectingWs && intersectingWs.length > 0) {
      html += `<div style="font-size: 0.85rem; font-weight: 600; color: #475569; margin-bottom: 8px;">Watersheds Spanned: <span style="background:#e0f2fe; color:#0369a1; padding: 2px 8px; border-radius: 99px; margin-left: 4px;">${intersectingWs.length}</span></div>`;
    }
    
    html += `<p style="font-size: 0.85rem; color: #374151; line-height: 1.6; margin-bottom: 0;">
        <strong>${this._toTitleCase(name)}</strong>, officially the ${this._src().levelNames[level]} of ${this._toTitleCase(name)}, is a ${this._src().levelNames[level].toLowerCase()} in the ${level === 2 ? ('province of ' + this._toTitleCase(p.Province || p.PROVINCE || '') + ', ') : ''}Philippines. According to the 2024 census, it has a population of ${pop} people.
      </p>
    </div>`;

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

    if (level >= 1) {
      d['Region'] = 'Cordillera Administrative Region (CAR)';
      if (level === 2) {
        const parentName = this._toTitleCase(props.Province || props.PROVINCE || props.Muni_City || '');
        if (parentName) d['Province'] = parentName;
        if (props.CENR_Cov) d['CENRO'] = this._toTitleCase(props.CENR_Cov);
      }
    }

    if (this.state.activeSource === 'cad') {
      if (props.Remarks && props.Remarks.trim()) d['Remarks'] = props.Remarks.trim();
    } else {
      if (level === 2) {
        if (props.X_Coord && props.Y_Coord) {
          d['Coordinates'] = `${(+props.Y_Coord).toFixed(4)}, ${(+props.X_Coord).toFixed(4)}`;
        }
      } else if (level === 1) {
        const cc = childCount(props._id);
        if (cc !== null) d['Municipalities'] = String(cc);
      } else {
        const cc = childCount(props._id);
        if (cc !== null) d['Provinces'] = String(cc);
      }
    }
    
    const sqMeters = parseFloat(props.Shape_Area || props.AREA || 0);
    let hectares = parseFloat(props.Hectares || props.Area || 0);
    if (hectares <= 0 && sqMeters > 0) hectares = sqMeters / 10000;
    
    if (hectares > 0) {
      d['Area (Ha)'] = hectares.toLocaleString(undefined, { maximumFractionDigits: 2 });
      let sizeCategory = '';
      if (level === 2) {
        if (hectares < 10000) sizeCategory = 'Small';
        else if (hectares <= 50000) sizeCategory = 'Medium';
        else sizeCategory = 'Large';
        d['Size'] = `${sizeCategory} sized municipality`;
      } else if (level === 1) {
        if (hectares < 100000) sizeCategory = 'Small';
        else if (hectares <= 300000) sizeCategory = 'Medium';
        else sizeCategory = 'Large';
        d['Size'] = `${sizeCategory} sized province`;
      } else {
        d['Size'] = 'Large sized region';
      }
    }
    
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
    const existing = document.querySelector('.data-request-overlay');
    if (existing) existing.remove();

    const summary = this._buildDataSummary(feature, level, panelType);

    const overlay = document.createElement('div');
    overlay.className = 'data-request-overlay';
    overlay.innerHTML = [
      '<div class="data-request-modal">',
      '  <div class="data-request-header">',
      '    <h3>Request Data<small>Submit an enquiry to obtain this geographic data</small></h3>',
      '    <button class="data-request-close" onclick="APP._closeDataRequest()" aria-label="Close">',
      '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '    </button>',
      '  </div>',
      '  <div class="data-request-body">',
      '    <div class="data-request-object">',
      '      <div class="data-request-object-label">Selected Object</div>',
      '      <div class="data-request-object-name">' + this._escHtml(summary.name) + '</div>',
      '      <div class="data-request-object-meta">',
      '        <span>Type: ' + this._escHtml(summary.typeLabel) + '</span>',
             summary.details.map(function(d) { return '<span>' + this._escHtml(d) + '</span>'; }.bind(this)).join(''),
      '      </div>',
      '    </div>',
      '    <div class="form-row">',
      '      <div class="form-group">',
      '        <label>Full Name <span class="required">*</span></label>',
      '        <input type="text" id="dr-name" placeholder="e.g. Juan Dela Cruz" required>',
      '      </div>',
      '      <div class="form-group">',
      '        <label>Email Address <span class="required">*</span></label>',
      '        <input type="email" id="dr-email" placeholder="e.g. juan@example.com" required>',
      '      </div>',
      '    </div>',
      '    <div class="form-group">',
      '      <label>Affiliation / Organization</label>',
      '      <input type="text" id="dr-org" placeholder="e.g. DENR, NAMRIA, University, Private Sector">',
      '    </div>',
      '    <div class="form-group">',
      '      <label>Purpose of Request <span class="required">*</span></label>',
      '      <select id="dr-purpose" required>',
      '        <option value="">Select purpose\u2026</option>',
      '        <option value="Academic Research">Academic Research</option>',
      '        <option value="Environmental Planning">Environmental Planning</option>',
      '        <option value="Policy Development">Policy Development</option>',
      '        <option value="Infrastructure Project">Infrastructure Project</option>',
      '        <option value="Disaster Risk Reduction">Disaster Risk Reduction</option>',
      '        <option value="Resource Management">Resource Management</option>',
      '        <option value="Personal / Educational">Personal / Educational</option>',
      '        <option value="Other">Other</option>',
      '      </select>',
      '    </div>',
      '    <div class="form-group">',
      '      <label>Additional Notes / Specific Data Requirements</label>',
      '      <textarea id="dr-notes" placeholder="Describe the specific data you need, preferred format (e.g. Shapefile, GeoJSON), coordinate system, etc."></textarea>',
      '    </div>',
      '  </div>',
      '  <div class="data-request-footer">',
      '    <button class="btn-secondary" onclick="APP._closeDataRequest()">Cancel</button>',
      '    <button class="btn-primary" onclick="APP._submitDataRequest()">',
      '      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
      '      Send Request via Email',
      '    </button>',
      '  </div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(overlay);
    overlay.offsetHeight;
    overlay.classList.add('show');
  },

  _closeDataRequest() {
    var overlay = document.querySelector('.data-request-overlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(function() { overlay.remove(); }, 250);
    }
  },

  _submitDataRequest() {
    var name = document.getElementById('dr-name');
    var email = document.getElementById('dr-email');
    var org = document.getElementById('dr-org');
    var purpose = document.getElementById('dr-purpose');
    var notes = document.getElementById('dr-notes');

    if (!name || !name.value.trim()) {
      if (name) { name.focus(); name.style.borderColor = '#dc2626'; }
      return;
    }
    if (!email || !email.value.trim() || !email.value.includes('@')) {
      if (email) { email.focus(); email.style.borderColor = '#dc2626'; }
      return;
    }
    if (!purpose || !purpose.value) {
      if (purpose) { purpose.focus(); purpose.style.borderColor = '#dc2626'; }
      return;
    }

    var objNameEl = document.querySelector('.data-request-object-name');
    var objMetaEl = document.querySelector('.data-request-object-meta');
    var objectName = objNameEl ? objNameEl.textContent.trim() : 'Unspecified';
    var objectMeta = objMetaEl ? objMetaEl.textContent.trim() : '';

    var subject = encodeURIComponent('Data Request: ' + objectName + ' \u2014 DENR CAR GeoPortal');
    var bodyLines = [
      'Good day,',
      '',
      'I would like to request geographic data from the DENR CAR Watershed Monitoring portal.',
      '',
      '--- Request Details ---',
      'Requested Object: ' + objectName,
      'Object Info: ' + objectMeta,
      '',
      '--- Requestor Information ---',
      'Name: ' + name.value.trim(),
      'Email: ' + email.value.trim(),
      'Organization: ' + (org ? org.value.trim() || 'Not specified' : 'Not specified'),
      'Purpose: ' + purpose.value,
      '',
      '--- Additional Notes ---',
      (notes ? notes.value.trim() || 'None' : 'None'),
      '',
      '---',
      'This request was submitted via the DENR CAR Watershed Monitoring GeoPortal.',
      'https://geo-monitor-ten.vercel.app',
    ];
    var body = encodeURIComponent(bodyLines.join('\n'));

    var recipient = this.config.dataRequestEmail || 'car@denr.gov.ph';
    window.location.href = 'mailto:' + recipient + '?subject=' + subject + '&body=' + body;
    this._closeDataRequest();
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
