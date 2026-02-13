// ════════════════════════════════════════════
// COUNTRY SPHERES VISUALIZATION
// ════════════════════════════════════════════

// Build DOM structure
const csWrapper = d3.select('#country-spheres')
  .append('div').attr('class', 'cs-wrapper');

const csHeader = csWrapper.append('div').attr('id', 'cs-header');
csHeader.append('h1').attr('id', 'cs-main-title')
  .html('Our Warming World<br><em>CO₂ Per Capita</em>');
csHeader.append('p')
  .text('Each bubble represents a country — sized by emissions, positioned geographically, colored by continent. Click any country for its full story.');

const csMetricToggle = csWrapper.append('div').attr('id', 'cs-metric-toggle');
csMetricToggle.append('button').attr('class', 'cs-metric-btn active').attr('data-metric', 'per_capita').text('Per Capita');
csMetricToggle.append('button').attr('class', 'cs-metric-btn').attr('data-metric', 'total').text('Total Emissions');

const csControls = csWrapper.append('div').attr('id', 'cs-controls');
csControls.append('button').attr('class', 'cs-btn').attr('id', 'cs-play-btn').text('▶ Play');
csControls.append('input').attr('type', 'range').attr('id', 'cs-year-slider')
  .attr('min', '1950').attr('max', '2023').attr('value', '2023').attr('step', '1');
csControls.append('div').attr('id', 'cs-year-display').text('2023');

const csSpeedControls = csControls.append('div').attr('id', 'cs-speed-controls');
csSpeedControls.append('button').attr('class', 'cs-btn cs-speed-btn').attr('data-speed', '250').text('1×');
csSpeedControls.append('button').attr('class', 'cs-btn cs-speed-btn active').attr('data-speed', '120').text('2×');
csSpeedControls.append('button').attr('class', 'cs-btn cs-speed-btn').attr('data-speed', '50').text('5×');

csWrapper.append('div').attr('id', 'cs-legend');

const csSvg = csWrapper.append('div').attr('id', 'cs-viz-container')
  .append('svg').attr('id', 'cs-viz');

csWrapper.append('div').attr('id', 'cs-tooltip');
csWrapper.append('div').attr('id', 'cs-detail-overlay').on('click', csCloseDetail);

const csDetailPanel = csWrapper.append('div').attr('id', 'cs-detail-panel');
csDetailPanel.append('button').attr('class', 'cs-close-btn').text('✕').on('click', csCloseDetail);
csDetailPanel.append('h2').attr('id', 'cs-detail-name');
csDetailPanel.append('div').attr('class', 'cs-detail-sub').attr('id', 'cs-detail-sub');
const csDetailMetricToggle = csDetailPanel.append('div').attr('id', 'cs-detail-metric-toggle');
csDetailMetricToggle.append('button').attr('class', 'cs-detail-mbtn active').attr('data-dm', 'per_capita').text('Per Capita');
csDetailMetricToggle.append('button').attr('class', 'cs-detail-mbtn').attr('data-dm', 'total').text('Total');
csDetailPanel.append('svg').attr('id', 'cs-detail-chart');

// ════════════════════════════════════════════
// DATA & STATE
// ════════════════════════════════════════════
const CS_GEO = {};
const csDataPC = {};
const csDataTotal = {};

const CS_COLORS = {
  'North America': '#c45d3e', 'South America': '#b5485d', 'Europe': '#2d6a4f',
  'Africa': '#d4860b', 'Asia': '#1b6b93', 'Oceania': '#7b5ea7', 'Middle East': '#b07d2e'
};

let csYear = 2023, csMetric = 'per_capita', csPlaying = false, csInterval = null, csSpeed = 120;
let csDetailCountry = null, csDetailMetric = 'per_capita';
let csSimNodes = [], csSimNodeMap = {}, csSimulation = null;

const csMargin = { top: 80, right: 20, bottom: 10, left: 20 };
let csW, csH;

function csCalcDimensions() {
  csW = Math.min(1400, window.innerWidth) - csMargin.left - csMargin.right;
  csH = Math.max(600, Math.min(850, window.innerHeight * 0.68));
}
csCalcDimensions();

const csLngRange = [-170, 180], csLatRange = [74, -48];
function csProjectX(lng) { return csMargin.left + ((lng - csLngRange[0]) / (csLngRange[1] - csLngRange[0])) * csW; }
function csProjectY(lat) { return csMargin.top + ((csLatRange[0] - lat) / (csLatRange[0] - csLatRange[1])) * csH; }

csSvg.attr('width', csW + csMargin.left + csMargin.right)
  .attr('height', csH + csMargin.top + csMargin.bottom);
const csBubbleG = csSvg.append('g');

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════
function csGetData() { return csMetric === 'per_capita' ? csDataPC : csDataTotal; }
function csGetDataFor(m) { return m === 'per_capita' ? csDataPC : csDataTotal; }
function csMetricLabel(m) { return m === 'per_capita' ? 'CO₂/capita' : 'Total CO₂'; }
function csMetricUnit(m) { return m === 'per_capita' ? 't' : 'Mt'; }

function csFormatVal(v, m) {
  if (m === 'total') {
    if (v >= 1000) return (v/1000).toFixed(1)+' Gt';
    if (v >= 1) return v.toFixed(1)+' Mt';
    return (v*1000).toFixed(0)+' kt';
  }
  return v.toFixed(2)+' t';
}

function csFormatShort(v, m) {
  if (m === 'total') {
    if (v >= 1000) return (v/1000).toFixed(1)+'G';
    if (v >= 100) return v.toFixed(0)+'M';
    if (v >= 1) return v.toFixed(1)+'M';
    return (v*1000).toFixed(0)+'k';
  }
  return v.toFixed(1)+'t';
}

function csShortName(name) {
  const map = {
    'United States':'USA','United Kingdom':'UK','United Arab Emirates':'UAE',
    'South Korea':'S.Korea','Saudi Arabia':'S.Arabia','New Zealand':'NZ',
    'South Africa':'S.Africa','Democratic Republic of Congo':'DR Congo',
    'Trinidad and Tobago':'Trinidad','Dominican Republic':'Dom.Rep.',
    'Bosnia and Herzegovina':'Bosnia','North Macedonia':'N.Maced.',
    'Papua New Guinea':'PNG','Central African Republic':'CAR',
    'Equatorial Guinea':'Eq.Guinea',"Cote d'Ivoire":"Cote d'Iv.",
    "Saint Vincent and the Grenadines":"St.Vincent","Antigua and Barbuda":"Antigua",
    "Saint Kitts and Nevis":"St.Kitts","Sao Tome and Principe":"STP",
    "Micronesia (country)":"Micronesia","Sint Maarten (Dutch part)":"St.Maarten",
    "Bonaire Sint Eustatius and Saba":"Bonaire"
  };
  return map[name] || (name.length > 9 ? name.slice(0,8)+'.' : name);
}

// ════════════════════════════════════════════
// LEGEND
// ════════════════════════════════════════════
function csBuildLegend() {
  const leg = d3.select('#cs-legend');
  Object.entries(CS_COLORS).forEach(([name, color]) => {
    const item = leg.append('div').attr('class','cs-legend-item');
    item.append('div').attr('class','cs-legend-dot').style('background', color);
    item.append('span').text(name);
  });
}

// ════════════════════════════════════════════
// YEAR DATA
// ════════════════════════════════════════════
function csGetYearData(year) {
  const source = csGetData();
  const entries = [];
  Object.keys(source).forEach(country => {
    const val = source[country][year];
    if (val === undefined || val <= 0) return;
    const geo = CS_GEO[country];
    if (!geo || !geo.cont) return;
    const prev = source[country][year - 5];
    let trend = 'stable';
    if (prev !== undefined && prev > 0) {
      if (val > prev * 1.05) trend = 'up';
      else if (val < prev * 0.95) trend = 'down';
    }
    entries.push({ country, val, cont: geo.cont, trend, px: csProjectX(geo.lng), py: csProjectY(geo.lat) });
  });
  entries.sort((a, b) => b.val - a.val);
  entries.forEach((d, i) => d.rank = i + 1);
  return entries;
}

function csMakeRScale(data) {
  const mx = d3.max(data, d => d.val) || 1;
  const maxR = Math.min(80, csW / 14);
  return d3.scalePow().exponent(0.7).domain([0, mx]).range([2, maxR]);
}

// ════════════════════════════════════════════
// FORCE SIMULATION
// ════════════════════════════════════════════
function csInitSim() {
  csSimulation = d3.forceSimulation(csSimNodes)
    .force('collide', d3.forceCollide().radius(d => d.r + 1.5).strength(0.85).iterations(4))
    .force('x', d3.forceX(d => d.tx).strength(0.12))
    .force('y', d3.forceY(d => d.ty).strength(0.12))
    .alphaDecay(0.02).velocityDecay(0.35)
    .on('tick', () => {
      csBubbleG.selectAll('.cs-bg').attr('transform', d => {
        const node = csSimNodeMap[d.country];
        if (node) { d.px = node.x; d.py = node.y; }
        return `translate(${d.px},${d.py})`;
      });
    }).alpha(1).restart();
}

function csSyncSim(data) {
  const newMap = {};
  data.forEach(d => {
    const existing = csSimNodeMap[d.country];
    const gx = csProjectX(CS_GEO[d.country].lng);
    const gy = csProjectY(CS_GEO[d.country].lat);
    if (existing) {
      existing.r = d.r; existing.tx = gx; existing.ty = gy; existing.val = d.val;
      newMap[d.country] = existing;
    } else {
      newMap[d.country] = { country: d.country, r: d.r, val: d.val, tx: gx, ty: gy, x: gx, y: gy };
    }
  });
  csSimNodeMap = newMap;
  csSimNodes = Object.values(csSimNodeMap);
  csSimulation.nodes(csSimNodes);
  csSimulation.force('collide').radius(d => d.r + 1.5);
  csSimulation.force('x').x(d => d.tx);
  csSimulation.force('y').y(d => d.ty);
  csSimulation.alpha(0.6).restart();
  data.forEach(d => { const node = csSimNodeMap[d.country]; if (node) { d.px = node.x; d.py = node.y; } });
}

// ════════════════════════════════════════════
// UPDATE VIZ
// ════════════════════════════════════════════
function csUpdateViz(year) {
  const data = csGetYearData(year);
  const rScale = csMakeRScale(data);
  data.forEach(d => d.r = rScale(d.val));
  csSyncSim(data);

  const topN = csW < 600 ? 12 : 30;
  const labelSet = new Set(data.slice(0, topN).map(d => d.country));

  const sel = csBubbleG.selectAll('.cs-bg').data(data, d => d.country);
  sel.exit().transition().duration(300).attr('opacity', 0).remove();

  const enter = sel.enter().append('g').attr('class','cs-bg')
    .attr('opacity', 0).style('cursor','pointer')
    .on('click', (_, d) => csOpenDetail(d.country))
    .on('mouseenter', csShowTooltip).on('mousemove', csShowTooltip)
    .on('mouseleave', csHideTooltip);

  enter.append('circle').attr('class','cs-bc');
  enter.append('text').attr('class','cs-bname').attr('text-anchor','middle').attr('pointer-events','none')
    .attr('font-weight', 600).attr('font-family','Source Sans 3, sans-serif');
  enter.append('text').attr('class','cs-binfo').attr('text-anchor','middle').attr('pointer-events','none')
    .attr('font-family','IBM Plex Mono, monospace');
  enter.append('text').attr('class','cs-btrend').attr('text-anchor','middle').attr('pointer-events','none');

  const merged = enter.merge(sel);
  enter.attr('transform', d => `translate(${d.px},${d.py})`);
  merged.transition().duration(300).attr('opacity', 1);

  merged.select('.cs-bc').transition().duration(350)
    .attr('r', d => d.r)
    .attr('fill', d => CS_COLORS[d.cont] || '#888').attr('fill-opacity', 0.18)
    .attr('stroke', d => CS_COLORS[d.cont] || '#888').attr('stroke-opacity', 0.7)
    .attr('stroke-width', d => d.r > 8 ? 1.5 : 0.8);

  merged.select('.cs-bname')
    .text(d => labelSet.has(d.country) && d.r > 12 ? csShortName(d.country) : '')
    .attr('dy', d => d.r > 22 ? '-0.5em' : '-0.15em')
    .attr('font-size', d => Math.max(5.5, Math.min(11, d.r * 0.38)) + 'px')
    .attr('fill', d => CS_COLORS[d.cont] || '#3d3229');

  merged.select('.cs-binfo')
    .text(d => labelSet.has(d.country) && d.r > 20 ? `${csFormatShort(d.val, csMetric)} #${d.rank}` : '')
    .attr('dy', '0.65em').attr('font-size', d => Math.max(5, Math.min(8, d.r * 0.28)) + 'px').attr('fill', '#6b5d50');

  merged.select('.cs-btrend')
    .text(d => (!labelSet.has(d.country) || d.r < 26) ? '' : d.trend === 'up' ? '▲' : d.trend === 'down' ? '▼' : '—')
    .attr('dy', '1.6em').attr('font-size', d => Math.max(6, Math.min(10, d.r * 0.3)) + 'px')
    .attr('fill', d => d.trend === 'up' ? '#c45d3e' : d.trend === 'down' ? '#2d6a4f' : '#9a8d80');
}

// ════════════════════════════════════════════
// TOOLTIP
// ════════════════════════════════════════════
function csShowTooltip(event, d) {
  const tip = d3.select('#cs-tooltip');
  const trendStr = d.trend === 'up' ? '▲ Rising' : d.trend === 'down' ? '▼ Falling' : '— Stable';
  const trendColor = d.trend === 'up' ? '#c45d3e' : d.trend === 'down' ? '#2d6a4f' : '#9a8d80';
  const mLabel = csMetric === 'per_capita' ? 'CO₂/capita' : 'Total CO₂';
  tip.html(`
    <div class="cs-tt-name" style="color:${CS_COLORS[d.cont]}">${d.country}</div>
    <div class="cs-tt-row">${mLabel}: <span class="cs-tt-val">${csFormatVal(d.val, csMetric)}</span></div>
    <div class="cs-tt-row">Global rank: <span class="cs-tt-val">#${d.rank}</span></div>
    <div class="cs-tt-row">5yr trend: <span class="cs-tt-val" style="color:${trendColor}">${trendStr}</span></div>
    <div class="cs-tt-row">Region: <span class="cs-tt-val">${d.cont}</span></div>
    <div class="cs-tt-click">Click for full trend →</div>
  `);
  tip.style('left', (event.clientX + 16) + 'px').style('top', (event.clientY - 10) + 'px').style('opacity', 1);
}

function csHideTooltip() { d3.select('#cs-tooltip').style('opacity', 0); }

// ════════════════════════════════════════════
// DETAIL PANEL
// ════════════════════════════════════════════
function csOpenDetail(country) {
  csDetailCountry = country;
  csDetailMetric = csMetric;
  d3.selectAll('.cs-detail-mbtn').classed('active', function() { return this.dataset.dm === csDetailMetric; });
  d3.select('#cs-detail-overlay').classed('open', true);
  d3.select('#cs-detail-panel').classed('open', true);
  csDrawDetailChart();
}

function csDrawDetailChart() {
  if (!csDetailCountry) return;
  const geo = CS_GEO[csDetailCountry];
  const color = CS_COLORS[geo?.cont] || '#c45d3e';
  const source = csGetDataFor(csDetailMetric);
  const mLabel = csMetricLabel(csDetailMetric), mUnit = csMetricUnit(csDetailMetric);

  d3.select('#cs-detail-name').text(csDetailCountry).style('color', color);
  d3.select('#cs-detail-sub').text(`${geo?.cont || ''} · ${mLabel} over time`);

  const countryData = source[csDetailCountry];
  if (!countryData) return;
  const years = Object.keys(countryData).map(Number).sort((a,b) => a-b);
  const values = years.map(y => ({ year: y, val: countryData[y] }));

  const chartSvg = d3.select('#cs-detail-chart');
  chartSvg.selectAll('*').remove();
  const cM = { top: 20, right: 16, bottom: 36, left: 52 };
  const cw = Math.min(420, window.innerWidth - 80) - cM.left - cM.right;
  const ch = 220 - cM.top - cM.bottom;

  const g = chartSvg.attr('width', cw + cM.left + cM.right).attr('height', ch + cM.top + cM.bottom)
    .append('g').attr('transform', `translate(${cM.left},${cM.top})`);

  const x = d3.scaleLinear().domain(d3.extent(years)).range([0, cw]);
  const y = d3.scaleLinear().domain([0, d3.max(values, d => d.val) * 1.12]).range([ch, 0]);

  g.append('g').attr('transform', `translate(0,${ch})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')))
    .attr('color', '#d5cfc5').selectAll('text').attr('fill', '#9a8d80').attr('font-size', '10px');
  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => csDetailMetric === 'total' ? (d >= 1000 ? (d/1000)+'G' : d+'M') : d))
    .attr('color', '#d5cfc5').selectAll('text').attr('fill', '#9a8d80').attr('font-size', '10px');

  g.append('text').attr('x', cw/2).attr('y', ch + 32).attr('text-anchor','middle').attr('fill','#9a8d80').attr('font-size','10px').text('Year');
  g.append('text').attr('transform','rotate(-90)').attr('x', -ch/2).attr('y', -42).attr('text-anchor','middle').attr('fill','#9a8d80').attr('font-size','10px').text(`${mLabel} (${mUnit})`);

  const area = d3.area().x(d => x(d.year)).y0(ch).y1(d => y(d.val)).curve(d3.curveMonotoneX);
  g.append('path').datum(values).attr('fill', color).attr('fill-opacity', 0.08).attr('d', area);

  const line = d3.line().x(d => x(d.year)).y(d => y(d.val)).curve(d3.curveMonotoneX);
  const path = g.append('path').datum(values).attr('fill','none').attr('stroke', color).attr('stroke-width', 2).attr('d', line);
  const totalLen = path.node().getTotalLength();
  path.attr('stroke-dasharray', totalLen).attr('stroke-dashoffset', totalLen)
    .transition().duration(1000).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0);

  const curVal = countryData[csYear];
  if (curVal !== undefined) {
    g.append('circle').attr('cx', x(csYear)).attr('cy', y(curVal)).attr('r', 4).attr('fill', color).attr('opacity', 0)
      .transition().delay(800).duration(300).attr('opacity', 1);
    g.append('text').attr('x', x(csYear)).attr('y', y(curVal) - 10).attr('text-anchor','middle').attr('fill', color)
      .attr('font-size','10px').attr('font-weight', 700).text(`${csFormatVal(curVal, csDetailMetric)} (${csYear})`)
      .attr('opacity', 0).transition().delay(900).duration(300).attr('opacity', 1);
  }
}

function csCloseDetail() {
  d3.select('#cs-detail-overlay').classed('open', false);
  d3.select('#cs-detail-panel').classed('open', false);
  csDetailCountry = null;
}

// ════════════════════════════════════════════
// CONTROLS
// ════════════════════════════════════════════
function csSetupControls() {
  const slider = document.getElementById('cs-year-slider');
  const yearDisp = d3.select('#cs-year-display');
  const playBtn = d3.select('#cs-play-btn');
  let sliderRaf = null;

  d3.selectAll('.cs-metric-btn').on('click', function() {
    const btn = d3.select(this);
    if (btn.attr('data-metric') === csMetric) return;
    d3.selectAll('.cs-metric-btn').classed('active', false);
    btn.classed('active', true);
    csMetric = btn.attr('data-metric');
    csSimNodeMap = {}; csSimNodes = [];
    if (csSimulation) csSimulation.stop();
    csInitSim();
    d3.select('#cs-main-title').html(csMetric === 'per_capita' ? 'Our Warming World<br><em>CO₂ Per Capita</em>' : 'Our Warming World<br><em>Total CO₂ Emissions</em>');
    csUpdateViz(csYear);
  });

  d3.selectAll('.cs-detail-mbtn').on('click', function() {
    d3.selectAll('.cs-detail-mbtn').classed('active', false);
    d3.select(this).classed('active', true);
    csDetailMetric = this.dataset.dm;
    csDrawDetailChart();
  });

  slider.addEventListener('input', () => {
    csYear = +slider.value;
    yearDisp.text(csYear);
    if (sliderRaf) cancelAnimationFrame(sliderRaf);
    sliderRaf = requestAnimationFrame(() => csUpdateViz(csYear));
  });

  function startPlay() {
    csPlaying = true;
    playBtn.text('⏸ Pause').classed('active', true);
    if (+slider.value >= 2023) slider.value = 1950;
    csYear = +slider.value;
    csInterval = setInterval(() => {
      csYear++;
      if (csYear > 2023) { stopPlay(); return; }
      slider.value = csYear;
      yearDisp.text(csYear);
      csUpdateViz(csYear);
    }, csSpeed);
  }

  function stopPlay() {
    csPlaying = false;
    playBtn.text('▶ Play').classed('active', false);
    clearInterval(csInterval);
  }

  playBtn.on('click', () => csPlaying ? stopPlay() : startPlay());

  d3.selectAll('.cs-speed-btn').on('click', function() {
    d3.selectAll('.cs-speed-btn').classed('active', false);
    d3.select(this).classed('active', true);
    csSpeed = +this.dataset.speed;
    if (csPlaying) { clearInterval(csInterval); startPlay(); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') csCloseDetail();
    if (e.key === ' ' && !e.target.closest('#cs-detail-panel')) { e.preventDefault(); csPlaying ? stopPlay() : startPlay(); }
    if (e.key === 'ArrowRight' && !csPlaying) { csYear = Math.min(2023, csYear+1); slider.value = csYear; yearDisp.text(csYear); csUpdateViz(csYear); }
    if (e.key === 'ArrowLeft' && !csPlaying) { csYear = Math.max(1950, csYear-1); slider.value = csYear; yearDisp.text(csYear); csUpdateViz(csYear); }
  });

  window.addEventListener('resize', () => {
    csCalcDimensions();
    csSvg.attr('width', csW + csMargin.left + csMargin.right).attr('height', csH + csMargin.top + csMargin.bottom);
    csSimNodeMap = {}; csSimNodes = [];
    if (csSimulation) csSimulation.stop();
    csInitSim();
    csUpdateViz(csYear);
  });
}

// ════════════════════════════════════════════
// LOAD DATA & INIT
// ════════════════════════════════════════════
Promise.all([
  d3.csv("data/country_long_lat.csv", r => ({ country: r.country, lat: +r.latitude, lng: +r.longitude })),
  d3.csv("data/countries_by_continent.csv", r => ({ country: r.country, continent: r.continent })),
  d3.csv("data/owid_co2_filtered.csv", r => ({ country: r.country, year: +r.year, pc: +r.co2_per_capita, total: +r.co2 }))
]).then(([geo, cont, co2]) => {
  geo.forEach(r => { CS_GEO[r.country] = { lat: r.lat, lng: r.lng, cont: null }; });
  cont.forEach(r => { if (CS_GEO[r.country]) CS_GEO[r.country].cont = r.continent; });
  co2.forEach(r => {
    if (!CS_GEO[r.country]) return;
    if (r.pc > 0) { if (!csDataPC[r.country]) csDataPC[r.country] = {}; csDataPC[r.country][r.year] = r.pc; }
    if (r.total > 0) { if (!csDataTotal[r.country]) csDataTotal[r.country] = {}; csDataTotal[r.country][r.year] = r.total; }
  });
  csBuildLegend();
  csInitSim();
  csUpdateViz(csYear);
  csSetupControls();
});
