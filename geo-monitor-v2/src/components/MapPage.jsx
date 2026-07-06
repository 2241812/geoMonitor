import BottomBar from './BottomBar';
import { Link } from 'react-router-dom';
import MapContainer from './MapContainer';
import '../assets/css/style.css';
import '../assets/css/map.css';
import 'leaflet/dist/leaflet.css';

export default function MapPage() {
  return (
    <div className="map-app">
      <MapContainer />

      <Link className="map-back-btn map-icon-btn" to="/" title="Home">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
      </Link>

      <div className="top-right-controls">
        <button 
          className="map-request-btn-top map-icon-btn" 
          id="map-request-btn-top"
          title="Request Data"
          onClick={() => window.APP?._openRequestFromToolbar()}
        >
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

      <BottomBar />

      <div className="bottom-left-controls" id="bottom-left-controls">
        <div className="basemap-switcher" id="basemap-switcher">
          <button className="basemap-btn" id="basemap-btn" onClick={() => window.APP?._toggleBasemap()} title="Switch basemap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
          </button>
          <div className="basemap-options" id="basemap-options">
            <button className="basemap-option active" data-layer="topo" onClick={() => window.APP?.switchBasemap('topo')}>
              <span className="basemap-thumb topo-thumb"></span><span>Topographic</span>
            </button>
            <button className="basemap-option" data-layer="osm" onClick={() => window.APP?.switchBasemap('osm')}>
              <span className="basemap-thumb osm-thumb"></span><span>Street</span>
            </button>
            <button className="basemap-option" data-layer="satellite" onClick={() => window.APP?.switchBasemap('satellite')}>
              <span className="basemap-thumb satellite-thumb"></span><span>Satellite</span>
            </button>
          </div>
        </div>

        <div className="boundary-switcher" id="boundary-switcher">
          <button className="map-icon-btn boundary-btn" id="boundary-btn" onClick={() => window.APP?._toggleBoundaryMenu()} title="Toggle boundary overlays">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 12 12 17 22 12"></polyline><polyline points="2 17 12 22 22 17"></polyline></svg>
          </button>
          <div className="boundary-options" id="boundary-options">
            <div className="boundary-options-header">Boundary Overlays</div>
            <label className="boundary-option"><input type="checkbox" data-type="region" onChange={(e) => window.APP?._toggleBoundaryLayer('region', e.target)} /><span>Region</span></label>
            <label className="boundary-option"><input type="checkbox" data-type="province" onChange={(e) => window.APP?._toggleBoundaryLayer('province', e.target)} /><span>Province</span></label>
            <label className="boundary-option"><input type="checkbox" data-type="municipality" onChange={(e) => window.APP?._toggleBoundaryLayer('municipality', e.target)} /><span>Municipality</span></label>
          </div>
        </div>

        <div className="watershed-switcher" id="watershed-switcher">
          <button className="map-icon-btn watershed-btn" id="watershed-btn" onClick={() => window.APP?.toggleWatershedMenu()} title="Filter Watersheds">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          </button>
          <div className="watershed-options" id="watershed-options">
            <div className="watershed-options-header">
              <span>Filter Basins</span>
              <button className="watershed-clear-btn" id="watershed-clear-btn" onClick={() => window.APP?._resetWatershedState()} style={{display: 'none'}}>Clear</button>
            </div>
            <div className="watershed-list" id="watershed-list"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
