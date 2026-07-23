import { useMapStore } from '../store/useMapStore';
import APP from '../lib/index.js';

/**
 * Breadcrumb — React component replacing string-based innerHTML injection for map breadcrumbs.
 * Dynamically subscribes to useMapStore for viewMode and selectedPath.
 */
export default function Breadcrumb() {
  const viewMode = useMapStore((s) => s.viewMode);
  const selectedPath = useMapStore((s) => s.selectedPath) || [];

  if (viewMode === 'watersheds') {
    const atRoot = selectedPath.length === 0;

    return (
      <div className="map-breadcrumb" id="map-breadcrumb">
        <button
          className={`breadcrumb-item ${atRoot ? 'active' : 'clickable'}`}
          onClick={() => APP._hydroDrillUp && APP._hydroDrillUp(0)}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          </svg>
          Basins
        </button>

        {selectedPath.map((item, idx) => {
          const isLast = idx === selectedPath.length - 1;
          const shortName = idx === 0
            ? item.name.replace(/ River Watershed$/, '').replace(/ River$/, '')
            : item.name;

          return (
            <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span className="breadcrumb-sep">›</span>
              <button
                className={`breadcrumb-item ${isLast ? 'active' : 'clickable'}`}
                onClick={() => !isLast && APP._hydroDrillUp && APP._hydroDrillUp(idx + 1)}
              >
                {shortName}
              </button>
            </span>
          );
        })}
      </div>
    );
  }

  const atRoot = selectedPath.length === 0;

  return (
    <div className="map-breadcrumb" id="map-breadcrumb">
      <button
        className={`breadcrumb-item ${atRoot ? 'active' : 'clickable'}`}
        onClick={() => APP.drillUp && APP.drillUp(0)}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        CAR
      </button>

      {selectedPath.map((item, idx) => {
        if (item.level === 0) return null;
        const isLast = idx === selectedPath.length - 1;

        return (
          <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span className="breadcrumb-sep">›</span>
            <button
              className={`breadcrumb-item ${isLast ? 'active' : 'clickable'}`}
              onClick={() => !isLast && APP.drillUp && APP.drillUp(item.level)}
            >
              {item.name}
            </button>
          </span>
        );
      })}
    </div>
  );
}
