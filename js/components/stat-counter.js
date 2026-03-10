/**
 * Stat Counter — animated number counters
 * Triggered by IntersectionObserver when element enters viewport
 */
(function () {
  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }

  function animateCounter(el) {
    const value    = parseFloat(el.dataset.value) || 0;
    const prefix   = el.dataset.prefix || '';
    const suffix   = el.dataset.suffix || '';
    const decimals = parseInt(el.dataset.decimals, 10) || 0;
    const duration = 1600;
    const start    = performance.now();

    const numEl = el.querySelector('.stat-number');
    if (!numEl) return;

    function tick(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const current  = value * easeOutQuad(progress);
      numEl.textContent = prefix + current.toFixed(decimals) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );

  document.querySelectorAll('.stat-item[data-value]').forEach(el => observer.observe(el));
})();
