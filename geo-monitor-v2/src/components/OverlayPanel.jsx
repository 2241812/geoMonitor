import { useState, useEffect, useRef } from 'react';
import { useMapStore } from '../store/useMapStore';
import APP from '../lib/index.js';
import { LCM_CLASSES } from '../lib/lcm-manager.js';

/**
 * OverlayPanel — right-side panel for map overlay controls.
 * Hidden by default, toggled via the overlay-toggle button.
 * Hides when drilling into a basin (level 1).
 */

export default function OverlayPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);
  const hydroDrillLevel = useMapStore((s) => s.hydroDrillLevel);
  const showSlope = useMapStore((s) => s.showSlope);
  const showStreamOrder = useMapStore((s) => s.showStreamOrder);
  const showSubWatersheds = useMapStore((s) => s.showSubWatersheds ?? false);
  const showLCM = useMapStore((s) => s.showLCM ?? false);

  const isLevel0 = hydroDrillLevel === 0;

  useEffect(() => {
    if (!isLevel0 && isOpen) {
      setIsOpen(false);
    }
  }, [isLevel0]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (isOpen && isLevel0) {
      el.classList.add('overlay-panel-visible');
      el.classList.remove('overlay-panel-hidden');
    } else {
      el.classList.remove('overlay-panel-visible');
      el.classList.add('overlay-panel-hidden');
    }
  }, [isOpen, isLevel0]);

  return (
    <>
      <button
        className="overlay-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle overlay controls"
        style={{ display: isLevel0 ? 'flex' : 'none' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 12 12 17 22 12"></polyline>
          <polyline points="2 17 12 22 22 17"></polyline>
        </svg>
      </button>

      <div
        ref={panelRef}
        className="overlay-panel overlay-panel-hidden"
        id="overlay-panel"
      >
        <div className="overlay-panel-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 12 12 17 22 12"></polyline>
            <polyline points="2 17 12 22 22 17"></polyline>
          </svg>
          <span>Overlays</span>
          <button className="overlay-close-btn" onClick={() => setIsOpen(false)} title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="overlay-panel-content">
          {/* Sub-watersheds Section */}
          <div className="overlay-section">
            <div className="toggle-row">
              <span>Sub-watersheds</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showSubWatersheds}
                  onChange={() => APP._toggleSubWatersheds()}
                />
                <span className="toggle-knob"></span>
              </label>
            </div>
            <div
              className="overlay-controls"
              id="sw-controls"
              style={{ display: showSubWatersheds ? 'block' : 'none', marginTop: '8px' }}
            >
              <div className="overlay-slider-row">
                <label>Fill Opacity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  defaultValue={APP.state.selectedFillOpacity ?? 0.3}
                  onInput={(e) => {
                    APP.state.selectedFillOpacity = parseFloat(e.target.value);
                    APP._updateSubWatershedStyles();
                  }}
                />
              </div>
              <div className="overlay-slider-row">
                <label>Outline Opacity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  defaultValue={APP.state.subWatershedOutlineOpacity ?? 0.8}
                  onInput={(e) => {
                    APP.state.subWatershedOutlineOpacity = parseFloat(e.target.value);
                    APP._updateSubWatershedStyles();
                  }}
                />
              </div>
              <div className="overlay-color-row">
                <label>Fill Color</label>
                <input
                  type="color"
                  defaultValue={APP.state.subWatershedFillColor ?? '#3b82f6'}
                  onChange={(e) => {
                    APP.state.subWatershedFillColor = e.target.value;
                    APP._updateSubWatershedStyles();
                  }}
                />
              </div>
              <div className="overlay-color-row">
                <label>Outline Color</label>
                <input
                  type="color"
                  defaultValue={APP.state.subWatershedOutlineColor ?? '#000000'}
                  onChange={(e) => {
                    APP.state.subWatershedOutlineColor = e.target.value;
                    APP._updateSubWatershedStyles();
                  }}
                />
              </div>
            </div>
          </div>

          {/* Stream Order Section */}
          <div className="overlay-section" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '12px' }}>
            <div className="toggle-row">
              <span>Stream Order</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showStreamOrder}
                  onChange={() => APP._toggleStreamOrder()}
                />
                <span className="toggle-knob"></span>
              </label>
            </div>
            <div
              className="overlay-controls"
              id="so-controls"
              style={{ display: showStreamOrder ? 'block' : 'none', marginTop: '8px' }}
            >
              <div className="overlay-slider-row">
                <label>Opacity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  defaultValue={APP.state.streamOrderOpacity ?? 1}
                  onInput={(e) => {
                    APP.state.streamOrderOpacity = parseFloat(e.target.value);
                    APP._updateStreamOrderStyles();
                  }}
                />
              </div>
              <div className="overlay-color-row">
                <label>Color</label>
                <input
                  type="color"
                  defaultValue={APP.state.streamOrderColor ?? '#0022ff'}
                  onChange={(e) => {
                    APP.state.streamOrderColor = e.target.value;
                    APP._updateStreamOrderStyles();
                  }}
                />
              </div>
            </div>
          </div>

          {/* Slope Section */}
          <div className="overlay-section" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '12px' }}>
            <div className="toggle-row">
              <span>Slope</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showSlope}
                  onChange={() => APP.slope.toggle()}
                />
                <span className="toggle-knob"></span>
              </label>
            </div>

            <div
              id="slope-load-progress"
              className="slope-load-progress"
              style={{ marginTop: '6px', display: 'none' }}
            >
              <div className="slope-load-bar">
                <div className="slope-load-fill"></div>
              </div>
              <span className="slope-load-label"></span>
            </div>

            <div
              className="overlay-controls"
              id="slope-controls"
              style={{ display: showSlope ? 'block' : 'none', marginTop: '8px' }}
            >
              <div className="overlay-slider-row">
                <label>Opacity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  defaultValue={APP.state.slopeOpacity}
                  onInput={(e) => {
                    APP.state.slopeOpacity = parseFloat(e.target.value);
                    APP.slope._setOpacity(parseFloat(e.target.value));
                  }}
                />
              </div>
              <div className="overlay-color-row">
                <label>Color Scheme</label>
                <select
                  defaultValue={APP.state.slopeColorScheme}
                  onChange={(e) => {
                    APP.state.slopeColorScheme = e.target.value;
                    APP.slope._setColorScheme(e.target.value);
                  }}
                >
                  <option value="default">Default</option>
                  <option value="terrain">Terrain</option>
                  <option value="heat">Heat</option>
                </select>
              </div>
            </div>
          </div>

          {/* LCM Section */}
          <div className="overlay-section" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '12px' }}>
            <div className="toggle-row">
              <span>Land Cover (LCM)</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showLCM}
                  onChange={() => APP._toggleLCM()}
                />
                <span className="toggle-knob"></span>
              </label>
            </div>

            <div
              id="lcm-load-progress"
              className="slope-load-progress"
              style={{ marginTop: '6px', display: 'none' }}
            >
              <div className="lcm-load-bar">
                <div className="lcm-load-fill"></div>
              </div>
              <span className="lcm-load-label"></span>
            </div>

            <div
              className="overlay-controls"
              id="lcm-controls"
              style={{ display: showLCM ? 'block' : 'none', marginTop: '8px' }}
            >
              <div className="overlay-slider-row">
                <label>Opacity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  defaultValue={APP.state.lcmOpacity ?? 0.65}
                  onInput={(e) => {
                    APP.state.lcmOpacity = parseFloat(e.target.value);
                    APP.lcm._setOpacity(parseFloat(e.target.value));
                  }}
                />
              </div>
              <div className="lcm-class-toggles">
                <div className="lcm-class-header">
                  <b>Land Cover Classes</b>
                  <span className="lcm-class-actions">
                    <a href="#" onClick={(e) => { e.preventDefault(); APP._lcmShowAll(); }} style={{ fontSize: '11px', cursor: 'pointer' }}>All</a>
                    <span style={{ color: '#ccc', margin: '0 2px' }}>|</span>
                    <a href="#" onClick={(e) => { e.preventDefault(); APP._lcmHideAll(); }} style={{ fontSize: '11px', cursor: 'pointer' }}>None</a>
                  </span>
                </div>
                {LCM_CLASSES.map((c) => (
                  <label key={c.name} className="lcm-class-row">
                    <input
                      type="checkbox"
                      checked={APP.lcm.isClassVisible(c.name)}
                      onChange={() => APP._toggleLCMClass(c.name)}
                    />
                    <span className="lcm-class-swatch" style={{ background: c.color }}></span>
                    <span className="lcm-class-label">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Basin Style Section */}
          <div className="overlay-section" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '12px' }}>
            <div className="overlay-section-title">Basin Style</div>

            <div className="overlay-slider-row">
              <label>Fill Opacity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                defaultValue={APP.state.basinFillOpacity}
                onInput={(e) => {
                  APP.state.basinFillOpacity = parseFloat(e.target.value);
                  APP._updateBasinStyles();
                }}
              />
            </div>

            <div className="overlay-color-row">
              <label>Fill Color</label>
              <input
                type="color"
                defaultValue={APP.state.basinFillColor}
                onChange={(e) => {
                  APP.state.basinFillColor = e.target.value;
                  APP._updateBasinStyles();
                }}
              />
            </div>

            <div className="overlay-slider-row">
              <label>Outline Opacity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                defaultValue={APP.state.basinOutlineOpacity}
                onInput={(e) => {
                  APP.state.basinOutlineOpacity = parseFloat(e.target.value);
                  APP._updateBasinStyles();
                }}
              />
            </div>

            <div className="overlay-color-row">
              <label>Outline Color</label>
              <input
                type="color"
                defaultValue={APP.state.basinOutlineColor}
                onChange={(e) => {
                  APP.state.basinOutlineColor = e.target.value;
                  APP._updateBasinStyles();
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
