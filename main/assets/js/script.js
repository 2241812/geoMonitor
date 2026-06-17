(function () {
  'use strict';

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
