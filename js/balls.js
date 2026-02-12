// ════════════════════════════════════════════
// DATA LOADING — 3 separate CSVs from /data folder
// ════════════════════════════════════════════
const COUNTRY_GEO = {};
const dataPC = {};
const dataTotal = {};

Promise.all([
  // Load geo coordinates
  d3.csv("data/country_long_lat.csv", row => ({
    country: row.country,
    latitude: +row.latitude,
    longitude: +row.longitude
  })),
  // Load continent assignments
  d3.csv("data/countries_by_continent.csv", row => ({
    country: row.country,
    continent: row.continent
  })),
  // Load CO2 emissions data
  d3.csv("data/owid_co2_filtered.csv", row => ({
    country: row.country,
    year: +row.year,
    co2_per_capita: +row.co2_per_capita,
    co2: +row.co2
  }))
]).then(([geoData, contData, co2Data]) => {
  console.log("Geo data loaded:", geoData.length, "countries");
  console.log("Continent data loaded:", contData.length, "countries");
  console.log("CO2 data loaded:", co2Data.length, "rows");

  // Build geo lookup
  geoData.forEach(row => {
    COUNTRY_GEO[row.country] = { lat: row.latitude, lng: row.longitude, cont: null };
  });

  // Attach continents
  contData.forEach(row => {
    if (COUNTRY_GEO[row.country]) {
      COUNTRY_GEO[row.country].cont = row.continent;
    }
  });

  // Build per-capita and total CO2 lookups
  co2Data.forEach(row => {
    if (!COUNTRY_GEO[row.country]) return;
    if (row.co2_per_capita > 0) {
      if (!dataPC[row.country]) dataPC[row.country] = {};
      dataPC[row.country][row.year] = row.co2_per_capita;
    }
    if (row.co2 > 0) {
      if (!dataTotal[row.country]) dataTotal[row.country] = {};
      dataTotal[row.country][row.year] = row.co2;
    }
  });

  console.log("Countries with per-capita data:", Object.keys(dataPC).length);
  console.log("Countries with total data:", Object.keys(dataTotal).length);

  // Initialize visualization
  buildLegend();
  initSimulation();
  updateViz(currentYear);
});

// Continent colors
const CONTINENT_META = {
  'North America': '#c45d3e',
  'South America': '#b5485d',
  'Europe':        '#2d6a4f',
  'Africa':        '#d4860b',
  'Asia':          '#1b6b93',
  'Oceania':       '#7b5ea7',
  'Middle East':   '#b07d2e'
};

// ════════════════════════════════════════════
// GLOBALS
// ════════════════════════════════════════════
let currentYear = 2023;
let currentMetric = 'per_capita';
let playing = false;
let animInterval = null;
let speed = 120;
let detailCountry = null;
let detailMetric = 'per_capita';

const svgMargin = { top: 80, right: 20, bottom: 10, left: 20 };
let W, H;

function calcDimensions() {
  W = Math.min(1400, window.innerWidth) - svgMargin.left - svgMargin.right;
  H = Math.max(600, Math.min(850, window.innerHeight * 0.68));
}
calcDimensions();

const lngRange = [-170, 180];
const latRange = [74, -48];
function projectX(lng) { return svgMargin.left + ((lng - lngRange[0]) / (lngRange[1] - lngRange[0])) * W; }
function projectY(lat) { return svgMargin.top + ((latRange[0] - lat) / (latRange[0] - latRange[1])) * H; }

const svg = d3.select('#viz')
  .attr('width', W + svgMargin.left + svgMargin.right)
  .attr('height', H + svgMargin.top + svgMargin.bottom);
const bubbleG = svg.append('g');

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════
function getActiveData() { return currentMetric === 'per_capita' ? dataPC : dataTotal; }
function getDataFor(m) { return m === 'per_capita' ? dataPC : dataTotal; }
function metricLabel(m) { return m === 'per_capita' ? 'CO\u2082/capita' : 'Total CO\u2082'; }
function metricUnit(m) { return m === 'per_capita' ? 't' : 'Mt'; }
function formatVal(v, m) {
  if (m === 'total') {
    if (v >= 1000) return (v/1000).toFixed(1)+' Gt';
    if (v >= 1) return v.toFixed(1)+' Mt';
    return (v*1000).toFixed(0)+' kt';
  }
  return v.toFixed(2)+' t';
}
function formatValShort(v, m) {
  if (m === 'total') {
    if (v >= 1000) return (v/1000).toFixed(1)+'G';
    if (v >= 100) return v.toFixed(0)+'M';
    if (v >= 1) return v.toFixed(1)+'M';
    return (v*1000).toFixed(0)+'k';
  }
  return v.toFixed(1)+'t';
}
function shortName(name) {
  const m = {
    'United States':'USA','United Kingdom':'UK','United Arab Emirates':'UAE',
    'South Korea':'S.Korea','Saudi Arabia':'S.Arabia','New Zealand':'NZ',
    'South Africa':'S.Africa','Democratic Republic of Congo':'DR Congo',
    'Trinidad and Tobago':'Trinidad','Dominican Republic':'Dom.Rep.',
    'Bosnia and Herzegovina':'Bosnia','North Macedonia':'N.Maced.',
    'Papua New Guinea':'PNG','Central African Republic':'CAR',
    'Equatorial Guinea':'Eq.Guinea',"Cote d'Ivoire":"Cote d'Iv.",
    "Saint Vincent and the Grenadines":"St.Vincent",
    "Antigua and Barbuda":"Antigua","Saint Kitts and Nevis":"St.Kitts",
    "Sao Tome and Principe":"STP","Micronesia (country)":"Micronesia",
    "Sint Maarten (Dutch part)":"St.Maarten",
    "Bonaire Sint Eustatius and Saba":"Bonaire"
  };
  return m[name] || (name.length > 9 ? name.slice(0,8)+'.' : name);
}

// ════════════════════════════════════════════
// LEGEND
// ════════════════════════════════════════════
function buildLegend() {
  const leg = d3.select('#legend');
  Object.entries(CONTINENT_META).forEach(([name, color]) => {
    const item = leg.append('div').attr('class','legend-item');
    item.append('div').attr('class','legend-dot').style('background', color);
    item.append('span').text(name);
  });
}

// ════════════════════════════════════════════
// YEAR DATA
// ════════════════════════════════════════════
function getYearData(year) {
  const source = getActiveData();
  const entries = [];
  Object.keys(source).forEach(country => {
    const val = source[country][year];
    if (val === undefined || val <= 0) return;
    const geo = COUNTRY_GEO[country];
    if (!geo || !geo.cont) return;
    const prev = source[country][year - 5];
    let trend = 'stable';
    if (prev !== undefined && prev > 0) {
      if (val > prev * 1.05) trend = 'up';
      else if (val < prev * 0.95) trend = 'down';
    }
    entries.push({
      country, val, cont: geo.cont, trend,
      px: projectX(geo.lng), py: projectY(geo.lat)
    });
  });
  entries.sort((a, b) => b.val - a.val);
  entries.forEach((d, i) => d.rank = i + 1);
  return entries;
}

// ════════════════════════════════════════════
// RADIUS
// ════════════════════════════════════════════
function makeRScale(data) {
  const mx = d3.max(data, d => d.val) || 1;
  const maxR = Math.min(80, W / 14);
  return d3.scalePow().exponent(0.7).domain([0, mx]).range([2, maxR]);
}

// ════════════════════════════════════════════
// PERSISTENT FORCE SIMULATION
// ════════════════════════════════════════════
let simNodes = [];
let simNodeMap = {};
let simulation = null;

function initSimulation() {
  simulation = d3.forceSimulation(simNodes)
    .force('collide', d3.forceCollide().radius(d => d.r + 1.5).strength(0.85).iterations(4))
    .force('x', d3.forceX(d => d.tx).strength(0.12))
    .force('y', d3.forceY(d => d.ty).strength(0.12))
    .alphaDecay(0.02).velocityDecay(0.35)
    .on('tick', onSimTick).alpha(1).restart();
}

function onSimTick() {
  bubbleG.selectAll('.bg').attr('transform', d => {
    const node = simNodeMap[d.country];
    if (node) { d.px = node.x; d.py = node.y; }
    return `translate(${d.px},${d.py})`;
  });
}

function syncSimulation(data) {
  const newMap = {};
  data.forEach(d => {
    const existing = simNodeMap[d.country];
    const gx = projectX(COUNTRY_GEO[d.country].lng);
    const gy = projectY(COUNTRY_GEO[d.country].lat);
    if (existing) {
      existing.r = d.r; existing.tx = gx; existing.ty = gy; existing.val = d.val;
      newMap[d.country] = existing;
    } else {
      newMap[d.country] = { country: d.country, r: d.r, val: d.val, tx: gx, ty: gy, x: gx, y: gy };
    }
  });
  simNodeMap = newMap;
  simNodes = Object.values(simNodeMap);
  simulation.nodes(simNodes);
  simulation.force('collide').radius(d => d.r + 1.5);
  simulation.force('x').x(d => d.tx);
  simulation.force('y').y(d => d.ty);
  simulation.alpha(0.6).restart();
  data.forEach(d => {
    const node = simNodeMap[d.country];
    if (node) { d.px = node.x; d.py = node.y; }
  });
}

// ════════════════════════════════════════════
// UPDATE VIZ
// ════════════════════════════════════════════
function updateViz(year) {
  const data = getYearData(year);
  const rScale = makeRScale(data);
  data.forEach(d => d.r = rScale(d.val));
  syncSimulation(data);

  const topN = W < 600 ? 12 : 30;
  const labelSet = new Set(data.slice(0, topN).map(d => d.country));

  const sel = bubbleG.selectAll('.bg').data(data, d => d.country);
  sel.exit().transition().duration(300).attr('opacity', 0).remove();

  const enter = sel.enter().append('g').attr('class','bg')
    .attr('opacity', 0).style('cursor','pointer')
    .on('click', (e, d) => openDetail(d.country))
    .on('mouseenter', showTooltip).on('mousemove', showTooltip)
    .on('mouseleave', hideTooltip);

  enter.append('circle').attr('class','bc');
  enter.append('text').attr('class','bname')
    .attr('text-anchor','middle').attr('pointer-events','none')
    .attr('font-weight', 600).attr('font-family','Source Sans 3, sans-serif');
  enter.append('text').attr('class','binfo')
    .attr('text-anchor','middle').attr('pointer-events','none')
    .attr('font-family','IBM Plex Mono, monospace');
  enter.append('text').attr('class','btrend')
    .attr('text-anchor','middle').attr('pointer-events','none');

  const merged = enter.merge(sel);
  enter.attr('transform', d => `translate(${d.px},${d.py})`);
  merged.transition().duration(300).attr('opacity', 1);

  merged.select('.bc').transition().duration(350)
    .attr('r', d => d.r)
    .attr('fill', d => CONTINENT_META[d.cont] || '#888')
    .attr('fill-opacity', 0.18)
    .attr('stroke', d => CONTINENT_META[d.cont] || '#888')
    .attr('stroke-opacity', 0.7)
    .attr('stroke-width', d => d.r > 8 ? 1.5 : 0.8);

  merged.select('.bname')
    .text(d => labelSet.has(d.country) && d.r > 12 ? shortName(d.country) : '')
    .attr('dy', d => d.r > 22 ? '-0.5em' : '-0.15em')
    .attr('font-size', d => Math.max(5.5, Math.min(11, d.r * 0.38)) + 'px')
    .attr('fill', d => CONTINENT_META[d.cont] || '#3d3229');

  merged.select('.binfo')
    .text(d => labelSet.has(d.country) && d.r > 20 ? `${formatValShort(d.val, currentMetric)} #${d.rank}` : '')
    .attr('dy', '0.65em')
    .attr('font-size', d => Math.max(5, Math.min(8, d.r * 0.28)) + 'px')
    .attr('fill', '#6b5d50');

  merged.select('.btrend')
    .text(d => {
      if (!labelSet.has(d.country) || d.r < 26) return '';
      return d.trend === 'up' ? '\u25B2' : d.trend === 'down' ? '\u25BC' : '\u2014';
    })
    .attr('dy', '1.6em')
    .attr('font-size', d => Math.max(6, Math.min(10, d.r * 0.3)) + 'px')
    .attr('fill', d => d.trend === 'up' ? '#c45d3e' : d.trend === 'down' ? '#2d6a4f' : '#9a8d80');
}

// ════════════════════════════════════════════
// TOOLTIP
// ════════════════════════════════════════════
function showTooltip(event, d) {
  const tip = d3.select('#tooltip');
  const trendStr = d.trend === 'up' ? '\u25B2 Rising' : d.trend === 'down' ? '\u25BC Falling' : '\u2014 Stable';
  const trendColor = d.trend === 'up' ? '#c45d3e' : d.trend === 'down' ? '#2d6a4f' : '#9a8d80';
  const mLabel = currentMetric === 'per_capita' ? 'CO\u2082/capita' : 'Total CO\u2082';
  tip.html(`
    <div class="tt-name" style="color:${CONTINENT_META[d.cont]}">${d.country}</div>
    <div class="tt-row">${mLabel}: <span class="tt-val">${formatVal(d.val, currentMetric)}</span></div>
    <div class="tt-row">Global rank: <span class="tt-val">#${d.rank}</span></div>
    <div class="tt-row">5yr trend: <span class="tt-val" style="color:${trendColor}">${trendStr}</span></div>
    <div class="tt-row">Region: <span class="tt-val">${d.cont}</span></div>
    <div class="tt-click">Click for full trend \u2192</div>
  `);
  tip.style('left', (event.clientX + 16) + 'px')
     .style('top', (event.clientY - 10) + 'px')
     .style('opacity', 1);
}
function hideTooltip() { d3.select('#tooltip').style('opacity', 0); }

// ════════════════════════════════════════════
// DETAIL PANEL
// ════════════════════════════════════════════
function openDetail(country) {
  detailCountry = country;
  detailMetric = currentMetric;
  document.querySelectorAll('.detail-mbtn').forEach(b => b.classList.toggle('active', b.dataset.dm === detailMetric));
  document.getElementById('detail-overlay').classList.add('open');
  document.getElementById('detail-panel').classList.add('open');
  drawDetailChart();
}

function drawDetailChart() {
  const country = detailCountry;
  if (!country) return;
  const geo = COUNTRY_GEO[country];
  const color = CONTINENT_META[geo?.cont] || '#c45d3e';
  const source = getDataFor(detailMetric);
  const mLabel = metricLabel(detailMetric);
  const mUnit = metricUnit(detailMetric);

  document.getElementById('detail-name').textContent = country;
  document.getElementById('detail-name').style.color = color;
  document.getElementById('detail-sub').textContent = `${geo?.cont || ''} \u00B7 ${mLabel} over time`;

  const countryData = source[country];
  if (!countryData) return;
  const years = Object.keys(countryData).map(Number).sort((a,b) => a-b);
  const values = years.map(y => ({ year: y, val: countryData[y] }));

  const chartSvg = d3.select('#detail-chart');
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
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => detailMetric === 'total' ? (d >= 1000 ? (d/1000)+'G' : d+'M') : d))
    .attr('color', '#d5cfc5').selectAll('text').attr('fill', '#9a8d80').attr('font-size', '10px');

  g.append('text').attr('x', cw/2).attr('y', ch + 32)
    .attr('text-anchor','middle').attr('fill','#9a8d80').attr('font-size','10px').text('Year');
  g.append('text').attr('transform','rotate(-90)').attr('x', -ch/2).attr('y', -42)
    .attr('text-anchor','middle').attr('fill','#9a8d80').attr('font-size','10px').text(`${mLabel} (${mUnit})`);

  const area = d3.area().x(d => x(d.year)).y0(ch).y1(d => y(d.val)).curve(d3.curveMonotoneX);
  g.append('path').datum(values).attr('fill', color).attr('fill-opacity', 0.08).attr('d', area);

  const line = d3.line().x(d => x(d.year)).y(d => y(d.val)).curve(d3.curveMonotoneX);
  const path = g.append('path').datum(values)
    .attr('fill','none').attr('stroke', color).attr('stroke-width', 2).attr('d', line);
  const totalLen = path.node().getTotalLength();
  path.attr('stroke-dasharray', totalLen).attr('stroke-dashoffset', totalLen)
    .transition().duration(1000).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0);

  const curVal = countryData[currentYear];
  if (curVal !== undefined) {
    g.append('circle').attr('cx', x(currentYear)).attr('cy', y(curVal))
      .attr('r', 4).attr('fill', color).attr('opacity', 0)
      .transition().delay(800).duration(300).attr('opacity', 1);
    g.append('text').attr('x', x(currentYear)).attr('y', y(curVal) - 10)
      .attr('text-anchor','middle').attr('fill', color).attr('font-size','10px').attr('font-weight', 700)
      .text(`${formatVal(curVal, detailMetric)} (${currentYear})`)
      .attr('opacity', 0).transition().delay(900).duration(300).attr('opacity', 1);
  }
}

function closeDetail() {
  document.getElementById('detail-overlay').classList.remove('open');
  document.getElementById('detail-panel').classList.remove('open');
  detailCountry = null;
}

// ════════════════════════════════════════════
// CONTROLS
// ════════════════════════════════════════════
document.querySelectorAll('.metric-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.metric === currentMetric) return;
    document.querySelectorAll('.metric-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMetric = btn.dataset.metric;
    simNodeMap = {}; simNodes = [];
    if (simulation) simulation.stop();
    initSimulation();
    document.getElementById('main-title').innerHTML =
      currentMetric === 'per_capita'
        ? 'Our Warming World<br><em>CO\u2082 Per Capita</em>'
        : 'Our Warming World<br><em>Total CO\u2082 Emissions</em>';
    updateViz(currentYear);
  });
});

document.querySelectorAll('.detail-mbtn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.detail-mbtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    detailMetric = btn.dataset.dm;
    drawDetailChart();
  });
});

const slider = document.getElementById('year-slider');
const yearDisp = document.getElementById('year-display');
const playBtn = document.getElementById('play-btn');

let sliderRaf = null;
slider.addEventListener('input', () => {
  currentYear = +slider.value;
  yearDisp.textContent = currentYear;
  if (sliderRaf) cancelAnimationFrame(sliderRaf);
  sliderRaf = requestAnimationFrame(() => updateViz(currentYear));
});

playBtn.addEventListener('click', () => playing ? stopPlay() : startPlay());

function startPlay() {
  playing = true;
  playBtn.textContent = '\u23F8 Pause'; playBtn.classList.add('active');
  if (+slider.value >= 2023) slider.value = 1950;
  currentYear = +slider.value;
  animInterval = setInterval(() => {
    currentYear++;
    if (currentYear > 2023) { stopPlay(); return; }
    slider.value = currentYear;
    yearDisp.textContent = currentYear;
    updateViz(currentYear);
  }, speed);
}

function stopPlay() {
  playing = false;
  playBtn.textContent = '\u25B6 Play'; playBtn.classList.remove('active');
  clearInterval(animInterval);
}

document.querySelectorAll('.speed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    speed = +btn.dataset.speed;
    if (playing) { clearInterval(animInterval); startPlay(); }
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDetail();
  if (e.key === ' ' && !e.target.closest('#detail-panel')) { e.preventDefault(); playing ? stopPlay() : startPlay(); }
  if (e.key === 'ArrowRight' && !playing) { currentYear = Math.min(2023, currentYear+1); slider.value = currentYear; yearDisp.textContent = currentYear; updateViz(currentYear); }
  if (e.key === 'ArrowLeft' && !playing) { currentYear = Math.max(1950, currentYear-1); slider.value = currentYear; yearDisp.textContent = currentYear; updateViz(currentYear); }
});

window.addEventListener('resize', () => {
  calcDimensions();
  svg.attr('width', W + svgMargin.left + svgMargin.right).attr('height', H + svgMargin.top + svgMargin.bottom);
  simNodeMap = {}; simNodes = [];
  if (simulation) simulation.stop();
  initSimulation();
  updateViz(currentYear);
});