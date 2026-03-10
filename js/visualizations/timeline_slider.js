// Usage:
//   const tl = new TimelineSlider({
//     container    : csWrapper,           // D3 selection or CSS selector string
//     min          : 1950,
//     max          : 2023,
//     initial      : 2023,               // defaults to max
//     speeds       : [{ label: '1×', ms: 250 }, { label: '2×', ms: 120 }],
//     defaultSpeed : 120,                // ms value matching one of the speeds
//     ignoreKeyboard: (e) => !!e.target.closest('#my-modal'),
//     onChange     : (year) => updateViz(year)
//   });
//
//   tl.year           // current year (read-only getter)
//   tl.setYear(2010)  // jump without triggering onChange
//   tl.play()
//   tl.pause()
//   tl.destroy()      // removes keyboard listener

class TimelineSlider {
  constructor({ container, min, max, initial, speeds, defaultSpeed, ignoreKeyboard, onChange }) {
    this._min = min;
    this._max = max;
    this._year = initial !== undefined ? initial : max;
    this._playing = false;
    this._interval = null;
    this._speeds = speeds || [
      { label: '1×', ms: 250 },
      { label: '2×', ms: 120 },
      { label: '5×', ms: 50 }
    ];
    this._speed = defaultSpeed !== undefined ? defaultSpeed : this._speeds[0].ms;
    this._onChange = onChange || function () {};
    this._ignoreKeyboard = ignoreKeyboard || null;

    const root = typeof container === 'string' ? d3.select(container) : container;
    this._buildDOM(root);
    this._bindEvents();
  }

  // DOM
  _buildDOM(root) {
    const ctrl = root.append('div').attr('class', 'tl-controls');

    this._playBtn = ctrl.append('button')
      .attr('class', 'tl-btn')
      .text('▶ Play');

    this._sliderEl = ctrl.append('input')
      .attr('type', 'range')
      .attr('class', 'tl-slider')
      .attr('min', this._min)
      .attr('max', this._max)
      .attr('value', this._year)
      .attr('step', 1)
      .node();

    this._yearDisplay = ctrl.append('div')
      .attr('class', 'tl-year-display')
      .text(this._year);

    const speedCtrl = ctrl.append('div').attr('class', 'tl-speed-controls');
    this._speeds.forEach(s => {
      speedCtrl.append('button')
        .attr('class', 'tl-btn tl-speed-btn' + (s.ms === this._speed ? ' active' : ''))
        .attr('data-speed', s.ms)
        .text(s.label);
    });
    this._speedCtrl = speedCtrl;
  }

  // Events
  _bindEvents() {
    let raf = null;

    d3.select(this._sliderEl).on('input', () => {
      this._year = +this._sliderEl.value;
      this._yearDisplay.text(this._year);
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this._onChange(this._year));
    });

    this._playBtn.on('click', () => this._playing ? this.pause() : this.play());

    this._speedCtrl.selectAll('.tl-speed-btn').on('click', (event) => {
      const btn = d3.select(event.currentTarget);
      this._speedCtrl.selectAll('.tl-speed-btn').classed('active', false);
      btn.classed('active', true);
      this._speed = +btn.attr('data-speed');
      if (this._playing) {
        clearInterval(this._interval);
        this._startInterval();
      }
    });

    this._keyHandler = (e) => {
      if (this._ignoreKeyboard && this._ignoreKeyboard(e)) return;
      if (e.key === ' ') {
        e.preventDefault();
        this._playing ? this.pause() : this.play();
      }
      if (!this._playing) {
        if (e.key === 'ArrowRight') this.setYear(Math.min(this._max, this._year + 1));
        if (e.key === 'ArrowLeft')  this.setYear(Math.max(this._min, this._year - 1));
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  // Playback
  _startInterval() {
    this._interval = setInterval(() => {
      this._year++;
      if (this._year > this._max) { this.pause(); return; }
      this._sliderEl.value = this._year;
      this._yearDisplay.text(this._year);
      this._onChange(this._year);
    }, this._speed);
  }

  play() {
    if (this._playing) return;
    this._playing = true;
    this._playBtn.text('⏸ Pause').classed('active', true);
    if (this._year >= this._max) {
      this._year = this._min;
      this._sliderEl.value = this._min;
      this._yearDisplay.text(this._min);
    }
    this._startInterval();
  }

  pause() {
    if (!this._playing) return;
    this._playing = false;
    this._playBtn.text('▶ Play').classed('active', false);
    clearInterval(this._interval);
  }

  // ── Public API ───────────────────────────
  setYear(year, notify = true) {
    this._year = year;
    this._sliderEl.value = year;
    this._yearDisplay.text(year);
    if (notify) this._onChange(year);
  }

  get year() { return this._year; }

  destroy() {
    this.pause();
    document.removeEventListener('keydown', this._keyHandler);
  }
}
