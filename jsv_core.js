// jsv_core.js - SVScale, SVEvents, SVSet, SVData, SVData2D, SVPath
// Load order: 3 of 8
//
//////////////////////////////////////////////////////////////////////////////
// SpectraViewer Scale
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  const LinearScale = function () {

    const d3_scale = d3v7.scaleLinear();

    d3_scale.min = function (x) {
      if (!arguments.length) return d3_scale.domain()[0];
      if (x > d3_scale.max()) {
        throw new Error('x must be less than domain max: ' + d3_scale.max());
      }
      // d3_scale.domain([ x, d3_scale.domain()[1] ]);
      d3_scale.domain([x, d3_scale.max()]);
      return d3_scale;
    }

    d3_scale.max = function (x) {
      if (!arguments.length) return d3_scale.domain()[1];
      if (x < d3_scale.min()) {
        throw new Error('x must be greater than domain min: ' + d3_scale.min());
      }
      // d3_scale.domain([ d3_scale.domain()[0], x ]);
      d3_scale.domain([d3_scale.min(), x]);
      return d3_scale;
    }

    d3_scale.diff = function () {
      return Math.abs(d3_scale.max() - d3_scale.min());
    }

    d3_scale.range_diff = function () {
      return Math.abs(d3_scale.range()[1] - d3_scale.range()[0]);
    }

    d3_scale.range_min = function () {
      return d3v7.min(d3_scale.range());
    }

    d3_scale.range_max = function () {
      return d3v7.max(d3_scale.range());
    }

    return d3_scale;
  };

  const SVScale = function () {
    this.x = JSV.LinearScale();
    this.y = JSV.LinearScale();
    this.initialized = false;
  };

  SVScale.prototype.clamp = function(x) {
    this.x.clamp(x);
    this.y.clamp(x);
  }

  /**
   * Update the scale/boundary based on the added data and the current scale/boundary.
   * @param {Object} data Data must be an object with an x and y array of min/max values.
   *   For example:
   *   ```js
   *   boundaries = { x: [-1, 10], y: [0, 1] };
   *   ```
   */
  SVScale.prototype.update = function(data) {
    // TODO: Handle multiple spectra better here
    // Only assign current x/y min/max if boundaries have been set before
    const current_x_max = this.initialized ? this.x.max() : null
    // const current_x_min = this.initialized ? this.x.min() : null
    const current_y_max = this.initialized ? this.y.max() : null
    // const current_y_min = this.initialized ? this.y.min() : null

    // Determine new boundaries (min/max x/y)
    let x_max = Number.NEGATIVE_INFINITY;
    let x_min = Number.POSITIVE_INFINITY;
    let y_max = Number.NEGATIVE_INFINITY;
    let y_min = Number.POSITIVE_INFINITY;

    data.x.concat(current_x_max).forEach((x) => {
        if(x > x_max) x_max = x;
      }
    )

    data.x.forEach((x) => {
      if(x < x_min) x_min = x;
    })

    data.y.concat(current_y_max).forEach((y) => {
          if(y > y_max) y_max = y;
        }
    )

    data.y.forEach((y) => {
      if(y < y_min) y_min = y;
    })

    // Update scale boundaries
    this.x.domain([x_min, x_max]);
    this.y.domain([y_min, y_max]);
    this.initialized = true;
  }

  JSV.LinearScale = LinearScale;
  JSV.SVScale = SVScale;

})(JSpectraViewer);


//////////////////////////////////////////////////////////////////////////////
// SpectraViewer Events
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  /**
   * SVEvents is a system to plug in callbacks to specific events in JSV.
   * Use [on](#on) to add a callback and [off](#off) to remove it.
   * Here are a list of events supported in JSV:
   *
   *  Event               | Description
   *  --------------------|-------------
   *  drag-start          | Called once before viewer starts drag animation
   *  drag                | Called every frame of the drag animation
   *  drag-end            | Called after dragging is complete
   *  zoom-start          | Called once before viewer starts zoom animation
   *  zoom                | Called every frame of the zoom animation
   *  zoom-end            | Called after zooming is complete
   *  domain-change       | Called after the viewer domains have changed
   *  adjust-start        | Called once on mouse down on a selection
   *  adjust              | Called while moving the selection
   *  adjust-end          | Called once after adjustment is complete, including deletions and peak creation
   *  adjust-peak-created | Called after peak creation
   *  selection-add       | Called when an element is added to the selection
   *  selection-remove    | Called after an element is removed from the selection
   *  selection-clear     | Called before the selection is cleared
   *  selection-empty     | Called after the selection becomes empty
   *  highlight-start     | Called when an element is highlighted
   *  highlight-end       | Called when an element is unhighlighted
   *  label-click         | Called when a annotation label is clicked
   *  cluster-navigator-updated | Called when the SVClusterNavigator table is updated
   *
   *  structure-click     | Called when atom or structure container is clicked
   */
  const SVEvents = function () {
    const handlers = {};

    /**
     * Attach a callback function to a specific JSV event.
     * ```js
     * sv = new JSV.SpectraViewer('#my-spectra');
     * sv.on('drag-start', function() { console.log('Dragging has begun!') };
     *
     * // The event can be namespaced for easier removal later
     * sv.on('drag-start.my_plugin', function() { console.log('Dragging has begun!') };
     * ```
     * @param {String} event Name of event. Events can be namespaced.
     * @param {Function} callback Function to call when event is triggered
     */
    this.on = function (event, callback) {
      check_type(event);
      const type = parse_event(event);
      if (!handlers[type]) handlers[type] = [];
      handlers[type].push(new Handler(event, callback));
    }

    /**
     * Remove a callback function from a specific JSV event. If no __callback__ is provided,
     * then all callbacks for the event will be removed. Namespaced events can and should be used
     * to avoid unintentionally removing callbacks attached by other plugins.
     * ```js
     * // Remove all callbacks attached to the 'drag-start' event.
     * // This includes any namespaced events.
     * sv.off('drag-start');
     *
     * // Remove all callbacks attached to the 'drag-start' event namespaced to 'my_plugin'
     * sv.off('drag-start.my_plugin');
     *
     * // Remove all callbacks attached to any events namespaced to 'my_plugin'
     * sv.off('.my_plugin');
     * ```
     * @param {String} event Name of event. Events can be namespaced.
     * @param {Function} callback Specfic function to remove
     */
    this.off = function (event, callback) {
      check_type(event);
      const type = parse_event(event);
      const namespace = parse_namespace(event);
      // If no callback is supplied remove all of them
      if (arguments.length == 1) {
        if (namespace) {
          if (type) {
            handlers[type] = handlers[type].filter(function (h) {
              return h.namespace != namespace;
            });
          } else {
            Object.keys(handlers).forEach(function (key) {
              handlers[key] = handlers[key].filter(function (h) {
                return h.namespace != namespace;
              });
            });
          }
        } else {
          handlers[type] = undefined;
        }
      } else {
        // Remove specific callback
        handlers[type] = handlers[type].filter(function (h) {
          return h.callback != callback;
        });
      }
    }

    /**
     * Trigger a callback function for a specific event.
     * ```js
     * // Triggers all callback functions associated with drag-start
     * sv.trigger('drag-start');
     *
     * // Triggers can also be namespaced
     * sv.trigger('drag-start.my_plugin');
     * ```
     * @param {String} event Name of event. Events can be namespaced.
     * @param {Object} object Object to be passed back to 'on'.
     */
    this.trigger = function (event, object) {
      check_type(event);
      const type = parse_event(event);
      const namespace = parse_namespace(event);
      if (Array.isArray(handlers[type])) {
        handlers[type].forEach(function (handler) {
          if (namespace) {
            if (handler.namespace == namespace) handler.callback.call(null, object);
          } else {
            handler.callback.call(null, object);
          }
        });
      }
    }

    /** @ignore */

    var check_type = function (type) {
      if (typeof type != 'string') {
        throw new Error('Type must be a string');
      }
    }
  };

  const Handler = function(event, callback) {
    this.callback = callback;
    this.event_type = parse_event(event);
    this.namespace = parse_namespace(event);
  }

  const parse_event = function(event) {
    return event.replace(/\..*/, '');
  }

  const parse_namespace = function(event) {
    const result = event.match(/\.(.*)/);
    return result ? result[1] : undefined
  }


  JSV.SVEvents = SVEvents;

})(JSpectraViewer);
//////////////////////////////////////////////////////////////////////////////
// SVSet
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  /**
   * SVSet is essentially an array for holding JSV Objects. Any method
   * that works directly on an Array (Mutator methods) will work on a SVSet
   * (e.g. pop, push, reverse)
   *
   * If a single array is provided it will be converted to an SVSet.
   * If mulitple elements are provided, they will be added to the new SVSet.
   */
  const SVSet = function () {
    if ((arguments.length == 1) && (Array.isArray(arguments[0]))) {
      this.push.apply(this, arguments[0])
    } else if (arguments.length > 0) {
      this.push.apply(this, arguments)
    }
  };
  SVSet.prototype = Object.create(Array.prototype);

  /**
   * Return the string 'SVSet'
   * @return {String}
   */
  SVSet.prototype.toString = function() { return 'SVSet' }

  /**
   * Push the elements of the supplied SVSet/Array on to the SVSet.
   * @param {SVSet|Array} svset SVSet or Array to add
   * @return {SVSet}
   */
  SVSet.prototype.merge = function(svset) {
    this.push.apply(this, svset);
    return this;
  };

  /**
   * Change one or more properties of each element of the SVSet.
   * ```javascript
   * my_svset.attr(property, value)
   * my_svset.attr( {property1: value1, property2: value2} )
   * ```
   *
   * @param {Property|Value} attributes A property name and the new value.
   * @param {Object}     attributes An object properties and their new values.
   * @return {SVSet}
   */
  SVSet.prototype.attr = function(attributes) {
    if ( (arguments.length == 1) && (typeof attributes == 'object') ) {
      const keys = Object.keys(attributes);
      const key_len = keys.length;
      let set_i = 0;
      const set_len = this.length;
      for (; set_i < set_len; set_i++) {
        for (let key_i=0; key_i < key_len; key_i++) {
          this[set_i][keys[key_i]] = attributes[keys[key_i]];
        }
      }
    } else if (arguments.length == 2) {
      let i = 0;
      const len = this.length;
      for (; i < len; i++) {
        this[i][arguments[0]] = arguments[1];
      }
    } else if (attributes != undefined) {
      throw new Error('attr(): must be 2 arguments or a single object');
    }
    return this;
  }

  /**
   * Call the draw method for each element in the SVSet.
   * See [SVPath.draw](SVPath.js.html#draw) for details
   * @param {} context
   * @param {} scale
   * @param {} fast
   * @param {} calculated
   * @param {} pixel_skip
   * @retrun {SVSet}
   */
  SVSet.prototype.draw = function(context, scale, fast, calculated, pixel_skip, threshold = null) {
    let i = 0;
    const len = this.length;
    for (; i < len; i++) {
      if(threshold)
        this[i].draw(context, scale, fast, calculated, pixel_skip);
      else
        this[i].draw(context, scale, fast, calculated, pixel_skip, threshold);
    }
    return this;
  }

  /**
   * Iterates through each element of the SVSet and run the callback.
   * In the callback _this_ will refer to the element.
   * ```javascript
   * .each(function(index, element))
   * ```
   *
   * Note: This is slower then a _forEach_ or a _for loop_ directly on the set.
   * @param {Function} callback Callback run on each element of SVSet.
   *   The callback will be called with 2 parameters: the index of the element
   *   and the element itself.
   * @return {SVSet}
   */
  SVSet.prototype.each = function(callback) {
    let i = 0;
    const len = this.length;
    for (; i < len; i++) {
      callback.call(this[i], i, this);
    }
    return this;
  }

  /**
   * Returns true if the SVSet contains the element.
   * @param {Object} element Element to check for
   * @return {Boolean}
   */
  SVSet.prototype.contains = function(element) {
    return (this.indexOf(element) >= 0)
  }

  /**
   * Returns new SVSet with element removed
   * @return {SVSet}
   */
  SVSet.prototype.remove = function(element) {
    let self = this;
    self = new SVSet( self.filter(function(i) { return i != element }) );
    return self;
  }

  /**
   * Return true if the SVSet is empty.
   * @return {Boolean}
   */
  SVSet.prototype.empty = function() {
    return this.length == 0;
  }

  /**
   * Returns true if the SVSet is not empty.
   * @return {Boolean}
   */
  SVSet.prototype.present = function() {
    return this.length > 0;
  }

  /**
   * Sorts the SVSet by the provided property name.
   * @param {String} property Property to order each element set by [default: 'center']
   * @param {Boolean} descending Order in descending order (default: false)
   * @return {SVSet}
   */
  SVSet.prototype.order_by = function(property, descending) {
    // Sort by function call
    if (this.length > 0) {

      if (typeof this[0][property] === 'function'){
        this.sort(function(a,b) {
          if (a[property]() > b[property]()) {
            return 1;
          } else if (a[property]() < b[property]()) {
            return -1;
          } else {
            return 0;
          }
        })
      } else {
        // Sort by property
        this.sort(function(a,b) {
          if (a[property] > b[property]) {
            return 1;
          } else if (a[property] < b[property]) {
            return -1;
          } else {
            return 0;
          }
        })
      }
    }
    if (descending) this.reverse();
    return this;
  }

  SVSet.prototype.lineWidth = function(width) {
    let i = 0;
    const len = this.length;
    for (; i < len; i++) {
      this[i].lineWidth = width;
    }
    return this;
  }

  /**
   * Retrieve subset of SVSet or an individual element from SVSet depending on term provided.
   * @param {Undefined} term Return full SVSet
   * @param {Integer}   term Return element at that index (base-1)
   * @param {String}    term Return first element with id same as string. If the id starts
   *   with 'path-id-', the first element with that path-id will be returned.
   * @param {Array}     term Return SVSet with elements with matching ids
   * @return {SVSet|or|Element}
   */
  SVSet.prototype.get = function(term) {
    // if (arguments.length == 0) {
    if (term == undefined) {
      return this;
    } else if (Number.isInteger(term)) {
      return this[term-1];
    } else if (typeof term == 'string') {
      if ( term.match(/^path-id-/) ) {
        return this.filter(function(element) { return element.path_id() == term; })[0];
      } else if ( term.match(/^label-id-/) ) {
        return this.filter(function(element) { return element.label_id() == term; })[0];
      } else {
        return this.filter(function(element) { return element.id == term; })[0];
      }
    } else if (Array.isArray(term)) {
      const filtered = this.filter(function (element) {
        return term.some(function (id) {
          return element.id == id;
        });
      });
      const svset = new SVSet();
      svset.push.apply(svset, filtered);
      return svset;
    } else {
      return new SVSet();
    }
  }

  /**
   * Returns true if set matchs the supplied set. The order does not matter
   * and duplicates are ignored.
   * @param {SVSet}     term SVSet to compare against
   * @return {Boolean}
   */
  SVSet.prototype.equals = function(set) {
    if (set.toString() != 'SVSet' && !Array.isArray(set)) { return false }
    const setA = this.unique();
    const setB = set.unique();
    let equals = true;
    if (setA.length != setB.length) {
      return false
    }
    setA.forEach(function(a) {
      if (!setB.contains(a)) {
        equals = false
        return
      }
    })
    return equals
  }

  /**
   * Return new SVSet with no duplicated values.
   * @return {SVSet}
   */
  SVSet.prototype.unique = function() {
    return new SVSet(this.filter( onlyUnique ));
  }

  function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
  }

  // Polyfill for Array
  SVSet.prototype.find = function(predicate) {
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    const list = Object(this);
    const length = list.length >>> 0;
    const thisArg = arguments[1];
    let value;

    for (let i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return value;
      }
    }
    return undefined;
  };

  /** @ignore */

  JSV.SVSet = SVSet;

})(JSpectraViewer);

//////////////////////////////////////////////////////////////////////////////
// SVData
// Object to store X/Y data
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  const SVData = function (data) {
    if (data === undefined) {
      data = {x: [], y: []}
    }
    ;
    // If data is an array of objects convert them.
    if (data instanceof Array) {
      data = array_to_object(data);
    }
    // Confirm x and y are the same length
    if (data.x.length != data.y.length) {
      throw new Error('x and y must be the same length!');
    }
    if (data.yi && (data.yi.length != data.x.length)) {
      throw new Error('If present yi must be the same length as x and y!');
    }
    // Confirm arrays start at lowest x values first. If not reverse.
    const reverse_data = (data.x[0] > data.x[data.x.length - 1]);

    this.x = reverse_data ? data.x.reverse() : data.x;
    this.y = reverse_data ? data.y.reverse() : data.y;
    this.yi = (data.yi && reverse_data) ? data.yi.reverse() : data.yi;
  };

  SVData.prototype.length = function() {
    return this.x.length;
  }

  SVData.prototype.asArray = function() {
    const data = [];
    let point;
    let i = 0;
    const len = this.length();
    for (; i < len; i++) {
      point = { x: this.x[i], y: this.y[i] }
      if (this.yi) { point.yi = this.yi[i]; }
      data.push(point);
    }
    return data;
  }

  SVData.prototype.index_of = function(search_value, upper) {
    return JSV.index_of_value(this.x, search_value, upper);
  }

  SVData.prototype.simplify = function(tolerance, highQuality) {
    // return new SVData( simplify(this.asArray(), tolerance, highQuality) );
    return new SVData( JSV.simplify(this, tolerance, highQuality) );
  }

  const array_to_object = function(data) {
    const x = [], y = [], yi = [];
    let i = 0;
    const len = data.length;
    for (; i < len; i++) {
      x.push(data[i].x);
      y.push(data[i].y);
      if (data[0].yi) { yi.push(data[i].yi); }
    }
    const object = {x: x, y: y};
    if (data[0] && data[0].yi) { object.yi = yi; }
    return object;
  }



  JSV.SVData = SVData;

})(JSpectraViewer);
//////////////////////////////////////////////////////////////////////////////
// SVData2D
// Object to store X/Y/Z data
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

    const SVData2D = function (data) {
        if (data === undefined) {
            data = {x: [], y: [], z: []}
        }
        ;
        // If data is an array of objects convert them.
        if (data instanceof Array) {
            data = array_to_object(data);
        }
        // Confirm x and y are the same length
        if (data.z.length != (data.x.length * data.y.length)) {
            throw new Error('z length must be divisible by x and y length!')
        }

        this.x = data.x;
        this.y = data.y;
        this.z = data.z;
    };

    SVData2D.prototype.length = function() {
        return this.x.length;
    }

    SVData2D.prototype.asArray = function() {
        let data = [];
        let point;
        for (let i=0, len=this.length(); i < len; i++) {
            point = { x: this.x[i], y: this.y[i], z: this.z[i] }
            data.push(point);
        }
        return data;
    }

    // SVData2D.prototype.index_of = function(search_value, upper) {
    //     return JSV.index_of_value(this.x, search_value, upper);
    // }

    // SVData2D.prototype.simplify = function(tolerance, highQuality) {
    //     // return new SVData( simplify(this.asArray(), tolerance, highQuality) );
    //     return new SVData( JSV.simplify(this, tolerance, highQuality) );
    // }

    let array_to_object = function(data) {
        let x = [ ], y = [ ], z = [ ];
        let i = 0;
        const len = data.length;
        for (; i < len; i++) {
            x.push(data[i].x);
            y.push(data[i].y);
            z.push(data[i].z);
        }
        let object = {x:x, y:y, z:z};
        return object;
    }



    JSV.SVData2D = SVData2D;

})(JSpectraViewer);
//////////////////////////////////////////////////////////////////////////////
// SVPath
// Objects that will be drawn as paths should inherit from SVPath
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  path_id = 0;

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
  const SVPath = function(options, meta) {
    options = options || {};
    this.meta = meta || {};
    this.lineWidth = JSV.default_for(options.lineWidth, 1);
    this.color     = JSV.default_for(options.color, 'black');
    this.visible   = JSV.default_for(options.visible, true);
    this.dash      = JSV.default_for(options.dash, []);
    this.fill      = options.fill;
    this.path_id();
  }

  SVPath.prototype.peaks = function() {
    return new JSV.SVSet();
  }

  SVPath.prototype.path_id = function() {
    const new_id = generate_path_id();
    this.path_id = function() { return new_id; }
    return new_id;
  }

  const generate_path_id = function() {
    return 'path-id-' + path_id++;
  }

  SVPath.prototype.attr = function(attributes) {
    const keys = Object.keys(attributes);
    for (let i=0, len=keys.length; i < len; i++) {
      this[keys[i]] = attributes[keys[i]];
    }
    return this;
  }

  SVPath.prototype.display_settings = function(options) {
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

  // Determine best data to use for drawing based on 'fast' and 'calculate' and the
  // available data in the SVPath.
  SVPath.prototype.data_for_draw = function(scale, fast, calculate, pixel_skip) {
    let data;
    const has_data = this.xy_data != undefined;

    if (this.phasing && has_data && this.xy_data.yi != undefined) {
      let ph;
      const y = [ ];
      const len = this.xy_data.length();
      for (let i=0; i < len; i++) {
        ph = Math.PI * (1*this.ph0 + 1*(len-i-1)*this.ph1/len) / 180.0;
        y.push( ( Math.cos(ph) * this.xy_data.y[i] ) + ( Math.sin(ph) * this.xy_data.yi[i] ) );
      }
      data = {x:this.xy_data.x, y:y};
    } else if ( (calculate && this.peaks().length > 0) || (!has_data && this.peaks().length > 0) ) {
      if (!pixel_skip) pixel_skip = 1;
      const number_of_points = scale.x.range_diff() / JSV.pixel_ratio / pixel_skip;
      const fast_calc = pixel_skip > 1;
      data = JSV.xy_from_peaks(this.peaks(), number_of_points, scale.x.domain()[0], scale.x.domain()[1], fast_calc);
    } else if (has_data) {
      data = fast ? this.simple_xy_data : this.xy_data;
    } else {
      data = {x: [0], y: [0]};
      console.error('No data or Peaks for SVPath:');
    }
    return data;
  }

  SVPath.prototype.draw = function(context, scale, fast, calculate, pixel_skip) {
    if (this.visible) {
      const data = this.data_for_draw(scale, fast, calculate, pixel_skip);
      const min_index = JSV.index_of_value(data.x, scale.x.domain()[0], false);
      const max_index = JSV.index_of_value(data.x, scale.x.domain()[1], true);
      context.translate(0.5, 0.5);
      context.beginPath();
      const y_start = this.fill ? scale.y(0) : scale.y(data.y[min_index]);
      context.moveTo( scale.x(data.x[min_index]), y_start );
      for (let i = min_index; i <= max_index; i++) {
        context.lineTo( scale.x(data.x[i]), scale.y(data.y[i]) );
      }
      if (this.fill) {
        context.lineTo( scale.x(data.x[max_index]), scale.y(0) );
        context.fillStyle = this.fill;
        context.fill();
      }
      // context.lineWidth = JSV.pixel(0.5);
      context.lineWidth = JSV.default_for(this.lineWidth, 1);
      context.strokeStyle = this.color;
      context.setLineDash(this.dash);
      context.stroke();
      context.translate(-0.5, -0.5);
    }
  }

  JSV.SVPath = SVPath;

})(JSpectraViewer);
