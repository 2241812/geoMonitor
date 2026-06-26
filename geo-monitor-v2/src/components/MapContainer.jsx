import { useEffect } from 'react';
import '../lib/index.js'; // Imports APP and its submodules

export default function MapContainer() {
  useEffect(() => {
    // Only initialize once
    if (!window.APP.state.map) {
      // Small timeout ensures the DOM has fully rendered before Leaflet binds to it
      setTimeout(() => {
        window.APP.init();
        if (window.initLayers) {
          window.initLayers();
        }
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
          <div className="map-loading-text">Loading boundaries…</div>
        </div>
      </div>
      
      {/* 
        The legacy dashboard and outline-toggles UI injects DOM dynamically into these containers 
      */}
      <div className="outline-toggles" id="outline-toggles"></div>
      <div id="map-dashboard" className="map-dashboard closed"></div>
    </>
  );
}
