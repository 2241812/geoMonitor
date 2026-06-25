Object.assign(APP, {

  _showAdminPickerPanel() {
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('info-panel-content');
    if (!panel || !content) return;

    this.state.lastViewed = null;

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
        const name = this._featureName(f, 1);
        const id = f.properties._id;
        const muniCount = this.state.hierarchy?.children?.[id]?.length || 0;
        const areaM2 = parseFloat(f.properties.Shape_Area || 0);
        const areaStr = areaM2 > 0 ? (areaM2 / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' km²' : '';
        itemsHtml += `
          <button class="basin-picker-item" onclick="APP._adminDrillDownByName('${this._escHtml(name)}')">
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
      /* CAD: group municipalities by Province property */
      const byProvince = {};
      data.features.forEach(f => {
        const prov = (f.properties.Province || '').trim();
        if (!prov) return;
        if (!byProvince[prov]) byProvince[prov] = [];
        byProvince[prov].push(f);
      });

      Object.keys(byProvince).sort().forEach(provName => {
        const munis = byProvince[provName];
        let itemsHtml = '';
        munis.forEach(f => {
          const name = this._featureName(f, 1);
          const areaM2 = parseFloat(f.properties.Shape_Area || 0);
          const areaStr = areaM2 > 0 ? (areaM2 / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' km²' : '';
          itemsHtml += `
            <button class="basin-picker-item" onclick="APP._adminDrillDownByName('${this._escHtml(name)}')">
              <div class="basin-picker-info">
                <span class="basin-picker-name">${this._escHtml(name)}</span>
                <span class="basin-picker-meta">
                  ${areaStr ? `<span class="basin-area">${areaStr}</span>` : ''}
                </span>
              </div>
              <svg class="basin-picker-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>`;
        });
        groupHtml += `
          <div class="basin-picker-group">
            <div class="basin-picker-group-title">${this._escHtml(provName)}</div>
            ${itemsHtml}
          </div>`;
      });
    }

    const html = `
      <div class="panel-hero basin-picker-hero">
        <div class="panel-level-badge">Administrative Boundaries</div>
        <h2 class="panel-title">Cordillera Administrative Region</h2>
        <p class="panel-subtitle">Tap a province/municipality to drill in</p>
      </div>
      <div class="panel-section basin-picker-section">
        ${groupHtml}
      </div>`;

    content.innerHTML = html;
    const ph = document.getElementById('panel-hero'); if(ph) ph.innerHTML=''; ph.className='panel-hero';
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
    const tab = document.getElementById('panel-toggle-tab');
    if (tab) tab.classList.add('hidden');
  },

  _adminDrillDownByName(name) {
    const layer = this.state.layers[1];
    if (!layer) return;
    let targetFeature = null, targetLayer = null;
    layer.eachLayer(lf => {
      const lfName = this._featureName(lf.feature, 1);
      if (lfName === name) { targetFeature = lf.feature; targetLayer = lf; }
    });
    if (targetFeature && targetLayer) this.drillDown(targetFeature, targetLayer);
  },

// Method _showLevel not found

// Method _prefetchLevel not found

// Method drillDown not found

// Method drillUp not found

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

  _openAdminPanel(feature, level) {
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
        <div class="legend-item"><span class="legend-dot watershed-dot"></span>Watershed</div>
      </div>
    </div>`;

    /* Watershed summary — always visible for level 0 (region) and level 1+ with intersections */
    const id = props._id;
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

  _heroSubtitle(props, level) {
    if (this.state.activeSource === 'cad') {
      if (level === 1) return props.Province || props.REGION || '';
      return 'Cordillera Administrative Region';
    }
    if (level === 2) return props.Province || props.PROVINCE || 'Province';
    if (level === 1) return 'Province — Cordillera Administrative Region';
    return 'Watershed Cradle of Northern Luzon';
  },

});
