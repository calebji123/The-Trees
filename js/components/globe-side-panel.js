/**
 * Globe Side Panel
 *
 * Listens for 'globeHotspotSelected' custom events dispatched by globeVis.js
 * and shows a right-side slide-in panel with:
 *   1. Region stats
 *   2. Forest cover + bird species trend chart (rendered by globeVis.drawChart)
 *   3. Global forest loss & bird RLI context mini-chart
 */
(function () {
  const panel    = document.getElementById('globe-side-panel');
  const backdrop = document.getElementById('globe-panel-backdrop');
  const closeBtn = document.getElementById('gsp-close');

  if (!panel) return;

  function openPanel(data) {
    const { name, timeSeries } = data;
    const latest     = timeSeries[timeSeries.length - 1];
    const first      = timeSeries[0];
    const forestLoss = Math.round(first.forestCover - latest.forestCover);
    const birdLoss   = Math.round((1 - latest.birdSpecies / first.birdSpecies) * 100);

    document.getElementById('gsp-title').textContent = name;

    document.getElementById('gsp-stats').innerHTML = `
      <div class="gsp-stat">
        <span class="gsp-stat-val">${forestLoss}%</span>
        <span class="gsp-stat-lbl">Forest lost since 2000</span>
      </div>
      <div class="gsp-stat">
        <span class="gsp-stat-val">↓${birdLoss}%</span>
        <span class="gsp-stat-lbl">Bird species decline</span>
      </div>
    `;
    if (typeof renderForestRLIPanelViz === 'function') {
      renderForestRLIPanelViz('gsp-bird-viz', data);
    }
    if (window.globeVis) {
      window.globeVis.drawChart(data);
    }

    drawForestContextChart();

    panel.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    const progressNav = document.getElementById('progress-nav');
    if (progressNav) progressNav.style.display = 'none';
  }


  function closePanel() {
    panel.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    const progressNav = document.getElementById('progress-nav');
    if (progressNav) progressNav.style.display = '';
    // Tell globe to reset its selection and resume rotation
    if (window.globeVis) {
      window.globeVis.closePopup(); // resets isPaused and restarts rotation
    }
  }

  function drawForestContextChart() {
    const container = document.getElementById('gsp-forest-chart');
    if (!container || typeof d3 === 'undefined') return;
    d3.select(container).html('');

    d3.csv('data/final_global_forest_rli_2001_2023.csv', d3.autoType).then(data => {
      data.sort((a, b) => a.year - b.year);

      const margin = { top: 8, right: 16, bottom: 28, left: 36 };
      const totalW = container.offsetWidth || 340;
      const w = totalW - margin.left - margin.right;
      const h = 100 - margin.top - margin.bottom;

      const svg = d3.select(container)
        .append('svg')
        .attr('width', totalW)
        .attr('height', h + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3.scaleLinear().domain(d3.extent(data, d => d.year)).range([0, w]);
      const y = d3.scaleLinear().domain([
        d3.min(data, d => d.rli) * 0.98,
        d3.max(data, d => d.rli) * 1.01
      ]).range([h, 0]);

      // Area fill
      const area = d3.area()
        .x(d => x(d.year))
        .y0(h)
        .y1(d => y(d.rli))
        .curve(d3.curveMonotoneX);

      svg.append('path').datum(data)
        .attr('fill', 'rgba(45,106,79,0.12)')
        .attr('d', area);

      // RLI line
      const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.rli))
        .curve(d3.curveMonotoneX);

      svg.append('path').datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#2d6a4f')
        .attr('stroke-width', 1.8)
        .attr('d', line);

      svg.append('g')
        .attr('transform', `translate(0,${h})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')))
        .selectAll('text').attr('fill', '#9a8d80').attr('font-size', '9px');

      svg.append('g')
        .call(d3.axisLeft(y).ticks(4).tickFormat(d => d.toFixed(2)))
        .selectAll('text').attr('fill', '#9a8d80').attr('font-size', '9px');

      // Axis lines
      svg.selectAll('.domain, .tick line')
        .attr('stroke', 'rgba(61,50,41,0.15)');
    }).catch(() => {
      d3.select(container).append('p')
        .style('font-size', '0.75rem')
        .style('color', '#9a8d80')
        .text('Global RLI data unavailable.');
    });
  }

  // Event listeners
  if (closeBtn) closeBtn.addEventListener('click', closePanel);
  if (backdrop) backdrop.addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });

  // Listen for hotspot selection from globe
  document.addEventListener('globeHotspotSelected', e => openPanel(e.detail));
})();
