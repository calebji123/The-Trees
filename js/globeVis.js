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
    this.data = [];
  }
  
  /**
   * Initialize the visualization
   */
  async init() {
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
      
      // Calculate forest loss for each region
      this.data.forEach(r => {
        const latest = r.timeSeries[r.timeSeries.length - 1];
        const first = r.timeSeries[0];
        r.forestLoss = first.forestCover - latest.forestCover;
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
      console.log('Using fallback data:', this.data);
    }
  }
  
  /**
   * Setup SVG and projection
   */
  setupSvg() {
    this.svg = d3.select(`#${this.containerId}`)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height);
    
    // Orthographic projection for 3D globe
    this.projection = d3.geoOrthographic()
      .scale(280)
      .translate([this.width / 2, this.height / 2])
      .clipAngle(90)
      .rotate([-20, -20]);
    
    this.path = d3.geoPath().projection(this.projection);
    
    // Ocean
    this.svg.append('circle')
      .attr('cx', this.width / 2)
      .attr('cy', this.height / 2)
      .attr('r', 280)
      .attr('fill', '#1a3a5c');
    
    // Graticule (grid lines)
    const graticule = d3.geoGraticule();
    this.svg.append('path')
      .datum(graticule)
      .attr('d', this.path)
      .attr('fill', 'none')
      .attr('stroke', '#2a4a6c')
      .attr('stroke-width', 0.5)
      .attr('stroke-opacity', 0.4);
    
    // Groups for layering
    this.landGroup = this.svg.append('g');
    this.hotspotGroup = this.svg.append('g');
  }
  
  /**
   * Load and draw world map
   */
  loadMap() {
    d3.json('https://unpkg.com/world-atlas@2/countries-110m.json')
      .then(world => {
        const countries = topojson.feature(world, world.objects.countries);
        
        this.landGroup.selectAll('.globe-country')
          .data(countries.features)
          .enter()
          .append('path')
          .attr('class', 'globe-country')
          .attr('d', this.path)
          .attr('fill', '#2d5a27')
          .attr('stroke', '#1a3518')
          .attr('stroke-width', 0.5);
        
        this.drawHotspots();
      });
  }
  
  /**
   * Draw deforestation hotspots
   */
  drawHotspots() {
    const self = this;
    
    console.log('Drawing hotspots for', this.data.length, 'regions:', this.data);
    
    const hotspots = this.hotspotGroup.selectAll('.globe-hotspot-group')
      .data(this.data)
      .enter()
      .append('g')
      .attr('class', 'globe-hotspot-group');
    
    // Pulse effect
    hotspots.append('circle')
      .attr('class', 'globe-hotspot-pulse')
      .attr('r', 20)
      .attr('fill', '#e07b39')
      .attr('opacity', 0.3);
    
    // Main hotspot circle
    hotspots.append('circle')
      .attr('class', 'globe-hotspot')
      .attr('r', d => 8 + (d.forestLoss / 5))
      .attr('fill', '#e07b39')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        if (self.selectedRegion !== d.name) {
          d3.select(this).attr('fill', '#dc3545');
        }
      })
      .on('mouseout', function(event, d) {
        if (self.selectedRegion !== d.name) {
          d3.select(this).attr('fill', '#e07b39');
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
    
    // Reset all hotspots
    this.hotspotGroup.selectAll('.globe-hotspot')
      .classed('globe-selected', false)
      .attr('fill', '#e07b39');
    
    // Highlight selected
    d3.select(element)
      .classed('globe-selected', true)
      .attr('fill', '#dc3545');
    
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
      .attr('fill', 'rgba(224, 123, 57, 0.2)')
      .attr('d', forestArea);
    
    // Forest line
    const forestLine = d3.line()
      .x(d => xScale(d.year))
      .y(d => yScaleForest(d.forestCover))
      .curve(d3.curveMonotoneX);
    
    chartSvg.append('path').datum(timeSeries)
      .attr('fill', 'none')
      .attr('stroke', '#e07b39')
      .attr('stroke-width', 2)
      .attr('d', forestLine);
    
    // Forest dots
    chartSvg.selectAll('.globe-forest-dot').data(timeSeries).enter()
      .append('circle')
      .attr('class', 'globe-forest-dot')
      .attr('cx', d => xScale(d.year))
      .attr('cy', d => yScaleForest(d.forestCover))
      .attr('r', 3)
      .attr('fill', '#e07b39');
    
    // Bird line
    const birdLine = d3.line()
      .x(d => xScale(d.year))
      .y(d => yScaleBirds(d.birdSpecies))
      .curve(d3.curveMonotoneX);
    
    chartSvg.append('path').datum(timeSeries)
      .attr('fill', 'none')
      .attr('stroke', '#4a7c43')
      .attr('stroke-width', 2)
      .attr('d', birdLine);
    
    // Bird dots
    chartSvg.selectAll('.globe-bird-dot').data(timeSeries).enter()
      .append('circle')
      .attr('class', 'globe-bird-dot')
      .attr('cx', d => xScale(d.year))
      .attr('cy', d => yScaleBirds(d.birdSpecies))
      .attr('r', 3)
      .attr('fill', '#4a7c43');
  }
  
  /**
   * Close the popup
   */
  closePopup() {
    document.getElementById('globe-popup').classList.remove('globe-visible');
    this.selectedRegion = null;
    
    this.hotspotGroup.selectAll('.globe-hotspot')
      .classed('globe-selected', false)
      .attr('fill', '#e07b39');
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
