import { useState, useEffect, useRef } from 'react';
import { useMapStore } from '../store/useMapStore';
import APP from '../lib/index.js';
import { LCM_CLASSES } from '../lib/lcm-manager.js';

/**
 * OverlayPanel — right-side panel for map overlay controls.
 * Hidden by default, toggled via the overlay-toggle button.
 * Shows watershed overlays in watersheds mode, boundary style controls in boundaries mode.
 */

export default function OverlayPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [lcmSelecting, setLcmSelecting] = useState(false);
  const panelRef = useRef(null);
  const hydroDrillLevel = useMapStore((s) => s.hydroDrillLevel);
  const showSlope = useMapStore((s) => s.showSlope);
  const showStreamOrder = useMapStore((s) => s.showStreamOrder);
  const showSubWatersheds = useMapStore((s) => s.showSubWatersheds ?? false);
  const showLCM = useMapStore((s) => s.showLCM ?? false);
  const slopeLoading = useMapStore((s) => s.slopeLoading);
  const lcmLoading = useMapStore((s) => s.lcmLoading);
  const slopeConfirmPending = useMapStore((s) => s.slopeConfirmPending);
  const viewMode = useMapStore((s) => s.viewMode);
  const currentLevel = useMapStore((s) => s.currentLevel);
  const isLevel0 = hydroDrillLevel === 0;
  const isWatersheds = viewMode === 'watersheds';
  const isBoundaries = viewMode === 'boundaries';

  const boStyle = APP.state.boundaryOverlayStyle || (APP.boundaryOverlay && APP.boundaryOverlay._getDefaults()) || {};

  useEffect(() => {
    if (isOpen && !isWatersheds && !isBoundaries) {
      setIsOpen(false);
    }
  }, [isWatersheds, isBoundaries]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (isOpen && (isWatersheds || isBoundaries)) {
      el.classList.add('overlay-panel-visible');
      el.classList.remove('overlay-panel-hidden');
    } else {
      el.classList.remove('overlay-panel-visible');
      el.classList.add('overlay-panel-hidden');
    }
  }, [isOpen, isWatersheds, isBoundaries]);

  const canShow = (isWatersheds && isLevel0) || isBoundaries;

  return (
    <>
      <button
        className="overlay-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle overlay controls"
        style={{ display: canShow ? 'flex' : 'none' }}
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
          {isWatersheds && (<>
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
              {slopeLoading && <span className="overlay-spinner" />}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  className="slope-quality-select-inline"
                  defaultValue={APP.state.slopeQuality || 'balanced'}
                  onChange={(e) => APP.slope.setQuality(e.target.value)}
                  style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff' }}
                >
                  <option value="balanced">Balanced</option>
                  <option value="full">Full Detail</option>
                  <option value="fast">High Speed</option>
                </select>
                <label className="toggle-switch" style={{ opacity: slopeLoading ? 0.5 : 1 }}>
                  <input
                    type="checkbox"
                    checked={showSlope}
                    disabled={slopeLoading}
                    onChange={() => {
                      if (slopeLoading) return;
                      if (!showSlope && isLevel0 && !APP.slope._layer) {
                        useMapStore.setState({ slopeConfirmPending: true });
                      } else {
                        APP.slope.toggle();
                      }
                    }}
                  />
                  <span className="toggle-knob"></span>
                </label>
              </div>
            </div>

            {/* Level 0 Confirmation Card */}
            {slopeConfirmPending && (
              <div className="overlay-confirm-card">
                <div className="overlay-confirm-text">
                  The slope overlay is a large dataset. It will be fetched and processed, which may take a few moments.
                </div>
                <div className="overlay-confirm-actions">
                  <button
                    className="overlay-confirm-btn overlay-confirm-cancel"
                    onClick={() => useMapStore.setState({ slopeConfirmPending: false })}
                  >
                    Cancel
                  </button>
                  <button
                    className="overlay-confirm-btn overlay-confirm-apply"
                    onClick={() => {
                      useMapStore.setState({ slopeConfirmPending: false });
                      APP.slope.toggle();
                    }}
                  >
                    Apply &amp; Fetch
                  </button>
                </div>
              </div>
            )}

            {slopeLoading && (
              <div className="overlay-loading-row">
                <div className="overlay-loading-bar" />
                <span className="overlay-loading-label">Loading slope data…</span>
              </div>
            )}

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
              {lcmLoading && <span className="overlay-spinner" />}
              <label className="toggle-switch" style={{ opacity: lcmLoading ? 0.5 : 1 }}>
                <input
                  type="checkbox"
                  checked={showLCM}
                  disabled={lcmLoading}
                  onChange={() => {
                    if (lcmLoading) return;
                    if (!showLCM) {
                      /* Turning ON — check if layer is already loaded */
                      if (APP.lcm._layer) {
                        APP._toggleLCM();
                        APP.lcm.show();
                      } else {
                        setLcmSelecting(true);
                      }
                    } else {
                      /* Turning OFF */
                      setLcmSelecting(false);
                      APP._toggleLCM();
                    }
                  }}
                />
                <span className="toggle-knob"></span>
              </label>
            </div>

            {/* Class selection card — shown before data is fetched */}
            {lcmSelecting && (
              <div className="overlay-confirm-card">
                <div className="overlay-confirm-text">
                  Choose which land cover classes to load, then click Apply &amp; Fetch.
                </div>
                <div className="lcm-class-toggles" style={{ marginTop: '8px' }}>
                  <div className="lcm-class-header">
                    <b>Classes</b>
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
                <div className="overlay-confirm-actions" style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    className="overlay-confirm-btn overlay-confirm-cancel"
                    onClick={() => setLcmSelecting(false)}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    className="overlay-confirm-btn overlay-confirm-apply"
                    onClick={() => {
                      const classes = [...APP.lcm.getVisibleClasses()];
                      if (classes.length === 0) {
                        APP._showToast('Select at least one land cover class');
                        return;
                      }
                      setLcmSelecting(false);
                      APP._toggleLCM();
                      APP._refetchLCMWithClasses();
                    }}
                    style={{ flex: 1 }}
                  >
                    Apply &amp; Fetch
                  </button>
                </div>
              </div>
            )}

            {lcmLoading && (
              <div className="overlay-loading-row">
                <div className="overlay-loading-bar" />
                <span className="overlay-loading-label">Loading land cover data…</span>
              </div>
            )}

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
            <button
              className="overlay-confirm-btn overlay-confirm-cancel"
              style={{ marginTop: '8px', width: '100%' }}
              onClick={() => {
                APP.state.basinFillColor = '#d1d5db';
                APP.state.basinFillOpacity = 0.15;
                APP.state.basinOutlineColor = '#000000';
                APP.state.basinOutlineOpacity = 0.9;
                APP._updateBasinStyles();
                /* Force React re-render to sync input values */
                useMapStore.setState({ _basinStyleTick: Date.now() });
              }}
            >
              Reset to Default
            </button>
          </div>
          </>)}

          {isBoundaries && (<>
          {/* Boundary Style Section */}
          <div className="overlay-section">
            <div className="toggle-row">
              <span>Boundary Styles</span>
            </div>
            <div className="overlay-controls" style={{ marginTop: '8px' }}>
              <div className="overlay-slider-row">
                <label>Fill Opacity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  defaultValue={boStyle.fillOpacity ?? 0}
                  onInput={(e) => APP.boundaryOverlay.setFillOpacity(parseFloat(e.target.value))}
                />
              </div>
              <div className="overlay-slider-row">
                <label>Outline Opacity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  defaultValue={boStyle.outlineOpacity ?? 0.9}
                  onInput={(e) => APP.boundaryOverlay.setOutlineOpacity(parseFloat(e.target.value))}
                />
              </div>
              <div className="overlay-slider-row">
                <label>Outline Weight</label>
                <input
                  type="range"
                  min="0.5"
                  max="6"
                  step="0.5"
                  defaultValue={boStyle.outlineWeight ?? 2.5}
                  onInput={(e) => APP.boundaryOverlay.setOutlineWeight(parseFloat(e.target.value))}
                />
              </div>
              <div className="overlay-color-row">
                <label>Fill Color</label>
                <input
                  type="color"
                  defaultValue={boStyle.fillColor ?? '#d1d5db'}
                  onChange={(e) => APP.boundaryOverlay.setFillColor(e.target.value)}
                />
              </div>
              <div className="overlay-color-row">
                <label>Outline Color</label>
                <input
                  type="color"
                  defaultValue={boStyle.outlineColor ?? '#1e293b'}
                  onChange={(e) => APP.boundaryOverlay.setOutlineColor(e.target.value)}
                />
              </div>
              <button
                className="overlay-confirm-btn overlay-confirm-cancel"
                style={{ marginTop: '8px', width: '100%' }}
                onClick={() => APP.boundaryOverlay.reset()}
              >
                Reset to Default
              </button>
            </div>
          </div>
          </>)}
        </div>
      </div>
    </>
  );
}
