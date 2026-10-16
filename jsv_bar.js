//////////////////////////////////////////////////////////////////////////////
// SVBar
// Objects that will be drawn as vertical bars (e.g. for mass spectrometry,
// EIMS, LCMS, MS/MS) should inherit from SVBar.
//
// Ported from jspectraviewer-rails dev env's SVBar.js (ES6 modules)
// to specdbi's IIFE-globals style.
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  let path_id = 0;

  /**
   * Objects that will be drawn as bars should inherit from SVBar
   * (e.g. SpectrumEIMS for mass spectrometry data).
   * @param {Object} options Properties for the canvas context to use when drawing the bars
   *
   *   - _color_ [default: 'black']
   *   - _fill_ [default: '']
   *   - _lineWidth_ [default: 1]
   *   - _visible_ [default: true]
   *   - _dash_ [default: []]
   *   - _display_ {color: ...} (alternate way to specify color)
   *
   * @param {Object} meta User-defined _key_:_value_ pairs to add to the SVBar.
   */
  const SVBar = function(options, meta) {
    options = options || {};
    this.meta = meta || {};
    this.y_axis_elevation = 10;
    this.lineWidth = JSV.default_for(options.lineWidth, 1);
    this.color = JSV.default_for(
      options.color || (options.display && options.display.color),
      'black'
    );
    this.visible = JSV.default_for(options.visible, true);
    this.dash    = JSV.default_for(options.dash, []);
    this.fill    = options.fill;
    this.path_id();
  }

  SVBar.prototype.peaks = function() {
    return new JSV.SVSet();
  }

  SVBar.prototype.path_id = function() {
    const new_id = generate_path_id();
    this.path_id = function() { return new_id; }
    return new_id;
  }

  const generate_path_id = function() {
    return 'path-id-' + path_id++;
  }

  SVBar.prototype.attr = function(attributes) {
    const keys = Object.keys(attributes);
    for (let i=0, len=keys.length; i < len; i++) {
      this[keys[i]] = attributes[keys[i]];
    }
    return this;
  }

  SVBar.prototype.display_settings = function(options) {
    if (options) {
      return this.attr(options);
    } else {
      return {
        color:     this.color,
        fill:      this.fill,
        lineWidth: this.lineWidth,
        visible:   this.visible,
        dash:      this.dash
      }
    }
  }

  // Mirrors SVPath.data_for_draw — choose the best data array to render.
  SVBar.prototype.data_for_draw = function(scale, fast, calculate, pixel_skip) {
    let data;
    const has_data = this.xy_data != undefined;

    if (this.phasing && has_data && this.xy_data.yi != undefined) {
      // Phasing branch (mostly NMR-relevant; harmless here)
      let ph;
      const y = [];
      const len = this.xy_data.length();
      for (let i=0; i < len; i++) {
        ph = Math.PI * (1*this.ph0 + 1*(len-i-1)*this.ph1/len) / 180.0;
        y.push((Math.cos(ph) * this.xy_data.y[i]) + (Math.sin(ph) * this.xy_data.yi[i]));
      }
      data = {x: this.xy_data.x, y: y};
    } else if ((calculate && this.peaks().length > 0) || (!has_data && this.peaks().length > 0)) {
      if (!pixel_skip) pixel_skip = 1;
      const number_of_points = scale.x.range_diff() / JSV.pixel_ratio / pixel_skip;
      const fast_calc        = pixel_skip > 1;
      data = JSV.xy_from_peaks(this.peaks(), number_of_points, scale.x.domain()[0], scale.x.domain()[1], fast_calc);
    } else if (has_data) {
      data = fast ? this.simple_xy_data : this.xy_data;
    } else {
      data = {x: [0], y: [0]};
      console.error('No data or Peaks for SVBar');
    }
    return data;
  }

  /**
   * Draw bars on the canvas. For each data point, draws a vertical bar from
   * y=0 (baseline) up to point.y (or down for negative values, used by mirror plots).
   */
  SVBar.prototype.draw = function(context, scale, fast, calculate, pixel_skip) {
    if (!this.visible) return;

    const data = this.data_for_draw(scale, fast, calculate, pixel_skip);
    if (!data || !data.x || data.x.length === 0) return;

    const min_index = JSV.index_of_value(data.x, scale.x.domain()[0], false);
    const max_index = JSV.index_of_value(data.x, scale.x.domain()[1], true);

    context.translate(0.5, 0.5);

    // Calculate bar width: 80% of pixel spacing between adjacent x values, capped at 2px.
    let calculatedWidth = 1;
    if (max_index > min_index) {
      calculatedWidth = Math.abs(scale.x(data.x[min_index + 1]) - scale.x(data.x[min_index])) * 0.8;
    }
    const barWidth = Math.min(calculatedWidth, 2);

    const barColor   = this.color || 'steelblue';
    const lineWidth  = JSV.default_for(this.lineWidth, 1);
    const baselineY  = scale.y(0);

    // Fill pass
    context.fillStyle = barColor;
    for (let i = min_index; i <= max_index; i++) {
      const px = data.x[i];
      const py = data.y[i];
      const x  = scale.x(px) - barWidth / 2;
      let y, height;

      if (py < 0) {
        // Mirror plot: bars extend downward from y=0
        y      = baselineY;
        height = scale.y(py) - baselineY;
      } else {
        // Normal: bars extend upward from y=0
        y      = scale.y(py);
        height = baselineY - scale.y(py);
      }

      context.beginPath();
      context.rect(x, y, barWidth, height);
      context.fill();
    }

    // Stroke pass (outline)
    context.lineWidth   = lineWidth;
    context.strokeStyle = barColor;
    for (let i = min_index; i <= max_index; i++) {
      const px = data.x[i];
      const py = data.y[i];
      const x  = scale.x(px) - barWidth / 2;
      let y, height;

      if (py < 0) {
        y      = baselineY;
        height = scale.y(py) - baselineY;
      } else {
        y      = scale.y(py);
        height = baselineY - scale.y(py);
      }

      context.beginPath();
      context.rect(x, y, barWidth, height);
      context.stroke();
    }

    context.translate(-0.5, -0.5);
  }

  JSV.SVBar = SVBar;

})(JSpectraViewer);
