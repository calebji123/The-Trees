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
  const spiralSvg     = document.getElementById('spiral_graph');
  const globe         = document.getElementById('scene-globe');
  const hint          = document.querySelector('.spiral-scroll-hint');
  const defoNarrative = document.querySelector('.deforestation-narrative');
  const timeline      = document.getElementById('timeline_graph');

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

    window.dispatchEvent(new CustomEvent('spiral:scroll-progress', {
      detail: { progress }
    }));

    // Gate momentum at spiral entry
    if (prevProgress !== -1 && prevProgress < 0.005 && progress >= 0.005) startGate();
    prevProgress = progress;

    // Final focus phase: fade spiral/timeline out quickly, then hold fully faded state.
    const fadeStart = 0.76;
    const fadeEnd = 0.9;
    const stableT = clamp((progress - fadeStart) / (fadeEnd - fadeStart), 0, 1);

    if (timeline) {
      timeline.style.opacity = String(1 - stableT);
      timeline.style.pointerEvents = stableT > 0.5 ? 'none' : 'auto';
    }
    if (spiralSvg) {
      spiralSvg.style.opacity = String(1 - stableT);
    }

    spiral.style.opacity       = '1';
    spiral.style.transform     = 'scale(1)';
    spiral.style.pointerEvents = 'auto';
    globe.style.opacity        = String(stableT);
    globe.style.transform      = 'scale(1)';
    globe.style.pointerEvents  = 'none';
    globe.style.zIndex         = stableT > 0 ? '4' : '2';
    globe.style.background     = 'transparent';
    globe.style.backgroundImage = 'none';
    if (hint) hint.classList.remove('visible');
    if (defoNarrative) defoNarrative.classList.toggle('visible', stableT > 0.35);
  }

  window.addEventListener('scroll', update, { passive: true });
  update();

  // No scene-globe observer while transition is disabled.
})();
