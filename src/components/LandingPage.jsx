import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import '../assets/css/style.css';

const BASINS_DATA = [
  { id: 1, name: "Agno River Watershed", image: "assets/images/basin-1.jpg", desc: "Originates in Benguet and serves as the fifth largest river system in the Philippines. It supplies extensive irrigation for Pangasinan and supports three major hydroelectric plants.", area: "580,000.31 HA", outflow: "Lingayen Gulf", provinces: "Benguet, Ifugao, Mountain Province" },
  { id: 2, name: "Upper Chico River", image: "assets/images/basin-2.jpg", desc: "Known as the 'River of Life' for the Kalinga people, this vast river spans multiple provinces before merging with the Cagayan River. It provides essential irrigation for regional farmlands and supports numerous mini-hydro plants.", area: "449,726.45 HA", outflow: "Cagayan River", provinces: "Kalinga, Mountain Province" },
  { id: 3, name: "Abra River Watershed", image: "assets/images/basin-3.jpg", desc: "Originating from Mount Data, it features deep gorges and wide valleys before emptying into the West Philippine Sea. As one of the five largest river systems in the country, it provides crucial irrigation for Ilocos Sur and Abra.", area: "491,347.87 HA", outflow: "West Philippine Sea", provinces: "Abra, Apayao, Benguet, Kalinga, Mountain Province" },
  { id: 4, name: "Abulog River Watershed", image: "assets/images/basin-4.jpg", desc: "Characterized by pristine forest cover, this wide river channel flows from the Apayao mountains down to the Babuyan Channel. It serves as a critical source of irrigation and sustains aquatic biodiversity in northern Cagayan.", area: "278,655.72 HA", outflow: "Babuyan Channel", provinces: "Abra, Apayao" },
  { id: 5, name: "Amburayan River", image: "assets/images/basin-5.jpg", desc: "Flowing from Benguet to the West Philippine Sea, it serves as a natural boundary between Ilocos Sur and La Union. The basin provides crucial irrigation for lowland agriculture and supports freshwater ecosystems.", area: "400,000.00 HA", outflow: "South China Sea", provinces: "Benguet, La Union" },
  { id: 6, name: "Aringay River", image: "assets/images/basin-6.jpg", desc: "Originating from Benguet, this watershed plays a vital role in sustaining local agricultural livelihoods. Upstream conservation efforts are critical for mitigating downstream flooding before it exits at the Luzon Sea.", area: "41,348.51 HA", outflow: "Lingayen Gulf", provinces: "Benguet" },
  { id: 7, name: "Naguilian River", image: "assets/images/basin-7.jpg", desc: "With headwaters in Benguet, this scenic system irrigates La Union before exiting into the Luzon Sea. It acts as an integral socio-economic driver by supporting both agriculture and local tourism.", area: "53,935.83 HA", outflow: "West Philippine Sea", provinces: "Benguet, La Union" },
  { id: 8, name: "Upper Magat River", image: "assets/images/basin-8.jpg", desc: "Originating from the mountainous terrain of Ifugao, this basin feeds directly into the massive Magat Dam. It is critically important for generating hydroelectric power and irrigating vast tracts of the Cagayan Valley.", area: "292,803.49 HA", outflow: "Cagayan River", provinces: "Ifugao, Isabela" },
  { id: 9, name: "Siffu River", image: "assets/images/basin-9.jpg", desc: "Channeling vital water resources from Eastern Ifugao into the plains of Isabela, this river forms a cornerstone of the regional agricultural economy. It sustains extensive rice terraces and critical lowland farming communities.", area: "98,973.37 HA", outflow: "Cagayan River", provinces: "Ifugao, Isabela" },
  { id: 10, name: "Mallig River", image: "assets/images/basin-9.jpg", desc: "Flowing through the rolling terrains of the Cordilleras, this river merges with regional networks to support Isabela's agricultural zones. It is essential for maintaining soil fertility and crop yields in adjacent downstream provinces.", area: "93,821.17 HA", outflow: "Cagayan River", provinces: "Mountain Province, Isabela" },
  { id: 11, name: "Cabicungan River", image: "assets/images/basin-10.jpg", desc: "Situated in Apayao, this watershed features relatively pristine forest cover and high regional biodiversity. It acts as a lifeline for northern communities by irrigating farmlands before exiting towards the Babuyan Channel.", area: "26,820.76 HA", outflow: "Babuyan Channel", provinces: "Apayao, Cagayan" },
  { id: 12, name: "Zumigui-Ziwanan River", image: "assets/images/basin-11.jpg", desc: "Characterized by its remote, rugged terrain, this basin provides essential water routing for neighboring agricultural plains. Its rich ecological profile sustains indigenous flora and fauna throughout Apayao.", area: "80,112.38 HA", outflow: "Babuyan Channel", provinces: "Apayao, Cagayan" },
  { id: 13, name: "Santa Maria River", image: "assets/images/basin-12.jpg", desc: "Draining the western ridges of the Cordillera, it channels localized headwaters directly into the coastal networks of the West Philippine Sea. The watershed supports local aquaculture and highlights the need for upstream forest protection.", area: "28,917.82 HA", outflow: "West Philippine Sea", provinces: "Ilocos Sur" },
  { id: 14, name: "Bued River Watershed", image: "assets/images/basin-13.jpg", desc: "Famous for running parallel to the historic Kennon Road, this river gathers from the high altitudes of Benguet. It manages critical runoff through steep transit corridors, requiring constant monitoring down to the Lingayen Gulf.", area: "57,632.96 HA", outflow: "Lingayen Gulf", provinces: "Benguet, Pangasinan" }
];

export default function LandingPage() {
  const [activeBasin, setActiveBasin] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMoreBasins, setShowMoreBasins] = useState(false);

  useEffect(() => {
    const root = document.getElementById('root');
    if (activeBasin) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      if (root) root.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      if (root) root.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      if (root) root.style.overflow = '';
    };
  }, [activeBasin]);

  const openModal = (basin) => {
    setActiveBasin(basin);
  };

  const closeModal = (e) => {
    if (e) e.preventDefault();
    setActiveBasin(null);
  };
  useEffect(() => {
    document.title = "GeoCradle | Cordillera Watershed Portal";
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
          CORDILLERA HYDRO-GEOGRAPHIC PORTAL
        </div>

        <h1 className="hero-title">
          GeoCradle
        </h1>

        <p className="hero-subtitle">
          Tracking administrative boundaries, geological data, and environmental metrics across the Cordilleras — the Watershed Cradle of Northern Luzon.
        </p>
      </div>
    </section>

    <div className="hero-bottom-controls">
      <div className="nav-arrow nav-arrow-up nav-arrow-hidden" id="nav-arrow-up" title="Back to top">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
      </div>
      <div className="nav-arrow nav-arrow-down nav-arrow-visible" id="nav-arrow-down" title="Scroll to dashboard">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
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
            <div className="stat-item fade-in-up delay-1">
              <span className="stat-number" data-target="14">0</span>
              <span className="stat-label">River Basins</span>
              <span className="stat-desc">Monitoring the crucial hydrological lifelines of Northern Luzon.</span>
            </div>
            <div className="stat-item fade-in-up delay-1">
              <span className="stat-number" data-target="6">0</span>
              <span className="stat-label">GEOSPATIAL LAYERS</span>
              <span className="stat-desc">Integrating dynamic parameters including Stream Order, Slope Analysis, and Land Cover classification.</span>
            </div>
        </div>
        
        <div className="stats-right scale-in">
          <div className="map-preview">
            <img src="assets/images/watershedmap.png" alt="CAR Watershed Map Preview" />
            <div className="map-preview-overlay"></div>
            <div className="map-preview-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
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
            The Cordillera Administrative Region is widely recognized as the Watershed Cradle of Northern Luzon, supplying vital water resources to the surrounding lowlands. This portal serves as an interactive educational baseline for hydrological study, mapping the ecological boundaries that support millions of Filipinos across Regions I, II, and III.
          </p>
          <p className="section-text fade-in-up">
            A watershed is a fundamental unit of land where all water drains to a common outlet such as a river or sea. Healthy watersheds dictate water quality, agricultural productivity, and community resilience. Through systematic mapping, this platform visualizes critical geospatial parameters across CAR's major river basins.
          </p>
        </div>

        <div className="info-image-wrap scale-in">
          <div className="image-glow"></div>
          <img src="assets/images/banaue.jpg" alt="Ambuklao Dam — a vital watershed infrastructure in Benguet" className="info-image" />
          <div className="image-float-badge">
            <div className="float-badge-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
            </div>
            <div className="float-badge-text">
              <span className="float-badge-number">14</span>
              <span className="float-badge-label">River Basins</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    
    <section className="basins-section" id="basins-section">
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
          {BASINS_DATA.slice(0, 4).map((basin, idx) => (
            <div key={basin.id} className="basin-card" onClick={() => openModal(basin)}>
              <img src={basin.image} alt={basin.name} className="basin-card-image" loading="lazy" />
              <div className="basin-card-overlay"></div>
              <div className="basin-card-content">
                <h3 className="basin-card-name">{basin.name}</h3>
                <p className="basin-card-desc">{basin.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={`basins-collapse ${showMoreBasins ? '' : 'hidden'}`} style={{ width: '100%' }}>
          <div className="basins-grid" style={{ marginTop: 'var(--space-lg)' }}>
            {BASINS_DATA.slice(4).map((basin, idx) => (
              <div key={basin.id} className="basin-card" onClick={() => openModal(basin)}>
                <img src={basin.image} alt={basin.name} className="basin-card-image" loading="lazy" />
                <div className="basin-card-overlay"></div>
                <div className="basin-card-content">
                  <h3 className="basin-card-name">{basin.name}</h3>
                  <p className="basin-card-desc">{basin.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="view-all-container fade-in-up">
          <button className="view-all-btn" onClick={() => {
            if (showMoreBasins) {
              setShowMoreBasins(false);
              
              const section = document.getElementById('basins-section');
              if (section) {
                const offset = 40;
                const targetY = section.getBoundingClientRect().top + window.scrollY - offset;
                const startY = window.scrollY;
                const distance = targetY - startY;
                const duration = 600;
                let startTime = null;

                const easeInOutQuad = (t, b, c, d) => {
                  t /= d / 2;
                  if (t < 1) return (c / 2) * t * t + b;
                  t--;
                  return (-c / 2) * (t * (t - 2) - 1) + b;
                };

                const animateScroll = (currentTime) => {
                  if (!startTime) startTime = currentTime;
                  const elapsedTime = currentTime - startTime;
                  
                  window.scrollTo(0, easeInOutQuad(elapsedTime, startY, distance, duration));
                  
                  if (elapsedTime < duration) {
                    requestAnimationFrame(animateScroll);
                  } else {
                    window.scrollTo(0, targetY);
                  }
                };
                
                requestAnimationFrame(animateScroll);
              }
            } else {
              setShowMoreBasins(true);
            }
          }}>
            <span>{showMoreBasins ? "View Less" : "View All 14 Basins"}</span>
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
            <span>Explore the Map</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Interactive Map
              </Link>
            </li>
            <li>
              <a href="https://car.denr.gov.ph" target="_blank" rel="noopener noreferrer" className="footer-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                DENR CAR Website
              </a>
            </li>
            <li>
              <a href="https://www.slu.edu.ph" target="_blank" rel="noopener noreferrer" className="footer-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                (074) 442-7374
              </span>
            </li>
            <li>
              <span className="footer-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                car@denr.gov.ph
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

  {/* React Controlled Basin Lightbox Modal */}
  <div className={`basin-lightbox ${activeBasin ? 'active' : ''}`} onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
    <div className="basin-lightbox-bg" onClick={closeModal}></div>
    <div className="basin-lightbox-content">
      <div className="modal-split-top">
        <img src={activeBasin?.image || null} alt={activeBasin?.name || ""} />
        <div className="modal-split-top-overlay"></div>
        <h3 className="modal-basin-title">{activeBasin?.name}</h3>
      </div>
      <div className="modal-split-bottom">
        <div className="modal-quick-stats">
          <span className="modal-stat-pill">Area: {activeBasin?.area || ""}</span>
          <span className="modal-stat-pill">Outflow: {activeBasin?.outflow || ""}</span>
          <span className="modal-stat-pill">Provinces: {activeBasin?.provinces || ""}</span>
        </div>
        <div className="modal-desc-container">
          <p className="modal-basin-desc">{activeBasin?.desc}</p>
        </div>
        <Link to="/map" className="modal-cta-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          View Basin Map
        </Link>
      </div>
      <button className="basin-lightbox-close" title="Close" onClick={closeModal}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>

  </>);
}
