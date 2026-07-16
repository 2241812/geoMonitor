import { APP } from './app.js';
import { submitDataRequest } from './supabase-geo.js';
import emailjs from '@emailjs/browser';

emailjs.init('230ECLuWvZ-VBUOvq');
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

    let id = p._id;
    if (!id && level >= 1) {
      const nameLower = this._featureName(feature, level).toLowerCase().replace(/\s+/g, '-');
      if (level === 1) {
        id = nameLower;
      } else if (level === 2) {
        const prov = (p.Province || p.PROVINCE || '').toLowerCase().replace(/\s+/g, '-');
        id = prov ? `${prov}:${nameLower}` : nameLower;
      }
    } else if (level === 0) {
      id = 'CAR';
    }

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
                  ${[...childrenIds].sort((a, b) => {
                    const nameA = this.state.hierarchy.names[a] || a;
                    const nameB = this.state.hierarchy.names[b] || b;
                    return nameA.localeCompare(nameB);
                  }).map(childId => {
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
        <div class="watershed-compact-list">
          ${intersectingWs.slice(0, 6).map(ws => {
            return `<div class="watershed-compact-item">${this._escHtml(ws)}</div>`;
          }).join('')}
          ${intersectingWs.length > 6 ? `<div class="watershed-compact-more">+ ${intersectingWs.length - 6} more</div>` : ''}
        </div>
      </div>`;
    }

    const overviewTitle = `${this._src().levelNames[level]} Overview`;
    const overviewTexts = {
      'cordillera administrative region': 'The Cordillera Administrative Region (CAR) is the only landlocked region in the Philippines, nestled in the mountainous northern part of Luzon. Established in 1987, it encompasses six provinces — Abra, Apayao, Benguet, Ifugao, Kalinga, and Mountain Province — and is home to the country\'s highest peak, Mount Apo, as well as the UNESCO World Heritage Rice Terraces of the Philippine Cordilleras. The region is a major watershed hub, feeding major river systems that flow into both the South China Sea and the Philippine Sea.',
      'abra': 'Abra is a landlocked province in the western part of CAR, bordered by Ilocos Norte and Apayao to the north, Mountain Province to the east, and Ilocos Sur to the south. Known for its rolling terrain and the Abra River — one of the longest river systems in the region — the province is a mix of lowland valleys and upland communities with a predominantly Ilocano and Tingguian population.',
      'apayao': 'Apayao is the northernmost province of CAR, sharing a boundary with Kalinga to the south and Cagayan to the east. The province is known for its dense forests, the Apayao River, and the Ambuklao watershed area. It is home to the Isneg people and remains one of the most forested and least densely populated provinces in the region.',
      'benguet': 'Benguet is a landlocked province in the southern part of CAR, known as the "Salad Bowl of the Philippines" for its extensive vegetable farming industry. It hosts Baguio City — the region\'s commercial center — and is home to the Ibaloi and Kankanaey peoples. The province is traversed by the Agno River system and contains major watershed areas feeding the Agno and Ambuklao basins.',
      'ifugao': 'Ifugao is a landlocked province in the eastern part of CAR, most famous for the Banaue Rice Terraces — a UNESCO World Heritage Site often called the "Eighth Wonder of the World." Carved into the mountains over 2,000 years ago by the Ifugao people, the terraces are a testament to ancient engineering and sustainable agriculture. The province is traversed by the Magat and Ibulao river systems.',
      'kalinga': 'Kalinga is a landlocked province in the northeastern part of CAR, bordered by Apayao to the north, Mountain Province to the south, and Cagayan to the east. The province is known for its well-preserved indigenous culture, particularly among the Kalinga people, and the Chico River system that runs through its valleys. It is one of the most culturally distinct provinces in the Philippines.',
      'mountain province': 'Mountain Province is a landlocked province in the central part of CAR, known for its rugged terrain, caves, and hanging coffins — an ancient burial tradition of the Igorot people. The province is traversed by major river systems and contains significant watershed areas that feed the Agno and Chico river basins. It is one of the original seven provinces of the old Mountain Province established during the American colonial period.',
    };
    let overviewKey = (id || '').toLowerCase().replace(/-/g, ' ').replace(/^namria:/, '').replace(/^cad:/, '');
    if (overviewKey === 'car') overviewKey = 'cordillera administrative region';
    const overviewFallback = `${this._toTitleCase(name)} is a ${this._src().levelNames[level].toLowerCase()} in the Cordillera Administrative Region (CAR), Philippines — the country's only landlocked region in northern Luzon.`;
    const overviewBody = overviewTexts[overviewKey] || overviewFallback;
    html += `<div class="panel-section" style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
      <div class="panel-section-title">${overviewTitle}</div>
      <p style="font-size: 0.85rem; color: #374151; line-height: 1.6; margin-bottom: 0;">
        ${overviewBody}
      </p>
    </div>`;

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

  _resolveDetails(props, level, _name) {
    const d = {};
    const hierarchy = this.state.hierarchy;
    const childCount = (id) => {
      if (!hierarchy || !hierarchy.children) return null;
      const kids = hierarchy.children[id];
      return kids ? kids.length : null;
    };

    // Pre-calculate size category
    const sqMeters = parseFloat(props.Shape_Area || 0);
    let hectares = parseFloat(props.Hectares || props.Area || props.AREA || 0);
    if (hectares <= 0 && sqMeters > 0) hectares = sqMeters / 10000;
    
    let sizeCategory = '';
    if (hectares > 0) {
      if (level === 2) {
        if (hectares < 10000) sizeCategory = 'Small';
        else if (hectares <= 50000) sizeCategory = 'Medium';
        else sizeCategory = 'Large';
        sizeCategory = `${sizeCategory} sized municipality`;
      } else if (level === 1) {
        if (hectares < 100000) sizeCategory = 'Small';
        else if (hectares <= 300000) sizeCategory = 'Medium';
        else sizeCategory = 'Large';
        sizeCategory = `${sizeCategory} sized province`;
      } else {
        sizeCategory = 'Large sized region';
      }
    }

    // Build properties dictionary sequentially to strictly enforce layout order
    if (level === 2) {
      // Municipality
      if (props.Province || props.PROVINCE) d['Province'] = props.Province || props.PROVINCE;
      if (sizeCategory) d['Size'] = sizeCategory;
      if (props.CENR_Cov) d['CENRO'] = props.CENR_Cov;
      if (props.X_Coord && props.Y_Coord) {
        d['Coordinates'] = `${(+props.Y_Coord).toFixed(4)}, ${(+props.X_Coord).toFixed(4)}`;
      }
      if (props.Remarks && props.Remarks.trim()) d['Remarks'] = props.Remarks.trim();
    } else if (level === 1) {
      // Province
      d['Region'] = 'Cordillera Administrative Region';
      if (sizeCategory) d['Size'] = sizeCategory;
      if (props.Remarks && props.Remarks.trim()) d['Remarks'] = props.Remarks.trim();
    } else {
      // Region
      d['Island Group'] = 'Luzon';
      if (sizeCategory) d['Size'] = sizeCategory;
      if (props.Remarks && props.Remarks.trim()) d['Remarks'] = props.Remarks.trim();
      const cc = childCount(props._id);
      if (cc !== null) d['Provinces'] = String(cc);
    }
    
    if (hectares > 0) d['Area (Ha)'] = hectares.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    let perimeter = parseFloat(props.PERIMETER || props.Perimeter || 0);
    if (perimeter <= 0 && props.Shape_Length) perimeter = parseFloat(props.Shape_Length) / 1000;
    if (perimeter > 0) d['Perimeter (km)'] = perimeter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
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
      if (p.Area_Ha) details.push('Area: ' + p.Area_Ha.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Ha');
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
      if (areaM2 > 0) details.push('Area: ' + (areaM2 / 10000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Ha');
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
      const areaM2 = parseFloat(p.Shape_Area || 0);
      if (areaM2 > 0) details.push('Area: ' + (areaM2 / 10000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Ha');
      const hectares = parseFloat(p.Hectares || p.Area || p.AREA || 0);
      if (hectares > 0) details.push('Area (Ha): ' + hectares.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
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
    if (panelType === 'boundary') {
      var boundaryItem = this.state.selectedPath && this.state.selectedPath[this.state.selectedPath.length - 1];
      if (boundaryItem && boundaryItem.name) {
        extentOptions.splice(1, 0, { id: 'dr-extent-boundary', value: 'Selected ' + (this.state.currentLevel === 1 ? 'Province' : 'Municipality'), label: boundaryItem.name, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' });
      }
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
          panelType === 'boundary'
            ? self._drChip('dr-layer-admin', 'Administrative Boundaries', 'Administrative Boundaries', true) +
              self._drChip('dr-layer-slope', 'Slope Data', 'Slope Data', false) +
              self._drChip('dr-layer-lcm', 'Land Cover (LCM)', 'Land Cover (LCM)', false)
            : self._drChip('dr-layer-watershed', 'Watershed Boundaries', 'Watershed Boundaries', true) +
              self._drChip('dr-layer-subwatershed', 'Sub-watershed Zones', 'Sub-watershed Zones', true) +
              self._drChip('dr-layer-stream', 'Stream Order', 'Stream Order', true) +
              self._drChip('dr-layer-slope', 'Slope Data', 'Slope Data', true) +
              self._drChip('dr-layer-lcm', 'Land Cover (LCM)', 'Land Cover (LCM)', true) +
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
        '<div class="dr-chip-grid" id="dr-purpose-grid">',
          self._drRadioChip('dr-purpose', 'Academic Research', 'Academic Research'),
          self._drRadioChip('dr-purpose', 'Environmental Planning', 'Environmental Planning'),
          self._drRadioChip('dr-purpose', 'Policy Development', 'Policy Development'),
          self._drRadioChip('dr-purpose', 'Infrastructure Project', 'Infrastructure Project'),
          self._drRadioChip('dr-purpose', 'Disaster Risk Reduction', 'Disaster Risk Reduction'),
          self._drRadioChip('dr-purpose', 'Resource Management', 'Resource Management'),
          self._drRadioChip('dr-purpose', 'Personal / Educational', 'Personal / Educational'),
          self._drRadioChip('dr-purpose', 'Other', 'Other'),
        '</div>',
        '<input type="text" id="dr-purpose-other" class="dr-input" placeholder="Please specify your purpose..." style="margin-top:8px;" disabled>',
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
    if (window.__lenis) window.__lenis.stop();

    /* Close on overlay background click */
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) self._closeDataRequest();
    });

    document.querySelectorAll('input[name="dr-purpose"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var otherInput = document.getElementById('dr-purpose-other');
        if (otherInput) {
          if (this.value === 'Other') {
            otherInput.disabled = false;
            otherInput.style.opacity = '1';
            otherInput.focus();
          } else {
            otherInput.disabled = true;
            otherInput.style.opacity = '0';
            otherInput.value = '';
          }
        }
      });
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
      if (window.__lenis) window.__lenis.start();
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
      purpose: purposeEl.value === 'Other'
        ? (document.getElementById('dr-purpose-other').value.trim() || 'Other')
        : purposeEl.value,
      notes: notesEl ? notesEl.value.trim() : '',
      timestamp: new Date().toISOString(),
      sourceUrl: window.location.href
    };

    var submitBtn = document.querySelector('.data-request-footer .btn-primary');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

    Promise.allSettled([
      submitDataRequest(payload),
      emailjs.send('service_0a4sxdr', 'template_gjkgvri', {
        name: payload.name,
        email: payload.email,
        organization: payload.organization || 'Not specified',
        contact_number: payload.contactNumber || 'Not specified',
        object_name: objectName,
        object_meta: objectMeta,
        data_layers: layers.join(', '),
        format: format,
        extent: extent,
        purpose: payload.purpose,
        notes: payload.notes || 'None',
        source_url: payload.sourceUrl,
      }),
    ]).then(function(results) {
      if (results[0].status === 'rejected') {
        if (import.meta.env.DEV) console.error('Supabase insert failed:', results[0].reason);
      }
      var emailOk = results[1].status === 'fulfilled';
      if (!emailOk) {
        if (import.meta.env.DEV) console.error('EmailJS failed:', results[1].reason);
      }
      if (emailOk) {
        alert('Request submitted! A confirmation will be sent to ' + payload.email + '.');
      } else {
        alert('Request saved in database. Email notification may not have been sent — we will review your request manually.');
      }
      APP._closeDataRequest();
    });
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


