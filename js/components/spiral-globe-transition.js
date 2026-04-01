/**
 * Spiral → Globe Fade Transition
 *
 * Phase layout (of the extended scroll track):
 *
 *   Phase 1  0–20%   Spiral at rest.
 *   Phase 2 20–70%   Cross-fade: spiral fades out (+ very subtle scale up),
 *                    globe fades in (+ subtle scale up from 0.97→1).
 *   Phase 3 70–100%  Globe fully visible and interactive.
 *
 * No zoom, no clip-path, no transform-origin calibration.
 *
 * Scroll-capture:
 *   During the transition zone wheel deltas are dampened so the user can't
 *   skip with a single flick.  Visuals are driven by a smoothed value that
 *   chases the real scroll progress at a controlled rate — no boomerang,
 *   no position clamping.
 *
 * Hotspot gating:
 *   window.__spiralGlobeTransitionComplete is set true once the smoothed
 *   transition value settles at 1.  Globe hotspot clicks check this flag.
 */
(function () {
  const track         = document.getElementById('spiral-globe-track');
  const spiral        = document.getElementById('scene-spiral');
  const spiralSvg     = document.getElementById('spiral_graph');
  const globe         = document.getElementById('scene-globe');
  const hint          = document.querySelector('.spiral-scroll-hint');
  const defoNarrative = document.querySelector('.deforestation-narrative');
  const timeline      = document.getElementById('timeline_graph');
  let spiralPlaythroughComplete = false;

  window.__deforestationHotspotsClickable = false;

  if (!track || !spiral || !globe) return;

  window.addEventListener('spiral:playthrough-complete', () => {
    spiralPlaythroughComplete = true;
  });

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ── Constants ────────────────────────────────────────────── */
  const FADE_START     = 0.74;
  const FADE_END       = 0.86;

  // Wheel dampening — transition zone
  const DAMPEN_FACTOR  = 0.22;
  const MAX_DELTA      = 45;     // px cap per wheel event

  // Post-transition settling zone — dampening to absorb momentum
  const SETTLE_START   = FADE_END + 0.04;  // 0.90
  const SETTLE_DAMPEN  = 0.25;
  const SETTLE_MAX     = 40;

  // Post-track buffer — dampen momentum that would carry past the globe
  const POST_TRACK_BUFFER = 200; // px past the track bottom to dampen
  const POST_TRACK_DAMPEN = 0.55;
  const POST_TRACK_MAX    = 60;

  // Smooth chasing — max rate the visual value can move per frame
  const MAX_STEP       = 0.012;  // ~83 frames (≈1.4 s at 60fps) to cross 0→1

  let smoothStableT    = 0;
  let targetStableT    = 0;
  let inZone           = false;
  let inSettleZone     = false;

  /* ── Helpers ──────────────────────────────────────────────── */
  function getProgress() {
    const rect       = track.getBoundingClientRect();
    const scrollable = track.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return 0;
    return clamp(-rect.top, 0, scrollable) / scrollable;
  }

  /* ── Wheel dampening (does NOT touch scroll position) ────── */
  // Zone check is computed live on every wheel event (not from the
  // RAF-cached flags) so fast bursts of events can't slip through
  // between animation frames.
  function getPixelsPastTrack() {
    const rect = track.getBoundingClientRect();
    // How far the track bottom is above the viewport bottom (positive = past)
    return window.innerHeight - rect.bottom;
  }

  const sidePanel = document.getElementById('globe-side-panel');

  window.addEventListener('wheel', function (e) {
    // Don't intercept scrolling inside the side panel
    if (sidePanel && sidePanel.contains(e.target)) return;

    const p = getProgress();
    const isTransition = p >= FADE_START - 0.03 && p <= FADE_END + 0.04;
    const isSettle     = !isTransition && p > SETTLE_START && p <= 1.0;
    const pxPast       = getPixelsPastTrack();
    const isPostTrack  = !isTransition && !isSettle && pxPast > 0 && pxPast < POST_TRACK_BUFFER;

    if (!isTransition && !isSettle && !isPostTrack) return;

    // Only dampen forward (downward) scrolling in the post-track zone;
    // let the user scroll back up freely.
    if (isPostTrack && e.deltaY <= 0) return;

    e.preventDefault();

    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    if (e.deltaMode === 2) dy *= window.innerHeight;

    if (isTransition) {
      dy = clamp(dy * DAMPEN_FACTOR, -MAX_DELTA, MAX_DELTA);
    } else if (isSettle) {
      dy = clamp(dy * SETTLE_DAMPEN, -SETTLE_MAX, SETTLE_MAX);
    } else {
      dy = clamp(dy * POST_TRACK_DAMPEN, -POST_TRACK_MAX, POST_TRACK_MAX);
    }
    window.scrollBy({ top: dy, behavior: 'instant' });
  }, { passive: false });

  /* ── RAF loop — smoothly chase the target ─────────────────── */
  function loop() {
    // Read real scroll progress
    const progress = getProgress();
    targetStableT  = clamp((progress - FADE_START) / (FADE_END - FADE_START), 0, 1);
    inZone         = progress >= FADE_START - 0.03 && progress <= FADE_END + 0.04;
    inSettleZone   = !inZone && progress > SETTLE_START && progress <= 1.0;

    // Chase target at a capped rate
    const diff = targetStableT - smoothStableT;
    if (Math.abs(diff) > 0.0005) {
      const step = clamp(diff, -MAX_STEP, MAX_STEP);
      smoothStableT += step;
    } else {
      smoothStableT = targetStableT;
    }

    applyVisuals(smoothStableT, progress);
    requestAnimationFrame(loop);
  }

  /* ── Visual application (unchanged transition logic) ──────── */
  function applyVisuals(stableT, progress) {
    const hotspotsVisible    = stableT > 0.35;
    // Use raw target (instant scroll position) for clickability, not the
    // slow-chasing smoothStableT — otherwise the gate lags behind what
    // the user actually sees on screen.
    const hotspotsClickable  = targetStableT >= 0.85;

    window.__deforestationHotspotsVisible   = hotspotsVisible;
    window.__deforestationHotspotsClickable = hotspotsClickable;
    window.dispatchEvent(new CustomEvent('globe:hotspots-visibility-state', {
      detail: { visible: hotspotsVisible, clickable: hotspotsClickable }
    }));

    if (timeline) {
      timeline.style.opacity      = String(1 - stableT);
      timeline.style.pointerEvents = stableT > 0.5 ? 'none' : 'auto';
    }
    if (spiralSvg) {
      spiralSvg.style.opacity = String(1 - stableT);
    }

    spiral.style.opacity        = '1';
    // The actual globe SVG lives inside #scene-spiral (embedded in the
    // spiral center hole), so spiral must stay pointer-events: auto
    // at all times — otherwise drag and hotspot clicks are killed.
    spiral.style.pointerEvents  = 'auto';
    globe.style.opacity         = String(stableT);
    globe.style.pointerEvents   = 'none';

    // When the transition is complete, remove transform & will-change so the
    // browser re-rasterizes at native resolution (avoids blurry globe).
    if (stableT >= 1) {
      spiral.style.transform    = '';
      spiral.style.willChange   = 'auto';
      globe.style.transform     = '';
      globe.style.willChange    = 'auto';
    } else {
      spiral.style.transform    = 'scale(1)';
      spiral.style.willChange   = 'opacity, transform';
      globe.style.transform     = 'scale(1)';
      globe.style.willChange    = 'opacity';
    }
    globe.style.zIndex          = stableT > 0 ? '4' : '2';
    globe.style.background      = 'transparent';
    globe.style.backgroundImage = 'none';
    if (defoNarrative) defoNarrative.classList.toggle('visible', stableT > 0.35);

    // Scroll hint: appears when spiral finishes, stays through crossfade
    if (hint) {
      hint.classList.toggle('visible', spiralPlaythroughComplete && stableT < 0.85);
    }

  }

  /* ── Scroll event — just dispatches progress for other listeners ── */
  function onScroll() {
    const progress = getProgress();
    window.dispatchEvent(new CustomEvent('spiral:scroll-progress', {
      detail: { progress }
    }));
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── Keyboard shortcut: Enter to auto-scroll through transition ── */
  let autoScrolling = false;
  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    // Only trigger when hint is visible (spiral done, transition not yet complete)
    if (!hint || !hint.classList.contains('visible')) return;
    if (autoScrolling) return;
    e.preventDefault();
    autoScrolling = true;

    // Target: scroll to FADE_END of the track
    const trackRect  = track.getBoundingClientRect();
    const scrollable = track.offsetHeight - window.innerHeight;
    const targetScroll = track.offsetTop + scrollable * FADE_END + scrollable * 0.08;
    const startScroll  = window.scrollY;
    const distance     = targetScroll - startScroll;
    const duration     = 1200; // ms
    const startTime    = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // ease-in-out cubic
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo({ top: startScroll + distance * ease, behavior: 'instant' });
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        autoScrolling = false;
      }
    }
    requestAnimationFrame(step);
  });

  requestAnimationFrame(loop);
})();
