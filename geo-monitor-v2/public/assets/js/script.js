window.initLandingPageScripts = function() {\n(function () {
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

  
    }, { threshold: 0.3 });

    var statsSection = document.querySelector('.stats-inner');
    if (statsSection) counterObserver.observe(statsSection);
  });

  /* ── Sticky header shadow on scroll & Parallax ── */
  
  });

  /* ── Navigation arrows click handlers ── */
  
      });
    }

    if (upArrow) {
      upArrow.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  });

  /* ── River basins expand/collapse ── */
  
      }
    });
  });

})();

  /* ── Basin Card Lightbox ── */
  
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
\n};