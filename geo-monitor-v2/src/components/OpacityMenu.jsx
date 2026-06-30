/*
 * OpacityMenu — Floating control for adjusting selected zone fill/outline opacity.
 *
 * Appears as a toggle button (bottom-right, beside Leaflet zoom controls) that
 * opens an upward popup with two range sliders: Fill Opacity and Outline Opacity.
 * Values are written to window.APP.state and trigger _updateSubWatershedStyles().
 *
 * CSS classes (all prefixed "opacity-menu-*") live in map.css.
 */

import { useState } from 'react';

const DEFAULT_FILL = 0.55;
const DEFAULT_OUTLINE = 1.0;

export default function OpacityMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [fillOpacity, setFillOpacity] = useState(DEFAULT_FILL);
  const [outlineOpacity, setOutlineOpacity] = useState(DEFAULT_OUTLINE);

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
      </div>
    </div>
  );
}
