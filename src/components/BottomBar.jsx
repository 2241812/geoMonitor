import { useMapStore } from '../store/useMapStore';
import APP from '../lib/index.js';
import '../assets/css/bottom-bar.css';

/**
 * BottomBar — Bottom-center controls bar.
 *
 * Three visual groups (separated by spacing, no labels):
 *   VIEW:      [Watersheds|Boundaries]
 *   SOURCE:    [NAMRIA|CAD]
 *   NAVIGATION: breadcrumb container (filled by APP._updateBreadcrumb) + reset button
 *
 * Reads UI state from Zustand store, calls APP methods for map actions.
 * Follows the pattern: React renders UI, Zustand holds state, APP manages Leaflet.
 *
 * IMPORTANT: #map-breadcrumb must remain an empty container — the legacy
 * APP._updateBreadcrumb() fills it via innerHTML. If React placed children
 * inside it, the next React reconciliation would crash with removeChild errors.
 * The reset button is a sibling, not a child, matching the original inline layout.
 */

/* ── Component ── */
export default function BottomBar() {
  const viewMode = useMapStore((s) => s.viewMode);
  const setViewModeStore = useMapStore((s) => s.setViewMode);
  const activeSource = useMapStore((s) => s.activeSource);
  const setActiveSource = useMapStore((s) => s.setActiveSource);
  const activeMode = useMapStore((s) => s.activeMode);
  const setActiveMode = useMapStore((s) => s.setActiveMode);

  /* ── Event handlers ── */
  function handleViewMode(mode) {
    setViewModeStore(mode);
    if (APP._setViewMode) APP._setViewMode(mode);
  }

  function handleSource(name) {
    setActiveSource(name);
    if (APP.switchSource) APP.switchSource(name);
  }

  function handleSubMode(mode) {
    setActiveMode(mode);
    if (APP._setMode) APP._setMode(mode);
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

        {/* Explore/Boundary sub-mode toggles — only in boundaries mode */}
        {viewMode === 'boundaries' && (
          <div className="mode-toggle-group">
            <button
              className={`mode-toggle ${activeMode === 'explore' ? 'active' : ''}`}
              onClick={() => handleSubMode('explore')}
              title="Explore mode — click to select, map click deselects"
            >
              Explore
            </button>
            <button
              className={`mode-toggle ${activeMode === 'boundary' ? 'active' : ''}`}
              onClick={() => handleSubMode('boundary')}
              title="Boundary mode — click to drill down through hierarchy"
            >
              Boundary
            </button>
          </div>
        )}

        {/* ── SOURCE group ── */}
        <div className="source-toggle-control" id="source-toggle-control">
          <button
            className={`source-toggle-btn ${activeSource === 'namria' ? 'active' : ''}`}
            id="btn-namria"
            onClick={() => handleSource('namria')}
          >
            NAMRIA
          </button>
          <button
            className={`source-toggle-btn ${activeSource === 'cad' ? 'active' : ''}`}
            id="btn-cad"
            onClick={() => handleSource('cad')}
          >
            CAD
          </button>
        </div>
      </div>

      {/* ── NAVIGATION group ── */}
      {/* Breadcrumb is an empty container — APP._updateBreadcrumb fills it via innerHTML */}
      <div className="map-breadcrumb" id="map-breadcrumb" />

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
