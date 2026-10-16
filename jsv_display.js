// jsv_display.js - SVDot, SVLegend, SVLabels, Spectrum, Spectrum2D, Compound, Cluster, Peak
// Load order: 4 of 8
//
//////////////////////////////////////////////////////////////////////////////
// SVDot
// Objects that will be drawn as paths should inherit from SVPath
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

    plot_id = 0;

    /**
     * Objects that will be drawn as paths should inherit form SVPath
     * (e.g. [Spectrum](Spectrum.js.html), [Peak](Peak.js.html), etc)
     * @param {Object} options Properties for the canvas context to use when drawing the path
     *
     *   - _color_ [default: 'black']
     *   - _fill_ [default: '']
     *   - _lineWidth_ [default: 1]
     *   - _visible_ [default: true]
     *   - _dash_ [default: []]
     *
     * @param {Object} meta User-defined _key_:_value_ pairs to add to the SVPath.
     */
    const SVDot = function (options, meta) {
        options = options || {};
        this.meta = meta || {};
        this.dotSize = JSV.default_for(options.dotSize, 1);
        this.color = JSV.default_for(options.color, 'black');
        this.visible = JSV.default_for(options.visible, true);
        this.plot_id();
    };

    SVDot.prototype.plot_id = function() {
        let new_id = generate_plot_id();
        this.path_id = function() { return new_id; }
        return new_id;
    }

    const generate_plot_id = function() {
        return 'plot-id-' + plot_id++;
    }

    SVDot.prototype.attr = function(attributes) {
        const keys = Object.keys(attributes);
        let i = 0;
        const len = keys.length;
        for (; i < len; i++) {
            this[keys[i]] = attributes[keys[i]];
        }
        return this;
    }

    SVDot.prototype.display_settings = function(options) {
        if (options) {
            return this.attr(options);
        } else {
            return {
                color: this.color,
                fill: this.fill,
                lineWidth: this.lineWidth,
                visible: this.visible,
                dash: this.dash
            }
        }
    }


    SVDot.prototype.sum = function(a) {
        return a.reduce((acc, val) => acc + val)
    }

    SVDot.prototype.mean = function(a) {
        return this.sum(a) / a.length
    }

    SVDot.prototype.stddev = function(arr) {
        const arr_mean = this.mean(arr)
        const r = function(acc, val) {
            return acc + ((val - arr_mean) * (val - arr_mean))
        }
        return Math.sqrt(arr.reduce(r, 0.0) / arr.length)
    }

    SVDot.prototype.find_peaks = function(z, threshold) {
        // init variables
        const signals = Array(z.length).fill(0);
        let std_dev = this.stddev(z)
        let av = this.mean(z)

        for(let i = 0; i<z.length; i++){
            if(z[i] > av + (std_dev * threshold)){
                signals[i] = 1 // positive peak
            } else if (z[i] < av - (std_dev * threshold)){
                signals[i] = -1 // negative peak
            }
        }
        return signals
    }

    // Determine best data to use for drawing based on 'fast' and 'calculate' and the
    // available data in the SVPath.
    SVDot.prototype.data_for_draw = function() {
        let data;
        const has_data = this.xyz_data != undefined;
        if (has_data) {
            return {x: this.xyz_data.x, y: this.xyz_data.y, z: this.xyz_data.z}
        } else {
            data = {x: [0], y: [0], z: [0]};
            console.log('No data or Peaks for SVPath:');
            console.log(this);
            return data
        }
    }

    SVDot.prototype.draw = function(context, scale, fast, scaled_height, x_range, threshold) {

        let draw_countours = (contours) => {
            contours.forEach(c =>{
                    if (c.coordinates.length == 0) return;
                    c.coordinates.forEach( coords => {
                        context.beginPath();
                        coords.forEach( contour => {
                            contour.forEach(coord => {
                                const x_range = scale.x.range();
                                const y_range = scale.y.range();
                                let x_coord = scale.x( this.original_scale.x.invert(coord[0]))
                                let y_coord = scale.y( this.original_scale.y.invert(coord[1]))
                                if(x_coord < x_range[1]){
                                    x_coord = x_range[1]
                                } else if(x_coord > x_range[0]){
                                    x_coord = x_range[0]
                                }
                                if(y_coord < y_range[0]){
                                    y_coord = y_range[0]
                                } else if(y_coord > y_range[1]){
                                    y_coord = y_range[1]
                                }
                                context.lineTo(x_coord, y_coord);
                            })
                        })
                        context.stroke();
                    })
                })
        }

        if (this.visible) {
            let svd = this;
            let data = this.data_for_draw();

            // We will use the first scale provided to calculate contours and later map the results to the current scale
            if(!this.original_scale){
                this.original_scale = new JSV.SVScale();
                this.original_scale.x.domain(scale.x.domain());
                this.original_scale.y.domain(scale.y.domain());
                this.original_scale.x.range(scale.x.range());
                this.original_scale.y.range(scale.y.range());
            }

            if(!this.old_threshold || this.old_threshold != threshold){
                this.old_threshold = threshold;

                // find peaks
                const peakArray = svd.find_peaks(data.z, threshold);

                let positivePeaks = [];
                let negativePeaks = [];

                // Generate Contours
                for (let row = 0; row < data.y.length; row++) {
                    for (let col = 0; col < data.x.length; col++) {
                        if (peakArray[(data.x.length * row) + col] === -1) {
                            negativePeaks.push([scale.x(data.x[col]), scale.y(data.y[row])]);
                        } else if (peakArray[(data.x.length * row) + col] === 1) {
                            positivePeaks.push([this.original_scale.x(data.x[col]),
                                this.original_scale.y(data.y[row])]);
                        }
                    }
                }

                this.posContours = d3v7.contourDensity()
                    .size([data.x.length * 3, data.y.length * 3])
                    .bandwidth(10)    // smaller = more precision in lines = more lines
                    (positivePeaks);

                this.negContours = d3v7.contourDensity()
                    .size([data.x.length * 3, data.y.length * 3])
                    .bandwidth(10)    // smaller = more precision in lines = more lines
                    (negativePeaks);
            }

            // Plot contours
            context.strokeStyle = 'blue';
            draw_countours(this.posContours);
            context.strokeStyle = 'red';
            draw_countours(this.negContours);

            // avoid doing this too often
            if(!fast) {

                // calculate the projection
                let x_projection = {};
                let y_projection = {};
                for (let row = 0; row < data.y.length; row++) {
                    let y_val = data.y[row]
                    for (let col = 0; col < data.x.length; col++) {
                        let x_val = data.x[col]
                        let z_val = data.z[(data.x.length * row) + col]
                        if (x_projection[x_val] === undefined) {
                            x_projection[x_val] = 0;
                        }
                        if (y_projection[y_val] === undefined) {
                            y_projection[y_val] = 0;
                        }
                        x_projection[x_val] += z_val;
                        y_projection[y_val] += z_val;
                    }
                }


                let y_proj_vals = Object.values(y_projection);
                let x_proj_vals = Object.values(x_projection);
                let x_proj_max = Math.max(...x_proj_vals);
                let x_proj_min = Math.min(...x_proj_vals);
                let y_proj_max = Math.max(...y_proj_vals);
                let y_proj_min = Math.min(...y_proj_vals);

                const x_old_range = (x_proj_max - x_proj_min);
                const y_old_range = (y_proj_max - y_proj_min);

                // scale x_projection
                Object.keys(x_projection).map(function (key, index) {
                    x_projection[key] = ((x_projection[key] - x_proj_min) / x_old_range);
                });

                // scale y_projection
                Object.keys(y_projection).map(function (key, index) {
                    y_projection[key] = (((y_projection[key] - y_proj_min)) / y_old_range);
                });

                // plot top 1d nmr from projections
                let horizontal_1d = d3v7.scaleLinear()
                    .domain([x_proj_min, x_proj_max])
                    .range([0, -(scaled_height * 0.12) + 10]);

                let vertical_1d = d3v7.scaleLinear()
                    .domain([y_proj_min, y_proj_max])
                    .range([0, -(x_range[0] * 0.08) + 10]);
                context.lineWidth = 1;
                context.strokeStyle = "blue";

                // plot x_projection
                context.beginPath();
                for (let i = 0; i <= data.x.length; i++) {
                    const x_coord = scale.x(data.x[i]);
                    const range = scale.x.range();
                    if (x_coord >= range[1] && x_coord <= range[0]) {
                        context.lineTo(x_coord, horizontal_1d(x_proj_vals[i]));
                    }
                }
                context.stroke();

                // plot y_projection
                context.beginPath();
                for (let i = 0; i <= data.y.length; i++) {
                    const y_coord = scale.y(data.y[i]);
                    const range = scale.y.range();
                    if (y_coord >= range[0] && y_coord <= range[1]) {
                        context.lineTo(vertical_1d(y_proj_vals[i]), scale.y(data.y[i]));
                    }
                }
                context.stroke();
            }

        }
    }

    JSV.SVDot = SVDot;

})(JSpectraViewer);

//////////////////////////////////////////////////////////////////////////////
// SpectraViewer Legend
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  function Rect(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  Rect.prototype.contains_pt = function(x, y) {
    return ( x >= this.x && x <= (this.x + this.width) && y >= this.y && y <= (this.y + this.height) )
  }


  function SVLegend(sv) {
    const self = this;
    this.sv = sv;
    this.max_label_length = 0;
    this.margin_top = JSV.pixel(5);
    this.margin_side = JSV.pixel(10);
    this.key_label_space = JSV.pixel(5);
    this.key_width = JSV.pixel(10);
    this.line_width = JSV.pixel(3);
    this.text_height = JSV.pixel(18);
    this.items = [];

    sv.svg.on('click.legend', function(event) {
      let pt = sv.mouse(event, sv.canvas);
      for (let i=0, len=self.items.length; i < len; i++) {
        let item = self.items[i];
        if (item.rect.contains_pt(pt[0], pt[1]) && sv.legend_show) {
          item.path.visible = !item.path.visible;
          sv.full_draw();
        }
      }
    })
  }

  SVLegend.prototype.bottom = function() {
    const text_y = (this.sv.zoombox.visible ? JSV.pixel(this.sv.zoombox.height) : 0) + this.margin_top;
    return this.sv.legend_show ? this.offset_y : text_y;
  }

  SVLegend.prototype.update = function() {
    const sv = this.sv;
    const context = sv.context;
    this.offset_y = (sv.zoombox.visible ? JSV.pixel(sv.zoombox.height) : 0) + this.margin_top;
    const offset_x = this.margin_side;
    context.font = sv.adjust_font(1, 'monospace');
    this.items = [];
    for (let i = 0; i < sv.spectra().length; i++) {
      const spectrum = sv.spectra()[i];
      // if (! spectrum.active) continue;
      const item = new JSV.SVLegendItem(this);
      const rect = new Rect();
      rect.y = this.offset_y;
      rect.height = this.text_height;
      rect.width = this.key_width + this.key_label_space + context.measureText(spectrum.name).width;
      rect.x = sv.axis_x_reverse ?
          offset_x :
          JSV.pixel(sv.width) - offset_x - rect.width;
      item.rect = rect;
      item.path = spectrum;
      this.offset_y += this.text_height;
      this.items.push(item);
      this.max_label_length = Math.max(item.path.name.length, this.max_label_length);
    }
  }

  SVLegend.prototype.draw = function() {
    const sv = this.sv;
    const context = sv.context;
    context.save();
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.font = sv.adjust_font(1, 'monospace');
    for (let i = 0; i < this.items.length; i++) {
      this.items[i].draw(this.max_label_length);
    }
    context.restore();
  }

  function SVLegendItem(legend, path, rect) {
    this.legend = legend;
    this.sv = legend.sv;
    this.path = path; // e.g. spectra
    this.rect = rect; // Rect defining space in legend
  }

  SVLegendItem.prototype.key_x1 = function() {
    return this.sv.axis_x_reverse ?
        this.rect.x :
        this.rect.x + this.rect.width - this.legend.key_width;
  }

  SVLegendItem.prototype.key_x2 = function() {
    return this.key_x1() + this.legend.key_width;
  }

  SVLegendItem.prototype.key_y = function() {
    return this.rect.y + (this.rect.height / 2);
  }

  SVLegendItem.prototype.label_x = function() {
    return this.sv.axis_x_reverse ?
        this.rect.x + this.legend.key_width + this.legend.key_label_space :
        this.rect.x;
  }


  SVLegendItem.prototype.draw = function(label_len) {
    let rect = this.rect;
    this.sv.context.clearRect(rect.x, rect.y, rect.width, rect.height);
    if (this.path.visible) this.draw_key();
    this.draw_label(label_len);
  }

  SVLegendItem.prototype.draw_key = function() {
    let context = this.sv.context;
    context.beginPath();
    context.moveTo(this.key_x1(), this.key_y());
    context.lineTo(this.key_x2(), this.key_y());
    context.lineWidth = this.legend.line_width;
    context.strokeStyle = this.path.color;
    context.setLineDash(this.path.dash);
    context.stroke();
  }

  SVLegendItem.prototype.draw_label = function(label_len) {
    this.sv.context.fillStyle = this.path.visible ? 'black' : '#999';
    let checkbox = this.path.visible ? "\u2612" : "\u2610"
    let label =  `${this.path.name.padEnd(label_len)} ${checkbox}`
    this.sv.context.fillText(label, this.label_x(), this.key_y())
  }

  JSV.SVLegend = SVLegend;
  JSV.SVLegendItem = SVLegendItem;

})(JSpectraViewer);

//////////////////////////////////////////////////////////////////////////////
// SpectraViewer Labels
//////////////////////////////////////////////////////////////////////////////
// TODO:
// - Only check for collisions with spectrum if number of labels is < 100
// - When checking for overlap with spectrum only use 4 points in increments of (width / 3)
// - consider having labels per spectrum, them group visible ones together for drawing
(function(JSV) {

  function SVAnnotation(sv, options = {}) {
    const self = this;
    this.sv = sv;
    this.highlighted_label;
    this.point_gap = JSV.default_for(options.point_gap, JSV.pixel(12));
    this.label_color = JSV.default_for(options.label_color, '#5555DD');
    this.visible = JSV.default_for(options.visible, true);
    this.hover = JSV.default_for(options.hover, true);
    this.labels = new JSV.SVSet();
    this.visible_labels = new JSV.SVSet();
    // Test label-click
    // sv.on('label-click', function(label) {
    //   console.log(label.text)
    // })
    sv.svg.on('mousedown.label', function() {
      if (self.highlighted_label && self.hover) {
        sv.trigger('label-click', self.highlighted_label);
      }
    });
  }

  SVAnnotation.prototype.get = function(term) {
    return this.labels.get(term);
  }

  SVAnnotation.prototype.update = function() {
    const sv = this.sv;
    const labels = sv.labels ? sv.labels.get() : new JSV.SVSet();
    sv.spectra().forEach(function(spectrum) {
      if (spectrum.visible && spectrum.active && spectrum.labels) {
        labels.push.apply(labels, spectrum.labels.get())
      }
    });
    this.labels = labels;

    let visible_labels = this.reduce_labels_by_view();
    visible_labels = this.reduce_labels_by_height(visible_labels);
    visible_labels = this.adjust_labels(visible_labels);
    this.visible_labels = visible_labels;
  }

  SVAnnotation.prototype.rect_for_label = function(label) {
    const sv = this.sv;
    let rect, x, y;
    const point_x = sv.scale.x(label.x);
    const point_y = sv.scale.y(label.y);
    const text_width = sv.context.measureText(label.text).width;
    const text_height = JSV.pixel(label.font_size);
    if (label.vertical) {
      x = point_x - (text_height/2);
      y = point_y - text_width - this.point_gap;
      rect = new Rect(x, y, text_height, text_width);
    } else {
      x = point_x - (text_width/2);
      y = point_y - text_height - this.point_gap;
      rect = new Rect(x, y, text_height, text_width);
    }
    return rect;
  }

  // Return labels within view
  SVAnnotation.prototype.reduce_labels_by_view = function(labels) {
    if (!labels) labels = this.labels;
    const scale = this.sv.scale;
    return labels.filter(function(label) { return (label.x > scale.x.min() && label.x < scale.x.max() && label.y < scale.y.max())})
  }

  // Return only highest labels of overlapping sets
  SVAnnotation.prototype.reduce_labels_by_height = function(labels) {
    if (!labels) labels = this.labels;
    const scale = this.sv.scale;
    const font_min = 6;
    const reduced = new JSV.SVSet();

    let i = 0;
    const len = labels.length;
    for (; i < len; i++) {
      label = labels[i];
      label.font_size = font_min;
      label.rect = this.rect_for_label(label);
      label.adjust_rect(reduced);
      if (label.stack_level < 3) {
        reduced.push(label);
      }
    }

    return reduced;
  }

  SVAnnotation.prototype.adjust_labels = function(labels) {
    const sv = this.sv;
    let peak, label, label_rects, spectra_overlap;
    // Number of stacked labels to accept before trying to reduce the font size
    const max_stack = 1;
    // space between label line and peak/label
    const line_spacer = JSV.pixel(2);
    // minimum gap between peak and label
    const peak_gap = JSV.pixel(12);
    const font_max = 13;
    const font_min = 8;
    const font_range = font_max - font_min;
    let font_current = font_max;
    let font_current_min = font_min;

    const scale = sv.scale;
    const context = sv.context;
    context.save();
    let bad_stack = true;
    while(bad_stack) {
      bad_stack = false;
      adjusted_labels = new JSV.SVSet();
      context.font = JSV.pixel(font_current) + "px Arial";
      // Adjust min font based on zoom level
      font_current_min = font_min + Math.round(font_range * sv.zoom_x / sv.zoom_max);
      let i = 0;
      const len = labels.length;
      for (; i < len; i++) {
        label = labels[i];
        label.font_size = font_current;
        label.rect = this.rect_for_label(label);
        // spectra_overlap = this.label_over_spectra(label, this.sv.peaks());
        label.adjust_rect(adjusted_labels);
        if ( (label.stack_level > max_stack) && font_current > font_current_min) {
          bad_stack = true;
          font_current -= 1;
          break;
        } else {
          adjusted_labels.push(label);
        }
      }
    }
    return labels;
  }

  // Check if the bottom line of rect overlaps with sumline created from peaks
  SVAnnotation.prototype.label_over_spectra = function(label, peaks, tolerance) {
    const sv = this.sv;
    const x_vals = [];
    for (let i=0, len=label.rect.width; i < len; i++) {
      x_vals.push(sv.scale.x.invert(label.rect.x + i));
    }
    const y = sv.scale.y.invert(label.rect.bottom());
    let overlap = false;
    for (let i=0, len=x_vals.length; i < len; i++) {
      if (y < JSV.sum_of_peaks(x_vals[i], peaks)) {
        overlap = true;
        break;
      }
    }
    return overlap;
  }

  SVAnnotation.prototype.draw = function() {
    if (!this.visible) { return }
    const sv = this.sv;
    const context = sv.context;
    const scale = sv.scale;
    let label;
    const line_spacer = JSV.pixel(2);
    context.save();

    this.update();
    const visible_labels = this.visible_labels;
    // Draw the label lines, joining the peak to the label
    for (let i=0, len=visible_labels.length; i < len; i++) {
      label = visible_labels[i];
      const line_x = scale.x(label.x);
      const line_y1 = scale.y(label.y) - line_spacer;
      const line_y2 = label.rect.bottom() + line_spacer;
      context.beginPath();
      context.moveTo(line_x, line_y1);
      context.lineTo(line_x, line_y2);
      context.strokeStyle = '#999999';
      context.lineWidth = JSV.pixel(0.5);
      context.stroke();
    }

    // Draw the labels
    context.fillStyle = this.label_color;
    for (let i=0, len=visible_labels.length; i < len; i++) {
      label = visible_labels[i];
      if (label === this.highlighted_label) {
        context.font = "bold " + context.font;
      } else {
        context.font = context.font.replace('bold ', '');
      }
      context.textBaseline = 'top';
      if (label.vertical) {
        context.textAlign = 'right';
        context.save();
        context.translate(label.rect.x, label.rect.y);
        context.rotate(-Math.PI/2);
        context.fillText(label.text, 0, 0);
        context.restore();
      } else {
        context.textAlign = 'left';
        context.fillText(label.text, label.rect.x, label.rect.y);
      }
    }
    context.restore();
  }

  SVAnnotation.prototype.check_hover = function() {
    const sv = this.sv;
    let label;
    if (this.hover) {
      const x = sv.scale.x(sv.mx);
      const y = sv.scale.y(sv.my);
      const old_label = this.highlighted_label;
      let current_label;

      let i = 0;
      const len = this.visible_labels.length;
      for (; i < len; i++) {
        label = this.visible_labels[i];
        if (label.rect.contains_pt(x, y)) {
          current_label = label;
          break;
        }
      }
      if (old_label != current_label) {
        this.highlighted_label = current_label;
        this.sv.trigger('click-start');
        sv.full_draw();
      }
      if (this.highlighted_label) {
        sv.svg.style('cursor', 'pointer');
      } else {
        sv.svg.style('cursor', 'move');
      }
    }
  }


  function SVLabelSet(options) {
    options = options || {};
    this.spectrum = options.spectrum
    this.labels = new JSV.SVSet();
  }

  SVLabelSet.prototype.get = function(term) {
    return this.labels.get(term);
  }

  SVLabelSet.prototype.add = function(data, display, meta) {
    this.labels.push( new SVLabel(this, data, display, meta) );
  }

  // If the SVLabelSet is associated with a spectrum with peaks those labels will be added
  SVLabelSet.prototype.add_peaks = function() {
    if (this.spectrum) {
      const peaks = this.spectrum.peaks();
      let i = 0;
      const len = peaks.length;
      for (; i < len; i++) {
        const peak = peaks[i];
        const y = JSV.sum_of_peaks(peak.center, peak.spectrum().peaks());
        this.add({ x: peak.center, y: y, text: peak.label() })
      }
    }
  }


  // If the SVLabelSet is associated with a spectrum with peaks those labels will be regenerated
  SVLabelSet.prototype.update_peaks = function() {
    if (this.spectrum) {
      // TODO: only remove peak associated labels
      this.labels = new JSV.SVSet();
      this.add_peaks();
    }
  }


  label_id = 0;

  function SVLabel(label_set, data, display, meta) {
    data = data || {};
    display_defaults = { vertical: true, font_size: 12 };
    display = JSV.merge(display_defaults, data.display, display);
    this.meta = JSV.merge(data.meta, meta);

    this.label_set = label_set;
    this.vertical = display.vertical;
    this.font_size = display.font_size;
    // this.id = data.id;
    // this.name = data.name || this.id;
    this.text = data.text;
    this.x = data.x;
    this.y = data.y;
    this.stack_level = 0;
    this.label_id();
  }

  SVLabel.prototype.label_id = function() {
    const new_id = generate_label_id();
    this.label_id = function() { return new_id; }
    return new_id;
  }

  const generate_label_id = function() {
    return 'label-id-' + label_id++;
  }

  // Adjust the rect so it does not overlap any rects in rect_array
  // Returns an object with the adjusted rect and how many levels the
  // rect had to be stacked to not overlap any more.
  SVLabel.prototype.adjust_rect = function(labels) {
    const overlap = true;
    let count = 0;
    while( this.overlap(labels) ) {
      this.rect.y -= JSV.pixel(this.font_size) * 2;
      count += 1;
    }
    this.stack_level = count
  }

  SVLabel.prototype.overlap =  function(labels) {
    return this.rect.overlap( labels.map( function(label) { return label.rect; } ) );
  }


  function Rect(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  Rect.prototype.bottom = function() {
    return this.y + this.height;
  }

  Rect.prototype.top = function() {
    return this.y;
  }

  Rect.prototype.left = function() {
    return this.x;
  }

  Rect.prototype.right = function() {
    return this.x + this.width;
  }

  // Check if rect overlaps with any rects in rect_array
  Rect.prototype.overlap = function(rect_array) {
    // Gap between labels
    const width_gap = JSV.pixel(4);
    const r1 = this;
    let overlap = false;
    let i = 0;
    const len = rect_array.length;
    for (; i < len; i++){
      const r2 = rect_array[i];
      if (r1.x <= r2.right() && r2.x <= (r1.right() + width_gap) && r1.y <= r2.bottom() && r2.y <= r1.bottom()) {
        overlap = true;
        break;
      }else{
        overlap = false;
      }
    }
    return overlap;
  }

  Rect.prototype.contains_pt = function(x, y) {
    return ( x >= this.x && x <= (this.x + this.width) && y >= this.y && y <= (this.y + this.height) )
  }

  JSV.SVAnnotation = SVAnnotation;
  JSV.SVLabelSet = SVLabelSet;
  JSV.SVLabel = SVLabel;

})(JSpectraViewer);

//////////////////////////////////////////////////////////////////////////////
// Spectrum
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  /**
   * Spectra can be made up from basic xy data, a peak list, or a set of one or
   * more [Compounds](Compound.js.html).
   *
   * Spectrum inherits methods and properties from [SVPath](SVPath.js.html).
   *
   * @param {Object} data Data used to create the Spectrum. See examples described in [SpectraViewer.add_spectrum](SpectraViewer.js.html#add_spectrum).
   * @param {Object} display Display options passed to [SVPath](SVPath.js.html)
   * @param {Object} meta User-defined _key_:_value_ pairs to add to the Spectrum.
   * @return {Spectrum}
   */
  function Spectrum(data, display, meta) {
    const self = this;
    data = data || { };
    display_defaults = { };
    display = JSV.merge(display_defaults, data.display, display);
    meta = JSV.merge(data.meta, meta);
    JSV.SVPath.call(this, display, meta);

    this.id = data.id;
    this.name = data.name || this.id;
    this.tolerance = data.tolerance;
    this.noise;
    this.active = true;
    this.xy_data = new JSV.SVData();
    this.simple_xy_data = new JSV.SVData();
    this.labels = new JSV.SVLabelSet({spectrum: this});
    this._compounds = new JSV.SVSet();

    if (data.compounds) {
      data.compounds.forEach(function(compound_data) {
        self.add_compound(new JSV.Compound(compound_data));
      })
    } else if (data.peak_list) {
      const compound_data = { clusters: [ { peaks: data.peak_list } ] };
      self.add_compound(new JSV.Compound(compound_data));
    }

    if (self.compounds().present()) {
      const number_of_points = JSV.default_for(data.number_of_points, 10000);
      const min_x = JSV.default_for(data.min_x, -1);
      const max_x = JSV.default_for(data.max_x, 10);
      if (!data.xy_line) {
        const xy_line = JSV.xy_from_peaks(self.peaks(), number_of_points, min_x, max_x);
        var __max_y = Math.max.apply(null, xy_line.y);
        if (__max_y > 0) { xy_line.y = xy_line.y.map(function(y) { return y / __max_y; }); }
        self.add_xy_line(xy_line);
      }
    }
    if (data.xy_line) {
      self.add_xy_line(data.xy_line);
    }

    if (data.labels) {
      data.labels.forEach(function(label) {
        self.labels.add(label);
      });
    }

  }
  JSV.inherits(Spectrum, JSV.SVPath);

  Spectrum.prototype.toString = function() { return 'Spectrum'; }

  /**
   * Add a [Compound](Compound.js.html) to the spectrum
   * @param {Compound} compound [Compound](Compound.js.html) to add
   */
  Spectrum.prototype.add_compound = function(compound) {
    this._compounds.push(compound);
    compound._spectrum = this;
    // TODO: update xy_data??
  }

  /**
   * Update xy_line based on peak data. Also update the zoombox.
   */
  Spectrum.prototype.update = function() {
    const sv = this._sv;
    const xy_data = JSV.xy_from_peaks(this.peaks(), this.xy_data.length(), sv.boundary.x.min(), sv.boundary.x.max());
    this.add_xy_line(xy_data);
    sv.zoombox.update();
  }

  /**
   * Returns an [SVSet](SVSet.js.html) of Compounds or a single Compound from the Spectrum.
   * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
   * @return {SVSet|or|Compound}
   */
  Spectrum.prototype.compounds = function(term) {
    return this._compounds.get(term)
  }

  Spectrum.prototype.add_xy_line = function(xy_data) {
    this.xy_data = new JSV.SVData(xy_data);
    this.noise = this.calculate_noise();
    const tolerance = this.tolerance || this.noise;
    this.simple_xy_data = this.xy_data.simplify(tolerance, true);
  }

  // Noise is calculated as the difference between the maximum
  // and minimum peak betwen the range.
  // TODO: if region does not exist, use first 0.01 in data
  Spectrum.prototype.calculate_noise = function() {
    // Region to calculate noise
    const region = [-0.05, -0.04];
    const xy_min = this.xy_data.index_of(region[0]);
    const xy_max = this.xy_data.index_of(region[1]);
    const y_noise = this.xy_data.y.slice(xy_min, xy_max);
    return (d3v7.max(y_noise) - d3v7.min(y_noise)).toPrecision(2);
  }

  /**
   * Returns an [SVSet](SVSet.js.html) of Clusters or a single Cluster from the Spectrum.
   * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
   * @return {SVSet|or|Cluster}
   */
  Spectrum.prototype.clusters = function(term) {
    const clusters = new JSV.SVSet();
    let i = 0;
    const len = this._compounds.length;
    for (; i < len; i++) {
      clusters.merge(this._compounds[i].clusters());
    }
    return clusters.get(term);
  }

  /**
   * Returns an [SVSet](SVSet.js.html) of Peaks or a single Peak from the Spectrum.
   * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
   * @return {SVSet|or|Peak}
   */
  Spectrum.prototype.peaks = function(term) {
    const peaks = new JSV.SVSet();
    this.compounds().forEach(function(compound) {
      compound.clusters().forEach(function(cluster) {
        peaks.merge(cluster.peaks());
      })
    })
    return peaks.get(term);
  }

  /////////////////////////////////////////////////////////////////////////////
  // Spectrum Properties (setters/getters)
  /////////////////////////////////////////////////////////////////////////////
  Object.defineProperties(Spectrum.prototype, {
    'active': {
      get: function() { return this._active },
      set: function(val) {
        this._active = val;
        const sv = this._sv;
        if (sv) {
          sv.reset_boundaries();
          sv.all_spectra().each(function() {
            if (this.active) {
              sv.boundary.update(this.xy_data);
              sv.scale.update(this.xy_data);
            }
          });
          sv.zoombox.update();
          sv.legend.update();
        }
      }
    }
  });

  JSV.Spectrum = Spectrum;

})(JSpectraViewer);//////////////////////////////////////////////////////////////////////////////
// Spectrum 2D
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

    /**
     * 2D Spectra are made up from basic xyz data
     *
     * Spectrum2D inherits methods and properties from [SVDot](SVDot.js.html).
     *
     * @param {Object} data Data used to create the Spectrum. See examples described in [SpectraViewer.add_spectrum](SpectraViewer.js.html#add_spectrum).
     * @param {Object} display Display options passed to [SVDot](SVDot.js.html)
     * @param {Object} meta User-defined _key_:_value_ pairs to add to the Spectrum.
     * @return {Spectrum2D}
     */
    function Spectrum2D(data, display, meta) {
        const self = this;
        data = data || { };
        display_defaults = { };
        display = JSV.merge(display_defaults, data.display, display);
        meta = JSV.merge(data.meta, meta);
        JSV.SVDot.call(this, display, meta);
        this._compounds = new JSV.SVSet();

        this.id = data.id;
        this.name = data.name || this.id;
        // this.tolerance = data.tolerance;
        // this.noise;
        this.active = true;
        this.xyz_data = new JSV.SVData2D();

        if(data.compounds) {
            data.compounds
        }

        self.add_xyz_plot(data.json_data);

        if (data.labels) {
            data.labels.forEach(function(label) {
                self.labels.add(label);
            });
        }

    }
    JSV.inherits(Spectrum2D, JSV.SVDot);

    Spectrum2D.prototype.toString = function() { return 'Spectrum2D'; }

    /**
     * Add a [Compound](Compound.js.html) to the spectrum
     * @param {Compound} compound [Compound](Compound.js.html) to add
     */
    Spectrum2D.prototype.add_compound = function(compound) {
        this._compounds.push(compound);
        compound._spectrum = this;
        // TODO: update xy_data??
    }

    Spectrum2D.prototype.add_xyz_plot = function(xyz_data) {
        this.xyz_data = new JSV.SVData2D(xyz_data);
        // this.noise = this.calculate_noise();
        // var tolerance = this.tolerance || this.noise
        //this.simple_xy_data = this.xy_data.simplify(tolerance, true);
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Compounds or a single Compound from the Spectrum.
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Compound}
     */
    Spectrum2D.prototype.compounds = function(term) {
        return this._compounds.get(term)
    }


    /////////////////////////////////////////////////////////////////////////////
    // Spectrum Properties (setters/getters)
    /////////////////////////////////////////////////////////////////////////////
    Object.defineProperties(Spectrum2D.prototype, {
        'active': {
            get: function() { return this._active },
            set: function(val) {
                this._active = val;
                const sv = this._sv;
                if (sv) {
                    sv.reset_boundaries();
                    sv.all_spectra().each(function() {
                        if (this.active) {
                            sv.boundary.update(this.xy_data);
                            sv.scale.update(this.xy_data);
                        }
                    });
                    sv.zoombox.update();
                    sv.legend.update();
                }
            }
        }
    });

    JSV.Spectrum2D = Spectrum2D;

})(JSpectraViewer);//////////////////////////////////////////////////////////////////////////////
// Compound
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  /**
   * Compounds are made up of a group of [Clusters](Cluster.js.html).
   *
   * ```javascript
   * data = [
   *   {
   *     id: 'HMDB01659',
   *     name: 'Acetone',
   *     concentration: '50',
   *     clusters: [
   *       {
   *         peaks: [
   *           { center: 2.22, amplitude: 0.6, width: 0.005 }
   *           { center: 2.34, amplitude: 0.6, width: 0.005 }
   *         ]
   *       }
   *     ]
   *   }
   * ]
   * ```
   *
   * Compound inherits methods and properties from [SVPath](SVPath.js.html).
   *
   * @param {Object} data Data used to create the Compound. See example below
   * @param {Object} display Display options passed to [SVPath](SVPath.js.html)
   * @param {Object} meta User-defined _key_:_value_ pairs to add to the Compound.
   * @return {Compound}
   */
  function Compound(data, display, meta) {
    const self = this;
    data = data || { };
    display_defaults = { visible: false };
    display = JSV.merge(display_defaults, data.display, display);
    meta = JSV.merge(data.meta, meta);
    JSV.SVPath.call(this, display, meta);

    this._clusters = new JSV.SVSet();
    if (data) {
      this.id = data.id;
      this.name = data.name;
      this.concentration = data.concentration
      this.original_concentration = data.concentration
      if (data.clusters) {
        data.clusters.forEach(function(cluster_data) {
          self.add_cluster(new JSV.Cluster(cluster_data))
        });
      }
    }
    // this.update_xy_data();
    this.update();
  }
  JSV.inherits(Compound, JSV.SVPath);

  Compound.prototype.toString = function() { return 'Compound'; }

  /**
   * Add a [Cluster](Cluster.js.html) to the Compound
   * @param {Cluster} cluster [Cluster](Cluster.js.html) to add
   */
  Compound.prototype.add_cluster = function(cluster) {
    this._clusters.push(cluster);
    cluster._compound = this;
    // cluster.update_center();
    // TODO: update xy_data??
  }

  /**
   * Update the xy_data simple_xy_data associated with this Compound.
   * Also update the order of the clusters.
   */
  Compound.prototype.update = function() {
    this.x_min = JSV.peak_min(this.peaks());
    this.x_max = JSV.peak_max(this.peaks());
    this.xy_data = new JSV.SVData(JSV.xy_from_peaks(this.peaks(), 5000, this.x_min, this.x_max));
    this.simple_xy_data = this.xy_data.simplify(0.0005, true);
    this._clusters.order_by('center');
  }

  /**
   * Returns an [SVSet](SVSet.js.html) of Clusters or a single Cluster from the Compound.
   * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
   * @return {SVSet|or|Cluster}
   */
  Compound.prototype.clusters = function(term) {
    return this._clusters.get(term);
  }

  /**
   * Returns an [SVSet](SVSet.js.html) of peaks or a single Peak from the Compound.
   * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
   * @return {SVSet|or|Peak}
   */
  Compound.prototype.peaks = function(term) {
    const peaks = new JSV.SVSet();
    this._clusters.forEach(function(cluster) {
      peaks.merge(cluster.peaks());
    })
    return peaks.get(term);
  }

  /**
   * Returns the parent [Spectrum](Spectrum.js.html).
   */
  Compound.prototype.spectrum = function() {
    return this._spectrum;
  }

  Compound.prototype.intersect = function(x, y, margin) {
    const cy = JSV.sum_of_peaks(x, this.peaks());
    // return y <= (cy + margin) && y >= (cy - margin);
    return y <= (cy) && y >= 0;
  }

  Compound.prototype.display_concentration = function() {
    return JSV.round(this.concentration, 1) + ' \u03BCM';
  }

  /**
   * Return the center of the compound: an average of center value for all the
   * peaks in the compound.
   * @return {Number}
   */
  Compound.prototype.center = function() {
    let center;
    if (this.peaks().present()) {
      center = d3v7.mean(this.peaks(), function(p) { return p.center });
    }
    return center;
  }

  Compound.prototype.atom_assignment_nmrml = function() {
    if (!window.X2JS) {
      console.log("X2JS needs to be installed to create nmrML: https://github.com/abdmob/x2js");
      return
    }
    const formatter = d3v7.format('.2f');
    const x2js = new X2JS();
    const json = {atomAssignmentList: {multiplet: []}};
    this.clusters().forEach(function(cluster) {
      const peaks = [];
      cluster.peaks().forEach(function(peak) {
        peaks.push({
          _center: peak.center,
          _amplitude: peak.amplitude,
          _width: peak.width
        })
      });
      const multiplet = {
        _center: formatter(cluster.center()),
        atoms: {_atomRefs: cluster.atom_refs.join(' ')},
        // multiplicity: { _TODO: 'TODO' },
        multiplicity: cluster.nmrml_multiplet_json(),
        peakList: {
          peak: peaks
        }
      };
      json.atomAssignmentList.multiplet.push(multiplet)
    });
    let nmrml = x2js.json2xml_str(json);
    nmrml = nmrml.replace(/><\/peak>/g, '/>')
    return nmrml
  }


  JSV.Compound = Compound;

})(JSpectraViewer);//////////////////////////////////////////////////////////////////////////////
// Cluster
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  /**
   * Clusters are made up of a group of [Peaks](Peak.js.html). Typically a
   * cluster for an NMR spectrum would correspond to a multiplet of peaks.
   *
   * ```javascript
   * data = {
   *   peaks: [
   *     { center: 2.22, amplitude: 0.6, width: 0.005 },
   *     { center: 2.34, amplitude: 0.6, width: 0.005 }
   *   ]
   * }
   *
   * // The data may also contain upper_bound and lower attributes.
   * // The bounds can shown on the Viewer when a cluster is selected,
   * // if the SVSelection.show_bounds is true.
   *
   * data = {
   *   peaks: [...],
   *   lower_bound: 2.0,
   *   upper_bound: 2.4
   * }
   * ```
   *
   * Cluster inherits methods and properties from [SVPath](SVPath.js.html).
   *
   * @param {Object} data Data used to create the cluster. See example below
   * @param {Object} display Display options passed to [SVPath](SVPath.js.html)
   * @param {Object} meta User-defined _key_:_value_ pairs to add to the Cluster.
   * @return {Cluster}
   */
  function Cluster(data, display, meta) {
    const self = this;
    data = data || { };
    display_defaults = { visible: false };
    display = JSV.merge(display_defaults, data.display, display);
    meta = JSV.merge(data.meta, meta);
    JSV.SVPath.call(this, display, meta);

    this._peaks = new JSV.SVSet();

    this._atoms = new JSV.SVSet();

    this.lower_bound = JSV.number(data.lower_bound);
    this.upper_bound = JSV.number(data.upper_bound);
    this.weight = JSV.number(data.weight);
    this.protons = JSV.number(data.protons);

    if (data.peaks) {
      data.peaks.forEach(function(peak_data) {
        self.add_peak(new JSV.Peak(peak_data))
      });
    }

  }
  JSV.inherits(Cluster, JSV.SVPath);

  Cluster.prototype.toString = function() { return 'Cluster'; }

  /**
   * Add a [Peak](Peak.js.html) to the cluster
   * @param {Peak} peak [Peak](Peak.js.html) to add
   */
  Cluster.prototype.add_peak = function(peak) {
    this._peaks.push(peak);
    this.multiplet_type = undefined;
    peak._cluster = this;
  }


  /**
   * Reorder all the peaks in the Cluster by their center property.
   */
  Cluster.prototype.update = function() {
    this._peaks.order_by('center');
  }


  /**
   * Returns an [SVSet](SVSet.js.html) of peaks or a single Peak from the Cluster.
   * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
   * @return {SVSet|or|Peak}
   */
  Cluster.prototype.peaks = function(term) {
    return this._peaks.get(term);
  }

  /**
   * Returns the parent [Compound](Compound.js.html).
   */
  Cluster.prototype.compound = function() {
    return this._compound;
  }

  /**
   * Returns the parent [Spectrum](Spectrum.js.html).
   */
  Cluster.prototype.spectrum = function() {
    return this.compound().spectrum();
  }

  /**
   * Return the center of the cluster: an average of center value for all the
   * peaks in the cluster.
   * @return {Number}
   */
  Cluster.prototype.center = function() {
    let center;
    if (this.peaks().present()) {
      center = d3v7.mean(this.peaks(), function(p) { return p.center });
    }
    return center;
  }

  /**
   * Returns an SVSet of atoms or a single Atom from the Cluster.
   * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
   * @return {SVSet|or|Atom}
   */
  Cluster.prototype.atoms = function(term) {
    return this._atoms.get(term);
  }


  // http://pubs.acs.org/paragonplus/submission/acs_nmr_guidelines.pdf
  // http://www.chem.uci.edu/~jsnowick/groupweb/files/MultipletGuideV4.pdf
  Cluster.prototype.determine_multiplet_type = function() {
    const self = this;
    const peaks = self.peaks();
    let type = 'm';
    if (peaks.length == 1) {
      type = 's';
    } else if (peaks.length == 2) {
      type = 'd';
    } else if (peaks.length == 3) {
      type = 't';
    } else if (peaks.length == 4) {
      if (double_of_doublets(peaks)) {
        type = 'dd';
      } else {
        type = 'q';
      }
    } else if (peaks.length == 5) {
      type = 'quint';
    } else if (peaks.length == 6) {
      if (triplet_of_doublets(peaks)) {
        type = 'td';
      } else {
        type = 'dt';
      }
    }
    return type
  }

  // All the peaks should be close to the same height
  const double_of_doublets = function(peaks) {
    const within = 0.1; // amount all heights must be within of the max height
    const heights = peaks.map(function (p) {
      return p.amplitude
    });
    const max_height = d3v7.max(heights);
    const range_min = max_height * (1 - within);
    const range_max = max_height * (1 + within);
    return heights.every(function(h) { return  h >= range_min && h <= range_max })
  }

  // The middle 2 peaks should be higher than all the other peaks
  const triplet_of_doublets = function(peaks) {
    const heights = peaks.map(function (p) {
      return p.amplitude
    });
    const middle_height = d3v7.min(heights.slice(2, 3));
    const check_heights = heights.slice(0, 1).concat(heights.slice(4, 5));
    return check_heights.every(function(h) { return  h <= middle_height })
  }

  // Return the json required to create the multiplet nmrml
  Cluster.prototype.nmrml_multiplet_json = function() {
    let json;
    switch (this.multiplet_type) {
      case 's':
        json = {_cvRef: 'NMRCV', _accession: 'NMR:1000194', _name: 'singlet feature'};
        break;
      case 'd':
        json = {_cvRef: 'NMRCV', _accession: 'NMR:1000184', _name: 'doublet feature'};
        break;
      case 't':
        json = {_cvRef: 'NMRCV', _accession: 'NMR:1000185', _name: 'triplet feature'};
        break;
      case 'q':
        json = {_cvRef: 'NMRCV', _accession: 'NMR:1000186', _name: 'quatruplet feature'};
        break;
      case 'dd':
        json = {_cvRef: 'NMRCV', _accession: 'NMR:1000192', _name: 'doublet of doublets feature'};
        break;
      case 'quint':
        json = {_cvRef: 'NMRCV', _accession: 'NMR:1000195', _name: 'quintet feature'};
        break;
      case 'dt':
        json = {_cvRef: 'NMRCV', _accession: 'NMR:1000196', _name: 'doublet of triplets feature'};
        break;
      case 'td':
        json = {_cvRef: 'NMRCV', _accession: 'NMR:1000197', _name: 'triplet of doublets feature'};
        break;
      case 'm':
        json = {_cvRef: 'NMRCV', _accession: 'NMR:1400305', _name: 'multiplet feature'};
        break;
      default:
        json = {_cvRef: 'NMRCV', _accession: 'NMR:1400305', _name: 'multiplet feature'};
    }
    return json
  }
  /////////////////////////////////////////////////////////////////////////////
  // Cluster Properties (setters/getters)
  /////////////////////////////////////////////////////////////////////////////
  Object.defineProperties(Cluster.prototype, {
    'multiplet_type': {
      get: function() {
        if (!this._multiplet_type) {
          this._multiplet_type = this.determine_multiplet_type();
        }
        return this._multiplet_type
      },
      set: function(type) {
        this._multiplet_type = type;
      }
    },
    'atom_refs': {
      get: function() {
        if (this.atoms().length > 0) {
          return this.atoms().map(function(a) { return a.id });
        } else {
          return this._atom_refs || []
        }
      },
      set: function(refs) {
        this._atom_refs = refs;
      }
    },
    'dir_dim_atom_refs': {
      get: function() {
        return this.dir_dim_atom_refs;
      },
      set: function(refs) {
        this._dir_dim_atom_refs = refs;
      }
    },
    'indir_dim_atom_refs': {
      get: function() {
        return this.indir_dim_atom_refs;
      },
      set: function(refs) {
        this._indir_dim_atom_refs = refs;
      }
    }
  });

  JSV.Cluster = Cluster;

})(JSpectraViewer);


//////////////////////////////////////////////////////////////////////////////
// Peak
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  /**
   * Peaks are the base element that make up a Spectrum. One or more peaks
   * group together to form a Cluster. One or more Clusters group together to
   * form a compound. One or more compounds group together to form a spectrum.
   * To draw a cluster, compound or spectrum, all the peaks are summed
   * together at a particular x value to determine the y value.
   *
   * Peak inherits methods and properties from [SVPath](SVPath.js.html).
   *
   * @param {Object} data Data used to create the peak:
   *
   *   - _center_: center of the peak
   *   - _width_: width of peak at half height
   *   - _amplitude_: height of peak
   *
   * @param {Object} display Display options passed to [SVPath](SVPath.js.html)
   * @param {Object} meta User-defined _key_:_value_ pairs to add to the Peak.
   * @return {Peak}
   */
  function Peak(data, display, meta) {
    const self = this;
    data = data || { };
    display_defaults = { visible: false };
    display = JSV.merge(display_defaults, data.display, display);
    meta = JSV.merge(data.meta, meta);
    JSV.SVPath.call(this, display, meta);

    this.center = JSV.number(data.center);
    this.original_amplitude = JSV.number(data.original_amplitude);
    this.amplitude = JSV.number(data.amplitude);
    this.width = JSV.number(data.width);
    // this.update_xy_data();
  }
  JSV.inherits(Peak, JSV.SVPath);

  Peak.prototype.toString = function() { return 'Peak'; }

  Peak.prototype.set_amplitude = function(new_value) {
    if (new_value <= 0) new_value = 0.00001;
    this.amplitude = new_value;
  }

  // Set the center to the 'new_value'
  // Also updates cluster center and bounds
  Peak.prototype.set_center = function(new_value) {
    this.center = new_value;
  }

  Peak.prototype.update = function() {
  }

  /**
   * Remove the peak from the parent Cluster. If the parent Cluster has no more peaks,
   * then it is removed from the parent Compound and so on. If there are no more peaks
   * in the Spectrum, then the spectrum is removed from the viewer.
   */
  Peak.prototype.delete = function() {
    const self = this;
    const cluster = this.cluster();
    const compound = this.compound();
    const spectrum = this.spectrum();
    const sv = spectrum._sv;
    const updated_peaks = cluster._peaks.filter(function (p) {
      return p != self
    });
    cluster._peaks = new JSV.SVSet(updated_peaks);
    cluster.multiplet_type = undefined;
    if (cluster.peaks().empty()) {
      const updated_clusters = compound._clusters.filter(function (c) {
        return c != cluster;
      });
      compound._clusters = new JSV.SVSet(updated_clusters);
    }
    if (compound.peaks().empty()) {
      const updated_compounds = spectrum._compounds.filter(function (c) {
        return c != compound;
      });
      spectrum._compounds = new JSV.SVSet(updated_compounds);
    }
    if (spectrum.peaks().empty()) {
      const updated_spectra = sv._spectra.filter(function (c) {
        return c != spectrum;
      });
      sv._spectra = new JSV.SVSet(updated_spectra);
    }
  }

  /**
   * Returns itself in a [SVSet](SVSet.js.html).
   */
  Peak.prototype.peaks = function() {
    return new JSV.SVSet(this);
  }

  /**
   * Returns the parent [Cluster](Cluster.js.html).
   */
  Peak.prototype.cluster = function() {
    return this._cluster;
  }

  /**
   * Returns the parent [Compound](Compound.js.html).
   */
  Peak.prototype.compound = function() {
    return this.cluster().compound();
  }

  /**
   * Returns the parent [Spectrum](Spectrum.js.html).
   */
  Peak.prototype.spectrum = function() {
    return this.compound().spectrum();
  }


  /**
   * Returns the peak center to 3 decimal places. Used for creating labels.
   */
  Peak.prototype.label = function() {
    return this.center.toFixed(3);
  }

  JSV.Peak = Peak;

})(JSpectraViewer);
