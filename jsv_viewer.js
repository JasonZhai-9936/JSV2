// jsv_viewer.js - SpectraViewer (1D & 2D) and Zoom/Drag/Brush interactions
// Load order: 2 of 8
//
// SpectraViewer
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  /**
   * The SpectraViewer object controls how the viewer looks and behaves and
   * is the main object in JSV. Spectra are added to the SpectraViewer
   * using the [add_spectrum](#add_spectrum) method. A large number of options
   * can be set when creating a new viewer:
   *
   *  Option                | Default     | Description
   *  ----------------------|-------------------------------------------------
   *  title                 | _undefined_ | Title will appear above viewer if present
   *  id                    | jsv-1       | ID to select viewer
   *  width                 | 800         | Width of viewer in pixels
   *  height                | 400         | Height of viewer in pixels
   *  axis_x_title          | 'ppm'       | Label of x-axis
   *  axis_x_show           | true        | Show x-axis
   *  axis_x_grid           | true        | Show grid along x-axis
   *  axis_x_reverse        | true        | Reverse the direction of the x-axis
   *  axis_y_title          | 'Intensity' | Label of y-axis
   *  axis_y_show           | false       | Show y-axis
   *  axis_y_grid           | false       | Show grid along y-axis
   *  axis_y_reverse        | *           | Reverse the y-axis so peaks grow downward from the top. * Defaults to true for chart_type '1D-IR', false otherwise
   *  axis_y_lock          | false       | If true, locks axis to minimum y value. If a number locks the y-axis a percentage below 0 (e.g. 0.1 sets the y-axis minimum to 10% of the viewable y-axis scale below 0)
   *  min_boundaries        | _undefined_ | The minimum/maximum values for the x/y-axis. e.g. {x: [-1, 10], y: [0, 1]}. _Note_: _min_boundaries_ must be set, if only providing peak data.
   *  zoom_max              | 100         | The maximum zoom level
   *  zoombox_show          | true        | Show the zoombox
   *  zoombox_size          | 15          | Zoombox size as a percent of the viewer
   *  legend_show           | true        | Show the spectra legend
   *  drag_drop_load        | true        | If true, then bayesil JSON data can be dragged on to the viewer to load
   *  select                | {}          | See options for [SVSelection](SVSelection.js.html)
   *  highlight             | {}          | See options for [SVHighlighter](SVHighlighter.js.html)
   *  structure             | {}          | See options for [SVStructure](SVStructure.js.html)
   *  assignment_table      | {}          | See options for [SVAssignments](SVAssignments.js.html)
   *  cluster_navigation_id | _undefined_ | ID of div to place cluster navigation viewer (e.g. '#clust-nav')
   *
   *
   * @param {String} container_id The id of the element to contain the viewer.
   *   The contents of this element will be replaced with the viewer.
   * @param {Object} options Options to set up the viewer. Described below.
   * @return {SpectraViewer}
   */
  const SpectraViewer = function(container, options) {
    const sv = this;
    this.container = d3v7.select(container);
    // Get options
    options = options || {};
    this.title          = options.title;
    // === MS-PORT: chart_type controls which Spectrum subclass to use ===
    // '1D-NMR' (default), '1D-IR', '1D-UV' -> JSV.Spectrum  (line rendering)
    // '1D-EIMS', '1D-LCMS' -> JSV.SpectrumEIMS (bar rendering)
    this.chart_type     = JSV.default_for(options.chart_type, '1D-NMR');
    this.width          = JSV.default_for(options.width, 800);
    this.height         = JSV.default_for(options.height, 400);
    this.tick_count     = JSV.default_for(options.tick_count, 10);
    this.x_tick_count     = JSV.default_for(options.x_tick_count, 10);
    this.tick_length    = JSV.default_for(options.tick_length, 10);
    this.tick_precision = JSV.default_for(options.tick_precision, 3);
    this.axis_x_tick_format = d3v7.format(JSV.default_for(options.axis_x_tick_format, '~g'));
    this.axis_y_tick_format = d3v7.format(JSV.default_for(options.axis_y_tick_format, '~g'));
    this.axis_x_title   = JSV.default_for(options.axis_x_title, 'ppm');
    this.axis_y_title   = JSV.default_for(options.axis_y_title, 'Intensity');
    this.axis_y_show    = JSV.default_for(options.axis_y_show, false);
    this.axis_x_show    = JSV.default_for(options.axis_x_show, true);
    this.axis_y_grid    = JSV.default_for(options.axis_y_grid, false);
    this.axis_x_grid    = JSV.default_for(options.axis_x_grid, false);
    // IR spectra are conventionally drawn with peaks growing downward
    this.axis_y_reverse = JSV.default_for(options.axis_y_reverse, this.chart_type === '1D-IR');
    this.axis_x_reverse = JSV.default_for(options.axis_x_reverse, true);
    // If logical true, locks y axis to minimum y value
    // If a number locks the y axis to a percentage below 0 (e.g. 0.1 sets the y-axis min to 10% of the
    // viewable y axis scale below 0).
    this.axis_y_lock    = JSV.default_for(options.axis_y_lock, false);
    // min_boundaries must be set, if only providing peak data
    this.min_boundaries = options.min_boundaries; // Array example: {x: [-1, 10], y: [0, 1]}]
    this.zoom_max       = JSV.default_for(options.zoom_max, 100);
    this.zoombox_show   = JSV.default_for(options.zoombox_show, true);
    this.zoombox_size   = JSV.default_for(options.zoombox_size, 15); // percentage of viewer
    this.legend_show    = JSV.default_for(options.legend_show, true);
    // Controls the number of pixels saved for plots while zooming/draging
    // Increasing this number will descrease the number of pixels and thus speed up animations.
    // If no tolerance is provided, it will be calculated automatically from the spectra noise.
    this.simplify_tolerance = options.simplify_tolerance;
    // An array of debug keys to display or true to show all.
    this.debug = JSV.default_for(options.debug, false);
    this.debug_data = { time: {}, data: {}, drag: {}, zoom: {}, zbox: {} };
    // Set viewer ID
    const current_ids = JSV.viewers().map(function (viewer) {
      return viewer.id;
    });
    this.id = JSV.default_for(options.id, JSV.unique_id('jsv-', 1, current_ids));

    // Space required for axes
    this.axis_y_gutter = this.axis_y_show ? JSV.default_for(options.axis_y_gutter, 60) : 0;
    this.axis_x_gutter = this.axis_x_show ? JSV.default_for(options.axis_x_gutter, 50) : 0;

    // Delete contents of container and add title
    const header = this.title ? '<h3>' + this.title + '</h3>' : '';
    this.container.html(header)
        .style('width', this.width + 2 + 'px');

    this.sv_wrapper = this.container.append('div')
        .attr('class', 'sv-wrapper')
        .style('position', 'relative');

    // Add div to store the current key press
    this.container.append('div')
        .attr('class', 'sv-key-down')
        .style('display', 'none');

    // Create the viewer canvas
    // NOTE: anything drawn to the canvas must take the pixel ratio into account
    //       and should use the pixel() method.
    this.canvas = this.sv_wrapper.append("canvas")
        .attr("id", this.container.attr('id'))
        .attr("class", 'spectra-viewer ' + this.class)
        .style('border', '1px solid #DDD')
        .attr("width", this.width)
        .attr("height", this.height).node();

    // Check for canvas support
    if (!this.canvas.getContext) {
      this.container.html('<h3>Spectra Viewer requires Canvas, which is not supported by this browser.</h3>');
      throw('Canvas not supported');
    }

    // Get pixel ratio and upscale canvas depending on screen resolution
    // http://www.html5rocks.com/en/tutorials/canvas/hidpi/
    JSV.pixel_ratio = JSV.get_pixel_ratio(this.canvas);
    JSV.scale_resolution(this.canvas, JSV.pixel_ratio);

    // This would need to be adjusted in width setter
    this.font = this.adjust_font();
    this.axis_title_font = this.adjust_font(1, undefined, 'bold');
    // Set viewer context
    this.context = this.canvas.getContext('2d');

    // Add a placeholder function for browsers that don't have setLineDash()
    if (!this.context.setLineDash) {
      this.context.setLineDash = function () {}
    }

    // Set up scales for plot area
    this.scaled_height = JSV.pixel(this.height - this.axis_x_gutter);
    this.scaled_width  = JSV.pixel(this.width - this.axis_y_gutter);

    // Scale hold the current x/y scales
    // NOTE: to reverse axis, reverse the ranges
    this.scale = new JSV.SVScale();
    this.scale.y.range(this.y_range());
    // this.axis_x_reverse = false
    this.scale.x.range(this.x_range());

    // boundary hold the domain extents
    this.boundary = new JSV.SVScale();
    this.boundary.x.range(this.x_range());
    this.boundary.y.range(this.y_range());
    this.boundary.clamp(true);
    // Set minimun boundaries
    if (this.min_boundaries) {
      this.boundary.update(this.min_boundaries);
      this.scale.update(this.min_boundaries);
    }

    // Initialize containers
    this._spectra = new JSV.SVSet();


    // Create SVG overlay
    this.svg = this.sv_wrapper.append('svg')
        .attr('width', this.width)
        .attr('height', this.height)
        .attr('class', 'svg-viewer')
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', 0);

    // Set cursor for svg
    this.svg.style('cursor', 'all-scroll');

    //TODO: change drag drop options to: none, replace, add
    // This option must be set after the svg is set up
    this.drag_drop_load = JSV.default_for(options.drag_drop_load, true);

    this.initialize_zooming();
    this.initialize_dragging();
    sv.legend = new JSV.SVLegend(sv);

    // Add keyboard callback
    // d3v7.select(window)
    //   .on("keydown", function() { if (sv.contains_mouse) sv.keydown() })
    //   .on("keyup",   function() { sv.keyup() });
    d3v7.select(window)
        .on("keydown", sv.keydown)
        .on("keyup",   sv.keyup);

    this.svg.on('mousemove', function(event) {
      const pos = d3v7.pointer(event);
      sv.mx = sv.scale.x.invert(JSV.pixel(pos[0]))
      sv.my = sv.scale.y.invert(JSV.pixel(pos[1]))
      // console.log([sv.mx, sv.my]);
      sv.highlight.hover();
      sv.annotation.check_hover();
    });

    this.svg.on('mouseover', function() {
      sv.contains_mouse = true;
      // Remove focus from other elements (e.g. NMRLib editor), so that
      // pressing keys like 'a' or 's' do not continue typing in other elements.
      document.activeElement.blur();
    });

    this.svg.on('mouseout', function() {
      sv.contains_mouse = false;
    });

    // Setup SVEvents
    this.handlers = new JSV.SVEvents();
    this.on = this.handlers.on
    this.off = this.handlers.off
    this.trigger = this.handlers.trigger

    if (this.drag_drop_load) { this.initialize_drag_drop_load(); }

    this.selection = new JSV.SVSelection(this, JSV.default_for(options.select, {}));

    // Initialize Labels
    this.annotation = new JSV.SVAnnotation(sv);

    // Initialize Zoom Box
    this.zoombox = new JSV.ZoomBox(sv);
    this.zoombox.visible = this.zoombox_show;

    // This option must be set after sv_wrapper and zoombox
    this.highlight = new JSV.SVHighlighter(this, JSV.default_for(options.highlight, {}));

    // Initialize Menu
    this.menu = new JSV.SVMenu(sv);

    // Initialize Help
    this.help = new JSV.SVHelp(sv);


    this.initial_settings();

    this.cluster_navigation_id = options.cluster_navigation_id;

    // Initialize Structure Viewer
    if (options.structure) {
      this.structure = new JSV.SVStructure(options.structure);
    }

    // Initialize Assignment Table
    if (options.assignment_table) {
      this.assignment_table = new JSV.SVAssignments(sv, options.assignment_table);
    }


    JSV._viewers.push(this);

    // Draw viewer
    this.draw();
  }

  SpectraViewer.prototype.toString = function() { return 'SpectraViewer' }

  /////////////////////////////////////////////////////////////////////////////
  // SpectraViewer Properties (setters/getters)
  /////////////////////////////////////////////////////////////////////////////
  Object.defineProperties(SpectraViewer.prototype, {
    'drag_drop_load': {
      get: function() { return this._drag_drop_load; },
      set: function(val) {
        this._drag_drop_load = val;
        if (this._drag_drop_load) {
          this.initialize_drag_drop_load();
        } else {
          this.svg.on('.dragndrop', null);
        }
      }
    },
    'cluster_navigation_id': {
      get: function() { return this._cluster_navigation_id; },
      set: function(val) {
        this._cluster_navigation_id = val;
        if (this._cluster_navigation_id) {
          this._cluster_navigation = new JSV.SVClusterNavigator(this, val);
        } else {
          if (this._cluster_navigation) {
            this._cluster_navigation.detach();
            this._cluster_navigation = undefined;
          }
        }
      }
    },
    'structure_viewer_id': {
      get: function() { return this._structure_viewer_id; },
      set: function(val) {
        this._structure_viewer_id = val;
        if (this._structure_viewer_id) {
          this._structure_viewer = new JSV.SVStructure(this, val);
        } else {
          if (this._structure_viewer) {
            this._structure_viewer.detach();
            this._structure_viewer = undefined;
          }
        }
      }
    }
    // 'zoombox_show': {
    //   get: function() { return this.zoombox.visible; },
    //   set: function(val) {
    //     this.zoombox.visible = val
    //   }
    // }
  });

  SpectraViewer.prototype.x_range = function(width) {
    width = width || this.width;
    const scaled_width = JSV.pixel(width - this.axis_y_gutter);
    return this.axis_x_reverse ?
        [scaled_width, 0] :
        [JSV.pixel(this.axis_y_gutter), JSV.pixel(width)];
  }

  SpectraViewer.prototype.y_range = function() {
    return this.axis_y_reverse ?
        [0, this.scaled_height] :
        [this.scaled_height, 0];
  }

  /**
   * Resizes the SpectraViewer
   *
   * @param {Number} width New width
   * @param {Number} height New height
   * @param {Boolean} fast After resize, should the spectra be draw redrawn fast.
   */
  SpectraViewer.prototype.resize = function(width, height, fast) {
    this.width = width || this.width;
    this.height = height || this.height;

    this.container
        .style('width', this.width + 'px');
    d3v7.select(this.canvas)
        .attr('width', this.width)
        .attr('height', this.height);
    this.font = this.adjust_font();
    this.axis_title_font = this.adjust_font(1, undefined, 'bold');
    this.scaled_height = JSV.pixel(this.height - this.axis_x_gutter);
    this.scaled_width  = JSV.pixel(this.width - this.axis_y_gutter);
    this.scale.y.range(this.y_range());
    this.boundary.y.range(this.y_range());
    this.scale.x.range(this.x_range());
    this.boundary.x.range(this.x_range());

    this.svg.attr('width', this.width).attr('height', this.height);
    JSV.scale_resolution(this.canvas, JSV.pixel_ratio);
    this.zoombox.update();
    this.legend.update();
    this.draw(fast);
  }

  SpectraViewer.prototype.keyval = function() {
    return d3v7.select('.sv-key-down').html();
  }


  d3v7.selection.prototype.moveToFront = function() {
    return this.each(function() {
      this.parentNode.appendChild(this);
    });
  };

  SpectraViewer.prototype.keydown = function(event) {
    // This has to be done globally on all viewers
    if (event[this.zoom_brush_key]) {
      d3v7.selectAll('.sv-wrapper .svg-viewer').style('cursor', 'crosshair');
      // d3v7.selectAll('.zoom-brush').moveToFront();
    }
    d3v7.selectAll('.sv-key-down').html(event.keyCode);
    // console.log(d3v7.event);
  }

  SpectraViewer.prototype.keyup = function(event) {
    // 16 is shift
    if (event.keyCode == 16) {
      d3v7.selectAll('.sv-wrapper .svg-viewer').style('cursor', 'all-scroll');
      // d3v7.selectAll('.select-brush').moveToFront();
    }
    // Test external custom cursor
    // d3v7.selectAll('.sv-wrapper .svg-viewer').style('cursor', "url('http://www.javascriptkit.com/dhtmltutors/cursor-hand.gif'), 'pointer'");
    d3v7.selectAll('.sv-key-down').html('');
  }


  SpectraViewer.prototype.pixels_to_units_of_axis = function(axis, number_of_pixels) {
    const sv = this;
    return sv.scale[axis].invert(JSV.pixel(number_of_pixels)) - sv.scale[axis].invert(0);
  }


  // Change the zoom axis and zoom scale to the current zoom level if the axis is changing
  SpectraViewer.prototype.set_zoom_axis = function(zoom_y_key_down, event) {
    if (zoom_y_key_down) {
      if (this.zoom_axis != 'y') {
        this.zoom_axis = 'y';
        //this.zoom_behavior.scale(this.zoom_y);
        this.set_zoom_cursor(zoom_y_key_down);
      }
    } else {
      if (this.zoom_axis != 'x') {
        this.zoom_axis = 'x';
        //this.zoom_behavior.scale(this.zoom_x);
        this.set_zoom_cursor(zoom_y_key_down);
      }
    }
  }

  SpectraViewer.prototype.set_zoom_cursor = function(zoom_y_key_down) {
    if (zoom_y_key_down) {
      this.svg.style('cursor', 'ns-resize');
    } else {
      this.svg.style('cursor', 'ew-resize');
    }
  }

  // Zoom the spectra for the supplied axis based on the current zoom level.
  // - axis: either 'x' or 'y'
  // - zoom: zoom level for the axis
  SpectraViewer.prototype.scale_axis = function(axis, zoom_level, event) {
    // Calculate the difference between min and max values on axis after zooming
    const axis_diff = Math.abs(this.boundary[axis].domain()[0] - this.boundary[axis].domain()[1]) / zoom_level;
    // Value of axis at the mouse position
    const mouse_index = axis === 'x' ? 0 : 1;
    let value = this.scale[axis].invert(this.mouse(event, this.canvas)[mouse_index]);
    // Calculate the ratio the mouse position is along the axis
    let axis_ratio = (value - this.scale[axis].domain()[0]) / Math.abs(this.scale[axis].domain()[0] - this.scale[axis].domain()[1]);

    // Constrain y zooming so that y domain minimum stays constant
    if (axis == 'y') {
      axis_ratio = 0;
      value = this.scale.y.domain()[0];
    }

    // Initially set the zoomed domain using the axis ratio
    const domain = [value - (axis_diff * axis_ratio), value + (axis_diff * (1 - axis_ratio))];
    this.scale[axis].domain(domain);

    // Update the domain making sure they are within the boundaries
    this.set_domain(axis, domain);

    // Save zoom level
    // this['zoom_' + axis] = zoom_level

    // DEBUG INFO
    if (this.debug) {
      axis = axis.toUpperCase();
      this.debug_data.zoom['d' + axis]  = JSV.round(axis_diff);
      this.debug_data.zoom['v' + axis]  = JSV.round(value);
      this.debug_data.zoom['r' + axis]  = JSV.round(axis_ratio);
    }
  }

  // Get mouse position in the 'container' taking into account the pixel ratio
  SpectraViewer.prototype.mouse = function(event, container) {
    return d3v7.pointer(event, container).map(function(p) { return JSV.pixel(p); });
  }

  // Translates the spectra for the supplied axis.
  // - axis: either 'x' or 'y'
  // - translation: number of pixels to move the specta  on the axis
  SpectraViewer.prototype.translate_axis = function(axis, translation) {
    // Calculate new domain based on translation
    const domain = this.scale[axis].range().map(function (r) {
      return r - JSV.pixel(translation);
    }).map(this.scale[axis].invert);
    this.set_domain(axis, domain);
  }

  // http://bl.ocks.org/mbostock/5731979
  /**
   * Move from the current x,y domain to the supplied x/y domain using a transition.
   *
   * @param {Array} domains 2D array containing the min/max for the new X/Y domains:
   *   [ [Xmin, Xmax], [Ymin, Ymax] ]
   * @param {Number} duration Time of move transition in milliseconds
   */
  SpectraViewer.prototype.move_to = function(domains, duration) {
    const sv = this;
    duration = duration || 500;
    // Change Ymin to boundaries Ymin if the y axis is locked
    if (this.axis_y_lock !== false) {
      domains[1][0] = this.axis_y_lock_value(domains[1]);
    }
    // Flatten 2D domain arrays so they have the format: [Xmin, Xmax, Ymin, Ymax]
    let end_domains = [];
    let start_domains = [];
    end_domains = end_domains.concat.apply(end_domains, domains);
    start_domains = start_domains.concat
        .apply(start_domains, [sv.scale.x.domain(), sv.scale.y.domain()]);

    d3v7.select(this.canvas).transition()
        .duration(duration)
        .tween('move', function() {
          const interm_domains = d3v7.interpolateArray(start_domains, end_domains);
          return function(t) {
            sv.set_domain('x', [interm_domains(t)[0], interm_domains(t)[1]]);
            sv.set_domain('y', [interm_domains(t)[2], interm_domains(t)[3]]);
            sv.fast_draw();
          }
        }).on('end', function() { sv.full_draw(); });
    // Reset zoom axis
    sv.zoom_axis = '';
  }

  // Sets the domain (mininum and maximum value) for the supplied axis
  // after adjusting the domain to make sure it is within the boundaries of
  // the plot. Also adjusts the domain based on max_zoom.
  // - axis: either 'x' or 'y'
  // - domain: array with 2 elements, the min and max value for the domain
  SpectraViewer.prototype.set_domain = function(axis, domain) {
    const scale = this.scale;
    const boundary = this.boundary;


    // Determine boundary domain (difference between min and max values on the axis)
    const boundary_diff = Math.abs(boundary[axis].domain()[1] - boundary[axis].domain()[0]);
    // Determine visible domain (difference between min and max values on the axis)
    let domain_diff = Math.abs(domain[1] - domain[0]);

    // Optionally lock minimum domain value to minimum boundary value
    if ( (axis == 'y') && (this['axis_y_lock'] !== false) ) {
      domain[0] = this.axis_y_lock_value(domain);
      domain[1] = domain[0] + domain_diff;
    }

    // Changing the domain may change the zoom level
    // Check that the zoom is not above the max
    let new_zoom = boundary_diff / domain_diff;
    if (new_zoom > this.zoom_max) {
      new_zoom = this.zoom_max;
      const old_domain_diff = domain_diff;
      domain_diff = boundary_diff / new_zoom;
      // Center the domain
      const center = (domain[0] + domain[1]) / 2;
      domain[0] = center - (domain_diff / 2);
      domain[1] = domain[0] + domain_diff;
      if (this.debug) {
        this.debug_data.zoom['center-' + axis] = JSV.round(center);
        this.debug_data.zoom['domain-diff-' + axis] = JSV.round(domain_diff);
      }
    }
    // Check that the zoom is not below 1
    if (new_zoom < 1) {
      new_zoom = 1;
      domain_diff = boundary_diff / new_zoom;
      domain[0] = boundary[axis].min();
      domain[1] = boundary[axis].max();
    }
    if (this['zoom_' + axis] != new_zoom) {
      this['zoom_' + axis] = new_zoom;
      this.trigger('zoom');
    }

    // Check that domain is within the plot boundaries
    if (domain[0] < boundary[axis].domain()[0]) {
      domain[0] = boundary[axis].domain()[0];
      domain[1] = domain[0] + domain_diff;
    } else  if (domain[1] > boundary[axis].domain()[1]) {
      domain[1] = boundary[axis].domain()[1];
      domain[0] = domain[1] - domain_diff;
    }

    // Set domain
    this.scale[axis].domain(domain);
    this.trigger('domain-change');
  }

  SpectraViewer.prototype.axis_y_lock_value = function(domain) {
    if (this.axis_y_lock === true) {
      return this.boundary.y.domain()[0];
    } else {
      const domain_diff = Math.abs(domain[1] - domain[0]);
      return 0 - domain_diff * this.axis_y_lock;
    }
  }

  /**
   * Zoom the Viewer out completely
   */
  SpectraViewer.prototype.zoom_out_completely = function() {
    this.move_to([this.boundary.x.domain(), this.boundary.y.domain()])
    this.scale.x.domain(this.boundary.x.domain());
    this.scale.y.domain(this.boundary.y.domain());
    this.zoom_x = 1;
    this.zoom_y = 1;
  }


  /**
   * Adds a new spectrum to the viewer using the data provided. The _data_
   * can be a previously generated [Spectrum](Spectrum.js.html) or the data that will be
   * passed on to create a new [Spectrum](Spectrum.js.html).
   * Example Data:
   * ```javascript
   * data = {
   *   // ID to identify the spectrum. Defaults to spectrum_1, spectrum2, etc.
   *   id: 'fit',
   *   // Name displayed in legend. Defaults to the id.
   *   name: 'My Spectrum',
   *   // One of the following must be provided to create a Spectrum.
   *   // If more than one is provided, only one will be used and they are prioritized in
   *   // order shown. Details on each data type can be found below.
   *   compounds: compound_data,
   *   peak_list: peak_data,
   *   xy_line: xy_data,
   *   // Optional display options
   *   display: {color: 'blue', lineWidth: 3},
   *   // Optional meta data. Accessible through the spectrum's meta property.
   *   meta: {extra_info: 'This spectrum is really good!'},
   *   // Optional annotation data. Accessible through the spectrum's labels property
   *   // See below for details
   *   labels: labels
   * }
   *
   * // Describes one or more compounds
   * compound_data = [
   *   {
   *     id: 'HMDB01659',
   *     name: 'Acetone',
   *     concentration: '50',
   *     clusters: [
   *       {
   *         peaks: [
   *           { center: 2.22, amplitude: 0.6, width: 0.005 }
   *         ]
   *       }
   *     ]
   *   }
   * ]
   *
   * // A simple peak list
   * peak_data = [
   *   { center: 3.2, amplitude: 1.1, width: 0.05 },
   *   { center: 5.1, amplitude: 1.3, width: 0.05 },
   *   { center: 4.5, amplitude: 0.6, width: 0.04 }
   * ]
   *
   * // xy_data can be one of two formats:
   * // An object with x and y arrays [Better]
   * xy_data = {
   *   x: [1, 2, 3],
   *   y: [0.5, 0.4, 0.3]
   * }
   *
   * // To reduce JSON download size, previously loaded spectrum data can be used for the x array.
   * // In this case a spectrum with the id 'my_spectrum' should already be loaded in the viewer.
   * xy_data = {
   *   x: 'my_spectrum',
   *   y: [0.5, 0.4, 0.3]
   * }
   *
   *
   * // An array of x and y points [Deprecated]
   * xy_data = [
   *   {x: 1, y: 0.5}, {x: 2, y: 0.4}, {x: 3, y: 0.3}
   * ]
   *
   * // Annotation labels: array of label objects
   * labels = [
   *   { x: 1,
   *     y: 1,
   *     text: 'my_label',
   *     display: { vertical: true, font_size: 12 }, // optional
   *     meta: { something_useful: 'value' } // optional
   *   }
   * ]
   * ```
   * @param {Object} data Data required to create a new [Spectrum](Spectrum.js.html).
   *   Data can also be a Spectrum object, in which case, _display_ and _meta_ are ignored.
   * @param {Object} display Display options as described in [SVPath](SVPath.js.html)
   * @param {Object} meta User-defined properties
   */
  SpectraViewer.prototype.add_spectrum = function(data, display, meta) {
    const start_time = new Date().getTime();

    //FIXME: Should be done elsewhere and in a better way
    // Determine max number of points from current spectra
    // This is used to draw spectra from peak data
    let max_points = d3v7.max(this.spectra().map(function (spectrum) {
      return spectrum.xy_data.length()
    }));
    if (!max_points) max_points = 40000;
    this.points_per_ppm = max_points / (this.boundary.x.domain()[1] - this.boundary.x.domain()[0]);

    data.tolerance = JSV.default_for(data.tolerance, this.simplify_tolerance);
    data.number_of_points = JSV.default_for(data.number_of_points, max_points);
    data.min_x = JSV.default_for(data.min_x, this.boundary.x.domain()[0]);
    data.max_x = JSV.default_for(data.max_x, this.boundary.x.domain()[1]);
    const current_ids = this.all_spectra().map(function (spectrum) {
      return spectrum.name;
    });
    data.id = JSV.default_for(data.id, JSV.unique_id('Spectrum_', 1, current_ids));

    // If a spectrum ID is provided for x data, use that spectrums x data
    if ( data.xy_line && (typeof data.xy_line.x == 'string') ) {
      const x_id = data.xy_line.x;
      if ( this.spectra(x_id) ) {
        data.xy_line.x = this.spectra(x_id).xy_data.x;
      } else {
        throw new Error("There is no spectrum with the id provided by '" + data.id + "' xy_line.x:" + x_id);
      }
    }

    // === MS-PORT: dispatch to SpectrumEIMS for MS chart types ===
    let spectrum;
    if (data.toString() == 'Spectrum') {
      spectrum = data;
    } else if (this.chart_type === '1D-EIMS' || this.chart_type === '1D-LCMS') {
      spectrum = new JSV.SpectrumEIMS(data, display, meta);
    } else {
      spectrum = new JSV.Spectrum(data, display, meta);
    }
    spectrum._sv = this;

    this._spectra.push(spectrum);
    this.boundary.update(spectrum.xy_data);
    this.scale.update(spectrum.xy_data);
    this.zoombox.update();
    this.legend.update();
    if (this.debug) {
      this.debug_data.time[data.id + '~add'] = JSV.elapsed_time(start_time);
      this.debug_data.data[data.id + '~noise'] = spectrum.noise;
      this.debug_data.data[data.id + '~points-all'] = spectrum.xy_data.length();
      this.debug_data.data[data.id + '~points-simple'] = spectrum.simple_xy_data.length();
    }
    this.draw();
  }

  /**
   * Add the processed spectra and the compound fit generated by Bayesil
   * @param {Object} data Bayesil results.json data
   */
  SpectraViewer.prototype.add_bayesil_data = function(data) {
    this.add_spectrum( { id: 'Spectrum', xy_line: data.spectrum_xy }, undefined, data.meta);
    this.add_spectrum( JSV.convert_bayesil_data(data) );
  }

  /**
   * Remove all the spectra before adding the Bayesil _data_.
   *
   * @param {Object} data Bayesil results.json data
   * @param {Boolean} keep_domains If true, keep the Viewer at the same position on the x/y axes
   */
  SpectraViewer.prototype.replace_bayesil_data = function(data, keep_domains) {
    const sv = this;
    const saved_domains = [sv.scale.x.domain(), sv.scale.y.domain()];
    const viewer_was_not_empty = sv.spectra().length > 0;
    sv.remove_all_spectra();
    sv.add_bayesil_data(data);
    // if (json_parsed.fit_xy) {
    //   sv.add_spectrum({ id: 'FIT', xy_line: json_parsed.fit_xy}, {color: 'orange'});
    // }
    if (viewer_was_not_empty && keep_domains)  {
      sv.set_domain('x', saved_domains[0]);
      sv.set_domain('y', saved_domains[1]);
    }
    sv.draw();
  }

  /**
   * Read and add the data from an nmrML file. JSV will read the structure, assignments and spectrum xy data.
   * This method is not meant to read nmrML-Quant
   *
   * @param {Object} nmrml nmrML data in text format
   */
  SpectraViewer.prototype.add_nmrml_data = function(nmrml, source="experimental") {
    const xy_data = {x: [], y: []};
    if(!["experimental", "predicted", "simulated"].includes(source) ){
      console.error("Spectra source not recognized")
    } else {
      const sv = this;
      if (!window.X2JS) {
        console.log("X2JS needs to be installed to read nmrML: https://github.com/abdmob/x2js");
        return
      }


      // Add Spectrum XY plot
      const data_array_match = nmrml.match(/<spectrumDataArray.*compressed="(true|false)"[^]*>(.*)<\/spectrumDataArray>/);
      if (data_array_match) {
        const compressed = (data_array_match[1] == 'true');
        const encoded_data = data_array_match[2];
        const xy_array = JSV.convert_base64_to_float64(encoded_data, compressed);
        let maxY = xy_array[1];
        for (let i = 0; i < xy_array.length; i += 2) {
          xy_data.x.push(xy_array[i]);
          xy_data.y.push(xy_array[i + 1]);

          maxY = (xy_array[i + 1] > maxY) ? xy_array[i + 1] : maxY;
        }
        const scale_factor = 1 / maxY;
        xy_data.y = xy_data.y.map(function (x) {
          return x * scale_factor;
        });
        sv.add_spectrum({id: "Experimental", name: 'Experimental', display: {color: 'black', visible: true}, xy_line: xy_data});
      }
      else {
        console.log("No Spectrum Data Array found")
      }
      // Extract part of nmrML of interest
      const atom_assignment_match = nmrml.match(/<atomAssignment[^]*<\/atomAssignment>/);
      let atom_assignment;
      if (atom_assignment_match) {
        atom_assignment = atom_assignment_match[0];
      } else {
        console.log("Could not read nmrML. No <atomAssignment> tag found.");
        return
      }
      // Create structure
      const structure_match = atom_assignment.match(/<structure[^]*<\/structure>/);
      if (sv.structure && structure_match) {
        const name_match = atom_assignment.match(/<identifier.*name="(.*?)"/);
        if (name_match) {
          sv.structure.title = name_match[1];
        }
        sv.structure.read_nmrml(structure_match[0]);
      }
      // Determine NMR type (e.g. 13C or 1H)
      const nucleus_match = nmrml.match(/acquisitionNucleus.*name=\"(.*?)\"/);
      if (sv.assignment_table && nucleus_match) {
        const nucleus = nucleus_match[1];
        if (nucleus.match(/hydrogen/i) || nucleus.match(/1H/i)) {
          sv.assignment_table.nmr_nucleus = '1H';
        } else if (nucleus.match(/carbon/i) || nucleus.match(/13C/i)) {
          sv.assignment_table.nmr_nucleus = '13C';
        }
      }
      // Create Compound
      const x2js = new X2JS();
      const json = x2js.xml_str2json(atom_assignment);
      let name;
      try {
        name = json.atomAssignment.chemicalCompound.identifierList.identifier._name;
      } catch(err){
        console.error("nmrML contains no compound identifier")
        name = "Compound";
      }
      const compound = {name: name};
      const clusters = [];
      let multiplet_list = json.atomAssignment.atomAssignmentList.multiplet;
      if (multiplet_list) {
        multiplet_list = Array.isArray(multiplet_list) ? multiplet_list : [multiplet_list];

        // create a the scale for simulated peaks
        let all_amps = multiplet_list.map((multiplet) => {
          let peak_list = multiplet.peakList.peak
          peak_list = Array.isArray(peak_list) ? peak_list : [peak_list];
          return peak_list.map((p) =>  parseFloat(p._amplitude))
        });
        all_amps = all_amps.flat()
        let y_data_min = xy_data.y[0]
        let y_data_max = xy_data.y[0]
        xy_data.y.forEach(function(val){
          y_data_min = Math.min(val, y_data_min);
          y_data_max = Math.max(val, y_data_max);
        });
        let peaks_scaler = d3v7.scaleLinear()
            .domain([Math.min(0, Math.min(...all_amps)), Math.max(...all_amps)])
            .range([y_data_min, y_data_max])
        multiplet_list.forEach(function (multiplet, index) {
          const peaks = [];
          let peak_list = multiplet.peakList.peak;
          peak_list = Array.isArray(peak_list) ? peak_list : [peak_list];
          peak_list.forEach((peak) => {
            let amplitude = peaks_scaler(parseFloat(peak._amplitude))
            peak = {
              center: parseFloat(peak._center),
              amplitude: amplitude
            };
            peak.width = parseFloat(peak._width) || 0.005;
            peaks.push(peak);
          });
          // nmrml_cluster_index is used to find the right cluster when adding atoms below
          clusters.push({peaks: peaks, meta: {nmrml_cluster_index: index}});
        });
      }
      compound.clusters = clusters;
      let label = "Simulated";
      let visible = false;

      if(source === "predicted"){
        visible = true;
        label = "Predicted/Simulated"
      } else if (source === "simulated"){
        visible = true
      }

      sv.add_spectrum({id: "Simulated", name: label, display: {color: 'blue', visible: visible}, compounds: [compound]});
      // Read assignments
      if (sv.structure && multiplet_list) {
        const compound_clusters = sv.compounds(sv.compounds().length).clusters();
        multiplet_list.forEach( (multiplet, index) => {
          const compound_cluster = compound_clusters.find( (c) => {
            return c.meta.nmrml_cluster_index === index;
          });
          if (multiplet.atoms && compound_cluster) {
            let atom_ids = [];
            const atom_refs = multiplet.atoms._atomRefs;
            if (atom_refs && atom_refs.match(/\w/)) {
              atom_ids = atom_refs.trim().split(/\s+/);
            }
            atom_ids.forEach((atom_id, index) => atom_ids[index] = atom_id.replace(/\D/g,''))
            compound_cluster.atom_refs = atom_ids;
            compound_cluster._atoms.merge(sv.structure.atoms(atom_ids));

            switch (multiplet.multiplicity._name.toLowerCase()) {
              case 'singlet feature':
                compound_cluster.multiplet_type = 's';
                break;
              case 'doublet feature':
                compound_cluster.multiplet_type = 'd';
                break;
              case 'triplet feature':
                compound_cluster.multiplet_type = 't';
                break;
              case 'quartet feature':
                compound_cluster.multiplet_type = 'q';
                break;
              case 'doublet of doublets feature':
                compound_cluster.multiplet_type = 'dd';
                break;
              case 'doublet of doublet of doublets feature':
                compound_cluster.multiplet_type = 'ddd';
                break;
              case 'doublet of doublet of doublets of doublets feature':
                compound_cluster.multiplet_type = 'dddd';
                break;
              case 'triplet of doublets feature':
                compound_cluster.multiplet_type = 'td';
                break;
              case 'doublet of triplets feature':
                compound_cluster.multiplet_type = 'dt';
                break;
              case 'triplet of triplets feature':
                compound_cluster.multiplet_type = 'tt';
                break;
              case 'doublet of quartets feature':
                compound_cluster.multiplet_type = 'dq';
                break;
              case 'doublet of doublet of triplets feature':
                compound_cluster.multiplet_type = 'ddt';
                break;
              case 'doublet of triplet of doublets feature':
                compound_cluster.multiplet_type = 'dtd';
                break;
              case 'triplet of doublets of doublets feature':
                compound_cluster.multiplet_type = 'tdd';
                break;
              case 'quintet feature':
                compound_cluster.multiplet_type = 'quint';
                break;
              case 'multiplet feature':
                compound_cluster.multiplet_type = 'm';
                break;
            }

            // look elsewhere for the multiplicity
            if (!compound_cluster.hasOwnProperty('multiplet_type')){
              switch (multiplet.multiplicity._accession) {
                case 'NMR:1000194':
                  compound_cluster.multiplet_type = 's';
                  break;
                case 'NMR:1000184':
                  compound_cluster.multiplet_type = 'd';
                  break;
                case 'NMR:1000185':
                  compound_cluster.multiplet_type = 't';
                  break;
                case 'NMR:1000186':
                  compound_cluster.multiplet_type = 'q';
                  break;
                case 'NMR:1000192':
                  compound_cluster.multiplet_type = 'dd';
                  break;
                case 'NMR:1000195':
                  compound_cluster.multiplet_type = 'qunit';
                  break;
                case 'NMR:1000196':
                  compound_cluster.multiplet_type = 'dt';
                  break;
                case 'NMR:1000197':
                  compound_cluster.multiplet_type = 'td';
                  break;
                case 'NMR:1400305':
                  compound_cluster.multiplet_type = 'm';
                  break;
              }
            }
          }
        });
      }

      if(source !== 'experimental'){
        sv.remove_spectra("Experimental")
      }
      sv.spectra("Simulated").labels.update_peaks();
      sv.trigger('adjust-end') // updates Assignment table (NEED BETTER WAY)
    }
  }

  SpectraViewer.prototype.add_spin_matrix_data = function(spin_matrix_json){
    const sv = this;
    const json = JSON.parse(spin_matrix_json);

    const experimental_xy_data = json.spectrum.spectrum_xy;
    const fit_xy_data = json.fit.spectrum_xy;

    sv.add_spectrum({
      id: "Experimental",
      name: 'Experimental',
      display: {color: 'black', visible: true},
      xy_line: experimental_xy_data
    })

    sv.add_spectrum({
      id: "Fit",
      name: 'Fit',
      display: {color: 'blue', visible: true},
      xy_line: fit_xy_data
    })
  }

  SpectraViewer.prototype.add_ir_data = function(ir_xml){
    const sv = this;
    const x2js = new X2JS();
    const json = x2js.xml_str2json(ir_xml);

    if (json.hasOwnProperty("ms-ir") || json.hasOwnProperty('ms-ir-comp')) {
      const data = json.hasOwnProperty("ms-ir") ? json["ms-ir"] : json['ms-ir-comp'];

      if (data.hasOwnProperty('x-units')) sv.axis_x_title = data["x-units"];
      if (data.hasOwnProperty('y-units')) sv.axis_y_title = data["y-units"];


      let spectrum_data;
      if (json.hasOwnProperty("ms-ir")){
        spectrum_data = data["ms-ir-spectrum"].split('\n');
      } else {
        spectrum_data = data["convoluted-ir"].split('\n');
      }
      const xy_data = {x: [], y: []};
      for(let coords of spectrum_data){
        coords =  coords.split(' ');
        xy_data["x"].push(parseFloat(coords[0]));
        xy_data["y"].push(parseFloat(coords[1]));
      }

      const spec_type = json.hasOwnProperty("ms-ir") ? 'Experimental' : 'Predicted';

      sv.add_spectrum({
        // max_x: 1900,
        // min_x: 580,
        id: spec_type,
        name: spec_type,
        display: {color: 'black', visible: true},
        xy_line: xy_data
      });

      sv.full_draw();
    } else{
      console.error("Could not find IR data")
    }
  }

  /**
   * Remove all the spectrum with the specified _id_ from the viewer.
   *
   * @param {Number} id ID of spectrum to remove
   */
  SpectraViewer.prototype.remove_spectra = function(id) {
    this._spectra = new JSV.SVSet( this._spectra.filter(function(spectrum) { return spectrum.id != id; }) );
    this.zoombox.remove_spectra(id);
    this.legend.update();
  }

  /**
   * Remove all the spectra from the viewer
   */
  SpectraViewer.prototype.remove_all_spectra = function() {
    const sv = this;
    sv.selection.clear();
    this.all_spectra().forEach(function(spectrum) { sv.remove_spectra(spectrum.id) });
    sv.reset_boundaries();
  }

  SpectraViewer.prototype.reset_boundaries = function() {
    const sv = this;
    sv.selection.clear();
    sv.boundary.initialized = false
    sv.scale.initialized = false
    if (sv.min_boundaries) {
      sv.boundary.update(sv.min_boundaries);
      sv.scale.update(sv.min_boundaries);
    } else {
      sv.boundary.update({ x: [0, 1], y: [0, 1] })
      sv.scale.update({ x: [0, 1], y: [0, 1] })
    }
  }

  /**
   * Returns an [SVSet](SVSet.js.html) of Spectra or a single Spectrum from the viewer.
   * If no term is given, only **active** spectra are returned.
   * Otherwise all spectra will be search with the _term_.
   * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
   * @return {SVSet|or|Spectrum}
   */
  SpectraViewer.prototype.spectra = function(term) {
    if (term) return this._spectra.get(term);
    const active_spectra = new JSV.SVSet(this._spectra.filter(function (s) {
      return s.active;
    }));
    return active_spectra.get(term);
  }

  /**
   * Returns an [SVSet](SVSet.js.html) of Spectra or a single Spectrum from the viewer.
   * This metod is the same as [SpectraViewer.spectra](SpectraViewer.js.html#spectra), except that if no
   * _term_ is given all spectra are returned, including inactive ones.
   *
   * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
   * @return {SVSet|or|Spectrum}
   */
  SpectraViewer.prototype.all_spectra = function(term) {
    return this._spectra.get(term);
  }

  /**
   * Returns an [SVSet](SVSet.js.html) of Compounds or a single Compound from all the Spectra in the viewer.
   * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
   * @return {SVSet|or|Compound}
   */
  SpectraViewer.prototype.compounds = function(term) {
    const compounds = new JSV.SVSet();
    let i = 0;
    const len = this._spectra.length;
    for (; i < len; i++) {
      compounds.merge(this._spectra[i].compounds());
    }
    return compounds.get(term);
  }

  /**
   * Returns an [SVSet](SVSet.js.html) of Clusters or a single Cluster from all the Spectra in the viewer.
   * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
   * @return {SVSet|or|Cluster}
   */
  SpectraViewer.prototype.clusters = function(term) {
    const clusters = new JSV.SVSet();
    let i = 0;
    const len = this._spectra.length;
    for (; i < len; i++) {
      clusters.merge(this._spectra[i].clusters());
    }
    return clusters.get(term);
  }

  /**
   * Returns an [SVSet](SVSet.js.html) of Peaks or a single Peak from all the Spectra in the viewer.
   * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
   * @return {SVSet|or|Peak}
   */
  SpectraViewer.prototype.peaks = function(term) {
    const peaks = new JSV.SVSet();
    let i = 0;
    const len = this._spectra.length;
    for (; i < len; i++) {
      peaks.merge(this._spectra[i].peaks());
    }
    return peaks.get(term);
  }

  /**
   * Clear the viewer canvas
   */
  SpectraViewer.prototype.clear = function() {
    this.context.clearRect(0, 0, JSV.pixel(this.width), JSV.pixel(this.height));
  }

  /**
   * Draws the contents of the viewer. This method should rarely be called directly.
   * Instead use, the convenience methods that call it:
   *
   *  - [SpectraViewer.full_draw](SpectraViewer.js.html#full_draw)
   *  - [SpectraViewer.calc_draw](SpectraViewer.js.html#calc_draw)
   *
   * @param {Boolean} fast If true, use simplified XY data if available
   * @param {Boolean} caculated If true, calculate XY data instead of using precomputed XY data.
   * @param {Number} pixel_skip If true, when calculating XY data skip this number of pixels between X values
   */
  SpectraViewer.prototype.draw = function(fast, calculated, pixel_skip) {
    const start_time = new Date().getTime();
    const sv = this;
    fast = fast || false
    const context = this.context;
    const scale = this.scale;
    this.clear();
    // Draw Grid lines
    if (this.axis_y_grid) this.draw_grid_lines('y');
    if (this.axis_x_grid) this.draw_grid_lines('x');
    this.spectra().forEach(function(spectrum) {
      // Draw compounds
      spectrum.compounds().draw(context, scale, fast, calculated, pixel_skip);
      // Draw clusters
      spectrum.clusters().draw(context, scale, fast, calculated, pixel_skip);
      // Draw peaks
      spectrum.peaks().draw(context, scale, fast, true, pixel_skip);
      // Draw spectra
      spectrum.draw(context, scale, fast, calculated, pixel_skip);
    });
    // Draw selection
    this.selection.draw(context, scale, fast, calculated, pixel_skip);
    this.zoombox.set_zoom_area(this.scale);
    // Draw labels
    this.annotation.draw();
    if (this.legend_show) this.legend.draw();
    this.draw_axes();
    this.selection.draw_bounds(context, scale);
    this.selection.draw_indicators(context, scale);
    if (this.debug) {
      this.debug_data.time['draw'] = JSV.elapsed_time(start_time);
      this.draw_debug(this.legend.bottom());
    }
  }

  /**
   * Draw using the full data (not simplified).
   * If zoomed in enough so that the number of points in the spectra
   * is less than the number of pixels in the viewer then then lines
   * will be calculated if possible.
   */
  SpectraViewer.prototype.full_draw = function() {
    const ppm_range = this.scale.x.domain()[1] - this.scale.x.domain()[0];
    const point_range = this.points_per_ppm * ppm_range;
    const pixel_range = Math.abs(this.scale.x.range()[1] - this.scale.x.range()[0]);
    ( (pixel_range / point_range) > 3 ) ? this.draw(false, true, 1) : this.draw(false, false);
  }

  /**
   * Draw by calculating the line shapes, using every visible pixel.
   */
  SpectraViewer.prototype.calc_draw = function() {
    this.draw(false, true, 1);
  }

  /**
   * Draw by calculating the line shapes, skipping several pixels
   */
  SpectraViewer.prototype.fast_calc_draw = function() {
    // this.draw(true, true, 2);
    this.draw(false, true, 2);
  }

  /**
   * Draw using simplified data if available. When zoomed in enough
   * the full data will be used.
   */
  SpectraViewer.prototype.fast_draw = function() {
    // Turn off fast draw when zoomed in 10x or more
    // TODO: determine at what level fast draw should be turned off based on the spectra length
    //       - this would be best if done at the spectrum level
    this.zoom_x < 10 ? this.draw(true) : this.draw();
    // this.draw(true);
  }

  /**
   * Flash a message on the center of the viewer.
   */
  SpectraViewer.prototype.flash = function(msg) {
    this.context.font = this.adjust_font(1.5);
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    const x = JSV.pixel(this.width) / 2;
    const y = JSV.pixel(this.height) / 2;
    this.context.fillText(msg, x, y);
  }

  // Draws any information in 'data' onto the left side of the viewer
  SpectraViewer.prototype.draw_debug = function(y) {
    if (!this.debug) return;
    const context = this.context;
    const data = this.debug_data;

    context.font = this.adjust_font(1, 'monospace');
    context.fillStyle = 'black';
    const line_height = JSV.pixel(18);
    y =  y || 0;
    let x;
    if (this.axis_x_reverse) {
      x = JSV.pixel(10);
      context.textAlign = 'left';
    } else {
      x = JSV.pixel(this.width - 10);
      context.textAlign = 'right';
    }
    const section_keys = this.debug === true ? Object.keys(data) : this.debug;
    let i = 0;
    section_keys.forEach(function(section_key) {
      const data_keys = Object.keys(data[section_key]);
      data_keys.forEach(function(data_key) {
        context.fillText((section_key + '|' + data_key + ': ' + data[section_key][data_key]), x, y + (line_height * i));
        i += 1;
      });
    })
  }

  // Returns a canvas font string adjusted to the size of the canvas
  SpectraViewer.prototype.adjust_font = function(font_factor, font_family, font_style) {
    font_factor = font_factor || 1;
    font_family = font_family || 'Sans-Serif';
    font_style  = font_style  || '';
    // ratio of default font size over default canvas width
    let ratio = 9 / 1400 * font_factor;
    let fontsize = ratio * JSV.pixel(this.width) + JSV.pixel(5);
    return font_style + ' ' + fontsize + 'pt ' + font_family;
  }

  // returns the font size used for a given font factor
  SpectraViewer.prototype.get_font_size = function(font_factor) {
    let ratio = 9 / 1400 * font_factor;
    return ratio * JSV.pixel(this.width) + JSV.pixel(5);
  }

  SpectraViewer.prototype.draw_axes = function() {
    const scale = this.scale;
    this.context.strokeStyle = 'black'; // axes color
    this.context.lineWidth = 1; // axes color
    this.context.setLineDash([1,0]);
    // Clear plot graphics from the X axis area
    const y_gutter = JSV.pixel(this.axis_y_gutter);
    const x_gutter = JSV.pixel(this.axis_x_gutter);
    // Clear plot graphics from the X axis area
    this.context.clearRect(scale.x.range_min(), scale.y.range_max(), scale.x.range_max() + y_gutter, x_gutter);
    // Clear plot graphics from the Y axis area
    const x = this.axis_x_reverse ? scale.x.range_max() : 0;
    this.context.clearRect(x, scale.y.range_min(), y_gutter, scale.y.range_max() + x_gutter);
    // Draw
    this.context.fillStyle = 'black';
    if (this.axis_y_show) this.draw_y_axis();
    if (this.axis_x_show) this.draw_x_axis();
  }

  SpectraViewer.prototype.draw_x_axis = function() {
    // Create a variable so we can access the chart in the tick drawing function
    const self = this;
    const tick_length = JSV.pixel(this.tick_length);
    const context = this.context;
    const scale = this.scale;

    // Bottom edge of the plot area (range_max so this holds when the y-axis is reversed)
    const bottom = scale.y.range_max();

    // Draw axis line
    context.beginPath();
    context.moveTo(scale.x.range()[1], bottom);
    context.lineTo(scale.x.range()[0], bottom);
    context.stroke();
    // Set up text
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.font = this.font;
    // Draw ticks and text
    scale.x.ticks(this.x_tick_count).forEach(function(tick_x) {
      context.beginPath();
      context.moveTo(scale.x(tick_x), bottom);
      context.lineTo(scale.x(tick_x), bottom + tick_length);
      context.stroke();
      const rounded_tick_x = parseFloat(tick_x.toFixed(self.tick_precision));
      context.fillText(rounded_tick_x, scale.x(tick_x), bottom + tick_length);
    });
    // Draw x label
    if (this.axis_x_title) {
      context.font = this.axis_title_font;
      const label_x = scale.x.range_diff() / 2;
      const label_y = bottom + (3 * tick_length);
      context.fillText(this.axis_x_title, label_x, label_y)
    }
  }

  SpectraViewer.prototype.draw_y_axis = function() {
    const sv = this;
    const context = this.context;
    const scale = this.scale;
    const padding = 5;
    const direction = this.axis_x_reverse ? 1 : -1;
    const tick_length = direction * JSV.pixel(this.tick_length);
    const text_x = scale.x.range()[0] + (direction * JSV.pixel(this.tick_length + padding));
    // Draw axis line
    context.beginPath();
    context.moveTo(scale.x.range()[0], scale.y.range()[1]);
    context.lineTo(scale.x.range()[0], scale.y.range()[0]);
    context.stroke();
    // Set up text
    context.textAlign = this.axis_x_reverse ? 'left' : 'right';
    context.textBaseline = 'middle';
    context.font = this.font;
    let max_label_width = 0;

    // Draw ticks and text
    scale.y.ticks(this.tick_count).forEach(function(tick_y) {
      context.beginPath();
      context.moveTo(scale.x.range()[0], scale.y(tick_y));
      context.lineTo(scale.x.range()[0] + tick_length, scale.y(tick_y));
      context.stroke();
      // context.fillText(tick_y.toFixed(decimal_places), text_x, scale.y(tick_y));
      context.fillText(sv.axis_y_tick_format(tick_y), text_x, scale.y(tick_y));
      if (sv.axis_y_title) {
        const label_width = Number(context.measureText(tick_y).width);
        if (label_width > max_label_width) max_label_width = label_width;
      }
    });
    // Draw y label
    if (this.axis_y_title) {
      const margin = JSV.pixel(4);
      const gutter = JSV.pixel(this.axis_y_gutter);
      const font_height = /(\d+\.?\d*)pt/.exec(this.axis_title_font)[1];
      // Width of text and ticks filling up the gutter
      const draw_width = max_label_width + Math.abs(tick_length) + Number(font_height) + margin + padding;
      if ( draw_width < gutter) {
        context.save();
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = this.axis_title_font;
        // Determine center point of label
        const label_x = scale.x.range()[0] + ((gutter - margin - Number(font_height) / 2) * direction);
        const label_y = scale.y.range_max() / 2;
        // Move to center
        context.translate(label_x, label_y);
        // Rotate Label
        context.rotate(direction * Math.PI / 2);
        // Move back to origin
        context.translate(-label_x, -label_y);
        // Draw label
        context.fillText(this.axis_y_title, label_x, label_y);
        context.restore();
      }
    }
  }

  SpectraViewer.prototype.draw_grid_lines = function(axis) {
    const sv = this;
    const context = this.context;
    const orig_context = context;
    const scale = this.scale;
    scale[axis].ticks(this.tick_count).forEach(function(tick) {
      context.beginPath();
      if (axis == 'y') {
        context.moveTo(scale.x.range()[0], scale.y(tick));
        context.lineTo(scale.x.range()[1], scale.y(tick));
      } else if (axis == 'x') {
        context.moveTo(scale.x(tick), scale.y.range()[0]);
        context.lineTo(scale.x(tick), scale.y.range()[1]);
      }
      context.strokeStyle = 'rgb(210,210,210)'; // axes color
      context.lineWidth = JSV.pixel(0.5);
      // context.setLineDash([2,2]);
      context.stroke();
    });
    this.context = orig_context;
  }

  SpectraViewer.prototype.draw_y_axis2 = function() {
    const sv = this;
    const context = this.context;
    const scale = this.scale;
    const padding = 5;

    const min_x = d3v7.min(scale.x.range());
    const max_x = d3v7.max(scale.x.range());
    const min_y = d3v7.min(scale.y.range());
    const max_y = d3v7.max(scale.y.range());
    let line_x, text_x, tick_length;
    if (this.axis_y_left) {
      line_x = min_x;
      text_x = line_x - JSV.pixel(this.tick_length + padding);
      context.textAlign = 'right';
      tick_length = -JSV.pixel(this.tick_length);
    } else {
      line_x = max_x;
      text_x = line_x + JSV.pixel(this.tick_length + padding);
      context.textAlign = 'left';
      tick_length = JSV.pixel(this.tick_length);
    }

    // Draw axis line
    context.beginPath();
    context.moveTo(line_x, min_y);
    context.lineTo(line_x, max_y);
    context.stroke();
    // Set up text
    context.textBaseline = 'middle';
    context.font = this.font;
    let max_label_width = 0;
    // Draw ticks and text
    scale.y.ticks(this.tick_count).forEach(function(tick_y) {
      context.beginPath();
      context.moveTo(line_x, scale.y(tick_y));
      context.lineTo(line_x + tick_length, scale.y(tick_y));
      context.stroke();
      context.fillText(tick_y, text_x, scale.y(tick_y));
      if (sv.axis_y_title) {
        const label_width = Number(context.measureText(tick_y).width);
        if (label_width > max_label_width) max_label_width = label_width;
      }
    });
    // Draw y label
    if (this.axis_y_title) {
      const margin = JSV.pixel(4);
      const gutter = JSV.pixel(this.axis_y_gutter);
      const font_height = /(\d+)pt/.exec(this.axis_title_font)[1];
      // Width of text and ticks filling up the gutter
      const draw_width = max_label_width + tick_length + Number(font_height) + margin;
      if ( draw_width < gutter) {
        context.save();
        context.textAlign = 'center';
        context.textBaseline = 'hanging';
        context.font = this.axis_title_font;
        context.rotate(Math.PI / 2);
        const label_y = -scale.x.range()[0] - gutter + margin;
        const label_x = scale.y.range()[0] / 2;
        context.fillText(this.axis_y_title, label_x, label_y);
        context.restore();
      }
    }
  }

  // Returns a 2D array of the x and y domains [[Xmin, Xmax], [Ymin, Ymax]]
  // peaks: an array of peak objects
  // exact: -true: the exact boundaries of the peaks
  //               good for drawing a selection line
  //        -false: add a little to dimensions.
  //                Best for domains to zoom in on.
  SpectraViewer.prototype.get_peak_domains = function(peaks, exact) {
    const margin_percentage = 0.1;
    let min_peak = peaks[0];
    let max_peak = peaks[0];
    let min, max;
    for (let i = 1; i < peaks.length; i++) {
      const peak = peaks[i];
      if (peak.center < min_peak.center) min_peak = peak;
      if (peak.center > max_peak.center) max_peak = peak;
    }
    // Calculate sum of peaks to determine top
    const xy_for_peaks = JSV.xy_from_peaks(peaks, 1000, min_peak.center, max_peak.center);
    let top = d3v7.max(xy_for_peaks.y);
    if (exact) {
      min = min_peak.center - (min_peak.width / 2);
      max = max_peak.center + (max_peak.width / 2);
    } else {
      min = min_peak.center - (min_peak.width);
      max = max_peak.center + (max_peak.width);
      const margin = (max - min) * margin_percentage;
      min -= margin;
      max += margin;
      top += (top * margin_percentage);
    }
    return [[min, max], [0, top]];
  }

  SpectraViewer.prototype.move_to_compound = function(spectrum_id, compound_id, duration) {
    const spectrum = this.spectra(spectrum_id);
    const compound = spectrum && spectrum.compounds(compound_id);
    this.move_to_peaks(compound.peaks(), duration);
  }

  SpectraViewer.prototype.move_to_peaks = function(peaks, duration, scale) {
    scale = scale || 1;
    const domains = this.get_peak_domains(peaks);
    domains[1][1] = domains[1][1] * scale;
    const domain_diff = Math.abs(domains[0][1] - domains[0][0]);
    domains[0][0] = domains[0][0] - (domain_diff - domain_diff / scale);
    domains[0][1] = domains[0][1] + (domain_diff - domain_diff / scale);
    this.move_to(domains, duration);
  }

  // Extent is a 2D array [[x0, y0], [x1, y1]]
  // - x0 and y0 are the lower bounds of the extent
  // - x1 and y1 are the upper bounds of the extent
  SpectraViewer.prototype.set_domain_to_brush_extent = function(extent, use_pixel_ratio) {
    const domains = this.domains_from_brush_extent(extent, use_pixel_ratio);
    this.set_domain('x', domains[0]);
    this.set_domain('y', domains[1]);
  }

  SpectraViewer.prototype.domains_from_brush_extent = function(extent, use_pixel_ratio) {
    const x_domain = [extent[0][0], extent[1][0]];
    // Order min-first: with a reversed y-axis the brush corners invert to [max, min]
    const y_domain = [Math.min(extent[0][1], extent[1][1]), Math.max(extent[0][1], extent[1][1])];
    return [x_domain, y_domain];
  }

  SpectraViewer.prototype.elements = function(element_type, parent, possible_elements, visible_only) {
    const sv = this;
    let elements = possible_elements;
    if (!possible_elements) {
      parent = JSV.default_for(parent, sv);
      if (typeof parent == 'string') {
        parent = sv.spectra(parent);
      }
      if (!parent) {
        elements = new JSV.SVSet();
      } else if (element_type == 'peak') {
        elements = parent.peaks();
      } else if (element_type == 'cluster') {
        elements = parent.clusters();
      } else if (element_type == 'compound') {
        elements = parent.compounds();
      } else if (element_type == 'spectrum') {
        elements = parent.spectra();
      } else {
        elements = new JSV.SVSet();
      }
    }
    if (visible_only) {
      elements = new JSV.SVSet(elements.filter(function(e) { return e.visible; }));
    }
    return elements;
  }

  SpectraViewer.prototype.find_element_mouse_over = function(element_type, spectrum, possible_elements, visible_only) {
    const sv = this;
    let found_element;
    elements = sv.elements(element_type, spectrum, possible_elements, visible_only);
    // Calculate y value for each element at the mouse x position
    elements.forEach(function(element) {
      element.y_for_mouse_x = JSV.sum_of_peaks(sv.mx, element.peaks());
    });
    // Sort elements by y value
    elements.order_by('y_for_mouse_x');
    // Find first element
    for (let i = 0; i < elements.length; i++) {
      if (sv.my <= elements[i].y_for_mouse_x && sv.my >= 0) {
        found_element = elements[i];
        break;
      }
    }
    return found_element;
  }

  SpectraViewer.prototype.max_y_in_range = function(x_min, x_max) {


  }


  SpectraViewer.prototype.image = function(width, height) {
    width = width || this.width;
    height = height || this.height;

    // Save current settings
    const orig_context = this.context;
    const zoombox_visible = this.zoombox.visible;

    // Generate new context and scales
    const temp_canvas = d3v7.select('body').append('canvas')
        .attr('width', width)
        .attr('height', height)
        .node();

    JSV.scale_resolution(temp_canvas, JSV.pixel_ratio);
    this.context = temp_canvas.getContext('2d');

    const scaled_height = JSV.pixel(height - this.axis_x_gutter);
    this.scale.x.range(this.x_range(width));
    this.scale.y.range([scaled_height, 0]);

    this.zoombox.visible = false;

    // Generate image
    this.full_draw();
    image = temp_canvas.toDataURL();

    // Restore original settings
    this.scale.x.range(this.x_range());
    this.scale.y.range([this.scaled_height, 0]);
    this.context = orig_context;
    this.zoombox.visible = zoombox_visible;

    // Delete temp canvas
    d3v7.select(temp_canvas).remove();

    return image;
  }

  SpectraViewer.prototype.initial_settings = function() {
    const self = this;
    this.settings = new JSV.SVSettings(this, {
      title: 'JSV Settings',
      width: '250',
      height: '210',
      settings: [ {
        label: 'Grid lines [y-axis]',
        property: 'axis_y_grid',
        type: 'boolean'
      }, {
        label: 'Grid lines [x-axis]',
        property: 'axis_x_grid',
        type: 'boolean'
      }, {
        label: 'Show Zoombox',
        property: function(value) {
          if (arguments.length == 0) return self.zoombox.visible;
          self.zoombox.visible = value;
        },
        type: 'boolean'
      }, {
        label: 'Show Legend',
        property: 'legend_show',
        type: 'boolean'
      }
      ]
    });
  }


  JSV.SpectraViewer = SpectraViewer;

})(JSpectraViewer);//////////////////////////////////////////////////////////////////////////////
// SpectraViewer2D
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

    /**
     * The SpectraViewer2D object controls how the viewer looks and behaves and
     * is the main object in JSV. Spectra are added to the SpectraViewer2D
     * using the [add_spectrum](#add_spectrum) method. A large number of options
     * can be set when creating a new viewer:
     *
     *  Option                | Default     | Description
     *  ----------------------|-------------------------------------------------
     *  title                 | _undefined_ | Title will appear above viewer if present
     *  id                    | jsv-1       | ID to select viewer
     *  width                 | 800         | Width of viewer in pixels
     *  height                | 400         | Height of viewer in pixels
     *  axis_x_title          | 'ppm'       | Label of x-axis
     *  axis_x_show           | true        | Show x-axis
     *  axis_x_grid           | true        | Show grid along x-axis
     *  axis_x_reverse        | true        | Reverse the direction of the x-axis
     *  axis_y_title          | 'Intensity' | Label of y-axis
     *  axis_y_show           | false       | Show y-axis
     *  axis_y_grid           | false       | Show grid along y-axis
     *  axis_y_lock           | false       | If true, locks axis to minimum y value. If a number locks the y-axis a percentage below 0 (e.g. 0.1 sets the y-axis minimum to 10% of the viewable y-axis scale below 0)
     *  min_boundaries        | _undefined_ | The minimum/maximum values for the x/y-axis. e.g. {x: [-1, 10], y: [0, 1]}. _Note_: _min_boundaries_ must be set, if only providing peak data.
     *  zoom_max              | 25          | The maximum zoom-out level (units in standard deviation for peak detection)
     *  zoom_min              | 0.25        | The maximum zoom-in level (units in standard deviations for peak detection)
     *  select                | {}          | See options for [SVSelection](SVSelection.js.html)
     *  structure             | {}          | See options for [SVStructure](SVStructure.js.html)
     *  assignment_table      | {}          | See options for [SVAssignments](SVAssignments.js.html)
     *  cluster_navigation_id | _undefined_ | ID of div to place cluster navigation viewer (e.g. '#clust-nav')
     *
     *
     * @param {String} container_id The id of the element to contain the viewer.
     *   The contents of this element will be replaced with the viewer.
     * @param {Object} options Options to set up the viewer. Described below.
     * @return {SpectraViewer2D}
     */
    const SpectraViewer2D = function (container, options) {
        let sv = this;
        this.container = d3v7.select(container);
        // Get options
        options = options || {};
        this.title = options.title;
        this.width = JSV.default_for(options.width, 800);
        this.height = JSV.default_for(options.height, 400);
        this.tick_count = JSV.default_for(options.tick_count, 10);
        this.x_tick_count = JSV.default_for(options.x_tick_count, 10);
        this.tick_length = JSV.default_for(options.tick_length, 10);
        this.tick_precision = JSV.default_for(options.tick_precision, 3);
        this.axis_x_tick_format = d3v7.format(JSV.default_for(options.axis_x_tick_format, '~g'));
        this.axis_y_tick_format = d3v7.format(JSV.default_for(options.axis_y_tick_format, '~g'));
        this.axis_x_title = JSV.default_for(options.axis_x_title, 'ppm');
        this.axis_y_title = JSV.default_for(options.axis_y_title, 'ppm');
        this.axis_y_show = JSV.default_for(options.axis_y_show, 'ppm');
        this.axis_x_show = JSV.default_for(options.axis_x_show, true);
        this.axis_y_grid = JSV.default_for(options.axis_y_grid, false);
        this.axis_x_grid = JSV.default_for(options.axis_x_grid, false);
        this.axis_y_reverse = JSV.default_for(options.axis_y_reverse, false);
        this.axis_x_reverse = JSV.default_for(options.axis_x_reverse, true);
        // If logical true, locks y axis to minimum y value
        // If a number locks the y axis to a percentage below 0 (e.g. 0.1 sets the y-axis min to 10% of the
        // viewable y axis scale below 0).
        this.axis_y_lock = JSV.default_for(options.axis_y_lock, false);
        // min_boundaries must be set, if only providing peak data
        this.min_boundaries = options.min_boundaries; // Array example: {x: [-1, 10], y: [0, 1]}]
        this.zoom_max = JSV.default_for(options.zoom_max, 25);
        this.zoom_min = JSV.default_for(options.zoom_min, 0.25);
        // Controls the number of pixels saved for plots while zooming/draging
        // Increasing this number will descrease the number of pixels and thus speed up animations.
        // If no tolerance is provided, it will be calculated automatically from the spectra noise.
        this.simplify_tolerance = options.simplify_tolerance;
        // An array of debug keys to display or true to show all.
        this.debug = JSV.default_for(options.debug, false);
        this.debug_data = {time: {}, data: {}, drag: {}, zoom: {}, zbox: {}};
        // Set viewer ID
        const current_ids = JSV.viewers().map(function (viewer) {
            return viewer.id;
        });
        this.id = JSV.default_for(options.id, JSV.unique_id('jsv-', 1, current_ids));

        // Space required for axes
        this.axis_y_gutter = this.axis_y_show ? JSV.default_for(options.axis_y_gutter, 0.14 * this.width) : 0;
        this.axis_x_gutter = this.axis_x_show ? JSV.default_for(options.axis_x_gutter, 150) : 0;

        // Set initial threshold for peak detection
        this.threshold = 1;

        // Delete contents of container and add title
        const header = this.title ? '<h3>' + this.title + '</h3>' : '';
        this.container.html(header)
            .style('width', this.width + 2 + 'px');

        this.sv_wrapper = this.container.append('div')
            .attr('class', 'sv-wrapper')
            .style('position', 'relative');

        // Add div to store the current key press
        this.container.append('div')
            .attr('class', 'sv-key-down')
            .style('display', 'none');

        // Create the viewer canvas
        // NOTE: anything drawn to the canvas must take the pixel ratio into account
        //       and should use the pixel() method.
        this.canvas = this.sv_wrapper.append("canvas")
            .attr("id", this.container.attr('id'))
            .attr("class", 'spectra-viewer ' + this.class)
            .style('border', '1px solid #DDD')
            .attr("width", this.width)
            .attr("height", this.height).node();

        // Check for canvas support
        if (!this.canvas.getContext) {
            this.container.html('<h3>Spectra Viewer requires Canvas, which is not supported by this browser.</h3>');
            throw('Canvas not supported');
        }

        // Get pixel ratio and upscale canvas depending on screen resolution
        // http://www.html5rocks.com/en/tutorials/canvas/hidpi/
        JSV.pixel_ratio = JSV.get_pixel_ratio(this.canvas);
        JSV.scale_resolution(this.canvas, JSV.pixel_ratio);

        // This would need to be adjusted in width setter
        this.font = this.adjust_font();
        this.axis_title_font = this.adjust_font(1, undefined, 'bold');
        // Set viewer context
        this.context = this.canvas.getContext('2d');

        // Add a placeholder function for browsers that don't have setLineDash()
        if (!this.context.setLineDash) {
            this.context.setLineDash = function () {
            }
        }

        // Set up scales for plot area
        this.scaled_height = JSV.pixel(this.height - this.axis_x_gutter);
        this.scaled_width = JSV.pixel(this.width - this.axis_y_gutter);

        // Scale hold the current x/y scales
        // NOTE: to reverse axis, reverse the ranges
        this.scale = new JSV.SVScale();
        this.scale.y.range([0, this.scaled_height]);
        // this.axis_x_reverse = false
        this.scale.x.range(this.x_range());

        // boundary hold the domain extents
        this.boundary = new JSV.SVScale();
        this.boundary.x.range(this.x_range());
        this.boundary.y.range([this.scaled_height, 0]);
        this.boundary.clamp(true);

        // Set minimun boundaries
        if (this.min_boundaries) {
            this.boundary.update(this.min_boundaries);
            this.scale.update(this.min_boundaries);
        }

        // Initialize containers
        this._spectra = new JSV.SVSet();

        // make room for 1D nmr on top and left sides\
        this.shift_plot()


        // Create SVG overlay
        this.svg = this.sv_wrapper.append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('class', 'svg-viewer')
            .style('position', 'absolute')
            .style('top', 0)
            .style('left', 0);

        // Set cursor for svg
        this.svg.style('cursor', 'crosshair');

        // draw crosshairs
        this.svg.append("text").attr("id", "crosshairs_label").attr("x", "0.35em").attr("y", "1em")
        this.svg.append("line").attr("id", "crosshair_x")
            .style("stroke", "blue")
            .style("stroke-width", 1)
        this.svg.append("line").attr("id", "crosshair_y")
            .style("stroke", "blue")
            .style("stroke-width", 1)
        this.svg.on("mousemove", function (event) {
            const pos = d3v7.pointer(event, this);
            sv.mx = sv.scale.x.invert(JSV.pixel(pos[0]))
            sv.my = sv.scale.y.invert(JSV.pixel(pos[1]))

            sv.annotation.check_hover();

            d3v7.select('#crosshair_x')
                .attr("x1", 0)
                .attr("y1", pos[1])
                .attr("x2", sv.width)
                .attr("y2", pos[1]);
            d3v7.select('#crosshair_y')
                .attr("x1", pos[0])
                .attr("y1", 0)
                .attr("x2", pos[0])
                .attr("y2", sv.height);

            if (sv.debug) d3v7.select("#crosshairs_label").text("x: " + sv.mx + " y: " + sv.my);
        })

        this.zoom_rect = {
            'r': null,
            'origin': null,
            'translated_origin': null,
        }

        sv.svg.call(d3v7.drag()
            .on('start', this.drag_zoom().start)
            .on('drag', this.drag_zoom().drag)
            .on('end', this.drag_zoom().end)
        );

        this.initialize_zooming();

        d3v7.select(window)
            .on("keydown", sv.keydown)
            .on("keyup", sv.keyup);

        this.svg.on('mouseover', function () {
            sv.contains_mouse = true;
            // Remove focus from other elements (e.g. NMRLib editor), so that
            // pressing keys like 'a' or 's' do not continue typing in other elements.
            document.activeElement.blur();

        });

        this.svg.on('mouseout', function () {
            sv.contains_mouse = false;
        });

        // Setup SVEvents
        this.handlers = new JSV.SVEvents();
        this.on = this.handlers.on
        this.off = this.handlers.off
        this.trigger = this.handlers.trigger


        this.selection = new JSV.SVSelection(this, JSV.default_for(options.select, {}));

        // Initialize Labels
        // this.labels = new JSV.SVLabels(sv);
        this.annotation = new JSV.SVAnnotation(sv);

        // Initialize Menu
        this.menu = new JSV.SVMenu(sv);

        // Initialize Help
        this.help = new JSV.SVHelp(sv);

        this.cluster_navigation_id = options.cluster_navigation_id;

        // Initialize Structure Viewer
        if (options.structure) {
            this.structure = new JSV.SVStructure(options.structure);
        }

        // Initialize Assignment Table
        if (options.assignment_table) {
            this.assignment_table = new JSV.SVAssignments2D(sv, options.assignment_table);
        }


        JSV._viewers.push(this);

        // Draw viewer
        this.draw();
    };

    SpectraViewer2D.prototype.toString = function() { return 'SpectraViewer2D' }

    /////////////////////////////////////////////////////////////////////////////
    // SpectraViewer2D Properties (setters/getters)
    /////////////////////////////////////////////////////////////////////////////
    Object.defineProperties(SpectraViewer2D.prototype, {
        'cluster_navigation_id': {
            get: function() { return this._cluster_navigation_id; },
            set: function(val) {
                this._cluster_navigation_id = val;
                if (this._cluster_navigation_id) {
                    this._cluster_navigation = new JSV.SVClusterNavigator(this, val);
                } else {
                    if (this._cluster_navigation) {
                        this._cluster_navigation.detach();
                        this._cluster_navigation = undefined;
                    }
                }
            }
        },
        'structure_viewer_id': {
            get: function() { return this._structure_viewer_id; },
            set: function(val) {
                this._structure_viewer_id = val;
                if (this._structure_viewer_id) {
                    this._structure_viewer = new JSV.SVStructure(this, val);
                } else {
                    if (this._structure_viewer) {
                        this._structure_viewer.detach();
                        this._structure_viewer = undefined;
                    }
                }
            }
        }
    });


    SpectraViewer2D.prototype.x_range = function(width) {
        width = width || this.width;
        const scaled_width = JSV.pixel(width - this.axis_y_gutter);
        return this.axis_x_reverse ?
            [scaled_width, 0] :
            [JSV.pixel(this.axis_y_gutter), JSV.pixel(width)];
    }

    /**
     * Resizes the SpectraViewer2D
     *
     * @param {Number} width New width
     * @param {Number} height New height
     * @param {Boolean} fast After resize, should the spectra be draw redrawn fast.
     */
    SpectraViewer2D.prototype.resize = function(width, height, fast) {
        this.shift_plot(true);
        this.width = width || this.width;
        this.height = height || this.height;

        this.container
            .style('width', this.width + 'px');
        d3v7.select(this.canvas)
            .attr('width', this.width)
            .attr('height', this.height);
        this.font = this.adjust_font();
        this.axis_title_font = this.adjust_font(1, undefined, 'bold');
        this.scaled_height = JSV.pixel(this.height - this.axis_x_gutter);
        this.scaled_width  = JSV.pixel(this.width - this.axis_y_gutter);
        this.scale.y.range([0, this.scaled_height]);
        this.boundary.y.range([this.scaled_height, 0]);
        this.scale.x.range(this.x_range());
        this.boundary.x.range(this.x_range());

        this.svg.attr('width', this.width).attr('height', this.height);
        JSV.scale_resolution(this.canvas, JSV.pixel_ratio);
        this.shift_plot();
        this.draw();
    }

    SpectraViewer2D.prototype.keyval = function() {
        return d3v7.select('.sv-key-down').html();
    }


    d3v7.selection.prototype.moveToFront = function() {
        return this.each(function() {
            this.parentNode.appendChild(this);
        });
    };

    SpectraViewer2D.prototype.keydown = function(event) {
        // This has to be done globally on all viewers
        if (event[this.zoom_brush_key]) {
            d3v7.selectAll('.sv-wrapper .svg-viewer').style('cursor', 'crosshair');
            // d3v7.selectAll('.zoom-brush').moveToFront();
        }
        d3v7.selectAll('.sv-key-down').html(event.keyCode);
        // console.log(d3v7.event);
    }

    SpectraViewer2D.prototype.keyup = function(event) {
        // 16 is shift
        if (event.keyCode == 16) {
            d3v7.selectAll('.sv-wrapper .svg-viewer').style('cursor', 'all-scroll');
            // d3v7.selectAll('.select-brush').moveToFront();
        }
        // Test external custom cursor
        // d3v7.selectAll('.sv-wrapper .svg-viewer').style('cursor', "url('http://www.javascriptkit.com/dhtmltutors/cursor-hand.gif'), 'pointer'");
        d3v7.selectAll('.sv-key-down').html('');
    }


    SpectraViewer2D.prototype.pixels_to_units_of_axis = function(axis, number_of_pixels) {
        const sv = this;
        return sv.scale[axis].invert(JSV.pixel(number_of_pixels)) - sv.scale[axis].invert(0);
    }


    // Change the zoom axis and zoom scale to the current zoom level if the axis is changing
    SpectraViewer2D.prototype.set_zoom_axis = function(zoom_y_key_down) {
        if (zoom_y_key_down) {
            if (this.zoom_axis != 'y') {
                this.zoom_axis = 'y';
                this.zoom_behavior.scale(this.zoom_y);
                this.set_zoom_cursor(zoom_y_key_down);
            }
        } else {
            if (this.zoom_axis != 'x') {
                this.zoom_axis = 'x';
                this.zoom_behavior.scale(this.zoom_x);
                this.set_zoom_cursor(zoom_y_key_down);
            }
        }
    }

    SpectraViewer2D.prototype.set_zoom_cursor = function(zoom_y_key_down) {
        if (zoom_y_key_down) {
            this.svg.style('cursor', 'ns-resize');
        } else {
            this.svg.style('cursor', 'ew-resize');
        }
    }

    // Zoom the spectra for the supplied axis based on the current zoom level.
    // - axis: either 'x' or 'y'
    // - zoom: zoom level for the axis
    SpectraViewer2D.prototype.scale_axis = function(axis, zoom_level) {
        // Calculate the difference between min and max values on axis after zooming
        const axis_diff = Math.abs(this.boundary[axis].domain()[0] - this.boundary[axis].domain()[1]) / zoom_level;
        // Value of axis at the mouse position
        const mouse_index = axis === 'x' ? 0 : 1;
        let value = this.scale[axis].invert(this.mouse(this.canvas)[mouse_index]);
        // Calculate the ratio the mouse position is along the axis
        let axis_ratio = (value - this.scale[axis].domain()[0]) / Math.abs(this.scale[axis].domain()[0] - this.scale[axis].domain()[1]);

        // Constrain y zooming so that y domain minimum stays constant
        if (axis == 'y') {
            axis_ratio = 0;
            value = this.scale.y.domain()[0];
        }

        // Initially set the zoomed domain using the axis ratio
        const domain = [value - (axis_diff * axis_ratio), value + (axis_diff * (1 - axis_ratio))];
        this.scale[axis].domain(domain);

        // Update the domain making sure they are within the boundaries
        this.set_domain(axis, domain);

        // Save zoom level
        // this['zoom_' + axis] = zoom_level

        // DEBUG INFO
        if (this.debug) {
            axis = axis.toUpperCase();
            this.debug_data.zoom['d' + axis]  = JSV.round(axis_diff);
            this.debug_data.zoom['v' + axis]  = JSV.round(value);
            this.debug_data.zoom['r' + axis]  = JSV.round(axis_ratio);
        }
    }

    // Get mouse position in the 'container' taking into account the pixel ratio
    SpectraViewer2D.prototype.mouse = function(container) {
        return d3v7.mouse(container).map(function(p) { return JSV.pixel(p); });
    }

    // Translates the spectra for the supplied axis.
    // - axis: either 'x' or 'y'
    // - translation: number of pixels to move the specta  on the axis
    SpectraViewer2D.prototype.translate_axis = function(axis, translation) {
        // Calculate new domain based on translation
        const domain = this.scale[axis].range().map(function (r) {
            return r - JSV.pixel(translation);
        }).map(this.scale[axis].invert);
        this.set_domain(axis, domain);
    }

    // Shifts canvas plot to make room for 1D NMR on sides
    SpectraViewer2D.prototype.shift_plot = function(reverse=false) {
        if(reverse){
            this.context.translate(-this.x_range()[0] * 0.08, -this.scaled_height * 0.12)
        } else {
            this.context.translate(this.x_range()[0] * 0.08, this.scaled_height * 0.12)
        }
    }

    SpectraViewer2D.prototype.absolute_to_translated_context = function(x, y) {
        let x_dif = this.x_range()[0] * 0.08;
        let y_dif = this.scaled_height * 0.12;

        let x_abs_min = this.scale.x.range()[1];
        let x_abs_max = this.scale.x.range()[0];
        let y_abs_min = this.scale.y.range()[0];
        let y_abs_max = this.scale.y.range()[1];

        x = x - x_dif;
        y = y - y_dif;

        x = Math.max(x_abs_min, Math.min(x_abs_max, x));
        y = Math.max(y_abs_min, Math.min(y_abs_max, y));
        return [this.scale.x.invert(x),this.scale.y.invert(y)];
    }

    // http://bl.ocks.org/mbostock/5731979
    /**
     * Move from the current x,y domain to the supplied x/y domain using a transition.
     *
     * @param {Array} domains 2D array containing the min/max for the new X/Y domains:
     *   [ [Xmin, Xmax], [Ymin, Ymax] ]
     * @param {Number} duration Time of move transition in milliseconds
     */
    SpectraViewer2D.prototype.move_to = function(domains, duration) {
        const sv = this;
        duration = duration || 500;
        // Change Ymin to boundaries Ymin if the y axis is locked
        if (this.axis_y_lock !== false) {
            domains[1][0] = this.axis_y_lock_value(domains[1]);
        }
        // Flatten 2D domain arrays so they have the format: [Xmin, Xmax, Ymin, Ymax]
        let end_domains = [];
        let start_domains = [];
        end_domains = end_domains.concat.apply(end_domains, domains);
        start_domains = start_domains.concat
            .apply(start_domains, [sv.scale.x.domain(), sv.scale.y.domain()]);

        d3v7.select(this.canvas).transition()
            .duration(duration)
            .tween('move', function() {
                const interm_domains = d3v7.interpolateArray(start_domains, end_domains);
                return function(t) {
                    sv.set_domain('x', [interm_domains(t)[0], interm_domains(t)[1]]);
                    sv.set_domain('y', [interm_domains(t)[2], interm_domains(t)[3]]);
                    sv.fast_draw();
                }
            }).on('end', function() { sv.full_draw(); });
        // Reset zoom axis
        sv.zoom_axis = '';
    }

    // Sets the domain (mininum and maximum value) for the supplied axis
    // after adjusting the domain to make sure it is within the boundaries of
    // the plot. Also adjusts the domain based on max_zoom.
    // - axis: either 'x' or 'y'
    // - domain: array with 2 elements, the min and max value for the domain
    SpectraViewer2D.prototype.set_domain = function(axis, domain) {
        const scale = this.scale;
        const boundary = this.boundary;


        // Determine boundary domain (difference between min and max values on the axis)
        const boundary_diff = Math.abs(boundary[axis].domain()[1] - boundary[axis].domain()[0]);
        // Determine visible domain (difference between min and max values on the axis)
        let domain_diff = Math.abs(domain[1] - domain[0]);

        // Optionally lock minimum domain value to minimum boundary value
        if ( (axis == 'y') && (this['axis_y_lock'] !== false) ) {
            domain[0] = this.axis_y_lock_value(domain);
            domain[1] = domain[0] + domain_diff;
        }

        // Changing the domain may change the zoom level
        // Check that the zoom is not above the max
        let new_zoom = boundary_diff / domain_diff;
        if (new_zoom > this.zoom_max) {
            new_zoom = this.zoom_max;
            const old_domain_diff = domain_diff;
            domain_diff = boundary_diff / new_zoom;
            // Center the domain
            const center = (domain[0] + domain[1]) / 2;
            domain[0] = center - (domain_diff / 2);
            domain[1] = domain[0] + domain_diff;
            if (this.debug) {
                this.debug_data.zoom['center-' + axis] = JSV.round(center);
                this.debug_data.zoom['domain-diff-' + axis] = JSV.round(domain_diff);
            }
        }
        // Check that the zoom is not below 1
        if (new_zoom < 1) {
            new_zoom = 1;
            domain_diff = boundary_diff / new_zoom;
            domain[0] = boundary[axis].min();
            domain[1] = boundary[axis].max();
        }
        if (this['zoom_' + axis] != new_zoom) {
            this['zoom_' + axis] = new_zoom;
            this.trigger('zoom');
        }

        // Check that domain is within the plot boundaries
        if (domain[0] < boundary[axis].domain()[0]) {
            domain[0] = boundary[axis].domain()[0];
            domain[1] = domain[0] + domain_diff;
        } else  if (domain[1] > boundary[axis].domain()[1]) {
            domain[1] = boundary[axis].domain()[1];
            domain[0] = domain[1] - domain_diff;
        }

        // Set domain
        this.scale[axis].domain(domain);
        this.trigger('domain-change');
    }

    SpectraViewer2D.prototype.axis_y_lock_value = function(domain) {
        if (this.axis_y_lock === true) {
            return this.boundary.y.domain()[0];
        } else {
            const domain_diff = Math.abs(domain[1] - domain[0]);
            return 0 - domain_diff * this.axis_y_lock;
        }
    }

    /**
     * Zoom the Viewer out completely
     */
    SpectraViewer2D.prototype.zoom_out_completely = function() {
        this.move_to([this.boundary.x.domain(), this.boundary.y.domain()])
        this.scale.x.domain(this.boundary.x.domain());
        this.scale.y.domain(this.boundary.y.domain());
        this.zoom_x = 1;
        this.zoom_y = 1;
    }

    SpectraViewer2D.prototype.add_spectrum_2d = function(data, display, meta) {
        //data.tolerance = JSV.default_for(data.tolerance, this.simplify_tolerance);
        //data.number_of_points = JSV.default_for(data.number_of_points, max_points);


        // calculate max and min values to update scaling
        let adjusted_y = data.json_data.y.map(v => data.json_data.y[0] - v)

        let x_min = Math.floor(Math.min(...data.json_data.x))
        let x_max = Math.ceil(Math.max(...data.json_data.x))
        let y_min = Math.floor(Math.min(...adjusted_y))
        let y_max = Math.ceil(Math.max(...adjusted_y))

        this.min_boundaries = {x: [x_min, x_max], y: [y_min, y_max]}

        this.boundary.update(this.min_boundaries);
        this.scale.update(this.min_boundaries);

        data.min_x = JSV.default_for(data.min_x, this.boundary.x.domain()[0]);
        data.max_x = JSV.default_for(data.max_x, this.boundary.x.domain()[1]);
        const current_ids = this.all_spectra().map(function (spectrum) {
            return spectrum.name;
        });
        data.id = JSV.default_for(data.id, JSV.unique_id('Spectrum2D_', 1, current_ids));

        const spectrum2D = (data.toString() == 'Spectrum2D') ? data : new JSV.Spectrum2D(data, display, meta);
        spectrum2D._sv = this;

        this._spectra.push(spectrum2D);
        this.boundary.update(spectrum2D.xyz_data);
        this.scale.update(spectrum2D.xyz_data);
        this.draw();
    }

    SpectraViewer2D.prototype.add_nmrml_data = function(nmrml){
        let sv = this;
            if (!window.X2JS) {
                console.error("X2JS needs to be installed to read nmrML: https://github.com/abdmob/x2js");
                return;
            }

            // Add Spectrum XYZ plot
            const coords_regex = {
                x: /<spectrumDataArray2dDirectDimensionF2.*compressed="(true|false)"[^]*>([^]+)<\/spectrumDataArray2dDirectDimensionF2>/,
                y: /<spectrumDataArray2dIndirectDimensionF1.*compressed="(true|false)"[^]*>([^]+)<\/spectrumDataArray2dIndirectDimensionF1>/,
                z: /<spectrumDataArray2dIntensities.*compressed="(true|false)"[^]*>([^]+)<\/spectrumDataArray2dIntensities>/
            };
            let xyz_data = {};

            Object.entries(coords_regex).forEach(function ([key, re]) {
                // find encoded data
                const data_array_match = nmrml.match(re);
                if (data_array_match) {
                    let compressed = (data_array_match[1] === 'true');
                    let encoded_data = data_array_match[2];
                    xyz_data[key] = Array.from(JSV.convert_base64_to_float64(encoded_data, compressed));
                } else {
                    console.error(`${key} data array not found`);
                }
            })


            if (Object.keys(coords_regex).every(key => key in xyz_data)) {
                sv.add_spectrum_2d({json_data: xyz_data});

                // Extract part of nmrML of interest
                const atom_assignment_match = nmrml.match(/<atomAssignment[^]*<\/atomAssignment>/);
                let atom_assignment;
                if (atom_assignment_match) {
                    atom_assignment = atom_assignment_match[0];
                } else {
                    console.log("Could not read nmrML. No <atomAssignment> tag found.");
                    return
                }
                // Create structure
                const structure_match = atom_assignment.match(/<structure[^]*<\/structure>/);
                if (sv.structure && structure_match) {
                    const name_match = atom_assignment.match(/<identifier.*name="(.*?)"/);
                    if (name_match) {
                        sv.structure.title = name_match[1];
                    }
                    sv.structure.read_nmrml(structure_match[0]);
                }
                //sv.assignment_table.nmr_nucleus = 'HSQC'; // only supported format for now
                // Create Compound
                const x2js = new X2JS();
                const json = x2js.xml_str2json(atom_assignment);
                const compound = {name: json.atomAssignment.chemicalCompound.identifierList.identifier._name};
                const clusters = [];
                let multiplet_list = json.atomAssignment.atomAssignmentList.multiplet;
                if (multiplet_list) {
                     multiplet_list = Array.isArray(multiplet_list) ? multiplet_list : [multiplet_list];
                     multiplet_list.forEach(function(multiplet, index) {
                        const peak = [multiplet._dir_dim_center, multiplet._indir_dim_center];
                        clusters.push( {peaks: peak,
                                        meta: {nmrml_cluster_index: index}});
                    });
                    compound.clusters = clusters;
                    // TODO: Add simulated 2D Spectrum to viewer
                    if (sv.structure && multiplet_list) {
                        const compound_clusters = sv.compounds(sv.compounds().length).clusters();
                        multiplet_list.forEach((multiplet, index) => {
                            const compound_cluster = compound_clusters.find((c) => {
                                return c.meta.nmrml_cluster_index === index;
                            });
                            if (multiplet.atoms && compound_cluster) {
                                let dir_dim_atom_ids = [];
                                let indir_dim_atom_ids = [];
                                const dir_dim_atom_refs = multiplet.atoms._dir_dim_atomRefs;
                                const indir_dim_atom_refs = multiplet.atoms._indir_dim_atomRefs;

                                if (dir_dim_atom_refs && dir_dim_atom_refs.match(/\w/) &&
                                    indir_dim_atom_refs && indir_dim_atom_refs.match(/\w/)) {
                                    dir_dim_atom_ids = dir_dim_atom_refs.trim().split(/\s+/);
                                    indir_dim_atom_ids = indir_dim_atom_refs.trim().split(/\s+/);
                                }

                                dir_dim_atom_ids.forEach((atom_id, index) => {
                                    dir_dim_atom_ids[index] = atom_id.replace(/\D/g, '');
                                });
                                indir_dim_atom_ids.forEach((atom_id, index) => {
                                    indir_dim_atom_ids[index] = atom_id.replace(/\D/g, '');
                                });

                                compound_cluster.dir_dim_atom_refs = dir_dim_atom_ids;
                                compound_cluster.indir_dim_atom_refs = indir_dim_atom_refs;
                                const atom_ids = dir_dim_atom_ids
                                    .concat(indir_dim_atom_ids.filter((id) => dir_dim_atom_ids.indexOf(id) < 0));
                                compound_cluster._atoms.merge(sv.structure.atoms(atom_ids));

                                switch (multiplet.multiplicity._name.toLowerCase()) {
                                    case 'singlet feature':
                                        compound_cluster.multiplet_type = 's';
                                        break;
                                    case 'doublet feature':
                                        compound_cluster.multiplet_type = 'd';
                                        break;
                                    case 'triplet feature':
                                        compound_cluster.multiplet_type = 't';
                                        break;
                                    case 'quartet feature':
                                        compound_cluster.multiplet_type = 'q';
                                        break;
                                    case 'doublet of doublets feature':
                                        compound_cluster.multiplet_type = 'dd';
                                        break;
                                    case 'doublet of doublet of doublets feature':
                                        compound_cluster.multiplet_type = 'ddd';
                                        break;
                                    case 'doublet of doublet of doublets of doublets feature':
                                        compound_cluster.multiplet_type = 'dddd';
                                        break;
                                    case 'triplet of doublets feature':
                                        compound_cluster.multiplet_type = 'td';
                                        break;
                                    case 'doublet of triplets feature':
                                        compound_cluster.multiplet_type = 'dt';
                                        break;
                                    case 'triplet of triplets feature':
                                        compound_cluster.multiplet_type = 'tt';
                                        break;
                                    case 'doublet of quartets feature':
                                        compound_cluster.multiplet_type = 'dq';
                                        break;
                                    case 'doublet of doublet of triplets feature':
                                        compound_cluster.multiplet_type = 'ddt';
                                        break;
                                    case 'doublet of triplet of doublets feature':
                                        compound_cluster.multiplet_type = 'dtd';
                                        break;
                                    case 'triplet of doublets of doublets feature':
                                        compound_cluster.multiplet_type = 'tdd';
                                        break;
                                    case 'quintet feature':
                                        compound_cluster.multiplet_type = 'quint';
                                        break;
                                    case 'multiplet feature':
                                        compound_cluster.multiplet_type = 'm';
                                        break;
                                }

                                // look elsewhere for the multiplicity
                                if (!compound_cluster.hasOwnProperty('multiplet_type')) {
                                    switch (multiplet.multiplicity._accession) {
                                        case 'NMR:1000194':
                                            compound_cluster.multiplet_type = 's';
                                            break;
                                        case 'NMR:1000184':
                                            compound_cluster.multiplet_type = 'd';
                                            break;
                                        case 'NMR:1000185':
                                            compound_cluster.multiplet_type = 't';
                                            break;
                                        case 'NMR:1000186':
                                            compound_cluster.multiplet_type = 'q';
                                            break;
                                        case 'NMR:1000192':
                                            compound_cluster.multiplet_type = 'dd';
                                            break;
                                        case 'NMR:1000195':
                                            compound_cluster.multiplet_type = 'qunit';
                                            break;
                                        case 'NMR:1000196':
                                            compound_cluster.multiplet_type = 'dt';
                                            break;
                                        case 'NMR:1000197':
                                            compound_cluster.multiplet_type = 'td';
                                            break;
                                        case 'NMR:1400305':
                                            compound_cluster.multiplet_type = 'm';
                                            break;
                                    }
                                }
                            }
                        });
                    }
                }
                sv.trigger('adjust-end'); // updates Assignment table (NEED BETTER WAY)
            } else {
                console.error("Could not read in Spectrum Data");
            }

    }

    /**
     * Remove all the spectrum with the specified _id_ from the viewer.
     *
     * @param {Number} id ID of spectrum to remove
     */
    SpectraViewer2D.prototype.remove_spectra = function(id) {
        this._spectra = new JSV.SVSet( this._spectra.filter(function(spectrum) { return spectrum.id != id; }) );
    }

    /**
     * Remove all the spectra from the viewer
     */
    SpectraViewer2D.prototype.remove_all_spectra = function() {
        const sv = this;
        sv.selection.clear();
        this.all_spectra().forEach(function(spectrum) { sv.remove_spectra(spectrum.id) });
        sv.reset_boundaries();
    }

    SpectraViewer2D.prototype.reset_boundaries = function() {
        const sv = this;
        sv.selection.clear();
        sv.boundary.initialized = false
        sv.scale.initialized = false
        if (sv.min_boundaries) {
            sv.boundary.update(sv.min_boundaries);
            sv.scale.update(sv.min_boundaries);
        } else {
            sv.boundary.update({ x: [0, 1], y: [0, 1] })
            sv.scale.update({ x: [0, 1], y: [0, 1] })
        }
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Spectra or a single Spectrum from the viewer.
     * If no term is given, only **active** spectra are returned.
     * Otherwise all spectra will be search with the _term_.
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Spectrum}
     */
    SpectraViewer2D.prototype.spectra = function(term) {
        if (term) return this._spectra.get(term);
        const active_spectra = new JSV.SVSet(this._spectra.filter(function (s) {
            return s.active;
        }));
        return active_spectra.get(term);
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Spectra or a single Spectrum from the viewer.
     * This metod is the same as [SpectraViewer2D.spectra](SpectraViewer2D.js.html#spectra), except that if no
     * _term_ is given all spectra are returned, including inactive ones.
     *
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Spectrum}
     */
    SpectraViewer2D.prototype.all_spectra = function(term) {
        return this._spectra.get(term);
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Compounds or a single Compound from all the Spectra in the viewer.
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Compound}
     */
    SpectraViewer2D.prototype.compounds = function(term) {
        const compounds = new JSV.SVSet();
        let i = 0;
        const len = this._spectra.length;
        for (; i < len; i++) {
            compounds.merge(this._spectra[i].compounds());
        }
        return compounds.get(term);
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Clusters or a single Cluster from all the Spectra in the viewer.
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Cluster}
     */
    SpectraViewer2D.prototype.clusters = function(term) {
        const clusters = new JSV.SVSet();
        let i = 0;
        const len = this._spectra.length;
        for (; i < len; i++) {
            clusters.merge(this._spectra[i].clusters());
        }
        return clusters.get(term);
    }

    /**
     * Clear the viewer canvas
     */
    SpectraViewer2D.prototype.clear = function(fast = false) {
        if(fast){
            this.context.clearRect(0, -1, JSV.pixel(this.width), JSV.pixel(this.height)+1);
            this.context.clearRect(-this.x_range()[0] * 0.08,
                JSV.pixel(this.height) - JSV.pixel(this.axis_x_gutter),
                JSV.pixel(this.width), JSV.pixel(this.height));
        } else {
            this.shift_plot(true)
            this.context.clearRect(0, 0, JSV.pixel(this.width), JSV.pixel(this.height));
            this.shift_plot()
        }
    }

    /**
     * Draws the contents of the viewer. This method should rarely be called directly.
     * Instead use, the convenience methods that call it:
     *
     *  - [SpectraViewer2D.full_draw](SpectraViewer2D.js.html#full_draw)
     *  - [SpectraViewer2D.calc_draw](SpectraViewer2D.js.html#calc_draw)
     *
     * @param {Boolean} fast If true, use simplified XY data if available
     * @param {Boolean} caculated If true, calculate XY data instead of using precomputed XY data.
     * @param {Number} pixel_skip If true, when calculating XY data skip this number of pixels between X values
     */
    SpectraViewer2D.prototype.draw = function(fast, calculated, pixel_skip) {
        const start_time = new Date().getTime();
        const sv = this;
        fast = fast || false
        const context = this.context;
        const scale = this.scale;
        this.clear(fast);
        // Draw Grid lines
        if (this.axis_y_grid) this.draw_grid_lines('y');
        if (this.axis_x_grid) this.draw_grid_lines('x');
        this.spectra().forEach(function(spectrum) {
                spectrum.draw(context, scale, fast, sv.scaled_height, sv.x_range(), sv.threshold);
        });
        this.draw_axes();

        if (this.debug) {
            this.debug_data.time['draw'] = JSV.elapsed_time(start_time);
        }
    }

    /**
     * Draw using the full data (not simplified).
     * If zoomed in enough so that the number of points in the spectra
     * is less than the number of pixels in the viewer then then lines
     * will be calculated if possible.
     */
    SpectraViewer2D.prototype.full_draw = function() {
        const ppm_range = this.scale.x.domain()[1] - this.scale.x.domain()[0];
        const point_range = this.points_per_ppm * ppm_range;
        const pixel_range = Math.abs(this.scale.x.range()[1] - this.scale.x.range()[0]);
        ( (pixel_range / point_range) > 3 ) ? this.draw(false, true, 1) : this.draw(false, false);
    }

    /**
     * Draw by calculating the line shapes, using every visible pixel.
     */
    SpectraViewer2D.prototype.calc_draw = function() {
        this.draw(false, true, 1);
    }

    /**
     * Draw by calculating the line shapes, skipping several pixels
     */
    SpectraViewer2D.prototype.fast_calc_draw = function() {
        // this.draw(true, true, 2);
        this.draw(false, true, 2);
    }

    /**
     * Draw using simplified data if available. When zoomed in enough
     * the full data will be used.
     */
    SpectraViewer2D.prototype.fast_draw = function() {
        // Turn off fast draw when zoomed in 10x or more
        // TODO: determine at what level fast draw should be turned off based on the spectra length
        //       - this would be best if done at the spectrum level
        this.draw(true);
        // this.draw(true);
    }

    /**
     * Flash a message on the center of the viewer.
     */
    SpectraViewer2D.prototype.flash = function(msg) {
        this.context.font = this.adjust_font(1.5);
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';
        const x = JSV.pixel(this.width) / 2;
        const y = JSV.pixel(this.height) / 2;
        this.context.fillText(msg, x, y);
    }

    // Draws any information in 'data' onto the left side of the viewer
    SpectraViewer2D.prototype.draw_debug = function(y) {
        if (!this.debug) return;
        const context = this.context;
        const data = this.debug_data;

        context.font = this.adjust_font(1, 'monospace');
        context.fillStyle = 'black';
        const line_height = JSV.pixel(18);
        y =  y || 0;
        let x;
        if (this.axis_x_reverse) {
            x = JSV.pixel(10);
            context.textAlign = 'left';
        } else {
            x = JSV.pixel(this.width - 10);
            context.textAlign = 'right';
        }
        const section_keys = this.debug === true ? Object.keys(data) : this.debug;
        let i = 0;
        section_keys.forEach(function(section_key) {
            const data_keys = Object.keys(data[section_key]);
            data_keys.forEach(function(data_key) {
                context.fillText((section_key + '|' + data_key + ': ' + data[section_key][data_key]), x, y + (line_height * i));
                i += 1;
            });
        })
    }

    // Returns a canvas font string adjusted to the size of the canvas
    SpectraViewer2D.prototype.adjust_font = function(font_factor, font_family, font_style) {
        font_factor = font_factor || 1;
        font_family = font_family || 'Sans-Serif';
        font_style  = font_style  || '';
        // ratio of default font size over default canvas width
        const ratio = 9 / 1400 * font_factor;
        const fontsize = ratio * JSV.pixel(this.width) + JSV.pixel(5);
        return font_style + ' ' + fontsize + 'pt ' + font_family;
    }

    SpectraViewer2D.prototype.draw_axes = function() {
        const scale = this.scale;
        this.context.strokeStyle = 'black'; // axes color
        this.context.lineWidth = 1; // axes color
        this.context.setLineDash([1,0]);
        // Clear plot graphics from the X axis area
        const y_gutter = JSV.pixel(this.axis_y_gutter);
        const x_gutter = JSV.pixel(this.axis_x_gutter);
        // Clear plot graphics from the X axis area
        this.context.clearRect(scale.x.range_min(), scale.y.range_max(), scale.x.range_max() + y_gutter, x_gutter);
        // Clear plot graphics from the Y axis area
        const x = this.axis_x_reverse ? scale.x.range_max() : 0;
        this.context.clearRect(x, scale.y.range_min(), y_gutter, scale.y.range_max() + x_gutter);
        // Draw
        this.context.fillStyle = 'black';
        if (this.axis_y_show) this.draw_y_axis();
        if (this.axis_x_show) this.draw_x_axis();
    }

    SpectraViewer2D.prototype.draw_x_axis = function() {
        // Create a variable so we can access the chart in the tick drawing function
        const self = this;
        const tick_length = JSV.pixel(this.tick_length);
        const context = this.context;
        const scale = this.scale;

        // Draw axis line
        context.beginPath();
        context.moveTo(scale.x.range()[1], scale.y.range()[1]);
        context.lineTo(scale.x.range()[0], scale.y.range()[1]);
        context.stroke();
        // Set up text
        context.textAlign = 'center';
        context.textBaseline = 'top';
        context.font = this.font;
        // Draw ticks and text
        scale.x.ticks(this.x_tick_count).forEach(function(tick_x) {
            context.beginPath();
            context.moveTo(scale.x(tick_x), scale.y.range()[1]);
            context.lineTo(scale.x(tick_x), scale.y.range()[1] + tick_length);
            context.stroke();
            let rounded_tick_x = +tick_x.toFixed(self.tick_precision);
            context.fillText(self.axis_x_tick_format(rounded_tick_x), scale.x(tick_x), scale.y.range()[1] + tick_length);
        });
        // Draw x label
        if (this.axis_x_title) {
            context.font = this.axis_title_font;
            const label_x = scale.x.range_diff() / 2;
            const label_y = scale.y.range()[1] + (3 * tick_length);
            context.fillText(this.axis_x_title, label_x, label_y)
        }
    }

    SpectraViewer2D.prototype.draw_y_axis = function() {
        const sv = this;
        const context = this.context;
        const scale = this.scale;
        const padding = 5;
        const direction = this.axis_x_reverse ? 1 : -1;
        const tick_length = direction * JSV.pixel(this.tick_length);
        const text_x = scale.x.range()[0] + (direction * JSV.pixel(this.tick_length + padding));
        // Draw axis line
        context.beginPath();
        context.moveTo(scale.x.range()[0], scale.y.range()[1]);
        context.lineTo(scale.x.range()[0], scale.y.range()[0]);
        context.stroke();
        // Set up text
        context.textAlign = this.axis_x_reverse ? 'left' : 'right';
        context.textBaseline = 'middle';
        context.font = this.font;
        let max_label_width = 0;

        // Draw ticks and text
        let y_ticks = scale.y.ticks(this.tick_count);
        y_ticks.forEach(function(tick_y) {
            context.beginPath();
            context.moveTo(scale.x.range()[0], scale.y(tick_y));
            context.lineTo(scale.x.range()[0] + tick_length, scale.y(tick_y));
            context.stroke();
            context.fillText(sv.axis_y_tick_format(tick_y), text_x, scale.y(tick_y));
            if (sv.axis_y_title) {
                const label_width = Number(context.measureText(tick_y).width);
                if (label_width > max_label_width) max_label_width = label_width;
            }
        });
        // Draw y label
        if (this.axis_y_title) {
            const margin = JSV.pixel(4);
            const gutter = JSV.pixel(this.axis_y_gutter);
            const font_height = /(\d+\.?\d*)pt/.exec(this.axis_title_font)[1];
            // Width of text and ticks filling up the gutter
            const draw_width = max_label_width + Math.abs(tick_length) + Number(font_height) + margin + padding;
            if ( draw_width < gutter) {
                context.save();
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.font = this.axis_title_font;
                // Determine center point of label
                const label_x = scale.x.range()[0] + ((7 * tick_length) * direction);
                const label_y = scale.y.range()[1] / 2;
                // Move to center
                context.translate(label_x, label_y);
                // Rotate Label
                context.rotate(direction * Math.PI / 2);
                // Move back to origin
                context.translate(-label_x, -label_y);
                // Draw label
                context.fillText(this.axis_y_title, label_x, label_y);
                context.restore();
            }
        }
    }

    SpectraViewer2D.prototype.draw_grid_lines = function(axis) {
        const sv = this;
        const context = this.context;
        const orig_context = context;
        const scale = this.scale;
        scale[axis].ticks(this.tick_count).forEach(function(tick) {
            context.beginPath();
            if (axis == 'y') {
                context.moveTo(scale.x.range()[0], scale.y(tick));
                context.lineTo(scale.x.range()[1], scale.y(tick));
            } else if (axis == 'x') {
                context.moveTo(scale.x(tick), scale.y.range()[0]);
                context.lineTo(scale.x(tick), scale.y.range()[1]);
            }
            context.strokeStyle = 'rgb(210,210,210)'; // axes color
            context.lineWidth = JSV.pixel(0.5);
            // context.setLineDash([2,2]);
            context.stroke();
        });
        this.context = orig_context;
    }

    SpectraViewer2D.prototype.elements = function(element_type, parent, possible_elements, visible_only) {
        const sv = this;
        let elements = possible_elements;
        if (!possible_elements) {
            parent = JSV.default_for(parent, sv);
            if (typeof parent == 'string') {
                parent = sv.spectra(parent);
            }
            if (!parent) {
                elements = new JSV.SVSet();
            } else if (element_type == 'peak') {
                elements = parent.peaks();
            } else if (element_type == 'cluster') {
                elements = parent.clusters();
            } else if (element_type == 'compound') {
                elements = parent.compounds();
            } else if (element_type == 'spectrum') {
                elements = parent.spectra();
            } else {
                elements = new JSV.SVSet();
            }
        }
        if (visible_only) {
            elements = new JSV.SVSet(elements.filter(function(e) { return e.visible; }));
        }
        return elements;
    }


    SpectraViewer2D.prototype.image = function(width, height) {
        width = width || this.width;
        height = height || this.height;

        // Save current settings
        const orig_context = this.context;

        // Generate new context and scales
        const temp_canvas = d3v7.select('body').append('canvas')
            .attr('width', width)
            .attr('height', height)
            .node();

        JSV.scale_resolution(temp_canvas, JSV.pixel_ratio);
        this.context = temp_canvas.getContext('2d');

        const scaled_height = JSV.pixel(height - this.axis_x_gutter);
        this.scale.x.range(this.x_range(width));
        this.scale.y.range([scaled_height, 0]);

        // Generate image
        this.full_draw();
        image = temp_canvas.toDataURL();

        // Restore original settings
        this.scale.x.range(this.x_range());
        this.scale.y.range([this.scaled_height, 0]);
        this.context = orig_context;

        // Delete temp canvas
        d3v7.select(temp_canvas).remove();

        return image;
    }


    JSV.SpectraViewer2D = SpectraViewer2D;

})(JSpectraViewer);//////////////////////////////////////////////////////////////////////////////
// Initializing Zooming, Dragging, Brushing, Drag-n-Drop, AdjustFit
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  /**
   * Initialize Spectra Viewer Dragging.
   */
  JSV.SpectraViewer.prototype.initialize_dragging = function() {
    const sv = this;
    sv.drag_event = false;
    sv.drag_behavior = d3v7.drag()
        .on('start', dragstart)
        .on('drag',      dragging)
        .on('end',   dragend);
    sv.svg.call(sv.drag_behavior);

    function dragstart(event) {
      sv.drag_event = true;
      event.sourceEvent.preventDefault(); // Prevent text cursor
      sv.svg.style('cursor', 'all-scroll');
      // Store current selection to restore it if dragging does occur
      // current_selected_elements = sv.selection.elements();
      sv.trigger('drag-start');
    }

    function dragging(event) {
      const start_time = new Date().getTime();
      // Restore selected peaks
      // if (sv.selection.empty()) sv.selection._elements = current_selected_elements;
      sv.translate_axis('x', event.dx);
      sv.translate_axis('y', event.dy);
      sv.trigger('drag');
      sv.fast_draw();

      // DEBUG INFO
      if (sv.debug) {
        console.log('dragging');
        sv.debug_data.time['drag'] = JSV.elapsed_time(start_time);
        sv.debug_data.drag['dX'] = JSV.round(event.dx);
        sv.debug_data.drag['dY'] = JSV.round(event.dy);
        sv.debug_data.drag['zX'] = JSV.round(sv.zoom_x);
        sv.debug_data.drag['zY'] = JSV.round(sv.zoom_y);
      }
    }

    function dragend() {
      sv.drag_event = false;
      sv.trigger('drag-end');
      sv.full_draw();
    }
  }

  /**
   * Initialize Spectra Viewer Zooming.
   */
  JSV.SpectraViewer.prototype.initialize_zooming = function() {
    const sv = this;
    sv.zoom_behavior = d3v7.zoom()
        .scaleExtent([1, sv.zoom_max])
        .on('start', zoomstart)
        .on('zoom',      zooming)
        .on('end',   zoomend);
    sv.svg.call(sv.zoom_behavior)
        .on('mousedown.zoom', null) // Remove click zoom behaviour
        .on('dblclick.zoom', null); // Remove double click zoom behaviour
    // Set starting zoom levels and axis
    sv.zoom_x = 1;
    sv.zoom_y = 1;
    sv.zoom_axis = 'x';
    // Possigle keys: 'altKey', 'shiftKey', 'ctrlKey', 'metaKey'
    // sv.zoom_y_key = 'shiftKey';
    sv.zoom_y_key = 'altKey';

    function zoomstart(event) {
      if (sv.drag_event) return; // Spectra dragging takes precedence over zooming
      const zoom_y_key_down = event.sourceEvent[sv.zoom_y_key];
      sv.set_zoom_axis(zoom_y_key_down, event);
      sv.set_zoom_cursor(zoom_y_key_down);
      sv.trigger('zoom-start');
    }

    function zooming(event) {
      if (sv.drag_event) return; // Spectra dragging takes precedence over zooming
      const start_time = new Date().getTime();

      // Set up which axis to zoom
      sv.set_zoom_axis(event.sourceEvent[sv.zoom_y_key], event);

      // Scale axes based on current level
      sv.scale_axis(sv.zoom_axis, event.transform.k, event);

      // sv.trigger('zoom');
      sv.fast_draw();

      // DEBUG INFO
      if (sv.debug) {
        console.log('zooming');
        sv.debug_data.time['zoom'] = JSV.elapsed_time(start_time);
        sv.debug_data.zoom['zX'] = JSV.round(sv.zoom_x);
        sv.debug_data.zoom['zY'] = JSV.round(sv.zoom_y);
      }
    }

    function zoomend() {
      if (sv.drag_event) return; // Spectra dragging takes precedence over zooming
      sv.svg.style('cursor', 'all-scroll');
      sv.trigger('zoom-end');
      sv.full_draw();
    }
  }

  /**
   * Initialize Spectra Viewer Drag-n-Drop.
   */
  JSV.SpectraViewer.prototype.initialize_drag_drop_load = function() {
    const sv = this;
    this.svg.on('dragleave.dragndrop', function(event) {
      event.preventDefault();
      event.stopPropagation();
      sv.draw();
    });

    this.svg.on('dragover.dragndrop', function(event) {
      event.preventDefault();
      event.stopPropagation();
      sv.draw();
      sv.flash('Drop Bayesil JSON File...');
    });

    this.svg.on('drop.dragndrop', function(event) {
      event.preventDefault();
      event.stopPropagation();
      sv.draw();
      const file = event.dataTransfer.files[0];
      // console.log(file.type)
      sv.flash('Loading "' + file.name + '"...');
      const reader = new FileReader();
      sv.json_file = file;
      reader.onload = function() {
        const json_obj = reader.result;
        try {
          const json_parsed = JSON.parse(json_obj);
          // TODO: add file and error checking
          sv.replace_bayesil_data(json_parsed, true);
          sv.trigger('drop');
        } catch (e) {
          sv.draw();
          sv.flash('Could not read file: ' + e.message);
        }
      }
      reader.readAsText(file);
    });
  }

  /** @ignore */

})(JSpectraViewer);

//////////////////////////////////////////////////////////////////////////////
// Initializing Zooming, Dragging, Brushing, Drag-n-Drop, AdjustFit
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {
    /**
     * Initialize Spectra Viewer Zooming.
     */
    JSV.SpectraViewer2D.prototype.initialize_zooming = function() {
        const sv = this;
        sv.zoom_behavior = d3v7.zoom()
            .scaleExtent([sv.zoom_min, sv.zoom_max])
            .on('zoom',      zooming)
        sv.svg.call(sv.zoom_behavior)
            .on('dblclick.zoom', null); // Remove double click zoom behaviour

        function zooming(event) {
            if (sv.drag_event) return; // Spectra dragging takes precedence over zooming
            sv.threshold = event.transform.k;
            sv.fast_draw();
        }

    }


    JSV.SpectraViewer2D.prototype.drag_zoom = function() {
        const sv = this;
        const context = sv.svg;

        const start = (event) => {
            sv.zoom_rect.origin = [event.x, event.y];
            sv.zoom_rect.translated_origin = sv.absolute_to_translated_context(JSV.pixel(sv.zoom_rect.origin[0]),
                JSV.pixel(sv.zoom_rect.origin[1]));

            sv.zoom_rect.r = context.append("rect")
                .attr("id", "zoom-rect")
                .attr("style", "fill:blue;fill-opacity:0.1;")
                .attr('x', sv.zoom_rect.origin[0])
                .attr('y', sv.zoom_rect.origin[1])
                .attr('width', 1)
                .attr('height', 1);
        }

        const drag = (event) => {
            sv.zoom_rect.r
                .attr("x", Math.min(sv.zoom_rect.origin[0], event.x))
                .attr("y", Math.min(sv.zoom_rect.origin[1], event.y))
                .attr("width", Math.abs(event.x - sv.zoom_rect.origin[0]))
                .attr("height", Math.abs(event.y - sv.zoom_rect.origin[1]));
        }

        const end = (event) => {
            const sorter = (a, b) => {
                return a - b;
            };

            const translated_mouse = sv.absolute_to_translated_context(JSV.pixel(event.x), JSV.pixel(event.y));
            if (event.x !== sv.zoom_rect.origin[0] && event.y !== sv.zoom_rect.origin[1]) {
                sv.move_to([[sv.zoom_rect.translated_origin[0], translated_mouse[0]].sort(sorter),
                    [sv.zoom_rect.translated_origin[1], translated_mouse[1]].sort(sorter)],
                    500);
            }
            sv.zoom_rect.r.remove();
        }

        return {
            start: start,
            drag: drag,
            end: end
        };
    }

    /** @ignore */

})(JSpectraViewer);
