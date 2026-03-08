/**
 * GlobeVis - Deforestation Globe Visualization
 * 
 * Shows global deforestation hotspots on an interactive 3D globe.
 * All CSS classes are prefixed with 'globe-' to avoid conflicts.
 * Loads data from data/deforestation.csv
 */

class GlobeVis {
  constructor(containerId) {
    this.containerId = containerId;
    this.width = 600;
    this.height = 600;
    this.selectedRegion = null;
    this.isPaused = false;
    this.rotationTimer = null;
    this.graticulePath = null;
    this.data = [];
  }
  
  /**
   * Initialize the visualization
   */
  async init() {
    // Build HTML structure
    this.buildHTML();
    
    // Load data from CSV
    await this.loadData();
    
    // Setup SVG
    this.setupSvg();
    
    // Load world map and draw
    this.loadMap();
    
    // Add interactions
    this.addDragBehavior();
    
    // Start auto-rotation
    this.startRotation();
  }
  
  /**
   * Build HTML structure dynamically
   */
  buildHTML() {
    const container = document.getElementById(this.containerId);
    container.innerHTML = `
      <h1 class="globe-title">Global Deforestation Hotspots</h1>
      <p class="globe-subtitle">Drag to rotate. Click a hotspot to see historical data.</p>
      
      <div class="globe-wrapper">
        <div id="globe-container" class="globe-container"></div>
        
        <div id="globe-popup" class="globe-popup">
          <button class="globe-close-btn">&times;</button>
          <h4 id="globe-popup-title"></h4>
          <div class="globe-popup-stats" id="globe-popup-stats"></div>
          <div id="globe-chart"></div>
          <div class="globe-chart-legend">
            <div class="globe-legend-item">
              <div class="globe-legend-color" style="background: #c45d3e;"></div>
              <span>Forest Cover %</span>
            </div>
            <div class="globe-legend-item">
              <div class="globe-legend-color" style="background: #2d6a4f;"></div>
              <span>Bird Species</span>
            </div>
          </div>
        </div>
        
        <div class="globe-paused-indicator" id="globe-paused">
          ⏸ Globe paused
          <button class="globe-resume-btn">Resume</button>
        </div>
      </div>
    `;
    
    // Add event listeners
    const self = this;
    container.querySelector('.globe-close-btn').addEventListener('click', () => self.closePopup());
    container.querySelector('.globe-resume-btn').addEventListener('click', () => self.resume());
  }
  
  /**
   * Load data from CSV file
   */
  async loadData() {
    try {
      const rawData = await d3.csv('data/deforestation.csv');
      console.log('Raw CSV data:', rawData);
      
      // Group by region
      const grouped = d3.group(rawData, d => d.region);
      
      this.data = Array.from(grouped, ([region, values]) => ({
        name: region,
        lat: +values[0].lat,
        lon: +values[0].lon,
        timeSeries: values.map(d => ({
          year: +d.year,
          forestCover: +d.forestCover,
          birdSpecies: +d.birdSpecies
        }))
      }));
      
      // Calculate forest loss and intensity for each region
      let maxForestLoss = 0;
      this.data.forEach(r => {
        const latest = r.timeSeries[r.timeSeries.length - 1];
        const first = r.timeSeries[0];
        r.forestLoss = first.forestCover - latest.forestCover;
        if (r.forestLoss > maxForestLoss) maxForestLoss = r.forestLoss;
      });
      this.maxForestLoss = maxForestLoss || 1;
      this.data.forEach(r => {
        r.intensity = r.forestLoss / this.maxForestLoss; // 0–1, how bad relative to worst
      });
      console.log('Processed data:', this.data);
    } catch (error) {
      console.error('Error loading CSV:', error);
      // Fallback to hardcoded data if CSV fails
      this.data = [
        { name: "Amazon", lat: -3.4653, lon: -62.2159, forestLoss: 30,
          timeSeries: [
            { year: 2000, forestCover: 100, birdSpecies: 1300 },
            { year: 2024, forestCover: 70, birdSpecies: 950 }
          ]
        },
        { name: "Congo Basin", lat: 0.228, lon: 21.7587, forestLoss: 23,
          timeSeries: [
            { year: 2000, forestCover: 100, birdSpecies: 1000 },
            { year: 2024, forestCover: 77, birdSpecies: 810 }
          ]
        },
        { name: "Southeast Asia", lat: 2.5, lon: 112.5, forestLoss: 45,
          timeSeries: [
            { year: 2000, forestCover: 100, birdSpecies: 800 },
            { year: 2024, forestCover: 55, birdSpecies: 490 }
          ]
        },
        { name: "Madagascar", lat: -18.7669, lon: 46.8691, forestLoss: 43,
          timeSeries: [
            { year: 2000, forestCover: 100, birdSpecies: 280 },
            { year: 2024, forestCover: 57, birdSpecies: 178 }
          ]
        },
        { name: "Indonesia", lat: -2.5, lon: 118.0, forestLoss: 40,
          timeSeries: [
            { year: 2000, forestCover: 100, birdSpecies: 720 },
            { year: 2024, forestCover: 60, birdSpecies: 485 }
          ]
        }
      ];
      this.maxForestLoss = Math.max(...this.data.map(r => r.forestLoss), 1);
      this.data.forEach(r => { r.intensity = r.forestLoss / this.maxForestLoss; });
      console.log('Using fallback data:', this.data);
    }
  }
  
  /**
   * Setup SVG and projection (append inside globe-container so popup positions correctly)
   */
  setupSvg() {
    const container = document.getElementById('globe-container');
    if (!container) return;
    this.svg = d3.select('#globe-container')
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('aria-label', 'Globe with deforestation hotspots');
    
    // Orthographic projection for 3D globe
    this.projection = d3.geoOrthographic()
      .scale(280)
      .translate([this.width / 2, this.height / 2])
      .clipAngle(90)
      .rotate([-20, -20]);
    
    this.path = d3.geoPath().projection(this.projection);
    
    // Ocean – soft blue-green to match cream page
    this.svg.append('circle')
      .attr('cx', this.width / 2)
      .attr('cy', this.height / 2)
      .attr('r', 280)
      .attr('fill', '#4da8c4')
      .attr('opacity', 0.25);
    
    // Graticule (grid lines) – keep a reference so it rotates with the globe
    this.graticule = d3.geoGraticule();
    this.graticulePath = this.svg.append('path')
      .datum(this.graticule())
      .attr('d', this.path)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(61,50,41,0.12)')
      .attr('stroke-width', 0.5);
    
    // Groups for layering
    this.landGroup = this.svg.append('g');
    this.hotspotGroup = this.svg.append('g');
  }
  
  /**
   * Load and draw world map (with error handling so hotspots still show)
   */
  loadMap() {
    const self = this;
    d3.json('https://unpkg.com/world-atlas@2/countries-110m.json')
      .then(world => {
        if (!world || !world.objects) throw new Error('Invalid world atlas');
        const countries = topojson.feature(world, world.objects.countries);
        self.landGroup.selectAll('.globe-country')
          .data(countries.features)
          .enter()
          .append('path')
          .attr('class', 'globe-country')
          .attr('d', self.path)
          .attr('fill', '#2d6a4f')
          .attr('stroke', 'rgba(61,50,41,0.15)')
          .attr('stroke-width', 0.5);
        self.drawHotspots();
      })
      .catch(err => {
        console.warn('Globe: world atlas failed, drawing hotspots only.', err);
        self.drawHotspots();
      });
  }
  
  /**
   * Draw deforestation hotspots as animated fires (intensity = relative severity)
   */
  drawHotspots() {
    const self = this;
    if (!this.data || this.data.length === 0) return;
    const maxR = 28;
    const minR = 12;
    const scaleR = d => minR + (maxR - minR) * (d.intensity ?? 0.5);

    const hotspots = this.hotspotGroup.selectAll('.globe-hotspot-group')
      .data(this.data)
      .enter()
      .append('g')
      .attr('class', 'globe-hotspot-group')
      .style('cursor', 'pointer');

    // Animated fire: outer glow
    hotspots.append('circle')
      .attr('class', 'globe-fire-glow')
      .attr('r', d => scaleR(d) * 1.4)
      .attr('fill', '#c45d3e')
      .attr('opacity', 0.35);
    // Middle flame
    hotspots.append('circle')
      .attr('class', 'globe-fire-flame')
      .attr('r', d => scaleR(d) * 0.85)
      .attr('fill', '#d4860b')
      .attr('opacity', 0.7);
    // Inner core
    hotspots.append('circle')
      .attr('class', 'globe-fire-core')
      .attr('r', d => scaleR(d) * 0.5)
      .attr('fill', '#f4a261')
      .attr('opacity', 0.95);

    // Hit target and selection ring
    hotspots.append('circle')
      .attr('class', 'globe-hotspot')
      .attr('r', d => scaleR(d) + 4)
      .attr('fill', 'transparent')
      .attr('stroke', 'none')
      .attr('stroke-width', 2)
      .on('mouseover', function(event, d) {
        if (self.selectedRegion !== d.name) {
          self.hotspotGroup.selectAll('.globe-hotspot').attr('stroke', 'none');
          d3.select(this).attr('stroke', '#3d3229').attr('stroke-width', 2);
        }
      })
      .on('mouseout', function(event, d) {
        if (self.selectedRegion !== d.name) {
          d3.select(this).attr('stroke', 'none');
        }
      })
      .on('click', function(event, d) {
        event.stopPropagation();
        self.selectRegion(d, this);
      });

    this.updatePositions();
  }
  
  /**
   * Update hotspot positions based on projection
   */
  updatePositions() {
    const self = this;
    
    this.hotspotGroup.selectAll('.globe-hotspot-group')
      .attr('transform', d => {
        const coords = self.projection([d.lon, d.lat]);
        return coords ? `translate(${coords[0]}, ${coords[1]})` : 'translate(-1000,-1000)';
      })
      .attr('visibility', d => {
        const r = self.projection.rotate();
        const distance = d3.geoDistance([d.lon, d.lat], [-r[0], -r[1]]);
        return distance < Math.PI / 2 ? 'visible' : 'hidden';
      });
  }
  
  /**
   * Select a region and show chart popup
   */
  selectRegion(d, element) {
    this.pause();
    this.selectedRegion = d.name;
    
    // Reset all hotspot groups
    this.hotspotGroup.selectAll('.globe-hotspot-group').classed('globe-selected', false);
    this.hotspotGroup.selectAll('.globe-hotspot').attr('stroke', 'none');
    
    // Highlight selected group
    d3.select(element.parentNode).classed('globe-selected', true);
    d3.select(element).attr('stroke', '#3d3229').attr('stroke-width', 2.5);
    
    // Calculate stats
    const latest = d.timeSeries[d.timeSeries.length - 1];
    const first = d.timeSeries[0];
    const forestLoss = first.forestCover - latest.forestCover;
    const birdLoss = Math.round((1 - latest.birdSpecies / first.birdSpecies) * 100);
    
    // Update popup content
    document.getElementById('globe-popup-title').textContent = d.name;
    document.getElementById('globe-popup-stats').innerHTML = `
      Forest loss: <span>${forestLoss}%</span> since 2000 | 
      Bird species: <span>${latest.birdSpecies}</span> (↓${birdLoss}%)
    `;
    
    // Position popup
    const coords = this.projection([d.lon, d.lat]);
    const popup = document.getElementById('globe-popup');
    
    let popupX = coords[0] + 20;
    let popupY = coords[1] - 100;
    
    if (popupX + 320 > this.width) popupX = coords[0] - 340;
    if (popupY < 10) popupY = coords[1] + 20;
    if (popupY + 250 > this.height) popupY = this.height - 260;
    // Clamp so popup stays on screen
    popupX = Math.max(10, Math.min(popupX, this.width - 330));
    popupY = Math.max(10, Math.min(popupY, this.height - 260));
    
    popup.style.left = popupX + 'px';
    popup.style.top = popupY + 'px';
    popup.classList.add('globe-visible');
    
    this.drawChart(d);
  }
  
  /**
   * Draw the trend chart
   */
  drawChart(regionData) {
    d3.select('#globe-chart').html('');
    
    const margin = { top: 15, right: 45, bottom: 30, left: 40 };
    const chartWidth = 280 - margin.left - margin.right;
    const chartHeight = 150 - margin.top - margin.bottom;
    
    const chartSvg = d3.select('#globe-chart')
      .append('svg')
      .attr('width', chartWidth + margin.left + margin.right)
      .attr('height', chartHeight + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    const timeSeries = regionData.timeSeries;
    
    // Scales
    const xScale = d3.scaleLinear().domain([2000, 2024]).range([0, chartWidth]);
    const yScaleForest = d3.scaleLinear().domain([0, 100]).range([chartHeight, 0]);
    const yScaleBirds = d3.scaleLinear()
      .domain([0, d3.max(timeSeries, d => d.birdSpecies) * 1.1])
      .range([chartHeight, 0]);
    
    // Grid
    chartSvg.append('g').attr('class', 'globe-grid') 
      .selectAll('line').data(yScaleForest.ticks(4)).enter()
      .append('line')
      .attr('x1', 0).attr('x2', chartWidth)
      .attr('y1', d => yScaleForest(d)).attr('y2', d => yScaleForest(d));
    
    // Axes
    chartSvg.append('g').attr('class', 'globe-axis')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale).ticks(4).tickFormat(d3.format('d')));
    
    chartSvg.append('g').attr('class', 'globe-axis')
      .call(d3.axisLeft(yScaleForest).ticks(4).tickFormat(d => d + '%'));
    
    chartSvg.append('g').attr('class', 'globe-axis')
      .attr('transform', `translate(${chartWidth}, 0)`)
      .call(d3.axisRight(yScaleBirds).ticks(4));
    
    // Forest area fill
    const forestArea = d3.area()
      .x(d => xScale(d.year))
      .y0(chartHeight)
      .y1(d => yScaleForest(d.forestCover))
      .curve(d3.curveMonotoneX);
    
    chartSvg.append('path').datum(timeSeries)
      .attr('fill', 'rgba(196,93,62,0.15)')
      .attr('d', forestArea);
    
    // Forest line
    const forestLine = d3.line()
      .x(d => xScale(d.year))
      .y(d => yScaleForest(d.forestCover))
      .curve(d3.curveMonotoneX);
    
    chartSvg.append('path').datum(timeSeries)
      .attr('fill', 'none')
      .attr('stroke', '#c45d3e')
      .attr('stroke-width', 2)
      .attr('d', forestLine);
    
    // Forest dots
    chartSvg.selectAll('.globe-forest-dot').data(timeSeries).enter()
      .append('circle')
      .attr('class', 'globe-forest-dot')
      .attr('cx', d => xScale(d.year))
      .attr('cy', d => yScaleForest(d.forestCover))
      .attr('r', 3)
      .attr('fill', '#c45d3e');
    
    // Bird line
    const birdLine = d3.line()
      .x(d => xScale(d.year))
      .y(d => yScaleBirds(d.birdSpecies))
      .curve(d3.curveMonotoneX);
    
    chartSvg.append('path').datum(timeSeries)
      .attr('fill', 'none')
      .attr('stroke', '#2d6a4f')
      .attr('stroke-width', 2)
      .attr('d', birdLine);
    
    // Bird dots
    chartSvg.selectAll('.globe-bird-dot').data(timeSeries).enter()
      .append('circle')
      .attr('class', 'globe-bird-dot')
      .attr('cx', d => xScale(d.year))
      .attr('cy', d => yScaleBirds(d.birdSpecies))
      .attr('r', 3)
      .attr('fill', '#2d6a4f');
  }
  
  /**
   * Close the popup and resume globe rotation
   */
  closePopup() {
    document.getElementById('globe-popup').classList.remove('globe-visible');
    this.selectedRegion = null;
    this.hotspotGroup.selectAll('.globe-hotspot-group').classed('globe-selected', false);
    this.hotspotGroup.selectAll('.globe-hotspot').attr('stroke', 'none');
    // Resume spinning when user closes the chart
    this.isPaused = false;
    document.getElementById('globe-paused').classList.remove('globe-visible');
    this.startRotation();
  }
  
  /**
   * Pause rotation
   */
  pause() {
    if (this.rotationTimer) {
      this.rotationTimer.stop();
      this.rotationTimer = null;
    }
    this.isPaused = true;
    document.getElementById('globe-paused').classList.add('globe-visible');
  }
  
  /**
   * Resume rotation
   */
  resume() {
    this.closePopup();
    this.isPaused = false;
    document.getElementById('globe-paused').classList.remove('globe-visible');
    this.startRotation();
  }
  
  /**
   * Start auto-rotation
   */
  startRotation() {
    if (this.isPaused) return;
    
    const self = this;
    this.rotationTimer = d3.timer(() => {
      const r = self.projection.rotate();
      self.projection.rotate([r[0] + 0.3, r[1]]);
      self.updateMap();
    });
  }
  
  /**
   * Stop rotation
   */
  stopRotation() {
    if (this.rotationTimer) {
      this.rotationTimer.stop();
      this.rotationTimer = null;
    }
  }
  
  /**
   * Update all map elements after rotation
   */
  updateMap() {
    this.svg.selectAll('.globe-country').attr('d', this.path);
    this.landGroup.selectAll('path').attr('d', this.path);
    if (this.graticulePath && this.graticule) {
      this.graticulePath.attr('d', this.path(this.graticule()));
    }
    this.updatePositions();
  }
  
  /**
   * Add drag behavior for manual rotation
   */
  addDragBehavior() {
    const self = this;
    
    const drag = d3.drag()
      .on('start', () => { 
        if (self.rotationTimer) self.rotationTimer.stop(); 
      })
      .on('drag', (event) => {
        const r = self.projection.rotate();
        self.projection.rotate([r[0] + event.dx * 0.5, r[1] - event.dy * 0.5]);
        self.updateMap();
      })
      .on('end', () => { 
        if (!self.isPaused) self.startRotation(); 
      });
    
    this.svg.call(drag);
  }
}

// Initialize on page load
let globeVis;
document.addEventListener('DOMContentLoaded', () => {
  try {
    globeVis = new GlobeVis('globe-section');
    globeVis.init().catch(err => {
      console.error('Globe init failed:', err);
    });
  } catch (e) {
    console.error('Globe setup error:', e);
  }
});
