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
		this.timelineSvg = d3.select(timelineId);
		this.tooltip = d3.select(tooltipId);
		this.timelineValue = d3.select("#timeline_value");
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
		this.isScrubbing = false;
		this.autoplayTimer = null;

		this.initLayout();
		this.loadData();
	}

	initLayout() {
		this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);
		this.timelineSvg.attr("viewBox", "0 0 900 70");

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
		this.hoverGroup = this.chart.append("g").attr("class", "hover-points");

		this.timelineWidth = 900;
		this.timelineHeight = 70;
		this.timelineMargin = { left: 30, right: 30, top: 18, bottom: 18 };
		this.timelineInnerWidth = this.timelineWidth - this.timelineMargin.left - this.timelineMargin.right;
		this.timelineCenterY = this.timelineHeight / 2 + 8;

		this.timelineGroup = this.timelineSvg
			.append("g")
			.attr("class", "timeline-group")
			.attr("transform", `translate(0, ${this.timelineCenterY})`);
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

			this.baselineLine = d3
				.line()
				.x((d) => d.x)
				.y((d) => d.y);

			this.renderLegend();
			this.initTimeline();
			this.syncToYear(this.startYear, true);
			this.startAutoplay(this.startYear);
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

		const labelSelection = this.overlay.selectAll("text.spiral-legend-label").data(["Temperature anomaly (°C)"]);
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
		const radius = this.radiusScale(point.t) + this.tempOffsetScale(point.temperature);
		return {
			x: Math.cos(angle) * radius,
			y: Math.sin(angle) * radius,
			angle,
			radius
		};
	}

	baselinePosition(point) {
		const angle = (point.t / this.monthsPerRotation) * Math.PI * 2 - Math.PI / 2;
		const radius = this.radiusScale(point.t) + this.tempOffsetScale(0);
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
			.attr("stroke-width", 1.6)
			.attr("stroke-linecap", "round")
			.attr("stroke-linejoin", "round")
			.attr("fill", "none")
			.attr("opacity", 0.85);
		segmentSelection
			.merge(segmentEnter)
			.attr("d", ([a, b]) => `M${a.x},${a.y} L${b.x},${b.y}`)
			.attr("stroke", ([, b]) => this.colorScale(b.temperature));
		segmentSelection.exit().remove();

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

		const holeSelection = this.holeGroup.selectAll("circle").data([this.centerHoleRadius]);
		const holeEnter = holeSelection
			.enter()
			.append("circle")
			.attr("fill", "none")
			.attr("stroke", "#e0e4ea")
			.attr("stroke-width", 1.2)
			.attr("stroke-dasharray", "6 6");
		holeSelection.merge(holeEnter).attr("r", (d) => d);
		holeSelection.exit().remove();

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

	initTimeline() {
		this.timelineScale = d3
			.scaleLinear()
			.domain([this.startYear, this.endYear])
			.range([this.timelineMargin.left, this.timelineMargin.left + this.timelineInnerWidth]);

		const trackSelection = this.timelineGroup.selectAll("line.timeline-track").data([null]);
		const trackEnter = trackSelection
			.enter()
			.append("line")
			.attr("class", "timeline-track")
			.attr("y1", 0)
			.attr("y2", 0)
			.attr("stroke", "#d3d8df")
			.attr("stroke-width", 2)
			.attr("stroke-linecap", "round");
		trackSelection
			.merge(trackEnter)
			.attr("x1", this.timelineScale(this.startYear))
			.attr("x2", this.timelineScale(this.endYear));
		trackSelection.exit().remove();

		const tickYears = d3.range(this.startYear, this.endYear + 1, 10);
		const tickSelection = this.timelineGroup.selectAll("line.tick").data(tickYears, (d) => d);
		const tickEnter = tickSelection
			.enter()
			.append("line")
			.attr("class", "tick")
			.attr("y1", -6)
			.attr("y2", 6)
			.attr("stroke", "#b7c0cc")
			.attr("stroke-width", 1);
		tickSelection
			.merge(tickEnter)
			.attr("x1", (d) => this.timelineScale(d))
			.attr("x2", (d) => this.timelineScale(d));
		tickSelection.exit().remove();

		const labelSelection = this.timelineGroup
			.selectAll("text.tick-label")
			.data(tickYears, (d) => d);
		const labelEnter = labelSelection
			.enter()
			.append("text")
			.attr("class", "tick-label")
			.attr("y", 22)
			.attr("text-anchor", "middle")
			.attr("fill", "#5b6b7a")
			.attr("font-size", 11);
		labelSelection
			.merge(labelEnter)
			.attr("x", (d) => this.timelineScale(d))
			.text((d) => d);
		labelSelection.exit().remove();

		const markerSelection = this.timelineGroup.selectAll("circle.timeline-marker").data([null]);
		const markerEnter = markerSelection
			.enter()
			.append("circle")
			.attr("class", "timeline-marker")
			.attr("cy", 0)
			.attr("r", 6)
			.attr("fill", "#101820");
		this.timelineMarker = markerSelection.merge(markerEnter).attr("cx", this.timelineScale(this.startYear));
		markerSelection.exit().remove();

		const hitAreaSelection = this.timelineGroup.selectAll("rect.timeline-hit").data([null]);
		const hitAreaEnter = hitAreaSelection
			.enter()
			.append("rect")
			.attr("class", "timeline-hit")
			.attr("y", -14)
			.attr("height", 28)
			.attr("fill", "transparent")
			.attr("cursor", "ew-resize");
		this.timelineHitArea = hitAreaSelection
			.merge(hitAreaEnter)
			.attr("x", this.timelineScale(this.startYear))
			.attr("width", this.timelineScale(this.endYear) - this.timelineScale(this.startYear));
		hitAreaSelection.exit().remove();

		this.bindTimelineInteraction();
	}

	bindTimelineInteraction() {
		const handleScrub = (xPosition) => {
			const clampedX = Math.max(
				this.timelineScale(this.startYear),
				Math.min(this.timelineScale(this.endYear), xPosition)
			);
			const targetYear = Math.round(this.timelineScale.invert(clampedX));
			this.syncToYear(targetYear, false);
		};

		const dragBehavior = d3
			.drag()
			.on("start", (event) => {
				this.isScrubbing = true;
				this.stopAutoplay();
				handleScrub(event.x);
			})
			.on("drag", (event) => {
				handleScrub(event.x);
			})
			.on("end", () => {
				this.isScrubbing = false;
				this.startAutoplay(this.currentYear);
			});

		this.timelineHitArea.call(dragBehavior);
		this.timelineMarker.call(dragBehavior);
	}

	syncToYear(targetYear, animate) {
		this.currentYear = targetYear;
		this.render(targetYear, animate);
		this.timelineMarker.attr("cx", this.timelineScale(targetYear));
		if (!this.timelineValue.empty()) {
			this.timelineValue.text(targetYear);
		}
	}

	stopAutoplay() {
		if (this.autoplayTimer) {
			this.autoplayTimer.stop();
			this.autoplayTimer = null;
		}
	}

	startAutoplay(fromYear) {
		const startFrom = Math.max(this.startYear, Math.min(this.endYear, fromYear));
		const totalYears = this.endYear - startFrom;
		if (totalYears <= 0) {
			return;
		}
		const duration = 10000;
		const startTime = performance.now();
		this.stopAutoplay();
		this.autoplayTimer = d3.timer(() => {
			if (this.isScrubbing) {
				return;
			}
			const elapsed = performance.now() - startTime;
			const progress = Math.min(1, elapsed / duration);
			const targetYear = Math.round(startFrom + totalYears * progress);
			if (targetYear !== this.currentYear) {
				this.syncToYear(targetYear, false);
			}
			if (progress >= 1) {
				this.stopAutoplay();
			}
		});
	}
}

function createSpiralGraph({ svgId, dataPath }) {
	return new SpiralGraph({ svgId, dataPath });
}
