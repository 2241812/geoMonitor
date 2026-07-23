import { useMapStore } from '../store/useMapStore';
import APP from '../lib/index.js';
import Breadcrumb from './Breadcrumb.jsx';
import '../assets/css/bottom-bar.css';

/**
 * BottomBar — Bottom-center controls bar.
 *
 * Three visual groups (separated by spacing, no labels):
 *   VIEW:      [Watersheds|Boundaries]
 *   NAVIGATION: Breadcrumb component + reset button
 *
 * Reads UI state from Zustand store, calls APP methods for map actions.
 */
export default function BottomBar() {
  const viewMode = useMapStore((s) => s.viewMode);
  const setViewModeStore = useMapStore((s) => s.setViewMode);

  /* ── Event handlers ── */
  function handleViewMode(mode) {
    setViewModeStore(mode);
    if (APP._setViewMode) APP._setViewMode(mode);
  }

  function handleReset() {
    if (APP._resetAll) APP._resetAll();
  }

  return (
    <div className="bottom-center-controls" id="bottom-center-controls">
      {/* ── VIEW group ── */}
      <div className="top-controls-row">
        <div className="view-toggle-control">
          <button
            id="btn-view-watersheds"
            className={`view-toggle-btn ${viewMode === 'watersheds' ? 'active' : ''}`}
            onClick={() => handleViewMode('watersheds')}
          >
            Watersheds
          </button>
          <button
            id="btn-view-boundaries"
            className={`view-toggle-btn ${viewMode === 'boundaries' ? 'active' : ''}`}
            onClick={() => handleViewMode('boundaries')}
          >
            Boundaries
          </button>
        </div>
      </div>

      {/* ── NAVIGATION group ── */}
      <Breadcrumb />

      <button
        className="map-reset-btn"
        id="map-reset-btn"
        onClick={handleReset}
        title="Reset view"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      </button>
    </div>
  );
}
