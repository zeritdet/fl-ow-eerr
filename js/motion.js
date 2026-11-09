(() => {
  const intro = document.getElementById('introScreen');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finishIntro = () => {
    if (!intro || intro.classList.contains('is-leaving')) return;
    intro.classList.add('is-leaving');
    window.setTimeout(() => intro.remove(), 850);
  };
  if (intro) {
    document.getElementById('introSkip')?.addEventListener('click', finishIntro);
    if (reduced) finishIntro();
    else window.setTimeout(finishIntro, 2350);
  }

  // Reveal-on-scroll: native scrolling stays untouched; observer pauses work off-screen.
  const targets = document.querySelectorAll('.hero-copy, .hero-image, .nav, .section, .story-copy, .footer, .cms-extra-section');
  targets.forEach((node, index) => {
    node.dataset.reveal = node.matches('.hero-image, .collection, .product-photo, .story img') ? 'image' : 'section';
    node.style.transitionDelay = `${Math.min(index % 3, 2) * 70}ms`;
  });
  if (!reduced && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('motion-ready');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
    targets.forEach(node => observer.observe(node));
  }
})();
