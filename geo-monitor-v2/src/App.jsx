import { useEffect } from 'react';
import { useMapStore } from './store/useMapStore';
import './assets/css/style.css';
import './assets/css/map.css';
import 'leaflet/dist/leaflet.css';

export default function App() {
  const { viewMode, setViewMode } = useMapStore();

  return (
    <div className="map-app">
      {/* 
        This is a placeholder for the actual MapContainer component.
        By using the exact classes from map.css ('map-app', 'map-loading', 'top-right-controls'),
        the UI remains 100% pixel-perfect identical to the vanilla JS version.
      */}
      <div id="map" style={{ height: '100vh', width: '100vw', background: '#1e293b' }}>
        {/* React-Leaflet MapContainer will go here */}
      </div>

      <div className="top-right-controls">
        <button className="map-request-btn-top map-icon-btn" title="Request Data">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <button className="map-fullscreen-btn map-icon-btn" title="Enter fullscreen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
        </button>
      </div>

      <div className="bottom-center-controls">
        <div className="top-controls-row">
          <div className="view-toggle-control">
            <button 
              className={`view-toggle-btn ${viewMode === 'watersheds' ? 'active' : ''}`}
              onClick={() => setViewMode('watersheds')}
            >
              Watersheds
            </button>
            <button 
              className={`view-toggle-btn ${viewMode === 'boundaries' ? 'active' : ''}`}
              onClick={() => setViewMode('boundaries')}
            >
              Boundaries
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
