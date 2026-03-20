/**
 * Compact emissions sparklines for spotlight countries.
 * Renders one simple line graph per country card.
 */
(function () {
  const mountSelector = '.country-mini-chart';
  const dataPath = 'data/owid_co2_filtered.csv';
  const startYear = 1990;

  const palette = {
    Germany: '#c45d3e',
    'United Kingdom': '#2d6a4f',
    Sweden: '#1b6b93'
  };

  let cachedRows = null;

  function drawCountrySparkline(node, country, rows) {
    const mount = d3.select(node);
    mount.html('');

    const values = rows
      .filter((d) => d.country === country && d.year >= startYear && d.co2 !== null)
      .map((d) => ({ year: +d.year, value: +d.co2 }))
      .sort((a, b) => a.year - b.year);

    if (values.length < 2) {
      mount.append('div').style('font-size', '11px').style('color', 'var(--fg-muted)').text('No trend data');
      return;
    }

    const bounds = node.getBoundingClientRect();
    const width = Math.max(180, Math.floor(bounds.width));
    const height = 86;
    const margin = { top: 8, right: 8, bottom: 16, left: 34 };

    const svg = mount
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const x = d3
      .scaleLinear()
      .domain(d3.extent(values, (d) => d.year))
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleLinear()
      .domain(d3.extent(values, (d) => d.value))
      .nice()
      .range([height - margin.bottom, margin.top]);

    const yFmt = (v) => {
      if (v >= 1000) return `${(v / 1000).toFixed(1)}G`;
      if (v >= 100) return `${Math.round(v)}M`;
      return `${v.toFixed(1)}M`;
    };

    const yAxis = d3.axisLeft(y).ticks(3).tickSize(0).tickFormat(yFmt);

    const stroke = palette[country] || 'var(--primary)';

    svg
      .append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', height - margin.bottom)
      .attr('y2', height - margin.bottom)
      .attr('stroke', 'var(--border)')
      .attr('stroke-width', 1);

    svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .attr('color', 'var(--fg-muted)')
      .call(yAxis)
      .call((g) => g.select('.domain').attr('stroke', 'var(--border)'))
      .call((g) => g.selectAll('.tick text').attr('font-size', 8));

    svg
      .append('path')
      .datum(values)
      .attr('fill', 'none')
      .attr('stroke', stroke)
      .attr('stroke-width', 2)
      .attr('d', d3.line().x((d) => x(d.year)).y((d) => y(d.value)).curve(d3.curveMonotoneX));

    const first = values[0];
    const last = values[values.length - 1];

    svg
      .append('circle')
      .attr('cx', x(first.year))
      .attr('cy', y(first.value))
      .attr('r', 2.2)
      .attr('fill', stroke);

    svg
      .append('circle')
      .attr('cx', x(last.year))
      .attr('cy', y(last.value))
      .attr('r', 2.8)
      .attr('fill', stroke);

    svg
      .append('text')
      .attr('x', margin.left)
      .attr('y', height - 3)
      .attr('font-size', 9)
      .attr('fill', 'var(--fg-muted)')
      .text(String(first.year));

    svg
      .append('text')
      .attr('x', width - margin.right)
      .attr('y', height - 3)
      .attr('font-size', 9)
      .attr('text-anchor', 'end')
      .attr('fill', 'var(--fg-muted)')
      .text(String(last.year));
  }

  function render() {
    const mounts = Array.from(document.querySelectorAll(mountSelector));
    if (!mounts.length) return;

    if (cachedRows) {
      mounts.forEach((node) => {
        const country = node.dataset.country;
        if (!country) return;
        drawCountrySparkline(node, country, cachedRows);
      });
      return;
    }

    d3.csv(dataPath, d3.autoType).then((rows) => {
      cachedRows = rows;
      mounts.forEach((node) => {
        const country = node.dataset.country;
        if (!country) return;
        drawCountrySparkline(node, country, cachedRows);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', render);
  window.addEventListener('resize', () => {
    const mount = document.querySelector(mountSelector);
    if (!mount) return;
    clearTimeout(window.__miniEmissionsResizeTimer);
    window.__miniEmissionsResizeTimer = setTimeout(render, 150);
  });
})();
