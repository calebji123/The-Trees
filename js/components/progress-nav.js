/**
 * Progress Navigation — fixed right-side dot indicators
 * Tracks sections via IntersectionObserver
 */
(function () {
  const SECTIONS = [
    { id: 'hero',        label: 'Home' },
    { id: 'background', label: 'The Crisis' },
    { id: 'temperature', label: 'Temperature' },
    { id: 'deforestation', label: 'Deforestation' },
    { id: 'emissions',  label: 'Emissions' },
    { id: 'hope',       label: 'Hope' },
  ];

  const nav = document.getElementById('progress-nav');
  const spiralTrack = document.getElementById('spiral-globe-track');
  if (!nav) return;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function setActiveById(id) {
    nav.querySelectorAll('.pnav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.target === id);
    });
  }

  function scrollToDeforestationPhase() {
    if (!spiralTrack) return;
    const trackTop = window.scrollY + spiralTrack.getBoundingClientRect().top;
    const scrollable = Math.max(spiralTrack.offsetHeight - window.innerHeight, 0);
    const targetY = trackTop + scrollable * 0.93;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }

  // Build dots
  SECTIONS.forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className = 'pnav-item';
    btn.dataset.target = id;
    btn.setAttribute('aria-label', `Go to ${label}`);
    btn.innerHTML = `<span class="pnav-label">${label}</span><span class="pnav-dot"></span>`;
    btn.addEventListener('click', () => {
      if (id === 'deforestation') {
        scrollToDeforestationPhase();
        return;
      }
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
    nav.appendChild(btn);
  });

  // Show nav after first scroll
  let shown = false;
  window.addEventListener('scroll', () => {
    if (!shown && window.scrollY > 60) {
      shown = true;
      nav.classList.add('visible');
    }
  }, { passive: true });

  // Track active section
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveById(entry.target.id);
        }
      });
    },
    { threshold: 0.3 }
  );

  SECTIONS.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });

  // While inside the sticky spiral->globe transition, expose a distinct nav state.
  if (spiralTrack) {
    window.addEventListener('scroll', () => {
      const rect = spiralTrack.getBoundingClientRect();
      const scrollable = Math.max(spiralTrack.offsetHeight - window.innerHeight, 0);
      if (!scrollable) return;

      const inTrack = rect.top <= 0 && rect.bottom >= window.innerHeight;
      if (!inTrack) return;

      const progress = clamp(-rect.top / scrollable, 0, 1);
      if (progress >= 0.88) {
        setActiveById('deforestation');
      } else if (progress >= 0.05) {
        setActiveById('temperature');
      }
    }, { passive: true });
  }
})();
