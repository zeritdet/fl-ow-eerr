(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 560px), (hover: none)');
  const nav = document.querySelector('.nav');

  const heroItems = [...document.querySelectorAll('.hero-copy, .hero-image')];
  heroItems.forEach((node, index) => {
    node.classList.add('motion-hero-item');
    node.style.setProperty('--hero-delay', `${index * 120}ms`);
  });

  const revealTargets = [...document.querySelectorAll(
    '.section, .collection, .product, .story, .footer, .page-extra'
  )].filter(node => !node.classList.contains('motion-hero-item'));

  revealTargets.forEach((node, index) => {
    node.classList.add('motion-reveal');
    if (node.matches('.collection, .product, .story img')) node.classList.add('motion-reveal-image');
    const perGroup = mobile.matches ? 3 : 4;
    const step = mobile.matches ? 60 : 85;
    node.style.setProperty('--reveal-delay', `${(index % perGroup) * step}ms`);
  });

  if (!reduceMotion.matches) {
    root.classList.add('motion-ready');
    requestAnimationFrame(() => {
      heroItems.forEach(node => node.classList.add('is-visible'));
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        });
      }, {
        threshold: mobile.matches ? 0.05 : 0.08,
        rootMargin: mobile.matches ? '0px 0px 2% 0px' : '0px 0px -4% 0px'
      });
      revealTargets.forEach(node => observer.observe(node));
    } else {
      revealTargets.forEach(node => node.classList.add('is-visible'));
    }
  } else {
    heroItems.concat(revealTargets).forEach(node => node.classList.add('is-visible'));
  }

  // Header state: one passive listener, updates coalesced through rAF.
  let scrollQueued = false;
  const updateHeader = () => {
    scrollQueued = false;
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 40);
  };
  const onScroll = () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(updateHeader);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  updateHeader();

  // Depth transforms on stack panels are intentionally disabled.
})();
