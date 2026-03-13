/**
 * Region-specific Forest / Bird blended visual for the side panel
 * Uses hotspot timeSeries instead of the global CSV.
 *
 * Prefers regional RLI if available in timeSeries.
 * Falls back to bird species decline only if no RLI field exists.
 */
function renderForestRLIPanelViz(mountId, regionData) {
  const IMG_BIRDS = "assets/birds.PNG";
  const IMG_RAIN  = "assets/rain.PNG";
  const IMG_TREES = "assets/trees.PNG";
  const IMG_SMOKE = "assets/smoke.PNG";

  const minSmoke = 0.08, maxSmoke = 0.70;
  const minRain  = 0.06, maxRain  = 0.82;
  const blendPx = 12;

  const W = 520, H = 420;
  const margin = { l: 10, r: 10, t: 8, b: 6 };

  const sceneX = margin.l;
  const sceneY = margin.t + 2;
  const sceneW = W - margin.l - margin.r;
  const sceneH = sceneW * 0.8;


  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const compress = (t, lo, hi) => lo + t * (hi - lo);

  const mount = d3.select("#" + mountId);
  if (mount.empty()) return;

  mount.html("");

  const panelId = mountId.replace(/[^a-zA-Z0-9_-]/g, "");
  const prevId = `${panelId}-prev`;
  const nextId = `${panelId}-next`;
  const sliderId = `${panelId}-slider`;
  const yearId = `${panelId}-year`;
  const forestId = `${panelId}-forest`;
  const rliId = `${panelId}-rli`;

  mount.html(`
    <div style="width:100%;">
      <div id="${panelId}-svg-wrap"></div>

      <div style="display:flex; align-items:center; gap:8px; margin-top:4px; flex-wrap:wrap;">
        <button id="${prevId}" class="btn btn-outline-secondary btn-sm">◀</button>
        <span style="min-width:48px; font-weight:600; color:#3d3229;" id="${yearId}"></span>
        <button id="${nextId}" class="btn btn-outline-secondary btn-sm">▶</button>
        <input id="${sliderId}" type="range" style="flex:1; min-width:120px;" />
      </div>

      <div style="display:flex; flex-direction:column; gap:3px; margin-top:4px; font-size:13px; color:#5e554d;">
        <div>Forest loss: <span id="${forestId}"></span></div>
        <div>RLI change: <span id="${rliId}"></span></div>
      </div>
    </div>
  `);

  const svg = d3.select(`#${panelId}-svg-wrap`)
    .append("svg")
    .attr("width", "100%")
    .attr("viewBox", [0, 0, W, H])
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("role", "img")
    .attr("aria-label", `Forest loss and bird Red List Index illustration for ${regionData.name}`);

  const defs = svg.append("defs");

  const makeClip = (id) => defs.append("clipPath")
    .attr("id", id)
    .attr("clipPathUnits", "userSpaceOnUse")
    .append("rect");

  makeClip(`${panelId}-clipTrees`);
  makeClip(`${panelId}-clipSmoke`);
  makeClip(`${panelId}-clipBirds`);
  makeClip(`${panelId}-clipRain`);

  function makeSoftMasks(prefix) {
    const gradLeftId  = `${prefix}-grad-left`;
    const gradRightId = `${prefix}-grad-right`;

    const gl = defs.append("linearGradient")
      .attr("id", gradLeftId)
      .attr("gradientUnits", "userSpaceOnUse");

    const gr = defs.append("linearGradient")
      .attr("id", gradRightId)
      .attr("gradientUnits", "userSpaceOnUse");

    gl.append("stop").attr("offset", "0%").attr("stop-color", "white");
    gl.append("stop").attr("offset", "46%").attr("stop-color", "white");
    gl.append("stop").attr("offset", "54%").attr("stop-color", "black");
    gl.append("stop").attr("offset", "100%").attr("stop-color", "black");

    gr.append("stop").attr("offset", "0%").attr("stop-color", "black");
    gr.append("stop").attr("offset", "46%").attr("stop-color", "black");
    gr.append("stop").attr("offset", "54%").attr("stop-color", "white");
    gr.append("stop").attr("offset", "100%").attr("stop-color", "white");

    const maskLeftId  = `${prefix}-mask-left`;
    const maskRightId = `${prefix}-mask-right`;

    const mL = defs.append("mask")
      .attr("id", maskLeftId)
      .attr("maskUnits", "userSpaceOnUse");

    const mR = defs.append("mask")
      .attr("id", maskRightId)
      .attr("maskUnits", "userSpaceOnUse");

    mL.append("rect")
      .attr("x", sceneX)
      .attr("y", sceneY)
      .attr("width", sceneW)
      .attr("height", sceneH)
      .attr("fill", `url(#${gradLeftId})`);

    mR.append("rect")
      .attr("x", sceneX)
      .attr("y", sceneY)
      .attr("width", sceneW)
      .attr("height", sceneH)
      .attr("fill", `url(#${gradRightId})`);

    return { gradLeftId, gradRightId, maskLeftId, maskRightId };
  }

  const forestMasks = makeSoftMasks(`${panelId}-forest`);
  const birdMasks   = makeSoftMasks(`${panelId}-birds`);

  svg.append("rect")
    .attr("x", sceneX)
    .attr("y", sceneY)
    .attr("width", sceneW)
    .attr("height", sceneH)
    .attr("rx", 10)
    .attr("fill", "none")
    .attr("stroke", "rgba(0,0,0,0.08)");

  svg.append("text")
    .attr("x", sceneX)
    .attr("y", sceneY + sceneH + 28)
    .attr("fill", "#3d3229")
    .attr("font-size", 14)
    .attr("font-weight", 700)
    .text("Forest pressure and RLI decline");

  const gScene = svg.append("g");

  gScene.append("image")
    .attr("class", "panel-trees-layer")
    .attr("href", IMG_TREES)
    .attr("xlink:href", IMG_TREES)
    .attr("x", sceneX)
    .attr("y", sceneY)
    .attr("width", sceneW)
    .attr("height", sceneH)
    .attr("preserveAspectRatio", "xMidYMid slice")
    .attr("clip-path", `url(#${panelId}-clipTrees)`)
    .attr("mask", `url(#${forestMasks.maskLeftId})`);

  gScene.append("image")
    .attr("class", "panel-smoke-layer")
    .attr("href", IMG_SMOKE)
    .attr("xlink:href", IMG_SMOKE)
    .attr("x", sceneX)
    .attr("y", sceneY)
    .attr("width", sceneW)
    .attr("height", sceneH)
    .attr("preserveAspectRatio", "xMidYMid slice")
    .attr("clip-path", `url(#${panelId}-clipSmoke)`)
    .attr("mask", `url(#${forestMasks.maskRightId})`)
    .attr("opacity", 0.95);

  gScene.append("image")
    .attr("class", "panel-birds-layer")
    .attr("href", IMG_BIRDS)
    .attr("xlink:href", IMG_BIRDS)
    .attr("x", sceneX)
    .attr("y", sceneY)
    .attr("width", sceneW)
    .attr("height", sceneH)
    .attr("preserveAspectRatio", "xMidYMid slice")
    .attr("clip-path", `url(#${panelId}-clipBirds)`)
    .attr("mask", `url(#${birdMasks.maskLeftId})`);

  gScene.append("image")
    .attr("class", "panel-rain-layer")
    .attr("href", IMG_RAIN)
    .attr("xlink:href", IMG_RAIN)
    .attr("x", sceneX)
    .attr("y", sceneY)
    .attr("width", sceneW)
    .attr("height", sceneH)
    .attr("preserveAspectRatio", "xMidYMid slice")
    .attr("clip-path", `url(#${panelId}-clipRain)`)
    .attr("mask", `url(#${birdMasks.maskRightId})`)
    .attr("opacity", 0.95);

  function updateSoftGradient(gradId, boundaryX) {
    const x1 = boundaryX - blendPx;
    const x2 = boundaryX + blendPx;
    defs.select(`#${gradId}`)
      .attr("x1", x1)
      .attr("y1", 0)
      .attr("x2", x2)
      .attr("y2", 0);
  }

  const timeSeries = (regionData.timeSeries || [])
    .slice()
    .sort((a, b) => a.year - b.year);

  if (!timeSeries.length) {
    mount.html(`<div style="color:crimson;padding:12px 0;">No regional time series available.</div>`);
    return;
  }

  const hasRLI = timeSeries.some(d => d.rli != null && !Number.isNaN(+d.rli));
  const first = timeSeries[0];

  const enriched = timeSeries.map(d => {
    const forestLossPct = first.forestCover > 0
      ? clamp01((first.forestCover - d.forestCover) / first.forestCover)
      : 0;

    let rliDeclinePct = 0;

    if (hasRLI) {
      const firstRLI = +first.rli;
      const currRLI = +d.rli;
      rliDeclinePct = firstRLI > 0
        ? clamp01((firstRLI - currRLI) / firstRLI)
        : 0;
    } else if (first.birdSpecies > 0) {
      rliDeclinePct = clamp01((first.birdSpecies - d.birdSpecies) / first.birdSpecies);
    }

    return {
      ...d,
      forestLossPct,
      rliDeclinePct
    };
  });

  const slider = document.getElementById(sliderId);
  slider.min = 0;
  slider.max = enriched.length - 1;
  slider.value = enriched.length - 1;

  let idx = +slider.value;

  function render(d) {
    document.getElementById(yearId).textContent = d.year;
    document.getElementById(forestId).textContent = `${Math.round(d.forestLossPct * 100)}%`;
    document.getElementById(rliId).textContent = `${Math.round(d.rliDeclinePct * 100)}%`;

    const smokeRaw = Math.pow(clamp01(d.forestLossPct), 0.70);
    const smokeShare = clamp01(compress(smokeRaw, minSmoke, maxSmoke));
    const treeShare = 1 - smokeShare;

    const rainRaw = Math.pow(clamp01(d.rliDeclinePct), 0.25);
    const rainShare = clamp01(compress(rainRaw, minRain, maxRain));
    const birdsShare = 1 - rainShare;

    const forestBoundaryX = sceneX + sceneW * treeShare;
    const birdBoundaryX   = sceneX + sceneW * birdsShare;

    defs.select(`#${panelId}-clipTrees rect`)
      .attr("x", sceneX)
      .attr("y", sceneY)
      .attr("width", sceneW * treeShare + blendPx)
      .attr("height", sceneH);

    defs.select(`#${panelId}-clipSmoke rect`)
      .attr("x", forestBoundaryX - blendPx)
      .attr("y", sceneY)
      .attr("width", sceneW * smokeShare + blendPx)
      .attr("height", sceneH);

    defs.select(`#${panelId}-clipBirds rect`)
      .attr("x", sceneX)
      .attr("y", sceneY)
      .attr("width", sceneW * birdsShare + blendPx)
      .attr("height", sceneH);

    defs.select(`#${panelId}-clipRain rect`)
      .attr("x", birdBoundaryX - blendPx)
      .attr("y", sceneY)
      .attr("width", sceneW * rainShare + blendPx)
      .attr("height", sceneH);

    updateSoftGradient(forestMasks.gradLeftId, forestBoundaryX);
    updateSoftGradient(forestMasks.gradRightId, forestBoundaryX);
    updateSoftGradient(birdMasks.gradLeftId, birdBoundaryX);
    updateSoftGradient(birdMasks.gradRightId, birdBoundaryX);

    gScene.selectAll(".panel-trees-layer")
      .attr("opacity", 0.50 + treeShare * 0.50);

    gScene.selectAll(".panel-smoke-layer")
      .attr("opacity", 0.18 + smokeShare * 0.82);

    gScene.selectAll(".panel-birds-layer")
      .attr("opacity", 0.35 + birdsShare * 0.65);

    gScene.selectAll(".panel-rain-layer")
      .attr("opacity", 0.12 + rainShare * 0.88);
  }

  document.getElementById(prevId).onclick = () => {
    idx = Math.max(0, idx - 1);
    slider.value = idx;
    render(enriched[idx]);
  };

  document.getElementById(nextId).onclick = () => {
    idx = Math.min(enriched.length - 1, idx + 1);
    slider.value = idx;
    render(enriched[idx]);
  };

  slider.oninput = (e) => {
    idx = +e.target.value;
    render(enriched[idx]);
  };

  render(enriched[idx]);
}
