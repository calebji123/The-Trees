/**
 * Parallax — subtle vertical shift on .parallax-bg elements
 * Uses CSS background-attachment: fixed on desktop;
 * On mobile the CSS falls back to scroll, so no JS needed.
 */
(function () {
  // Hero fade on scroll
  const heroContent = document.getElementById('hero-content');
  const heroScrollCue = document.getElementById('hero-scroll-cue');

  if (heroContent) {
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      const fadeStart = 80;
      const fadeEnd   = 480;
      let opacity = 1;
      if (scrollY > fadeStart) {
        opacity = Math.max(0, 1 - (scrollY - fadeStart) / (fadeEnd - fadeStart));
      }
      const translateY = (1 - opacity) * 28;
      heroContent.style.opacity  = opacity;
      heroContent.style.transform = `translateY(${translateY}px)`;
      if (heroScrollCue) heroScrollCue.style.opacity = opacity;
    }, { passive: true });
  }
})();
