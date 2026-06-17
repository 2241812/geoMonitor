(function () {
  'use strict';

  /* ── Scroll to Top on Refresh ── */
  if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  /* ── Lenis Smooth Scroll ── */
  if (typeof Lenis !== 'undefined') {
    var lenis = new Lenis({
      duration: 1.0, 
      easing: function(t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
  }

  /* ── Scroll-triggered fade-in & scale-in ── */
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.addEventListener('DOMContentLoaded', function () {
    var els = document.querySelectorAll('.fade-in-up, .scale-in');
    for (var i = 0; i < els.length; i++) {
      observer.observe(els[i]);
    }
  });

  /* ── Animated counters ── */
  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-target'), 10);
    if (isNaN(target) || target === 0) return;
    var current = 0;
    var duration = 1500;
    var startTime = performance.now();

    function tick(now) {
      var elapsed = now - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 4);
      current = Math.round(eased * target);
      el.textContent = current;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var counters = entry.target.querySelectorAll('.stat-number[data-target]');
          for (var i = 0; i < counters.length; i++) {
            animateCounter(counters[i]);
          }
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    var statsSection = document.querySelector('.stats-inner');
    if (statsSection) counterObserver.observe(statsSection);
  });

  /* ── Sticky header shadow on scroll & Parallax ── */
  document.addEventListener('DOMContentLoaded', function () {
    var header = document.getElementById('site-header');
    var heroBg = document.querySelector('.hero-bg');
    var heroContent = document.querySelector('.hero-content');
    var ctaBg = document.querySelector('.cta-bg');

    window.addEventListener('scroll', function () {
      var scrollY = window.scrollY;
      
      // Header sticky state
      if (scrollY > 60) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }

      // Hero Parallax
      if (heroBg && heroContent) {
        var heroProgress = Math.min(scrollY / window.innerHeight, 1);
        heroBg.style.transform = 'translateY(' + (heroProgress * 40) + '%)';
        heroContent.style.opacity = Math.max(1 - (heroProgress / 0.7), 0);
      }

      // CTA Parallax
      if (ctaBg) {
        var ctaRect = document.getElementById('dashboard-section').getBoundingClientRect();
        if (ctaRect.top < window.innerHeight && ctaRect.bottom > 0) {
          // Calculate progress from 0 (just appeared) to 1 (fully scrolled past)
          var ctaProgress = 1 - (ctaRect.bottom / (window.innerHeight + ctaRect.height));
          ctaBg.style.transform = 'translateY(' + (ctaProgress * 25) + '%)';
        }
      }

      // Hide scroll arrow near dashboard section
      var scrollArrow = document.querySelector('.scroll-arrow');
      var dashboardSection = document.getElementById('dashboard-section');
      if (scrollArrow && dashboardSection) {
        var dashRect = dashboardSection.getBoundingClientRect();
        if (dashRect.top <= window.innerHeight * 0.8) {
          scrollArrow.classList.add('scroll-arrow-hidden');
          scrollArrow.classList.remove('scroll-arrow-visible');
        } else {
          scrollArrow.classList.add('scroll-arrow-visible');
          scrollArrow.classList.remove('scroll-arrow-hidden');
        }
      }
    }, { passive: true });
  });

  /* ── River basins expand/collapse ── */
  document.addEventListener('DOMContentLoaded', function () {
    var toggleBtn = document.getElementById('basins-toggle');
    var toggleText = document.getElementById('basins-toggle-text');
    var toggleIcon = document.getElementById('basins-toggle-icon');
    var extraGrid = document.getElementById('basins-extra-grid');
    var isExpanded = false;

    if (!toggleBtn || !extraGrid || !toggleText || !toggleIcon) return;

    toggleBtn.addEventListener('click', function () {
      isExpanded = !isExpanded;

      if (isExpanded) {
        extraGrid.classList.remove('hidden');
        toggleText.textContent = 'Show Less';
        toggleIcon.classList.add('rotated');
      } else {
        extraGrid.classList.add('hidden');
        toggleText.textContent = 'View All 13 River Basins';
        toggleIcon.classList.remove('rotated');
        document.getElementById('basins').scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

})();

  /* ── Basin Card Lightbox ── */
  document.addEventListener('DOMContentLoaded', function () {
    var basinCards = document.querySelectorAll('.basin-card');
    var lightbox = document.getElementById('basin-lightbox');
    if (!lightbox) return;

    var lightboxImg = document.getElementById('basin-lightbox-img');
    var lightboxIndex = document.getElementById('basin-lightbox-index');
    var lightboxName = document.getElementById('basin-lightbox-name');
    var lightboxDesc = document.getElementById('basin-lightbox-desc');
    var lightboxClose = document.getElementById('basin-lightbox-close');
    var lightboxBg = document.querySelector('.basin-lightbox-bg');

    basinCards.forEach(function(card) {
      card.addEventListener('click', function() {
        var img = this.querySelector('.basin-card-image');
        var index = this.querySelector('.basin-card-index');
        var name = this.querySelector('.basin-card-name');
        var desc = this.querySelector('.basin-card-desc');

        if (img) lightboxImg.src = img.src;
        if (img) lightboxImg.alt = img.alt;
        if (index) lightboxIndex.textContent = index.textContent;
        if (name) lightboxName.textContent = name.textContent;
        if (desc) lightboxDesc.textContent = desc.textContent;

        lightbox.classList.add('active');
        // Disable body scroll when lightbox is open
        document.body.style.overflow = 'hidden';
      });
    });

    function closeLightbox() {
      if (lightbox.classList.contains('active')) {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
      }
    }

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxBg) lightboxBg.addEventListener('click', closeLightbox);

    // Close on any scroll attempt
    window.addEventListener('wheel', function() {
      closeLightbox();
    }, { passive: true });

    window.addEventListener('touchmove', function() {
      closeLightbox();
    }, { passive: true });

    // Close on Escape key
    window.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeLightbox();
    });
  });
