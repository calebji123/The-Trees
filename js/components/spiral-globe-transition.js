/**
 * Spiral → Globe Fade Transition
 *
 * Phase layout (of the 180vh scroll track):
 *
 *   Phase 1  0–20%   Spiral at rest.
 *   Phase 2 20–70%   Cross-fade: spiral fades out (+ very subtle scale up),
 *                    globe fades in (+ subtle scale up from 0.97→1).
 *   Phase 3 70–100%  Globe fully visible and interactive.
 *
 * No zoom, no clip-path, no transform-origin calibration.
 */
(function () {
  const track         = document.getElementById('spiral-globe-track');
  const spiral        = document.getElementById('scene-spiral');
  const globe         = document.getElementById('scene-globe');
  const hint          = document.querySelector('.spiral-scroll-hint');
  const defoNarrative = document.querySelector('.deforestation-narrative');

  if (!track || !spiral || !globe) return;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function easeInOut(t)     { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }

  // ── Scroll gate ───────────────────────────────────────────────────────────
  // Gates wheel/touch events at boundary points until the current scroll
  // gesture fully stops (no wheel event for 150ms), killing trackpad momentum.
  let gating       = false;
  let gateTimer    = null;
  let prevProgress = -1;

  function startGate() { gating = true; }

  function isTrackSticky() {
    const r = track.getBoundingClientRect();
    return r.top <= 0 && r.bottom >= window.innerHeight;
  }

  window.addEventListener('wheel', (e) => {
    if (!gating || !isTrackSticky()) return;
    e.preventDefault();
    clearTimeout(gateTimer);
    gateTimer = setTimeout(() => { gating = false; }, 150);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (gating && isTrackSticky()) e.preventDefault();
  }, { passive: false });

  function update() {
    const rect       = track.getBoundingClientRect();
    const scrollable = track.offsetHeight - window.innerHeight;
    const scrolled   = clamp(-rect.top, 0, scrollable);
    const progress   = scrolled / scrollable; // 0 → 1

    // Gate momentum at spiral entry and at globe reveal
    if (prevProgress !== -1) {
      if (prevProgress < 0.005 && progress >= 0.005) startGate();
      if (prevProgress < 0.68  && progress >= 0.68)  startGate();
    }
    prevProgress = progress;

    // Scroll hint
    if (hint) {
      hint.classList.toggle('visible', progress > 0.02 && progress < 0.18);
    }

    if (progress < 0.20) {
      // ── Phase 1: Spiral at rest ──────────────────────────────────────
      spiral.style.opacity      = '1';
      spiral.style.transform    = 'scale(1)';
      spiral.style.pointerEvents = 'auto';
      globe.style.opacity       = '0';
      globe.style.transform     = 'scale(0.97)';
      globe.style.pointerEvents = 'none';
      if (defoNarrative) defoNarrative.classList.remove('visible');

    } else if (progress < 0.70) {
      // ── Phase 2: Cross-fade ──────────────────────────────────────────
      const t    = (progress - 0.20) / 0.50;
      const ease = easeInOut(t);

      // Spiral: fade out with a very subtle scale-up
      spiral.style.opacity      = String(clamp(1 - ease, 0, 1));
      spiral.style.transform    = `scale(${1 + ease * 0.06})`;
      spiral.style.pointerEvents = ease > 0.5 ? 'none' : 'auto';

      // Globe: fade in with a subtle scale-up from 0.97 → 1
      globe.style.opacity       = String(clamp(ease, 0, 1));
      globe.style.transform     = `scale(${0.97 + ease * 0.03})`;
      globe.style.pointerEvents = ease > 0.5 ? 'auto' : 'none';
      if (defoNarrative) defoNarrative.classList.toggle('visible', ease > 0.7);

    } else {
      // ── Phase 3: Globe fully revealed ───────────────────────────────
      spiral.style.opacity      = '0';
      spiral.style.transform    = 'scale(1.06)';
      spiral.style.pointerEvents = 'none';
      globe.style.opacity       = '1';
      globe.style.transform     = 'scale(1)';
      globe.style.pointerEvents = 'auto';
      if (defoNarrative) defoNarrative.classList.add('visible');
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  update();

  // Pause/resume globe rotation based on viewport visibility
  const globeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (!window.globeVis) return;
        if (entry.isIntersecting) {
          if (!window.globeVis.isPaused) window.globeVis.startRotation();
        } else {
          window.globeVis.stopRotation();
        }
      });
    },
    { threshold: 0.1 }
  );
  globeObserver.observe(globe);
})();
