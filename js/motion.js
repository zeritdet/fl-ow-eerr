(() => {
  const intro = document.getElementById('introScreen');
  const skip = document.getElementById('introSkip');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let introDone = false;
  let introTimer;

  const finishIntro = () => {
    if (!intro || introDone) return;
    introDone = true;
    window.clearTimeout(introTimer);
    intro.classList.add('is-leaving');
    document.body.classList.remove('intro-active');
    window.setTimeout(() => intro.remove(), 1150);
  };

  if (intro) {
    skip?.addEventListener('click', finishIntro);
    if (reduceMotion.matches) {
      finishIntro();
    } else {
      // Let each part of the logo animation read clearly before the white fade.
      introTimer = window.setTimeout(finishIntro, 6500);
    }
  }

  const revealTargets = document.querySelectorAll(
    '.hero-copy, .hero-image, .nav, #collections .section-head, .collection, ' +
    '#shop .section-head, #shop .product, .story img, .story-copy, .footer'
  );
  revealTargets.forEach((node, index) => {
    node.classList.add('motion-reveal');
    if (node.matches('.hero-image, .collection, .product, .story img')) {
      node.classList.add('motion-reveal-image');
    }
    node.style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 85}ms`);
  });

  if (!reduceMotion.matches && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('motion-ready');
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
    revealTargets.forEach(node => revealObserver.observe(node));
  } else {
    revealTargets.forEach(node => node.classList.add('is-visible'));
  }

  // Scroll depth: panels gently recede as the next panel approaches.
  // Uses one rAF loop, passive scroll listeners and transforms only.
  const panels = [...document.querySelectorAll('.stack-panel')];
  let ticking = false;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const updateDepth = () => {
    ticking = false;
    if (reduceMotion.matches) return;
    const vh = window.innerHeight || 800;
    panels.forEach(panel => {
      const rect = panel.getBoundingClientRect();
      const progress = clamp((vh * 0.58 - rect.top) / (vh * 0.58), 0, 1);
      const scale = 1 - progress * 0.025;
      const y = -progress * 12;
      panel.style.setProperty('--depth-scale', scale.toFixed(4));
      panel.style.setProperty('--depth-y', `${y.toFixed(1)}px`);
      panel.style.setProperty('--depth-shadow', `${(0.035 + progress * 0.045).toFixed(3)}`);
    });
  };
  const requestDepthUpdate = () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateDepth);
    }
  };
  if (!reduceMotion.matches && panels.length) {
    window.addEventListener('scroll', requestDepthUpdate, { passive: true });
    window.addEventListener('resize', requestDepthUpdate, { passive: true });
    updateDepth();
  }

  reduceMotion.addEventListener?.('change', event => {
    if (event.matches) {
      document.documentElement.classList.remove('motion-ready');
      revealTargets.forEach(node => node.classList.add('is-visible'));
      panels.forEach(panel => {
        panel.style.removeProperty('--depth-scale');
        panel.style.removeProperty('--depth-y');
        panel.style.removeProperty('--depth-shadow');
      });
    }
  });
})();
