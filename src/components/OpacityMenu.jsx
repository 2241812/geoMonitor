/*
 * OpacityMenu — Floating control for adjusting selected zone fill/outline opacity.
 *
 * Appears as a toggle button (bottom-right, beside Leaflet zoom controls) that
 * opens an upward popup with two range sliders: Fill Opacity and Outline Opacity.
 * Values are written to window.APP.state and trigger _updateSubWatershedStyles().
 *
 * CSS classes (all prefixed "opacity-menu-*") live in map.css.
 */

import { useState, useCallback } from 'react';

const DEFAULT_FILL = 0.55;
const DEFAULT_OUTLINE = 1.0;

/* Basin names in hydroBasinFolderMap insertion order (matching _hydroBasinIndex) */
const BASIN_NAMES = [
  'Abra River Watershed',
  'Abulug River Watershed',
  'Agno River Watershed',
  'Bayogao River Watershed',
  'Aringay River Watershed',
  'Bued River Watershed',
  'Cabicungan River Watershed',
  'Mallig River Watershed',
  'Naguilian River Watershed',
  'Siffu River Watershed',
  'Santa Maria River Watershed',
  'Upper Chico River Watershed',
  'Upper Magat River Watershed',
  'Zumigui-Ziwanan River Watershed',
];

/* Short label: strip " River Watershed" / " Watershed" suffix */
function shortLabel(name) {
  return name.replace(/ River Watershed$/, '').replace(/ Watershed$/, '');
}

/* Initialize window.APP.state.customColors if not yet set */
function ensureCustomColors() {
  if (!window.APP) return null;
  if (!window.APP.state.customColors) {
    const colors = window.APP.config && window.APP.config.hydroLevelColors
      ? [...window.APP.config.hydroLevelColors]
      : BASIN_NAMES.map(() => '#6b7280');
    window.APP.state.customColors = {
      watersheds: colors,
      subWatershed: '#d1d5db',
      adminLevel0: '#059669',
      adminLevel1: '#2563eb',
      adminLevel2: '#d97706',
    };
  }
  return window.APP.state.customColors;
}

export default function OpacityMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [fillOpacity, setFillOpacity] = useState(DEFAULT_FILL);
  const [outlineOpacity, setOutlineOpacity] = useState(DEFAULT_OUTLINE);

  const [showColors, setShowColors] = useState(false);
  const [showWatershedColors, setShowWatershedColors] = useState(false);

  /* Initialize watershedColors from config on first render */
  const [watershedColors, setWatershedColors] = useState(() => {
    const cc = ensureCustomColors();
    return cc ? [...cc.watersheds] : BASIN_NAMES.map(() => '#6b7280');
  });

  /* Sub-watershed & admin boundary color pickers */
  const [subWatershedColor, setSubWatershedColor] = useState(() => {
    const cc = ensureCustomColors();
    return (cc && cc.subWatershed) || '#d1d5db';
  });
  const [adminLevel0Color, setAdminLevel0Color] = useState(() => {
    const cc = ensureCustomColors();
    return (cc && cc.adminLevel0) || '#059669';
  });
  const [adminLevel1Color, setAdminLevel1Color] = useState(() => {
    const cc = ensureCustomColors();
    return (cc && cc.adminLevel1) || '#2563eb';
  });
  const [adminLevel2Color, setAdminLevel2Color] = useState(() => {
    const cc = ensureCustomColors();
    return (cc && cc.adminLevel2) || '#d97706';
  });

  const handleFillOpacityChange = (e) => {
    const val = parseFloat(e.target.value);
    setFillOpacity(val);
    if (window.APP) {
      window.APP.state.selectedFillOpacity = val;
      if (window.APP._updateSubWatershedStyles) {
        window.APP._updateSubWatershedStyles();
      }
    }
  };

  const handleOutlineOpacityChange = (e) => {
    const val = parseFloat(e.target.value);
    setOutlineOpacity(val);
    if (window.APP) {
      window.APP.state.selectedOutlineOpacity = val;
      if (window.APP._updateSubWatershedStyles) {
        window.APP._updateSubWatershedStyles();
      }
    }
  };

  const handleWatershedColorToggle = useCallback(() => {
    const newVal = !showWatershedColors;
    setShowWatershedColors(newVal);
    if (window.APP) {
      window.APP.state.showWatershedColors = newVal;
      if (window.APP._applyCustomColors) {
        window.APP._applyCustomColors();
      }
    }
  }, [showWatershedColors]);

  const handleColorChange = useCallback((idx, ev) => {
    const newColors = [...watershedColors];
    newColors[idx] = ev.target.value;
    setWatershedColors(newColors);
    if (window.APP) {
      const cc = ensureCustomColors();
      if (cc) cc.watersheds[idx] = ev.target.value;
      if (window.APP._applyCustomColors) {
        window.APP._applyCustomColors();
      }
    }
  }, [watershedColors]);

  const handleSubWatershedColorChange = useCallback((ev) => {
    const val = ev.target.value;
    setSubWatershedColor(val);
    if (window.APP) {
      const cc = ensureCustomColors();
      if (cc) cc.subWatershed = val;
      if (window.APP._applyCustomColors) window.APP._applyCustomColors();
    }
  }, []);

  const handleAdminColorChange = useCallback((level, ev) => {
    const val = ev.target.value;
    const key = 'adminLevel' + level;
    if (window.APP) {
      const cc = ensureCustomColors();
      if (cc) cc[key] = val;
      if (window.APP._applyCustomColors) window.APP._applyCustomColors();
    }
    /* Update local state based on level */
    if (level === 0) setAdminLevel0Color(val);
    else if (level === 1) setAdminLevel1Color(val);
    else if (level === 2) setAdminLevel2Color(val);
  }, []);

  return (
    <div className="opacity-menu-wrapper">
      <button
        className="map-icon-btn opacity-menu-btn"
        onClick={() => setIsOpen((v) => !v)}
        title="Adjust Selected Boundary Opacity"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      </button>

      <div className={`opacity-menu-popup${isOpen ? ' show' : ''}`}>
        <div className="opacity-menu-header">Selected Zone Settings</div>

        <div className="opacity-menu-slider-group">
          <div className="opacity-menu-slider-label">
            <span>Fill Opacity</span>
            <span>{Math.round(fillOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            className="opacity-menu-slider"
            min="0"
            max="1"
            step="0.05"
            value={fillOpacity}
            onChange={handleFillOpacityChange}
          />
        </div>

        <div className="opacity-menu-slider-group">
          <div className="opacity-menu-slider-label">
            <span>Outline Opacity</span>
            <span>{Math.round(outlineOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            className="opacity-menu-slider"
            min="0"
            max="1"
            step="0.05"
            value={outlineOpacity}
            onChange={handleOutlineOpacityChange}
          />
        </div>

        {/* ── Colors Section ── */}
        <div className="opacity-menu-section">
          <button
            className={`opacity-menu-section-toggle${showColors ? ' expanded' : ''}`}
            onClick={() => setShowColors((v) => !v)}
          >
            <span>Colors</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showColors && (
            <>
              <div className="opacity-menu-toggle-row">
                <span className="opacity-menu-toggle-label">Color-code Watersheds</span>
                <div
                  className={`opacity-menu-toggle${showWatershedColors ? ' active' : ''}`}
                  onClick={handleWatershedColorToggle}
                  role="switch"
                  aria-checked={showWatershedColors}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleWatershedColorToggle(); }}
                />
              </div>

              {showWatershedColors && (
                <div className="opacity-menu-color-grid">
                  {BASIN_NAMES.map((name, idx) => (
                    <div key={name} className="opacity-menu-color-item">
                      <input
                        type="color"
                        className="opacity-menu-color-input"
                        value={watershedColors[idx]}
                        onChange={(ev) => handleColorChange(idx, ev)}
                        title={name}
                      />
                      <span>{shortLabel(name)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="opacity-menu-section-heading">Sub-watershed &amp; Boundaries</div>

              <div className="opacity-menu-color-row">
                <span className="opacity-menu-toggle-label">Sub-watershed Fill</span>
                <input type="color" className="opacity-menu-color-input" value={subWatershedColor} onChange={handleSubWatershedColorChange} title="Sub-watershed Fill Color" />
              </div>
              <div className="opacity-menu-color-row">
                <span className="opacity-menu-toggle-label">Region Fill</span>
                <input type="color" className="opacity-menu-color-input" value={adminLevel0Color} onChange={(ev) => handleAdminColorChange(0, ev)} title="Region Fill Color" />
              </div>
              <div className="opacity-menu-color-row">
                <span className="opacity-menu-toggle-label">Province Fill</span>
                <input type="color" className="opacity-menu-color-input" value={adminLevel1Color} onChange={(ev) => handleAdminColorChange(1, ev)} title="Province Fill Color" />
              </div>
              <div className="opacity-menu-color-row">
                <span className="opacity-menu-toggle-label">Municipality Fill</span>
                <input type="color" className="opacity-menu-color-input" value={adminLevel2Color} onChange={(ev) => handleAdminColorChange(2, ev)} title="Municipality Fill Color" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
