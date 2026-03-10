/**
 * main.js — Our Warming World
 * Initializes all visualizations after DOM is ready.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Spiral Graph ──────────────────────────────────────────
  createSpiralGraph({
    svgId:    '#spiral_graph',
    dataPath: 'data/global_temperature.csv'
  });

  // ── Globe Visualization ───────────────────────────────────
  try {
    window.globeVis = new GlobeVis('globe-section');
    window.globeVis.init().catch(err => {
      console.error('Globe init failed:', err);
    });
  } catch (e) {
    console.error('Globe setup error:', e);
  }

  // ── Forest Loss & Bird Extinction Risk ────────────────────
  initForestRLIViz('forest-rli-mount');

});
