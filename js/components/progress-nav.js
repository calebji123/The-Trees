/**
 * Progress Navigation — fixed right-side dot indicators
 * Tracks sections via IntersectionObserver
 */
(function () {
  const SECTIONS = [
    { id: 'hero',        label: 'Home' },
    { id: 'background', label: 'The Crisis' },
    { id: 'temperature', label: 'Temperature' },
    { id: 'emissions',  label: 'Emissions' },
    { id: 'habitat',    label: 'Habitat' },
    { id: 'hope',       label: 'Hope' },
  ];

  const nav = document.getElementById('progress-nav');
  if (!nav) return;

  // Build dots
  SECTIONS.forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className = 'pnav-item';
    btn.dataset.target = id;
    btn.setAttribute('aria-label', `Go to ${label}`);
    btn.innerHTML = `<span class="pnav-label">${label}</span><span class="pnav-dot"></span>`;
    btn.addEventListener('click', () => {
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
          nav.querySelectorAll('.pnav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.target === entry.target.id);
          });
        }
      });
    },
    { threshold: 0.3 }
  );

  SECTIONS.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
})();
