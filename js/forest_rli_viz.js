(() => {
  const CSV_FILE = "data/final_global_forest_rli_2001_2023.csv";
  const RLI_COUNTRY_FILE = "data/red-list-index.csv";

  const IMG_BIRDS = "assets/birds.PNG";
  const IMG_RAIN = "assets/rain.PNG";
  const IMG_TREES = "assets/trees.PNG";
  const IMG_SMOKE = "assets/smoke.PNG";

  const minSmoke = 0.10, maxSmoke = 0.60;
  const minRain = 0.05, maxRain = 0.50;
  const blendPx = 160;

  const W = 1000, H = 720;
  const margin = { l: 40, r: 40, t: 20, b: 20 };

  const sceneX = margin.l;
  const sceneY = margin.t + 10;
  const sceneW = W - margin.l - margin.r;
  const sceneH = 560;

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const compress = (t, lo, hi) => lo + t * (hi - lo);

  const mount = d3.select("body")
    .append("section")
    .attr("class", "forest-rli-page")
    .style("padding", "40px 0");

  mount.append("div")
    .attr("class", "container")
    .html(`
      <h2 style="font-family: Space Grotesk, system-ui; margin-bottom: 8px;">
        Forest Loss & Bird Extinction Risk
      </h2>

      <div id="forest-rli-container" style="max-width:1100px;"></div>

      <div class="controls" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;">
        <button id="forestPrev" class="btn btn-outline-secondary btn-sm">◀</button>
        <span class="badge text-bg-light" style="font-size:14px;">
          <b id="forestYearLabel"></b>
        </span>
        <button id="forestNext" class="btn btn-outline-secondary btn-sm">▶</button>

        <input id="forestYearSlider" type="range" style="min-width:320px;" />

        <span class="badge text-bg-light" style="font-weight:400;">
          Selection: <span id="forestSelLabel">Global</span>
        </span>

        <span class="badge text-bg-light" style="font-weight:400;">
          Forest loss: <span id="forestLossLabel"></span>
        </span>
        <span class="badge text-bg-light" style="font-weight:400;">
          RLI: <span id="forestRliLabel"></span> · Risk: <span id="forestRiskLabel"></span>
        </span>
      </div>
    `);

  const svg = d3.select("#forest-rli-container")
    .append("svg")
    .attr("viewBox", [0, 0, W, H])
    .attr("role", "img")
    .attr("aria-label", "Forest loss and bird extinction risk blended illustration");

  svg.append("rect")
    .attr("x", sceneX).attr("y", sceneY)
    .attr("width", sceneW).attr("height", sceneH)
    .attr("fill", "none")
    .attr("stroke", "rgba(0,0,0,0.08)");

  const defs = svg.append("defs");

  const makeClip = (id) => defs.append("clipPath")
    .attr("id", id)
    .attr("clipPathUnits", "userSpaceOnUse")
    .append("rect");

  makeClip("clipTrees");
  makeClip("clipSmoke");
  makeClip("clipBirds");
  makeClip("clipRain");

  function makeSoftMasks(prefix) {
    const gradLeftId = `${prefix}-grad-left`;
    const gradRightId = `${prefix}-grad-right`;

    const gl = defs.append("linearGradient")
      .attr("id", gradLeftId)
      .attr("gradientUnits", "userSpaceOnUse");

    const gr = defs.append("linearGradient")
      .attr("id", gradRightId)
      .attr("gradientUnits", "userSpaceOnUse");

    gl.append("stop").attr("offset", "0%").attr("stop-color", "white");
    gl.append("stop").attr("offset", "35%").attr("stop-color", "white");
    gl.append("stop").attr("offset", "65%").attr("stop-color", "black");
    gl.append("stop").attr("offset", "100%").attr("stop-color", "black");

    gr.append("stop").attr("offset", "0%").attr("stop-color", "black");
    gr.append("stop").attr("offset", "35%").attr("stop-color", "black");
    gr.append("stop").attr("offset", "65%").attr("stop-color", "white");
    gr.append("stop").attr("offset", "100%").attr("stop-color", "white");

    const maskLeftId = `${prefix}-mask-left`;
    const maskRightId = `${prefix}-mask-right`;

    const mL = defs.append("mask").attr("id", maskLeftId).attr("maskUnits", "userSpaceOnUse");
    const mR = defs.append("mask").attr("id", maskRightId).attr("maskUnits", "userSpaceOnUse");

    mL.append("rect")
      .attr("x", sceneX).attr("y", sceneY)
      .attr("width", sceneW).attr("height", sceneH)
      .attr("fill", `url(#${gradLeftId})`);

    mR.append("rect")
      .attr("x", sceneX).attr("y", sceneY)
      .attr("width", sceneW).attr("height", sceneH)
      .attr("fill", `url(#${gradRightId})`);

    return { gradLeftId, gradRightId, maskLeftId, maskRightId };
  }

  const forestMasks = makeSoftMasks("forest");
  const birdMasks = makeSoftMasks("birds");

  const gScene = svg.append("g");

  gScene.append("image")
    .attr("href", IMG_TREES).attr("xlink:href", IMG_TREES)
    .attr("x", sceneX).attr("y", sceneY)
    .attr("width", sceneW).attr("height", sceneH)
    .attr("clip-path", "url(#clipTrees)")
    .attr("mask", `url(#${forestMasks.maskLeftId})`);

  gScene.append("image")
    .attr("href", IMG_SMOKE).attr("xlink:href", IMG_SMOKE)
    .attr("x", sceneX).attr("y", sceneY)
    .attr("width", sceneW).attr("height", sceneH)
    .attr("clip-path", "url(#clipSmoke)")
    .attr("mask", `url(#${forestMasks.maskRightId})`)
    .attr("opacity", 0.95);

  gScene.append("image")
    .attr("href", IMG_BIRDS).attr("xlink:href", IMG_BIRDS)
    .attr("x", sceneX).attr("y", sceneY)
    .attr("width", sceneW).attr("height", sceneH)
    .attr("clip-path", "url(#clipBirds)")
    .attr("mask", `url(#${birdMasks.maskLeftId})`);

  gScene.append("image")
    .attr("href", IMG_RAIN).attr("xlink:href", IMG_RAIN)
    .attr("x", sceneX).attr("y", sceneY)
    .attr("width", sceneW).attr("height", sceneH)
    .attr("clip-path", "url(#clipRain)")
    .attr("mask", `url(#${birdMasks.maskRightId})`)
    .attr("opacity", 0.95);

  function updateSoftGradient(gradId, boundaryX) {
    const x1 = boundaryX - blendPx;
    const x2 = boundaryX + blendPx;
    defs.select(`#${gradId}`)
      .attr("x1", x1).attr("y1", 0)
      .attr("x2", x2).attr("y2", 0);
  }

  Promise.all([
    d3.csv(CSV_FILE, d3.autoType),
    d3.csv(RLI_COUNTRY_FILE, d3.autoType),
  ]).then(([data, rliRows]) => {
    data.sort((a, b) => a.year - b.year);

    const nameToISO3 = new Map();
    const iso3ToName = new Map();
    const rliByCodeYear = new Map();

    for (const d of rliRows) {
      const name = (d.Entity || "").trim();
      const code = (d.Code || "").trim();
      const year = +d.Year;
      const rli = +d["Red List Index"];

      if (name && code) {
        nameToISO3.set(name, code);
        iso3ToName.set(code, name);
      }
      if (code && Number.isFinite(year) && Number.isFinite(rli)) {
        rliByCodeYear.set(`${code}|${year}`, rli);
      }
    }

    const years = data.map(d => d.year);
    const slider = document.getElementById("forestYearSlider");
    slider.min = 0;
    slider.max = years.length - 1;
    slider.value = years.length - 1;

    let idx = +slider.value;

    let selectedCodes = null;

    function getCurrentRiskScale() {
  // Global mode
  if (!selectedCodes || selectedCodes.length === 0) {
    const extent = d3.extent(data, row => 1 - row.rli);
    return d3.scaleLinear().domain(extent).range([0, 1]).clamp(true);
  }
  // select mode
  const selectedRiskSeries = data.map(row => {
    const vals = [];
    for (const code of selectedCodes) {
      const v = rliByCodeYear.get(`${code}|${row.year}`);
      if (Number.isFinite(v)) vals.push(v);
    }
    const rli = vals.length ? d3.mean(vals) : row.rli;
    return 1 - rli;
  });
  let extent = d3.extent(selectedRiskSeries);
  if (!extent || !Number.isFinite(extent[0]) || !Number.isFinite(extent[1])) {
    extent = [0, 1];
  } else if (extent[0] === extent[1]) {
    extent = [extent[0] - 0.01, extent[1] + 0.01];
  }

  return d3.scaleLinear().domain(extent).range([0, 1]).clamp(true);
}

    function setSelectionLabel() {
      const labelEl = document.getElementById("forestSelLabel");
      if (!labelEl) return;

      if (!selectedCodes || selectedCodes.length === 0) {
        labelEl.textContent = "Global";
        return;
      }
      if (selectedCodes.length === 1) {
        labelEl.textContent = iso3ToName.get(selectedCodes[0]) || selectedCodes[0];
        return;
      }
      labelEl.textContent = `${selectedCodes.length} countries`;
    }

    window.countryNameToISO3 = function(name) {
      if (!name) return null;
      return nameToISO3.get(String(name).trim()) || null;
    };

    window.setSelectedCountryNames = function(names) {
      if (!Array.isArray(names) || names.length === 0) {
        window.setSelectedCountryCodes(null);
        return;
      }
      const iso3s = names
        .map(n => window.countryNameToISO3(n))
        .filter(Boolean);
      window.setSelectedCountryCodes(iso3s.length ? iso3s : null);
    };

    window.setSelectedCountryCodes = function(codes) {
      if (!Array.isArray(codes) || codes.length === 0) {
        selectedCodes = null;
        setSelectionLabel();
        render(data[idx]);
        return;
      }

      const clean = Array.from(new Set(
        codes.map(c => String(c).trim().toUpperCase()).filter(c => /^[A-Z]{3}$/.test(c))
      ));

      selectedCodes = clean.length ? clean : null;
      setSelectionLabel();
      render(data[idx]);
    };

    window.selectCountryForBirdViz = function(countryOrISO3) {
      if (!countryOrISO3) {
        window.setSelectedCountryCodes(null);
        return;
      }
      const key = String(countryOrISO3).trim();
      const iso3 = /^[A-Z]{3}$/.test(key) ? key : (nameToISO3.get(key) || null);
      if (!iso3) {
        console.warn("RLI: no ISO3 match for:", key);
        return;
      }
      window.setSelectedCountryCodes([iso3]);
    };

    function render(d) {
      let rli = d.rli;

      if (selectedCodes && selectedCodes.length) {
        const vals = [];
        for (const code of selectedCodes) {
          const v = rliByCodeYear.get(`${code}|${d.year}`);
          if (Number.isFinite(v)) vals.push(v);
        }
        if (vals.length) rli = d3.mean(vals);
      }

      const risk = 1 - rli;

      document.getElementById("forestYearLabel").textContent = `${d.year}`;
      document.getElementById("forestLossLabel").textContent =
        `${Math.round(d.forest_loss).toLocaleString()} ha`;
      document.getElementById("forestRliLabel").textContent = rli.toFixed(2);
      document.getElementById("forestRiskLabel").textContent = risk.toFixed(2);

      const smokeRaw = clamp01(d.forest_loss_norm);
      const smokeShare = clamp01(compress(smokeRaw, minSmoke, maxSmoke));
      const treeShare = 1 - smokeShare;

      const currentRiskTo01 = getCurrentRiskScale();
      const rainRaw = clamp01(currentRiskTo01(risk));
      const rainShare = clamp01(compress(rainRaw, minRain, maxRain));
      const birdsShare = 1 - rainShare;

      const forestBoundaryX = sceneX + sceneW * treeShare;
      const birdBoundaryX = sceneX + sceneW * birdsShare;

      defs.select("#clipTrees rect")
        .attr("x", sceneX).attr("y", sceneY)
        .attr("width", sceneW * treeShare + blendPx)
        .attr("height", sceneH);

      defs.select("#clipSmoke rect")
        .attr("x", forestBoundaryX - blendPx).attr("y", sceneY)
        .attr("width", sceneW * smokeShare + blendPx)
        .attr("height", sceneH);

      defs.select("#clipBirds rect")
        .attr("x", sceneX).attr("y", sceneY)
        .attr("width", sceneW * birdsShare + blendPx)
        .attr("height", sceneH);

      defs.select("#clipRain rect")
        .attr("x", birdBoundaryX - blendPx).attr("y", sceneY)
        .attr("width", sceneW * rainShare + blendPx)
        .attr("height", sceneH);

      updateSoftGradient(forestMasks.gradLeftId, forestBoundaryX);
      updateSoftGradient(forestMasks.gradRightId, forestBoundaryX);
      updateSoftGradient(birdMasks.gradLeftId, birdBoundaryX);
      updateSoftGradient(birdMasks.gradRightId, birdBoundaryX);
    }

    document.getElementById("forestPrev").onclick = () => {
      idx = Math.max(0, idx - 1);
      slider.value = idx;
      render(data[idx]);
    };

    document.getElementById("forestNext").onclick = () => {
      idx = Math.min(years.length - 1, idx + 1);
      slider.value = idx;
      render(data[idx]);
    };

    slider.oninput = (e) => {
      idx = +e.target.value;
      render(data[idx]);
    };

    setSelectionLabel();
    render(data[idx]);

  }).catch((err) => {
    console.error(err);
    d3.select("#forest-rli-container")
      .append("div")
      .style("color", "crimson")
      .style("padding", "12px 0")
      .text("Failed to load forest/RLI visualization data or assets. Check console for details.");
  });
})();