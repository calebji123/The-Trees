/**
 * Main.js - Application Entry Point
 * Initializes all visualizations
 */

// Global visualization instance
let globeVis;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('🌍 The Trees - Initializing...');
  
  // Initialize Globe Visualization
  globeVis = new GlobeVis('globe-container');
  globeVis.init();
  
  console.log('✅ Application ready!');
});
