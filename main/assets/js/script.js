(function () {
  'use strict';

  /* ── Scroll-triggered fade-in ── */
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.addEventListener('DOMContentLoaded', function () {
    var els = document.querySelectorAll('.fade-in-up');
    for (var i = 0; i < els.length; i++) {
      observer.observe(els[i]);
    }
  });

  /* ── Sticky header shadow on scroll ── */
  document.addEventListener('DOMContentLoaded', function () {
    var header = document.getElementById('site-header');

    window.addEventListener('scroll', function () {
      if (window.scrollY > 10) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  });

  /* ── River basins expand/collapse ── */
  document.addEventListener('DOMContentLoaded', function () {
    var toggleBtn = document.getElementById('basins-toggle');
    var extra = document.getElementById('basins-extra');
    var isExpanded = false;

    if (!toggleBtn || !extra) return;

    toggleBtn.addEventListener('click', function () {
      isExpanded = !isExpanded;

      if (isExpanded) {
        extra.classList.add('expanded');
        toggleBtn.textContent = 'Show Less';
      } else {
        extra.classList.remove('expanded');
        toggleBtn.textContent = 'View All 13 River Basins';
        document.getElementById('basins').scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

})();
