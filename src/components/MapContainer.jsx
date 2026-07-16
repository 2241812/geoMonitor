import { useEffect } from 'react';
import '../lib/index.js'; // Imports APP and its submodules

export default function MapContainer() {
  useEffect(() => {
    // Only initialize once
    if (!window.APP.state.map) {
      // Small timeout ensures the DOM has fully rendered before Leaflet binds to it
      setTimeout(async () => {
        window.APP.init();
        if (window.initLayers) {
          try {
            await window.initLayers();
          } catch (err) {
            if (import.meta.env.DEV) console.error('Layer initialization failed:', err);
          }
        }
        const loading = document.getElementById('loading-overlay');
        if (loading) loading.classList.add('hidden');
      }, 100);
    }

    return () => {
      // Cleanup map if component unmounts
      if (window.APP.state.map) {
        window.APP.state.map.remove();
        window.APP.state.map = null;
      }
    };
  }, []);

  return (
    <>
      <div id="map" style={{ height: '100vh', width: '100vw', background: '#1e293b' }}></div>
      <div className="map-loading" id="loading-overlay">
        <div className="map-loading-inner">
          <div className="map-spinner"></div>
          <div className="map-loading-text" id="loading-text">Loading map data…</div>
        </div>
      </div>

      {/*
        The legacy dashboard UI injects DOM dynamically into these containers
      */}
      <div id="map-dashboard" className="map-dashboard closed"></div>

      <div className="map-hover-label" id="map-hover-label"></div>

      <div className="info-panel" id="info-panel">
        <div className="info-panel-header">
          <svg id="panel-header-icon" className="panel-header-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>
          </svg>
          <span id="panel-header-label" className="panel-header-label">Watershed Monitor</span>
        </div>
        <div className="panel-hero" id="panel-hero"></div>
        <div className="info-panel-handle" id="info-panel-handle" onClick={() => window.APP?.togglePanel()}>
          <span className="handle-bar"></span>
        </div>
        <div className="info-panel-content" id="info-panel-content"></div>

        <button className="info-panel-edge-toggle" onClick={() => window.APP?.togglePanel()}>
          <svg className="icon-closed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <svg className="icon-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>
    </>
  );
}
