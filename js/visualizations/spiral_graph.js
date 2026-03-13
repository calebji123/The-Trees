const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec"
];

function parseTemperatureData(rawText) {
	const lines = rawText.trim().split(/\r?\n/);
	const cleanedLines = lines[0].startsWith("Land-Ocean") ? lines.slice(1) : lines;
	const rows = d3.csvParse(cleanedLines.join("\n"));
	const points = [];
	const startYear = +rows[0].Year;

	rows.forEach((row) => {
		const year = +row.Year;
		MONTHS.forEach((month, monthIndex) => {
			const value = row[month];
			if (!value || value === "***") {
				return;
			}
			const temperature = Number.parseFloat(value);
			const t = (year - startYear) * 12 + monthIndex;
			points.push({
				year,
				month,
				monthIndex,
				temperature,
				t
			});
		});
	});

	return points;
}

function formatTemperature(value) {
	const sign = value > 0 ? "+" : "";
	return `${sign}${value.toFixed(2)}°C`;
}

class SpiralGraph {
	constructor({ svgId, dataPath, timelineId = "#timeline_graph", tooltipId = "#tooltip" }) {
		this.svg = d3.select(svgId);
		this.timelineContainer = d3.select(timelineId);
		this.tooltip = d3.select(tooltipId);
		this.dataPath = dataPath;
		this.width = 900;
		this.height = 900;
		this.margin = 60;
		this.outerRadius = Math.min(this.width, this.height) / 2 - this.margin;
		this.centerHoleRadius = Math.min(this.width, this.height) * 0.2;
		this.innerRadius = this.centerHoleRadius + 4;
		this.yearsPerRotation = 10;
		this.monthsPerRotation = this.yearsPerRotation * 12;
		this.tempAmplitude = 20;
		this.prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		this.currentYear = null;
		this.timelineSlider = null;
		this.scrollDepthProgress = 0;
		this.lastRenderedDepthProgress = -1;
		this.depthZoomStrength = 3.45;
		this.depthZoomOffset = 46;
		this.depthZoomPower = 1.75;
		this.lineZoomStrength = 1.75;
		this.globeZoomStrength = 1.35;
		this.globeZoomPower = 1.35;
		this.centerGlobeSizeFactor = 0.78;

		this.initLayout();
		this.initScrollDepthInteraction();
		this.loadData();
	}

	initScrollDepthInteraction() {
		if (this.prefersReducedMotion) {
			return;
		}

		window.addEventListener("spiral:scroll-progress", (event) => {
			if (!event || !event.detail) {
				return;
			}
			const trackProgress = Number(event.detail.progress);
			if (!Number.isFinite(trackProgress)) {
				return;
			}

			const depthProgress = this.computeDepthProgress(trackProgress);
			if (Math.abs(depthProgress - this.lastRenderedDepthProgress) < 0.004) {
				return;
			}

			this.scrollDepthProgress = depthProgress;
			this.lastRenderedDepthProgress = depthProgress;

			if (this.currentYear !== null) {
				this.render(this.currentYear, false);
			}
		});
	}

	computeDepthProgress(trackProgress) {
		// Reserve runway at the end where the zoom remains stable at max.
		const start = 0.005;
		const end = 0.86;
		const normalized = (trackProgress - start) / (end - start);
		return Math.max(0, Math.min(1, normalized));
	}

	initCenterGlobeOverlay() {
		const overlay = document.getElementById('spiral-center-globe');
		if (!overlay || typeof GlobeVis === 'undefined') return;

		this.centerGlobeOverlay = overlay;

		const positionOverlay = () => {
			const svgEl = this.svg.node();
			const cardEl = overlay.parentElement;
			if (!svgEl || !cardEl) return;
			const svgRect = svgEl.getBoundingClientRect();
			const cardRect = cardEl.getBoundingClientRect();
			if (svgRect.width === 0) return;
			const displayedScale = Math.min(svgRect.width / this.width, svgRect.height / this.height);
			const holeDiam = Math.round(this.centerHoleRadius * 2 * displayedScale * this.centerGlobeSizeFactor);
			const hcx = (svgRect.left - cardRect.left) + svgRect.width / 2;
			const hcy = (svgRect.top - cardRect.top) + svgRect.height / 2;
			overlay.style.width  = holeDiam + 'px';
			overlay.style.height = holeDiam + 'px';
			overlay.style.left   = (hcx - holeDiam / 2) + 'px';
			overlay.style.top    = (hcy - holeDiam / 2) + 'px';
		};

		window.addEventListener('resize', positionOverlay, { passive: true });

		requestAnimationFrame(() => requestAnimationFrame(() => {
			const svgEl = this.svg.node();
			const svgRect = svgEl.getBoundingClientRect();
			const displayedScale = svgRect.width > 0
				? Math.min(svgRect.width / this.width, svgRect.height / this.height)
				: 0.37;
			const holeDiam = Math.round(this.centerHoleRadius * 2 * displayedScale * this.centerGlobeSizeFactor);
			const globe = new GlobeVis('spiral-center-globe', holeDiam, { embedded: true });
			globe.init().catch(err => console.error('Center globe failed:', err));
			window.globeVis = globe;
			positionOverlay();
		}));
	}

	depthBiasForRadius(baseRadius) {
		const radiusRange = Math.max(1, this.outerRadius - this.innerRadius);
		const normalizedRadius = Math.max(0, Math.min(1, (baseRadius - this.innerRadius) / radiusRange));
		// 0.35 floor ensures inner rings still expand; outer rings reach 1.0
		return 0.35 + 0.65 * Math.pow(normalizedRadius, this.depthZoomPower);
	}

	lineZoomMultiplier(depthBias) {
		return 1 + this.scrollDepthProgress * (0.2 + depthBias * this.lineZoomStrength);
	}

	updateCenterGlobeZoom() {
		// Match the innermost ring's depth scale exactly so globe and inner spiral stay in sync
		const innerBias = this.depthBiasForRadius(this.innerRadius);
		const globeScale = 1 + this.scrollDepthProgress * this.depthZoomStrength * innerBias;
		if (this.centerGlobeOverlay) {
			this.centerGlobeOverlay.style.transform = `scale(${globeScale})`;
		}
		// SVG groups are now empty; clear stale transforms
		this.globeGroup.attr('transform', null);
		this.holeGroup.attr('transform', null);
	}

	initLayout() {
		this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);

		this.defs = this.svg.append("defs");
		const gradient = this.defs
			.append("linearGradient")
			.attr("id", "spiral-temp-gradient")
			.attr("x1", "0%")
			.attr("y1", "0%")
			.attr("x2", "100%")
			.attr("y2", "0%");
		gradient.append("stop").attr("offset", "0%").attr("stop-color", "#2a7bbd");
		gradient.append("stop").attr("offset", "50%").attr("stop-color", "#f6d365");
		gradient.append("stop").attr("offset", "100%").attr("stop-color", "#c82838");

		this.chart = this.svg
			.append("g")
			.attr("class", "spiral-chart")
			.attr("transform", `translate(${this.width / 2}, ${this.height / 2})`);

		this.overlay = this.svg.append("g").attr("class", "spiral-overlay");

		this.baselineGroup = this.chart.append("g").attr("class", "baseline-group");
		this.segmentGroup = this.chart.append("g").attr("class", "segments");
		this.holeGroup = this.chart.append("g").attr("class", "center-hole");
		this.globeGroup = this.chart.append("g").attr("class", "center-globe");
		this.hoverGroup = this.chart.append("g").attr("class", "hover-points");
	}

	renderCenterGlobe() {
		const frameSelection = this.holeGroup.selectAll("circle.spiral-center-frame").data([this.centerHoleRadius]);
		const frameEnter = frameSelection
			.enter()
			.append("circle")
			.attr("class", "spiral-center-frame")
			.attr("fill", "none")
			.attr("stroke", "#e0e4ea")
			.attr("stroke-width", 1.2)
			.attr("stroke-dasharray", "6 6");
		frameSelection.merge(frameEnter).attr("r", (d) => d);
		frameSelection.exit().remove();

		this.globeProjection = d3
			.geoOrthographic()
			.scale(this.globeRadius)
			.translate([0, 0])
			.clipAngle(90)
			.rotate([-20, -20]);
		this.globePath = d3.geoPath().projection(this.globeProjection);

		const oceanSelection = this.globeGroup.selectAll("path.spiral-globe-ocean").data([{ type: "Sphere" }]);
		const oceanEnter = oceanSelection
			.enter()
			.append("path")
			.attr("class", "spiral-globe-ocean")
			.attr("fill", "#4da8c4")
			.attr("opacity", 0.25)
			.attr("stroke", "rgba(61,50,41,0.15)")
			.attr("stroke-width", 0.5);
		oceanSelection.merge(oceanEnter).attr("d", this.globePath);
		oceanSelection.exit().remove();

		const graticuleSelection = this.globeGroup
			.selectAll("path.spiral-globe-graticule")
			.data([d3.geoGraticule()()]);
		const graticuleEnter = graticuleSelection
			.enter()
			.append("path")
			.attr("class", "spiral-globe-graticule")
			.attr("fill", "none")
			.attr("stroke", "rgba(61,50,41,0.12)")
			.attr("stroke-width", 0.5);
		graticuleSelection.merge(graticuleEnter).attr("d", this.globePath);
		graticuleSelection.exit().remove();

		const landGroupSelection = this.globeGroup.selectAll("g.spiral-globe-land-group").data([null]);
		const landGroupEnter = landGroupSelection
			.enter()
			.append("g")
			.attr("class", "spiral-globe-land-group");
		this.globeLandGroup = landGroupSelection.merge(landGroupEnter);

		this.loadCenterGlobeLand();

		this.globeGroup.style("pointer-events", "none");
	}

	loadCenterGlobeLand() {
		if (!window.topojson || typeof window.topojson.feature !== "function") {
			return;
		}

		d3.json("https://unpkg.com/world-atlas@2/countries-110m.json")
			.then((world) => {
				if (!world || !world.objects || !world.objects.countries) {
					return;
				}
				const countries = window.topojson.feature(world, world.objects.countries);
				const countrySelection = this.globeLandGroup
					.selectAll("path.spiral-globe-country")
					.data(countries.features);
				const countryEnter = countrySelection
					.enter()
					.append("path")
					.attr("class", "spiral-globe-country")
					.attr("fill", "#2d6a4f")
					.attr("stroke", "rgba(61,50,41,0.15)")
					.attr("stroke-width", 0.35);
				countrySelection.merge(countryEnter).attr("d", this.globePath);
				countrySelection.exit().remove();
			})
			.catch(() => {
				// leave ocean + graticule only when world atlas is unavailable
			});
	}

	loadData() {
		d3.text(encodeURI(this.dataPath)).then((rawText) => {
			this.points = parseTemperatureData(rawText).sort((a, b) => a.t - b.t);
			this.startYear = this.points[0].year;
			this.endYear = this.points[this.points.length - 1].year;
			this.maxT = this.points[this.points.length - 1].t;
			this.radiusSpan = this.outerRadius - this.innerRadius - this.tempAmplitude * 0.5;
			this.radiusScale = d3
				.scaleLinear()
				.domain([0, this.maxT])
				.range([this.innerRadius, this.innerRadius + this.radiusSpan]);

			this.temperatureExtent = d3.extent(this.points, (d) => d.temperature);
			this.colorScale = d3
				.scaleLinear()
				.domain([
					this.temperatureExtent[0],
					(this.temperatureExtent[0] + this.temperatureExtent[1]) / 2,
					this.temperatureExtent[1]
				])
				.range(["#2a7bbd", "#f6d365", "#c82838"])
				.clamp(true);

			this.tempOffsetScale = d3
				.scaleLinear()
				.domain([this.temperatureExtent[0], this.temperatureExtent[1]])
				.range([-this.tempAmplitude, this.tempAmplitude])
				.clamp(true);

			this.strokeWidthScale = d3
				.scaleLinear()
				.domain([this.temperatureExtent[0], this.temperatureExtent[1]])
				.range([1.2, 4.4])
				.clamp(true);

			this.baselineLine = d3
				.line()
				.x((d) => d.x)
				.y((d) => d.y);

			this.renderLegend();
			this.initTimelineSlider();
			this.syncToYear(this.startYear, true);
			if (this.timelineSlider) {
				this.timelineSlider.play();
			}
			this.initCenterGlobeOverlay();
		});
	}

	initTimelineSlider() {
		if (this.timelineContainer.empty()) {
			return;
		}

		this.timelineContainer.selectAll("*").remove();

		if (this.timelineSlider) {
			this.timelineSlider.destroy();
			this.timelineSlider = null;
		}

		if (typeof TimelineSlider === "undefined") {
			return;
		}

		this.timelineSlider = new TimelineSlider({
			container: this.timelineContainer,
			min: this.startYear,
			max: this.endYear,
			initial: this.startYear,
			speeds: [
				{ label: "1×", ms: 120 },
				{ label: "2×", ms: 70 },
				{ label: "5×", ms: 30 }
			],
			defaultSpeed: 120,
			onChange: (year) => {
				this.syncToYear(year, false);
			}
		});
	}

	renderLegend() {
		const padding = 28;
		const titleX = padding;
		const titleY = padding + 6;
		const barWidth = 200;
		const barHeight = 12;
		const barX = padding;
		const barY = titleY + 18;
		const labelY = barY + 24;

		const titleSelection = this.overlay.selectAll("text.spiral-title").data(["Global Temperature Spiral"]);
		const titleEnter = titleSelection
			.enter()
			.append("text")
			.attr("class", "spiral-title")
			.attr("font-size", 18)
			.attr("font-weight", 600)
			.attr("fill", "#101820");
		titleSelection
			.merge(titleEnter)
			.attr("x", titleX)
			.attr("y", titleY)
			.text((d) => d);
		titleSelection.exit().remove();

		const labelSelection = this.overlay
			.selectAll("text.spiral-legend-label")
			.data(["Temperature anomaly (°C) · warmer = thicker"]);
		const labelEnter = labelSelection
			.enter()
			.append("text")
			.attr("class", "spiral-legend-label")
			.attr("font-size", 12)
			.attr("fill", "#5b6b7a");
		labelSelection
			.merge(labelEnter)
			.attr("x", barX)
			.attr("y", barY - 6)
			.text((d) => d);
		labelSelection.exit().remove();

		const barSelection = this.overlay.selectAll("rect.spiral-legend-bar").data([null]);
		const barEnter = barSelection
			.enter()
			.append("rect")
			.attr("class", "spiral-legend-bar")
			.attr("height", barHeight)
			.attr("rx", barHeight / 2)
			.attr("fill", "url(#spiral-temp-gradient)");
		barSelection
			.merge(barEnter)
			.attr("x", barX)
			.attr("y", barY)
			.attr("width", barWidth);
		barSelection.exit().remove();

		const minMax = [
			{ key: "min", value: this.temperatureExtent[0].toFixed(2), x: barX },
			{ key: "max", value: this.temperatureExtent[1].toFixed(2), x: barX + barWidth }
		];
		const rangeSelection = this.overlay
			.selectAll("text.spiral-legend-range")
			.data(minMax, (d) => d.key);
		const rangeEnter = rangeSelection
			.enter()
			.append("text")
			.attr("class", "spiral-legend-range")
			.attr("font-size", 11)
			.attr("fill", "#5b6b7a");
		rangeSelection
			.merge(rangeEnter)
			.attr("x", (d) => d.x)
			.attr("y", labelY)
			.attr("text-anchor", (d) => (d.key === "min" ? "start" : "end"))
			.text((d) => d.value);
		rangeSelection.exit().remove();
	}

	polarPosition(point) {
		const angle = (point.t / this.monthsPerRotation) * Math.PI * 2 - Math.PI / 2;
		const baseRadius = this.radiusScale(point.t);
		const tempOffset = this.tempOffsetScale(point.temperature);
		const depthBias = this.depthBiasForRadius(baseRadius);
		const depthScale = 1 + this.scrollDepthProgress * this.depthZoomStrength * depthBias;
		const depthOffset = this.scrollDepthProgress * this.depthZoomOffset * depthBias;
		const radius = (baseRadius + tempOffset) * depthScale + depthOffset;
		return {
			x: Math.cos(angle) * radius,
			y: Math.sin(angle) * radius,
			angle,
			radius,
			depthBias
		};
	}

	baselinePosition(point) {
		const angle = (point.t / this.monthsPerRotation) * Math.PI * 2 - Math.PI / 2;
		const baseRadius = this.radiusScale(point.t);
		const depthBias = this.depthBiasForRadius(baseRadius);
		const depthScale = 1 + this.scrollDepthProgress * this.depthZoomStrength * depthBias;
		const depthOffset = this.scrollDepthProgress * this.depthZoomOffset * depthBias;
		const radius = (baseRadius + this.tempOffsetScale(0)) * depthScale + depthOffset;
		return {
			x: Math.cos(angle) * radius,
			y: Math.sin(angle) * radius
		};
	}

	render(targetYear, animate) {
		const cutoffT = Math.min(this.maxT, (targetYear - this.startYear) * 12 + 11);
		const filteredPoints = this.points.filter((point) => point.t <= cutoffT);
		const withPosition = filteredPoints.map((point) => ({
			...point,
			...this.polarPosition(point)
		}));
		const baselinePoints = filteredPoints.map((point) => this.baselinePosition(point));
		const segmentPairs = d3.pairs(withPosition);

		const baselineSelection = this.baselineGroup.selectAll("path").data([baselinePoints]);
		const baselineEnter = baselineSelection
			.enter()
			.append("path")
			.attr("class", "baseline-spiral")
			.attr("fill", "none")
			.attr("stroke", "#9aa6b2")
			.attr("stroke-width", 1)
			.attr("stroke-dasharray", "4 6")
			.attr("opacity", 0.7);
		baselineSelection
			.merge(baselineEnter)
			.attr("d", this.baselineLine);
		baselineSelection.exit().remove();

		const segmentSelection = this.segmentGroup
			.selectAll("path")
			.data(segmentPairs, (d) => d[1].t);
		const segmentEnter = segmentSelection
			.enter()
			.append("path")
			.attr("stroke-linecap", "round")
			.attr("stroke-linejoin", "round")
			.attr("fill", "none")
			.attr("opacity", 0.85);
		segmentSelection
			.merge(segmentEnter)
			.attr("d", ([a, b]) => `M${a.x},${a.y} L${b.x},${b.y}`)
			.attr("stroke", ([, b]) => this.colorScale(b.temperature))
			.attr("stroke-width", ([, b]) => this.strokeWidthScale(b.temperature) * this.lineZoomMultiplier(b.depthBias));
		segmentSelection.exit().remove();

		this.updateCenterGlobeZoom();

		const segments = this.segmentGroup.selectAll("path");
		segments.each(function () {
			const length = this.getTotalLength();
			d3.select(this).attr("stroke-dasharray", length).attr("stroke-dashoffset", length);
		});

		if (animate && !this.prefersReducedMotion) {
			const totalSegments = segments.size();
			const drawDuration = 10000;
			const delayScale = d3
				.scaleLinear()
				.domain([0, Math.max(1, totalSegments - 1)])
				.range([0, drawDuration]);
			const segmentDuration = Math.max(20, (drawDuration / Math.max(1, totalSegments)) * 2.5);

			segments
				.transition()
				.duration(segmentDuration)
				.delay((d, i) => delayScale(i))
				.ease(d3.easeLinear)
				.attr("stroke-dashoffset", 0);
		} else {
			segments.attr("stroke-dashoffset", 0);
		}

		const hoverSelection = this.hoverGroup
			.selectAll("circle")
			.data(withPosition, (d) => d.t);
		const hoverEnter = hoverSelection
			.enter()
			.append("circle")
			.attr("r", 5)
			.attr("fill", "transparent")
			.attr("pointer-events", "all")
			.on("mousemove", (event, d) => {
				this.tooltip
					.classed("is-visible", true)
					.style("left", `${event.pageX}px`)
					.style("top", `${event.pageY}px`)
					.html(`${d.month} ${d.year} · ${formatTemperature(d.temperature)}`);
			})
			.on("mouseout", () => {
				this.tooltip.classed("is-visible", false);
			});
		hoverSelection
			.merge(hoverEnter)
			.attr("cx", (d) => d.x)
			.attr("cy", (d) => d.y);
		hoverSelection.exit().remove();
	}

	syncToYear(targetYear, animate) {
		this.currentYear = targetYear;
		this.render(targetYear, animate);
	}
}

function createSpiralGraph({ svgId, dataPath }) {
	return new SpiralGraph({ svgId, dataPath });
}
