/**
 * script.js — Landing Page Animations & Interactivity
 */

export function initLandingPageScripts() {
  /* ── Scroll to Top on Mount ── */
  if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  /* ── Lenis Smooth Scroll ── */
  if (typeof window.Lenis !== 'undefined') {
    const lenis = new window.Lenis({
      duration: 1.0, 
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });

    window.__lenis = lenis;

    function raf(time) {
      if (window.__lenis) {
        window.__lenis.raf(time);
        requestAnimationFrame(raf);
      }
    }
    requestAnimationFrame(raf);
  }

  /* ── Scroll-triggered fade-in & scale-in ── */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  const els = document.querySelectorAll('.fade-in-up, .scale-in');
  els.forEach((el) => observer.observe(el));

  /* ── Animated counters ── */
  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-target'), 10);
    if (isNaN(target) || target === 0) return;
    let current = 0;
    const duration = 1500;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      current = Math.round(eased * target);
      el.textContent = current;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const counters = entry.target.querySelectorAll('.stat-number[data-target]');
        counters.forEach((c) => animateCounter(c));
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  const statsSection = document.querySelector('.stats-inner');
  if (statsSection) counterObserver.observe(statsSection);

  /* ── Sticky header shadow on scroll & Parallax ── */
  const header = document.getElementById('site-header');
  const heroBg = document.querySelector('.hero-bg');
  const heroContent = document.querySelector('.hero-content');
  const ctaBg = document.querySelector('.cta-bg');
  const downArrow = document.getElementById('nav-arrow-down');
  const upArrow = document.getElementById('nav-arrow-up');
  const dashboardSection = document.getElementById('dashboard-section');

  const onScroll = () => {
    const scrollY = window.scrollY;
    
    if (header) {
      if (scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    if (heroBg && heroContent) {
      const heroProgress = Math.min(scrollY / window.innerHeight, 1);
      heroBg.style.transform = `translateY(${heroProgress * 40}%)`;
      heroContent.style.opacity = Math.max(1 - (heroProgress / 0.7), 0);
    }

    if (ctaBg && dashboardSection) {
      const ctaRect = dashboardSection.getBoundingClientRect();
      if (ctaRect.top < window.innerHeight && ctaRect.bottom > 0) {
        const ctaProgress = 1 - (ctaRect.bottom / (window.innerHeight + ctaRect.height));
        ctaBg.style.transform = `translateY(${ctaProgress * 25}%)`;
      }
    }

    if (downArrow && upArrow && dashboardSection) {
      const dashRect = dashboardSection.getBoundingClientRect();
      const isAtBottom = dashRect.top <= window.innerHeight - 100;

      if (isAtBottom) {
        downArrow.classList.add('nav-arrow-hidden');
        downArrow.classList.remove('nav-arrow-visible');
      } else {
        downArrow.classList.add('nav-arrow-visible');
        downArrow.classList.remove('nav-arrow-hidden');
      }

      if (scrollY > 50 || isAtBottom) {
        upArrow.classList.add('nav-arrow-visible');
        upArrow.classList.remove('nav-arrow-hidden');
      } else {
        upArrow.classList.add('nav-arrow-hidden');
        upArrow.classList.remove('nav-arrow-visible');
      }
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Navigation arrows click handlers ── */
  const onDownClick = () => {
    if (dashboardSection) dashboardSection.scrollIntoView({ behavior: 'smooth' });
  };
  const onUpClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (downArrow) downArrow.addEventListener('click', onDownClick);
  if (upArrow) upArrow.addEventListener('click', onUpClick);

  return () => {
    observer.disconnect();
    counterObserver.disconnect();
    window.removeEventListener('scroll', onScroll);
    if (downArrow) downArrow.removeEventListener('click', onDownClick);
    if (upArrow) upArrow.removeEventListener('click', onUpClick);
  };
}

if (typeof window !== 'undefined') {
  window.initLandingPageScripts = initLandingPageScripts;
}
