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

  // ── Forest Loss & Bird Extinction Risk ────────────────────
  initForestRLIViz('forest-rli-mount');

});
