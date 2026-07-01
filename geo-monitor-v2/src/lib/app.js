export const APP = {

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
    activeMode: 'boundary',
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
    showSubWatersheds: false,
    showStreamOrder: false,
    adminLayers: {},
    boundaryMenuOpen: false,
    customColors: null,
    showWatershedColors: false,
  },

  config: {},

  _src() {
    return this.config.sources[this.state.activeSource];
  },

  /* ── Init ────────────────────────────────── */
  init() {
    const el = document.getElementById('map');
    if (!el || el._leaflet_id) return;
    document.body.classList.add('mode-boundary');
    document.body.classList.add('mode-' + this.state.viewMode); /* R2: initial body class for source-toggle */

    const map = L.map('map', {
      center: this.config.mapCenter,
      zoom: this.config.mapZoom,
      minZoom: this.config.minZoom,
      maxZoom: this.config.maxZoom,
      maxBounds: this.config.maxBounds,
      zoomAnimation: true,
      zoomSnap: 0.5,
      preferCanvas: true,
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
      .then(r => r.json()).then(window.decodeGeo)
      .then(w => { this.state.watershedIntersections = w; })
      .catch(() => {});

    fetch('geoJSON/zone-intersections.json')
      .then(r => r.json()).then(window.decodeGeo)
      .then(z => { this.state.zoneIntersections = z; })
      .catch(() => {});
      
    // Prefetch watershed data for area lookups and hydro mode
    fetch('geoJSON/CAR Watersheds.topojson')
      .then(r => r.json()).then(window.decodeGeo)
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
      .then(r => r.json()).then(window.decodeGeo)
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
        .then(r => r.json()).then(window.decodeGeo)
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
        const shortName = this.state.hydroSelectedBasin.name.replace(/ River Watershed$/, '').replace(/ River$/, '');
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

  _toastTimer: null,
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

  /* Render the full Spans section HTML with count badges and province-grouped municipalities */
  _renderSpansSection(spans) {
    if (!spans || (!spans.provinces.length && !spans.municipalities.length)) return '';

    const muniByProvince = {};
    (spans.municipalities || []).forEach(m => {
      const key = m.province || 'Other';
      if (!muniByProvince[key]) muniByProvince[key] = [];
      muniByProvince[key].push(m);
    });

    let accordionHTML = '';
    (spans.provinces || []).forEach(prov => {
      const provName = prov.label || prov.name || prov.slug;
      const escapedName = this._escHtml(provName);
      const escapedSlug = this._escHtml(prov.slug).replace(/'/g, '&#39;');
      const munis = muniByProvince[provName] || muniByProvince[prov.slug] || [];
      
      let muniChips = '';
      if (munis.length) {
        muniChips = this._renderSpansChips(munis, 'municipality');
      } else {
        muniChips = '<div style="font-size: 11px; color: #9ca3af; padding: 4px;">No municipalities shown.</div>';
      }

      accordionHTML += `
          <div class="province-accordion collapsed" data-province-slug="${escapedSlug}">
            <div class="province-accordion-header" onclick="this.parentElement.classList.toggle('collapsed'); APP._outlineAdminUnit('province', '${escapedSlug}')">
              ${escapedName}
              <span class="province-muni-count">${munis.length}</span>
            </div>
            <div class="province-accordion-wrapper">
              <div class="province-accordion-content">
                <div class="span-chip-row">${muniChips}</div>
              </div>
            </div>
          </div>`;
    });

    return `
        <div class="panel-section">
          <div class="panel-section-title">Spans — Administrative Boundaries</div>
          ${this._renderSourceToggleHTML()}
          <div class="span-group collapsed">
            <div class="span-group-label" onclick="this.parentElement.classList.toggle('collapsed')">
              Provinces & Municipalities
              <span class="span-count-badge">${spans.provinces.length}</span>
            </div>
            <div class="span-group-wrapper">
              <div class="span-group-content">
                <div class="span-group-enclosed province-accordion-list">
                  ${accordionHTML}
                </div>
              </div>
            </div>
          </div>
          <p class="span-hint">Tap a province to explore its municipalities and overlay its outline.</p>
        </div>`;
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
      spansHTML = this._renderSpansSection(this._watershedSpans(name));
    }
    
    this.state.lastViewed = { feature, isWatershed: true };
    
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('info-panel-content');
    
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
          <span>Sub-watersheds</span>
          <label class="toggle-switch">
            <input type="checkbox" ${this.state.showSubWatersheds ? 'checked' : ''} onchange="APP._toggleSubWatersheds()">
            <span class="toggle-knob"></span>
          </label>
        </div>
        <div class="toggle-row" style="margin-top: 12px;">
          <span>Stream Order</span>
          <label class="toggle-switch">
            <input type="checkbox" ${this.state.showStreamOrder ? 'checked' : ''} onchange="APP._toggleStreamOrder()">
            <span class="toggle-knob"></span>
          </label>
        </div>
        <div class="toggle-row" style="margin-top: 12px;">
          <span>Slope</span>
          <label class="toggle-switch">
            <input type="checkbox" ${this.state.showSlope ? 'checked' : ''} onchange="APP._toggleSlope()">
            <span class="toggle-knob"></span>
          </label>
        </div>
        <div class="toggle-row" style="margin-top: 12px;">
          <span>Land Cover</span>
          <label class="toggle-switch">
            <input type="checkbox" ${this.state.showLCM ? 'checked' : ''} onchange="APP._toggleLCM()">
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
    
    if (wasSpansOpen) {
      const newSpans = content.querySelector('.span-group');
      if (newSpans) newSpans.classList.remove('collapsed');
    }
    openProvinces.forEach(slug => {
      const acc = content.querySelector(`.province-accordion[data-province-slug="${slug}"]`);
      if (acc) acc.classList.remove('collapsed');
    });
    if (scrollTop > 0) {
      // Small timeout to ensure DOM is ready
      setTimeout(() => { content.scrollTop = scrollTop; }, 0);
    }

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
