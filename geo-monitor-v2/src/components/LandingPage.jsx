import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import '../assets/css/style.css';

const BASINS_DATA = [
  { id: 1, name: "Agno River Watershed", image: "assets/images/basin-1.jpg", desc: "Originates in the Cordillera mountains of Benguet, specifically Mount Data. It is the fifth largest river system in the Philippines and a vital resource for Northern Luzon. It supports three major hydroelectric plants: Ambuklao, Binga, and San Roque. The basin supplies extensive irrigation for the agricultural plains of Pangasinan, serving as the lifeblood for local farming communities, fisheries, and regional power generation." },
  { id: 2, name: "Upper Chico River", image: "assets/images/basin-2.jpg", desc: "Headwaters are located in the mountains of Benguet, Mountain Province, and Kalinga. Known as the 'River of Life' for the Kalinga people, it spans a vast area before merging with the Cagayan River. It supports numerous mini-hydro power plants and provides essential irrigation for rice terraces and farmlands across Kalinga, Apayao, Cagayan, and Isabela." },
  { id: 3, name: "Abra River Watershed", image: "assets/images/basin-3.jpg", desc: "Originates from the slopes of Mount Data in Benguet and runs through Mountain Province and Abra before emptying into the West Philippine Sea. It is one of the five largest river systems in the Philippines, featuring deep gorges and wide valleys. The basin provides crucial irrigation for Ilocos Sur and Abra, supporting local agriculture and inland fisheries." },
  { id: 4, name: "Abulog River Watershed", image: "assets/images/basin-4.jpg", desc: "Also known as the Abulug-Apayao River Watershed, its headwaters lie deep within the mountainous province of Apayao. It is characterized by pristine forest cover and a wide river channel that flows down to the Babuyan Channel. It serves as a critical source of irrigation for the plains of northern Cagayan Province and sustains local aquatic biodiversity." },
  { id: 5, name: "Amburayan River", image: "assets/images/basin-5.jpg", desc: "Emanates in Benguet, flows to the Luzon Sea at La Union, and supplies irrigation water for the Province of La Union." },
  { id: 6, name: "Aringay River", image: "assets/images/basin-6.jpg", desc: "Originates from Benguet and Baguio City. A source of irrigation for La Union Province, exiting at the Luzon Sea." },
  { id: 7, name: "Naguilian River", image: "assets/images/basin-7.jpg", desc: "Headwaters in Benguet, irrigates La Union, and exits at the Luzon Sea." },
  { id: 8, name: "Upper Magat River", image: "assets/images/basin-8.jpg", desc: "Originates from Ifugao, supports Magat Dam hydroelectric plant, and irrigates Isabela, Nueva Vizcaya, and Quirino." },
  { id: 9, name: "Siffu-Mallig River", image: "assets/images/basin-9.jpg", desc: "Headwaters originating from eastern Ifugao and Mountain Province, flowing as a merged network towards the Cagayan River to irrigate major agricultural areas in Isabela." },
  { id: 10, name: "Cabicungan River", image: "assets/images/basin-10.jpg", desc: "Situated in Apayao, irrigates farmers in Cagayan Province and exits towards Claveria." },
  { id: 11, name: "Zumigui-Ziwanan River", image: "assets/images/basin-11.jpg", desc: "Emanates in Apayao, irrigates Cagayan, and exits towards the Pamplona River." },
  { id: 12, name: "Santa Maria River", image: "assets/images/basin-12.jpg", desc: "Draining the western ridges of the Cordillera mountain range, it channels localized headwaters directly into the coastal networks of the West Philippine Sea." },
  { id: 13, name: "Bued River Watershed", image: "assets/images/basin-13.jpg", desc: "Gathering from the high-altitude southern slopes of Benguet, it channels critical mountain runoff through steep transit corridors down toward the Lingayen Gulf." }
];

export default function LandingPage() {
  const [activeBasin, setActiveBasin] = useState(null);
  const [showMoreBasins, setShowMoreBasins] = useState(false);

  const openModal = (basin) => {
    setActiveBasin(basin);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setActiveBasin(null);
    document.body.style.overflow = '';
  };
  useEffect(() => {
    if(window.initLenis) window.initLenis();
    if(window.initLandingPageScripts) {
      setTimeout(window.initLandingPageScripts, 100);
    }
  }, []);

  return (<>

  <div className="container">

    
    <header className="header" id="site-header">
      <div className="logo-group">
        <img src="assets/img/denr-logo.svg" alt="DENR" className="logo" />
        <div className="brand-text">
          <span className="brand-subtitle">Republic of the Philippines</span>
          <span className="brand-title">Department of Environment and Natural Resources</span>
          <span className="brand-sub-agency">Cordillera Administrative Region</span>
        </div>
      </div>
      <div className="collab-group">
        <div className="collab-text-block">
          <span className="brand-subtitle">In collaboration with</span>
          <span className="collab-title">Saint Louis University</span>
        </div>
        <img src="assets/img/slu-logo.png" alt="SLU" className="slu-logo" />
      </div>
    </header>

    
    <section className="hero" id="hero">
      <div className="hero-bg">
        <img src="assets/images/20220506_111217.jpg" alt="Cordillera Landscape" />
      </div>
      <div className="hero-overlay"></div>

      <div className="hero-particles">
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
        <span className="particle"></span>
      </div>

      <div className="hero-content fade-in-up">
        <div className="hero-badge fade-in-up">
          <span className="hero-badge-dot"></span>
          Watershed Monitoring System
        </div>

        <h1 className="hero-title">
          CAR Watershed Monitoring
        </h1>

        <p className="hero-subtitle">
          Tracking administrative boundaries, geological data, and environmental metrics across the Cordilleras — the Watershed Cradle of Northern Luzon.
        </p>
      </div>
    </section>

    <div className="hero-bottom-controls">
      <div className="nav-arrow nav-arrow-up nav-arrow-hidden" id="nav-arrow-up" title="Back to top">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
      </div>
      <div className="nav-arrow nav-arrow-down nav-arrow-visible" id="nav-arrow-down" title="Scroll to dashboard">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    </div>

    
    <section className="stats-section" id="stats-section">
      <div className="stats-inner fade-in-up">
        
        <div className="stats-left">
            <div className="stat-item fade-in-up delay-1">
              <span className="stat-number" data-target="6">0</span>
              <span className="stat-label">Provinces</span>
              <span className="stat-desc">Covering the entirely mountainous landscape of the Cordillera region.</span>
            </div>
            <div className="stat-item fade-in-up delay-2">
              <span className="stat-number" data-target="77">0</span>
              <span className="stat-label">Municipalities</span>
              <span className="stat-desc">Partnering with local government units for on-ground conservation.</span>
            </div>
            <div className="stat-item fade-in-up delay-3">
              <span className="stat-number" data-target="13">0</span>
              <span className="stat-label">River Basins</span>
              <span className="stat-desc">Monitoring the crucial hydrological lifelines of Northern Luzon.</span>
            </div>
            <div className="stat-item fade-in-up delay-4">
              <span className="stat-number" data-target="2">0</span>
              <span className="stat-label">Data Sources</span>
              <span className="stat-desc">Integrating real-time satellite imagery and on-ground sensor data.</span>
            </div>
        </div>
        
        <div className="stats-right scale-in">
          <div className="map-preview">
            <img src="assets/images/watershedmap.png" alt="CAR Watershed Map Preview" />
            <div className="map-preview-overlay"></div>
            <div className="map-preview-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>Interactive Map</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    
    <section className="info-section" id="about">
      <div className="section-inner">
        <div className="info-content fade-in-up">
          <div className="section-label fade-in-up">
            <span className="section-label-line"></span>
            About the Region
          </div>
          <h2 className="section-title fade-in-up">
            Protecting Our <span className="section-title-accent">Lifelines</span>
          </h2>
          <p className="section-text fade-in-up">
            The Cordillera Administrative Region serves as the watershed cradle of Northern Philippines, supplying vital water resources to the lowlands. The Department of Environment and Natural Resources' mandate is to monitor, protect, and sustain these ecological boundaries that support millions of Filipinos across Regions I, II, and III.
          </p>
          <p className="section-text fade-in-up">
            A watershed is an area of land where all water drains to a common outlet such as a river, lake, or sea. Healthy watersheds mean clean water, productive fisheries, and resilient communities. Through systematic monitoring, we track changes in land use, water quality, and biodiversity across CAR's major river basins.
          </p>
        </div>

        <div className="info-image-wrap scale-in">
          <div className="image-glow"></div>
          <img src="assets/images/banaue.jpg" alt="Ambuklao Dam — a vital watershed infrastructure in Benguet" className="info-image" />
          <div className="image-float-badge">
            <div className="float-badge-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
            </div>
            <div className="float-badge-text">
              <span className="float-badge-number">13</span>
              <span className="float-badge-label">River Basins</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    
    <section className="basins-section" id="basins">
      <div className="section-inner">
        <div className="basins-section-header fade-in-up">
          <div className="section-label" style={{'justifyContent': 'center'}}>
            <span className="section-label-line"></span>
            Watershed Geography
            <span className="section-label-line"></span>
          </div>
          <h2 className="section-title">
            Major River Basins of <span className="section-title-accent">CAR</span>
          </h2>
          <p className="basins-header-desc">
            The Cordillera Administrative Region hosts a vast network of major river basins and watersheds — the Watershed Cradle of Northern Luzon. Explore our featured systems below, or expand the view to see all critical networks.
          </p>
        </div>

        
        <div className="basins-grid fade-in-up">
          {BASINS_DATA.slice(0, 4).map((basin, index) => (
            <div key={basin.id} className={asin-card basin-card-tall fade-in-up delay-} onClick={() => openModal(basin)}>
              <img src={basin.image} alt={basin.name} className="basin-card-image" loading="lazy" />
              <div className="basin-card-overlay"></div>
              <div className="basin-card-content">
                <div className="basin-card-line"></div>
                <span className="basin-card-index">Basin {String(basin.id).padStart(2, '0')}</span>
                <h3 className="basin-card-name">{basin.name}</h3>
                <p className="basin-card-desc">{basin.desc}</p>
              </div>
            </div>
          ))}
        </div>

        
        <div className={asins-collapse } id="basins-extra-grid">
          <div className="basins-extra-grid">
            {BASINS_DATA.slice(4).map((basin) => (
              <div key={basin.id} className="basin-card basin-card-tall fade-in-up" onClick={() => openModal(basin)}>
                <img src={basin.image} alt={basin.name} className="basin-card-image" loading="lazy" />
                <div className="basin-card-overlay"></div>
                <div className="basin-card-content">
                  <div className="basin-card-line"></div>
                  <span className="basin-card-index">Basin {String(basin.id).padStart(2, '0')}</span>
                  <h3 className="basin-card-name">{basin.name}</h3>
                  <p className="basin-card-desc">{basin.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="view-all-container fade-in-up">
          <button className="view-all-btn" onClick={() => setShowMoreBasins(!showMoreBasins)}>
            <span>{showMoreBasins ? "Show Less" : "View All 13 River Basins"}</span>
            <svg className="view-all-icon" style={{ transform: showMoreBasins ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>
    </section>

    
    <section className="cta-section" id="dashboard-section">
      <div className="cta-bg">
        <img src="assets/images/Outcrop_along_the_riverside_of_the_Dalupirip_section_of_the_Agno_River,_Lower_Agno_Watershed_Forest_Reserve,_Itogon,_Benguet,_Philippines.jpg" alt="Agno River Outcrop" />
      </div>
      <div className="cta-overlay"></div>

      <div className="cta-content fade-in-up">
        <div className="section-label fade-in-up" style={{'justifyContent': 'center', 'color': 'rgba(255,255,255,0.8)'}}>
          <span className="section-label-line"></span>
          Explore
          <span className="section-label-line"></span>
        </div>

        <h2 className="cta-title fade-in-up">
          Interactive Geographic Dashboard
        </h2>

        <p className="cta-subtitle fade-in-up">
          Dive into the data. Explore administrative boundaries, river networks, and geological profiles across the Cordillera Administrative Region.
        </p>

        <div className="fade-in-up">
          <Link  to="/map"  className="cta-explore-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
            <span>Explore the Map</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
        </div>
      </div>
    </section>

    
    <footer className="footer fade-in-up">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo-group">
            <img src="assets/img/denr-logo.svg" alt="DENR" className="footer-logo" />
            <span className="footer-brand-name">DENR CAR</span>
          </div>
          <p className="footer-address">
            Department of Environment and Natural Resources — Cordillera Administrative Region, DENR Compound, Gibraltar Road, Baguio City, Philippines, 2600
          </p>
        </div>

        <div>
          <h4 className="footer-heading">Quick Links</h4>
          <ul className="footer-links">
            <li>
              <Link  to="/map"  className="footer-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Interactive Map
              </Link>
            </li>
            <li>
              <a href="https://car.denr.gov.ph" target="_blank" rel="noopener noreferrer" className="footer-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                DENR CAR Website
              </a>
            </li>
            <li>
              <a href="https://www.slu.edu.ph" target="_blank" rel="noopener noreferrer" className="footer-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
                SLU Website
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="footer-heading">Contact</h4>
          <ul className="footer-links">
            <li>
              <span className="footer-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                (074) 442-7374
              </span>
            </li>
            <li>
              <span className="footer-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                car@denr.gov.ph
              </span>
            </li>
            <li>
              <span className="footer-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6 0 1.2-.2 1.7-.6C4.8 5 5.4 4.8 6 4.8s1.2.2 1.7.6C8.8 6 9.4 6.2 10 6.2s1.2-.2 1.7-.6C12.8 5 13.4 4.8 14 4.8s1.2.2 1.7.6c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C20.2 5 20.8 4.8 21.4 4.8M2 12c.6 0 1.2-.2 1.7-.6C4.8 11 5.4 10.8 6 10.8s1.2.2 1.7.6c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C12.8 11 13.4 10.8 14 10.8s1.2.2 1.7.6c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6c.5-.4 1.1-.6 1.7-.6M2 18c.6 0 1.2-.2 1.7-.6C4.8 17 5.4 16.8 6 16.8s1.2.2 1.7.6c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C12.8 17 13.4 16.8 14 16.8s1.2.2 1.7.6c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6c.5-.4 1.1-.6 1.7-.6"/></svg>
                Watershed Division
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copyright">
          &copy; 2026 DENR-CAR &amp; SLU Computer Science. All rights reserved.
        </p>
        <div className="footer-logos">
          <img src="assets/img/denr-logo.svg" alt="DENR" className="footer-small-logo" />
          <img src="assets/img/slu-logo.png" alt="SLU" className="footer-small-logo" />
        </div>
      </div>
    </footer>

  </div>

  {/* Basin Lightbox Modal - Main Style */}
  <div className={asin-lightbox }>
    <div className="basin-lightbox-bg" onClick={closeModal}></div>
    <div className="basin-lightbox-content">
      <img src={activeBasin?.image || ""} alt={activeBasin?.name || ""} />
      <div className="basin-lightbox-overlay"></div>
      <div className="basin-lightbox-text">
        <span className="basin-card-index">Basin {activeBasin ? String(activeBasin.id).padStart(2, '0') : ''}</span>
        <h3 className="basin-card-name">{activeBasin?.name}</h3>
        <p className="basin-card-desc">{activeBasin?.desc}</p>
      </div>
      <button className="basin-lightbox-close" title="Close" onClick={closeModal}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>

  </>);
}
