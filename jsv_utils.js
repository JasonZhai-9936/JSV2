// jsv_utils.js - Utils, Simplify algorithm, Mol2SVG structure renderer
// Load order: 7 of 8
//
//////////////////////////////////////////////////////////////////////////////
// Utils
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  /**
   * Return the _default_value_ if _value_ is undefined
   * @param {Object} value         Returned if it is defined
   * @param {Object} default_value Returned if _value_ is undefined
   * @return {Object}
   */
  JSV.default_for = function(value, default_value) {
    return (value === undefined) ? default_value : value;
  }

  /**
   * Return the pixel ratio. The default is 1.
   */
  JSV.pixel_ratio = 1;

  /**
   * Converts provided number of pixels based on pixel ratio which depends on
   * the screen resolution. Typical displays will have a pixel ration of 1,
   * while retina displays will have a pixel ration of 2.
   *
   * **Important**: Whenever drawing on the canvas, convert the pixels first
   * using this method.
   *
   * @param {Integer} value Number of pixels
   * @return {Intger}
   */
  JSV.pixel = function(px) {
    return px * JSV.pixel_ratio;
  }

  JSV.get_pixel_ratio = function(canvas) {
    const context = canvas.getContext('2d');
    //  query the various pixel ratios
    const devicePixelRatio = window.devicePixelRatio || 1;

    const backingStoreRatio = context.webkitBackingStorePixelRatio ||
        context.mozBackingStorePixelRatio ||
        context.msBackingStorePixelRatio ||
        context.oBackingStorePixelRatio ||
        context.backingStorePixelRatio || 1;

    return devicePixelRatio / backingStoreRatio;
  }

  JSV.scale_resolution = function(canvas, ratio){
    // get the canvas and context
    const context = canvas.getContext('2d');

    // upscale the canvas if the two ratios don't match
    if (ratio != 1) {

      const oldWidth = canvas.width;
      const oldHeight = canvas.height;

      canvas.width  = oldWidth  * ratio;
      canvas.height = oldHeight * ratio;

      canvas.style.width  = oldWidth  + 'px';
      canvas.style.height = oldHeight + 'px';
    }
  }

  // Function to create subclasses
  Function.prototype.inherits = function(parent) {
    this.prototype = Object.create(parent.prototype);
  };

  /**
   * Merges top level properties of each supplied object.
   * ```javascript
   * JSV.merge({a:1, b:1}, {b:2, c:2}, {c:3, d:3});
   * //=> {a: 1, b: 2, c: 3, d: 3}
   * ```
   * If a non object is provided, it is ignored. This can be useful if
   * merging function arguments that may be undefined.
   * @param {Object} object_1,object_2,..,object_n Objects to merge
   * @return {Object}
   */
  JSV.merge = function() {
    const data = {};
    let object, keys, key;
    let arg_i = 0;
    const arg_len = arguments.length;
    for (; arg_i < arg_len; arg_i++) {
      object = arguments[arg_i];
      if (typeof object === 'object') {
        keys = Object.keys(object);
        let key_i = 0;
        const key_len = keys.length;
        for (; key_i < key_len; key_i++){
          key = keys[key_i];
          data[key] = object[key];
        }
      }
    }
    return data;
  }

  /**
   * Returns a string id using the _id_base_ and _start_ while
   * making sure the id is not in _current_ids_.
   * ```javascript
   * JSV.unique_id('spectra_', 1, ['spectra_1', 'spectra_2']);
   * //=> 'spectra_3'
   * ```
   * @param {String} id_base Base of ids
   * @param {Integer} start Integer to start trying to creat ids with
   * @param {Array} current_ids Array of current ids
   * @return {String}
   */
  JSV.unique_id = function(id_base, start, current_ids) {
    let id;
    do {
      id = id_base + start;
      start++;
    } while (current_ids.indexOf(id) > -1);
    return id;
  }


  /**
   * Rounds the number use d3v7.round. The only reason to use this method
   * is that it sets the default number of decimal places to 2.
   * @param {Number} value Number to round
   * @param {Integer} places Number of decimal places to round [Default: 2]
   * @return {Number}
   */
  JSV.round = function(value, places=2) {
    return d3v7.round(value, places);
  }

  /**
   * Returns the number of milliseconds elapsed since the supplied time.
   * The returned time will have 'ms' appended to it.
   * @param {Integer} old_time Old time in milliseconds
   * @return {Integer}
   */
  JSV.elapsed_time = function(old_time) {
    const elapsed = (new Date().getTime()) - old_time;
    return elapsed + ' ms';
  }

  /**
   * Binary search to find the index of data where data[index] equals _search_value_.
   * If no element equals value, the returned index will be the upper or lower [default]
   * index that surrounds the value.
   *
   * @param {Array} data Array of numbers. Must be sorted from lowest to highest.
   * @param {Number} search_value The value to search for.
   * @param {Boolean} upper Only used if no element equals the _search_value_
   *
   *    - _true_: return index to right of value
   *    - _false_: return index to left of value [default]
   *
   * @return {Number}
   */
  JSV.index_of_value = function(data, search_value, upper) {
    let min_index = 0;
    let max_index = data.length - 1;
    let current_index, current_value;
    if (data[min_index] >= search_value) return min_index;
    if (data[max_index] <= search_value) return max_index;

    while (max_index - min_index > 1) {
      current_index = (min_index + max_index) / 2 | 0;
      current_value = data[current_index];
      if (current_value < search_value) {
        min_index = current_index;
      } else if (current_value > search_value){
        max_index = current_index;
      } else {
        return current_index;
      }
    }
    return (upper ? max_index : min_index);
  }

  /**
   * Return the y value for the _x_value_ of a lorentzian peak with the specified
   * _center_, _width_, and _amplitude_.
   *
   * @param {Number} x_value The x value used to determine the y value
   * @param {Number} center Center of the lorentzian
   * @param {Number} width Width of the lorentzian at half height
   * @param {Number} amplitude Amplitude of the lorentzian
   * @return {Number}
   */
  JSV.lorentzian = function(x_value, center, width, amplitude) {
    const w2 = width * width;
    const shift = x_value - center;
    return amplitude * w2 / (w2 + (4 * shift * shift));
  }

  /**
   * Calculates the cumulative Y value from the peaks at _x_value_.
   * Each peak must have the following properties:
   *   - _center_
   *   - _width_
   *   - _amplitude_
   *
   * @param {Number} x_value The x value used to determine the y value
   * @param {Array} peaks An Array or SVSet of Peaks.
   * @return {Number}
   */
  JSV.sum_of_peaks = function(x_value, peaks) {
    let sum = 0;
    let peak;
    for (let i = 0; i < peaks.length; i++) {
      peak = peaks[i];
      sum += JSV.lorentzian(x_value, peak.center, peak.width, peak.amplitude);
    }
    return sum;
  };

  /**
   * Generate an array of x/y points for the provided _peaks_, making sure to
   * include the points at the peak amplitude for the peak within the limits.
   *
   * The returned xy_data will have the following structure:
   * ```javascript
   * xy_data = { x: [1,2,3], y: [4,5,6] }
   * ```
   *
   * @param {SVSet} peaks A SVSet of peaks
   * @param {Number} number_of_points Number of points to create from the _lowerlim_ to the _upperlim_
   * @param {Number} lowerlim Lowest x value
   * @param {Number} lowerlim Highest x value
   * @param {Boolean} fast If true, only use peaks within the limits or close to the outside limits. This speeds up the calculation by ignoring peaks that are far away and thus contribute little to the plot within the limits.
   * @return {Object}
   */
  JSV.xy_from_peaks = function(peaks, number_of_points, lowerlim, upperlim, fast) {
    if (fast) peaks = JSV.peaks_in_range(peaks, lowerlim, upperlim, 6);
    const peaks_in_view = JSV.peaks_in_range(peaks, lowerlim, upperlim);
    const centers = peaks_in_view.order_by('center').map(function (p) {
      return p.center;
    });
    let xpos = lowerlim;
    const xmax = upperlim;
    const x = [], y = [];
    const delta = ((upperlim - lowerlim) / number_of_points);
    while (xpos < xmax) {
      x.push(xpos);
      y.push(JSV.sum_of_peaks(xpos, peaks));
      if (centers[0] && (centers[0] <= xpos + delta) ) {
        xpos = centers.shift();
      } else {
        xpos += delta;
      }
    }
    // Add last point
    x.push(upperlim);
    y.push(JSV.sum_of_peaks(upperlim, peaks));
    return {x:x, y:y};
  }

  /**
   * Return a SVSet of Peaks that are within the limits or close to the limits.
   *
   * @param {SVSet} peaks A SVSet of Peaks
   * @param {Number} lowerlim The lower limit to look for peaks.
   * @param {Number} upperlim The upper limit to look for peaks.
   * @param {range} range Used to find peaks that are close to but outside of the limits. For example, a range of 2 will include peaks that have center value withing 2 peak widths of the limit.
   * @return {SVSet}
   */
  JSV.peaks_in_range = function(peaks, lowerlim, upperlim, range) {
    range = range || 0;
    const new_peaks = new JSV.SVSet();
    peaks.forEach(function(peak) {
      if ( (JSV.peak_min([peak], range) < upperlim) && (JSV.peak_max([peak], range) > lowerlim ) ) {
        new_peaks.push(peak);
      }
    });
    // console.log(peaks.length + ' -> ' + new_peaks.length)
    return new_peaks
  }


  // TODO: this should be merged or extracted from get_peak_domains()
  /**
   * Returns the minimum x value for the supplied set of peaks.
   * First finds the minimum peak by center, then subtracts the
   * number of widths from the center.
   *
   * @param {SVSet} peaks SVSet of Peaks
   * @param {Number} widths The number of widths to subtract from the minimum peak center
   * @return {Number}
   */
  JSV.peak_min = function(peaks, widths) {
    widths = widths || 3;
    let min, best_peak;
    if (peaks.length > 0) {
      best_peak = peaks[0];
    }
    peaks.forEach(function(peak) {
      if (peak.center < best_peak.center) {
        best_peak = peak;
      }
    })
    if (best_peak) {
      min = best_peak.center - (widths * best_peak.width);
    }
    return min;
  }
  /**
   * Returns the maximum x value for the supplied set of peaks.
   * First finds the maximum peak by center, then adds the
   * number of widths to the center.
   *
   * @param {SVSet} peaks SVSet of Peaks
   * @param {Number} widths The number of widths to add from the maximum peak center
   * @return {Number}
   */
  JSV.peak_max = function(peaks, widths) {
    widths = widths || 3;
    let max, best_peak;
    if (peaks.length > 0) {
      best_peak = peaks[0];
    }
    peaks.forEach(function(peak) {
      if (peak.center > best_peak.center) {
        best_peak = peak;
      }
    })
    if (best_peak) {
      max = best_peak.center + (widths * best_peak.width);
    }
    return max;
  }

  /**
   * Returns a number unless _n_ is undefined in which case _undefined_ is returned.
   * @param {Object} n The object to convert to a number
   * @return {Number}
   */
  JSV.number = function(n) {
    if (n === undefined) return;
    return Number(n);
  }

  /**
   * Convience function to determine if an object is a number.
   * @param {Object} n The object to check
   * @return {Boolean}
   */
  JSV.isNumeric = function (n) {
    return isFinite(n) && parseFloat(n) == n;
  }

  /**
   * Return the number of decimal places found in _num_.
   *
   * @param {Number} num The number to check
   * @return {Number}
   */
  JSV.decimalPlaces = function(num) {
    const match = ('' + num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
    if (!match) { return 0; }
    return Math.max(
        0,
        // Number of digits right of decimal point.
        (match[1] ? match[1].length : 0)
        // Adjust for scientific notation.
        - (match[2] ? +match[2] : 0));
  }

  // COLORS
  // http://krazydad.com/tutorials/makecolors.php
  JSV.colors = function(len, center, width, alpha, freq1, freq2, freq3,
                        phase1, phase2, phase3) {
    const colors = [];
    if (len == undefined)      len    = 50;
    if (center == undefined)   center = 200;
    if (width == undefined)    width  = 30;
    if (alpha == undefined)    alpha  = 1;
    if (freq1 == undefined)    freq1  = 2.4;
    if (freq2 == undefined)    freq2  = 2.4;
    if (freq3 == undefined)    freq3  = 2.4;
    if (phase1 == undefined)   phase1 = 0;
    if (phase2 == undefined)   phase2 = 2;
    if (phase3 == undefined)   phase3 = 4;

    for (let i = 0; i < len; ++i) {
      const red = Math.round(Math.sin(freq1 * i + phase1) * width + center);
      const green = Math.round(Math.sin(freq2 * i + phase2) * width + center);
      const blue = Math.round(Math.sin(freq3 * i + phase3) * width + center);
      colors.push('rgba(' + red + ',' + green + ',' + blue + ',' + alpha + ')');
    }
    return colors;
  }

  JSV.test_colors = function(colors) {
    colors.forEach(function(color) {
      document.write( '<font style="color:' + color + '">&#9608;</font>')
    })
    document.write( '<br/>')
  }

  // The xy data is the content of the spectrumDataArray element, it is an
  // array of 64 bit floats. The array is of the form:
  // [x_1,y_1,x_2,y_2,...,x_n,y_n]  the bytes are encoded as base64. They can
  // also be compressed with zlib.
  // Here is a javascript function to decode the xy data, that returns it as an
  // array with xy points, add true as a second option if the data is
  // compressed:
  JSV.convert_base64_to_float64 = function(encoded_data, zipped) {
    // function convert_base64_to_float64(encoded_data,zipped) {

    if(typeof zipped === 'undefined') { zipped = false; }

    const byte_string = atob(encoded_data);
    let int_array = new Int8Array(byte_string.length);
    if(zipped) {
      int_array = new Zlib.Deflate(int_array);
    }

    for (let i = 0; i < byte_string.length; i++){
      int_array[i] = byte_string.charCodeAt(i);
    }
    const values = new Float64Array(int_array.buffer);
    // new DataView(int_array.buffer).getFloat64(0, true) // For little endian

    return values;
  }


  /**
   * Convert JSON results from Bayesil to the proper format for JSV
   * @param {Object} bayesil_data Bayesil results as JSON
   * @return {Object}
   */
  JSV.convert_bayesil_data = function(bayesil_data) {
    const spectrum = {
      id: JSV.default_for(bayesil_data.id, 'Fit'),
      name: JSV.default_for(bayesil_data.name, 'Fit'),
      compounds: [],
      display: JSV.merge({color: 'blue'}, bayesil_data.display),
      meta: {dss_concentration: bayesil_data.dss_conc}
    };
    bayesil_data.metabolites.forEach(function(compound_data) {
      const compound = {
        concentration: compound_data.concentration,
        original_concentration: compound_data.concentration,
        concentration_units: '\u03BCM',
        id: compound_data.id,
        name: compound_data.name,
        clusters: [],
        display: {visible: false},
        meta: {
          dss_ratio: JSV.default_for(JSV.number(compound_data.dss_ratio), 1),
          threshold: compound_data.threshold,
          score: compound_data.score,
        }
      };

      compound.meta.amplitude_coefficient = compound.concentration / compound.meta.dss_ratio / spectrum.meta.dss_concentration;

      compound_data.clusters.forEach(function(cluster_data) {
        const cluster = {
          peaks: [],
          meta: {shift: cluster_data.shift}
        };
        cluster_data.shift = JSV.default_for(cluster_data.shift, 0);
        // cluster.center = cluster_data.center;
        cluster.upper_bound = cluster_data.upper_bound;
        cluster.lower_bound = cluster_data.lower_bound;
        cluster.meta.lower_bound_diff = cluster_data.lower_bound_diff;
        cluster.meta.upper_bound_diff = cluster_data.upper_bound_diff;
        cluster_data.peaks.forEach(function(peak_data) {

          const peak = {
            center: Number(peak_data.center) + Number(cluster_data.shift),
            width: Number(peak_data.width),
            original_amplitude: Number(peak_data.amplitude),
            amplitude: Number(peak_data.amplitude) * Number(compound.meta.amplitude_coefficient),
            meta: {initial_width: peak_data.initial_width}
          };
          cluster.peaks.push(peak);
        });
        compound.clusters.push(cluster);
      });
      spectrum.compounds.push(compound);
    });

    return spectrum;
  }

  /**
   * Convert spectra data to Bayesil JSON format
   * @param {Object} xy_spectrum The fid spectrum to extract xy data from
   * @param {Object} fit_spectrum The fit  spectrum to extract compound data from
   * @return {Object}
   */
  JSV.create_bayesil_json = function(xy_spectrum, fit_spectrum) {

    xy_spectrum = xy_spectrum || { xy_data: { x: [], y: [] } };
    const bayesil = {
      dss_conc: fit_spectrum.meta.dss_concentration,
      metabolites: [],
      meta: xy_spectrum.meta
    };

    fit_spectrum.compounds().forEach(function(compound) {

      const compound_data = {
        name: compound.name,
        id: compound.id,
        concentration: compound.concentration,
        dss_ratio: compound.meta.dss_ratio,
        score: compound.meta.score,
        threshold: compound.meta.threshold,
        clusters: []
      };
      // Update amplitude_coefficient in case concentration has changed
      // amplitude_coefficient is only used for converted to and from the Bayesil JSON format
      compound.meta.amplitude_coefficient = compound.concentration / compound.meta.dss_ratio / fit_spectrum.meta.dss_concentration;
      compound.clusters().forEach(function(cluster) {
        const cluster_data = {
          center: cluster.center(),
          initial_center: cluster.meta.initial_center,
          shift: cluster.center(), // TEMP
          lower_bound: cluster.lower_bound,
          upper_bound: cluster.upper_bound,
          peaks: []
        };
        cluster.peaks().forEach(function(peak) {
          let amplitude;
// If the concentration has been changed from 0, display the compound peaks
          if (compound.original_concentration == 0){
            amplitude = peak.original_amplitude;

          }else{
            amplitude = peak.amplitude / compound.meta.amplitude_coefficient;
          }
          const peak_data = {
            amplitude: amplitude,
            center: peak.center - cluster.center(),
            width: peak.width,
            initial_width: peak.meta.initial_width
          };

          if (isNaN(peak_data.amplitude)) peak_data.amplitude = 0;
          cluster_data.peaks.push(peak_data);
        });
        compound_data.clusters.push(cluster_data);
      });
      bayesil.metabolites.push(compound_data);
    });
    bayesil.spectrum_xy = {x: xy_spectrum.xy_data.x, y: xy_spectrum.xy_data.y};

    return bayesil;
  }

  /////////////////////////////////////////////////////////////////////////////
  // POLYFILLS
  /////////////////////////////////////////////////////////////////////////////
  if (!Number.isInteger) {
    Number.isInteger = function isInteger (nVal) {
      return typeof nVal === "number" && isFinite(nVal) && nVal > -9007199254740992 && nVal < 9007199254740992 && Math.floor(nVal) === nVal;
    };
  }


})(JSpectraViewer);

//////////////////////////////////////////////////////////////////////////////
// Simplify code
// Adapted from Simplify.js by Vladimir Agafonkin (Details are at the bottom)
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

    let _points = [];

    // square distance between 2 points
    function getSqDist(p1, p2) {

        const dx = _points.x[p1] - _points.x[p2],
            dy = _points.y[p1] - _points.y[p2];

        return dx * dx + dy * dy;
    }

    // square distance from a point to a segment
    function getSqSegDist(p, p1, p2) {

        let x = _points.x[p1],
            y = _points.y[p1],
            dx = _points.x[p2] - x,
            dy = _points.y[p2] - y;

        if (dx !== 0 || dy !== 0) {

            const t = ((_points.x[p] - x) * dx + (_points.y[p] - y) * dy) / (dx * dx + dy * dy);

            if (t > 1) {
                x = _points.x[p2];
                y = _points.y[p2];

            } else if (t > 0) {
                x += dx * t;
                y += dy * t;
            }
        }

        dx = _points.x[p] - x;
        dy = _points.y[p] - y;

        return dx * dx + dy * dy;
    }

    // basic distance-based simplification
    function simplifyRadialDist(pts, sqTolerance) {

        let prevPoint = pts[0];
        const newPoints = [prevPoint];
        let pt;

        let i = 1;
        const len = pts.length;
        for (; i < len; i++) {
            pt = pts[i];

            if (getSqDist(pt, prevPoint) > sqTolerance) {
                newPoints.push(pt);
                prevPoint = pt;
            }
        }

        if (prevPoint !== pt) newPoints.push(pt);

        return newPoints;
    }

    // simplification using optimized Douglas-Peucker algorithm with recursion elimination
    function simplifyDouglasPeucker(pts, sqTolerance) {

        const len = pts.length,
            MarkerArray = typeof Uint8Array !== 'undefined' ? Uint8Array : Array,
            markers = new MarkerArray(len);
        let first = 0,
            last = len - 1;
        const stack = [],
            newPoints = [];
        let i, maxSqDist, sqDist, index;

        markers[first] = markers[last] = 1;

        while (last) {

            maxSqDist = 0;

            for (i = first + 1; i < last; i++) {
                sqDist = getSqSegDist(pts[i], pts[first], pts[last]);

                if (sqDist > maxSqDist) {
                    index = i;
                    maxSqDist = sqDist;
                }
            }

            if (maxSqDist > sqTolerance) {
                markers[index] = 1;
                stack.push(first, index, index, last);
            }

            last = stack.pop();
            first = stack.pop();
        }

        for (i = 0; i < len; i++) {
            if (markers[i]) newPoints.push(pts[i]);
        }

        return newPoints;
    }

    /**
     * Simplify.js is a high-performance JS polyline simplification library by Vladimir Agafonkin.
     * [Orignal Project](http://mourner.github.io/simplify-js)
     *
     * It has been adapted here to work with a different point format.
     * The format used in JSV is an object of arrays:
     * ```js
     * points = { x: [1, 2, 3], y: [10, 20, 30] };
     * ```
     * There can also be an optional yi array, to hold the imaginary component of
     * the line. This is used when incorporating phasing into the viewer.
     *
     * The orginal format was an array of points:
     * ```js
     * // Do not use this format
     * points = [ {x:1, y:10}, {x:2, y:20}, {x:3, y:30} ];
     * ```
     * ***
     * Copyright (c) 2012, Vladimir Agafonkin
     * All rights reserved.
     *
     * Redistribution and use in source and binary forms, with or without modification, are
     * permitted provided that the following conditions are met:
     *
     *   1. Redistributions of source code must retain the above copyright notice, this list of
     *      conditions and the following disclaimer.
     *
     *   2. Redistributions in binary form must reproduce the above copyright notice, this list
     *      of conditions and the following disclaimer in the documentation and/or other materials
     *      provided with the distribution.
     *
     * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
     * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
     * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
     * COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
     * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
     * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
     * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
     * TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
     * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.)
     *
     * @param {Object} points An object containing an x and y array of points. There may also be an yi array.
     * @param {Number} tolerance Affects the amount of simplification. [Default: 1]
     * @param {Boolean} highestQuality Excludes distance-based preprocessing step which leads to highest quality simplification but runs ~10-20 times slower. [Default: false]
     */
    function simplify(points, tolerance, highestQuality) {

        const length = points.x.length;
        if (length <= 1) return points;

        _points = points;
        let pts = new Array(length);
        for (let i=0; i < length; i++) {
            pts[i] = i;
        }

        const sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

        pts = highestQuality ? pts : simplifyRadialDist(pts, sqTolerance);
        pts = simplifyDouglasPeucker(pts, sqTolerance);

        const x = new Array(pts.length);
        const y = new Array(pts.length);
        for (let i=0, len=pts.length; i < len; i++) {
            x[i] = _points.x[pts[i]];
            y[i] = _points.y[pts[i]];
        }
        let yi;
        if (_points.yi) {
            yi = new Array(pts.length);
            for (let i=0, len=pts.length; i < len; i++) {
                yi[i] = _points.yi[pts[i]];
            }
        }

        points = {x:x, y:y};
        if (yi) { points.yi = yi; }
        return points
    }
    /** @ignore */

    JSV.simplify = simplify;

})(JSpectraViewer);

// test_1=" \n  Marvin  02071110482D          \n\n  9  9  0  0  0  0            999 V2000\n   12.5055   -6.4299    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0\n   12.5073   -5.6033    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   11.7891   -4.3542    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0\n   11.7891   -5.1974    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   11.0709   -3.9483    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   12.5073   -3.9483    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   11.0709   -3.1053    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   12.5073   -3.1053    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   11.7891   -2.6993    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  1  0  0  0  0\n  4  3  1  0  0  0  0\n  5  3  1  0  0  0  0\n  6  3  1  0  0  0  0\n  2  4  1  0  0  0  0\n  7  5  1  0  0  0  0\n  8  6  1  0  0  0  0\n  9  7  1  0  0  0  0\n  9  8  1  0  0  0  0\nM  END\n"
// test_2=" \n  Marvin  01220814402D          \n\n 13 14  0  0  0  0            999 V2000\n    0.0000   -0.8250    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    0.7145   -0.4125    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    0.7145    0.4125    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    0.0000    0.8250    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   -0.7145    0.4125    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   -0.7145   -0.4125    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    3.1130   -1.0105    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0\n    2.5610   -1.6236    0.0000 C   0  0  2  0  0  0  0  0  0  0  0  0\n    2.8159   -2.4082    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0\n    1.7540   -1.4521    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    1.4991   -0.6674    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    1.9840    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    1.4991    0.6674    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0\n  2  1  2  0  0  0  0\n 11  2  1  0  0  0  0\n  3  2  1  0  0  0  0\n 13  3  1  0  0  0  0\n  3  4  2  0  0  0  0\n  4  5  1  0  0  0  0\n  6  1  1  0  0  0  0\n  5  6  2  0  0  0  0\n  8  7  1  6  0  0  0\n  8  9  1  0  0  0  0\n  8 10  1  0  0  0  0\n 10 11  1  0  0  0  0\n 11 12  2  0  0  0  0\n 12 13  1  0  0  0  0\nM  END\n"

// Adapted from: https://bitbucket.org/sbeisken/specktackle/src/e2cfb3f9d6730b0292b67fc425366975ff3495ec/js/util/mol2svg.js?at=master&fileviewer=file-view-default
// TODO: Add license
// GNU LESSER GENERAL PUBLIC LICENSE: Version 3, 29 June 2007
//

(function(JSV) {

  /**
   * The SVStructure object controls the displaying of a chemical structure.
   * SVStructure requires the [X2JS library](https://github.com/abdmob/x2js) to read structures in nmrML format.
   * The following options can be set when creating a
   * [SpectraViewer](SpectraViewer.js.html):
   *
   *  Option                | Default     | Description
   *  ----------------------|-------------------------------------------------
   *  container_id          | _undefined_ | ID of dom element where the structure will be draw (e.g. '#my-structure')
   *  width                 | 200         | Width of strucutre panel
   *  height                | 200         | Height of strucutre panel
   *  data                  | _undefined_ | Structure data as a string. It can be in molfile or nmrML format.
   *  format                | mol         | Structure data format: 'mol' or 'nmrML'. The nmrML format is similar to CML.
   *  show_hydrogen         | false       | Show hydrogens in structure
   *  show_atom_numbers     | true        | Show atom numbers in structure
   *  nmr_nucleus           | _undefined_ | NMR nucleus ('13C', '1H', or _undefined_)
   *
   *
   * @param {Object} options Options for how the Structure should work. Described below.
   * @return {SVSelection}
   */
  function SVStructure(options) {
    this.container_id = options.container_id
    this.width = options.width || 200,   // width of the panel
    this.height = options.height || 200,  // height of the panel
    this.container = d3v7.select(this.container_id); //element id or the element itself to be the container for the image
    this.container.classed('js-structure', true);
    this.data = options.data;
    this.format = options.format || 'mol';
    this.x_scale;     // linear d3v7 x scale function
    this.y_scale;     // linear d3v7 y scale function
    this.avgL = 0;    // scaled average bond length (for font size scaling)

    this.show_hydrogen = JSV.default_for(options.show_hydrogen, false);
    this.show_atom_numbers = JSV.default_for(options.show_atom_numbers, false);
    this.use_jsmol = JSV.default_for(options.use_jsmol, false);
    this.nmr_nucleus = options.nmr_nucleus;
    this.interactive_1H = true;
    this._atoms = new JSV.SVSet();
    this._bonds = new JSV.SVSet();

    if (this.data) {
      this.read_data(this.data, this.format);
    }

    // Setup SVEvents
    this.handlers = new JSV.SVEvents();
    this.on = this.handlers.on
    this.off = this.handlers.off
    this.trigger = this.handlers.trigger
  }

  SVStructure.prototype.nmr_1H = function () {
    return this.nmr_nucleus && this.nmr_nucleus.toUpperCase() == '1H'
  }

  SVStructure.prototype.nmr_13C = function () {
    return this.nmr_nucleus && this.nmr_nucleus.toUpperCase() == '13C'
  }

  /**
   * Initializes the viewport and appends it to the element identified
   * by the given identifier. The linear d3v7 x- and y-scales are set
   * to translate from the viewport coordinates to the mol coordinates.
   */
  SVStructure.prototype.initSVG = function () {
    const self = this;
    const container = self.container;
    // x minimum and maximum
    const xExtrema = d3v7.extent(self.atoms(), function (atom) {
      return atom.x;
    });
    // y minimum and maximum
    const yExtrema = d3v7.extent(self.atoms(), function (atom) {
      return atom.y;
    });

    // dimensions of molecule graph
    const m = [15, 15, 20, 15];   // margins
    self.margins = m;
    let wp = self.width - m[1] - m[3];   // width
    let hp = self.height - m[0] - m[2];   // height

    // Scale the image to the contrained dimension
    const container_ratio = wp / hp;
    self.structure_ratio = ( xExtrema[1] - xExtrema[0] ) / ( yExtrema[1] - yExtrema[0] );
    const constrained_dim = (container_ratio >= self.structure_ratio) ? 'height' : 'width';
    if (constrained_dim == 'height') {
      wp = hp * self.structure_ratio;
    } else {
      hp = wp / self.structure_ratio;
    }
    self.wp = wp;
    self.hp = hp;
    // X scale will fit all values within pixels 0-w
    self.x_scale = d3v7.scaleLinear().domain([xExtrema[0], xExtrema[1]]).range([m[1], wp-m[3]]);
    // Y scale will fit all values within pixels h-0
    self.y_scale = d3v7.scaleLinear().domain([yExtrema[0], yExtrema[1]]).range([hp-m[2], m[0]]);

    // Adjust container
    container.style({
      height: self.height + 'px',
      width: self.width + 'px'
    })

    self.add_menu_bar();
    if(!this.use_jsmol) self.add_resizer();

    // Remove any previous structure
    // container.select('svg').remove();
    container.select('div.js-graph-div').remove();
    let graph = null;
    if(!this.use_jsmol) {
      self.graph_div = container.append('div')
          .attr('class', 'js-graph-div')
          .style({
            width: wp + 'px',
            height: hp + 'px',
            margin: '0 auto',
            'margin-top': ((self.height - hp - m[0]) / 2) + 'px',
            // border: '1px solid black'
          })
      graph = self.graph_div.append('svg:svg')
          .attr('width', '100%')
          .attr('height', '100%')
          .append('svg:g');
    }
    return graph;
  };

  SVStructure.prototype.add_menu_bar = function () {
    const self = this;
    // Remove any previous menu bar
    self.container.select('div.menubar').remove();
    const menu = self.container.insert('div', ":first-child")
        .attr('class', 'menubar');
    self.button_toggle_H = menu.append('div')
        .attr('class', 'toggle-hydrogens menu-button button-on')
        .style('width', '60px')
        .text('Show H')
        .on('click', function(event) {
          self.toggleH();
          event.stopPropagation();
        });
    self.button_toggle_numbers = menu.append('div')
        .attr('class', 'toggle-atom-ids menu-button button-on')
        .text('Show #')
        .style('width', '60px')
        .style('padding-bottom', '50px')
        .on('click', function(event) {
          self.toggleAtomNumbers();
          event.stopPropagation();
        });
    self.menu_buttons_width  = self.button_toggle_numbers.offsetWidth + self.button_toggle_numbers.offsetWidth;
    self.menu_title = menu.append('div')
        .attr('class', 'structure-title')
        .style('width', self.menu_buttons_width + 'px')
        .text(self.title);
  }

  SVStructure.prototype.add_resizer = function () {
    const self = this;
    const m = self.margins;
    const wp = self.wp;
    const hp = self.hp;
    const body = d3v7.select('body');
    self.resizer = self.container.append('div')
        .attr('class', 'js-structure-resizer')
        .on('mousedown.resizer', function() {
          let x_mouse = d3v7.event.x;
          let y_mouse = d3v7.event.y;
          d3v7.event.preventDefault();
          body.on('mousemove.resizer', function() {
            // window.getSelection().removeAllRanges()
            dx_mouse = d3v7.event.x - x_mouse;
            dy_mouse = d3v7.event.y - y_mouse;
            x_mouse = d3v7.event.x
            y_mouse = d3v7.event.y
            self.height = self.height + dy_mouse;
            self.width = self.width + dx_mouse;
            self.container.style({
              height: self.height + 'px',
              width: self.width + 'px'
            })
            const container_ratio = self.width / self.height;
            const constrained_dim = (container_ratio >= self.structure_ratio) ? 'height' : 'width';
            let ratio;
            if (constrained_dim == 'height') {
              ratio = (self.height - m[0] - m[2]) / hp;
            } else {
              ratio = (self.width - m[1] - m[3]) / wp;
            }
            self.graph.attr('transform', 'scale(' + ratio + ',' + ratio + ')');
            const graph_div_height = hp * ratio;
            const graph_div_top_margin = (self.height - graph_div_height - m[0]) / 2;
            self.graph_div.style({
              width: wp * ratio + 'px',
              height: hp * ratio + 'px',
              'margin-top': graph_div_top_margin + 'px'
            })
            self.menu_title.style('width', self.width - self.menu_buttons_width + 'px');
            self.trigger('structure-resize');
          });
          body.on('mouseup.resizer', function() {
            body.on('mousemove.resizer', null);
            body.on('mouseup.resizer', null);
          });
        })
        .on('click.resizer', function() {
          event.stopPropagation();
        });

    // Draw the resizer icon
    const resizer_path = [
      {x: 9, y: 4}, {x: 4, y: 4}, {x: 4, y: 9}, {x: 4, y: 4}, // Top Left
      {x: 16, y: 16}, // Join line
      {x: 16, y: 11}, {x: 16, y: 16}, {x: 11, y: 16} // Bottom Right
    ];
    const line_function = d3v7.line()
        .x(function (d) {
          return d.x;
        })
        .y(function (d) {
          return d.y;
        })
        
    const resizer_svg = self.resizer.append('svg')
        .style("width", "100%")
        .style("height", "100%")
        .append('path')
        .attr("d", line_function(resizer_path))
        .attr("stroke", "grey")
        .attr("stroke-width", 1)
        .attr("stroke-linejoin", 'round')
        .attr("stroke-linecap", 'round')
        .attr("fill", "none");

  }

  /**
   * Draws the bonds onto the SVG element. Note that the bonds are drawn
   * first before anything else is added.
   */
  SVStructure.prototype.drawBonds = function () {
    const self = this;
    const graph = this.graph;
    const x = this.x_scale;
    const y = this.y_scale;
    this.create_bond_functions();
    this.bonds().forEach(function(bond) {
      let dxx1;
      let dyy1;
      let dxx2;
      let dyy2;
      const a1 = bond.a1;
      const a2 = bond.a2;
      let bond_path;

      // apply backing by calculating the unit vector and
      // subsequent scaling: shortens the drawn bond
      const dox = a2.x - a1.x,
          doy = a2.y - a1.y,
          l = Math.sqrt(dox * dox + doy * doy),
          dx = (dox / l) * (0.2),
          dy = (doy / l) * (0.2);

      // get adjusted x and y coordinates
      const x1 = a1.x + dx,
          y1 = a1.y + dy,
          x2 = a2.x - dx,
          y2 = a2.y - dy;

      // update average bond length for font scaling
      self.avgL += distance(x(x1), y(y1), x(x2), y(y2));

      let off,    // offset factor for stereo bonds
          xOff,   // total offset in x
          yOff,   // total offset in y
          xyData = []; // two dimensional data array
      if (bond.order === 1) {                 // single bond
        if (bond.stereo === 1) {            // single wedge bond
          const length = distance(x1, y1, x2, y2);
          off = 0.1;
          xOff = off * (y2 - y1) / length;
          yOff = off * (x1 - x2) / length;
          xyData = [
            [x1, y1],
            [x2 + xOff, y2 + yOff],
            [x2 - xOff, y2 - yOff]
          ];
          bond_path = graph.append('svg:path')
              .style('fill', 'black')
              .style('stroke-width', 1)
              .attr('d', self.wedgeBond(xyData));
        } else if (bond.stereo === 6) {     // single hash bond
          off = 0.2;
          xOff = off * (y2 - y1) / l;
          yOff = off * (x1 - x2) / l;
          dxx1 = x2 + xOff - x1;
          dyy1 = y2 + yOff - y1;
          dxx2 = x2 - xOff - x1;
          dyy2 = y2 - yOff - y1;
          for (let j = 0.05; j <= 1; j += 0.15) {
            xyData.push(
                [x1 + dxx1 * j, y1 + dyy1 * j],
                [x1 + dxx2 * j, y1 + dyy2 * j]
            );
          }

          bond_path = graph.append('svg:path')
              .style('fill', 'none')
              .style('stroke-width', 1)
              .attr('d', self.hashBond(xyData))
              .attr('stroke', 'black');
        } else if (bond.stereo === 4) {     // single wiggly bond
          off = 0.2;
          xOff = off * (y2 - y1) / l;
          yOff = off * (x1 - x2) / l;
          dxx1 = x2 + xOff - x1;
          dyy1 = y2 + yOff - y1;
          dxx2 = x2 - xOff - x1;
          dyy2 = y2 - yOff - y1;
          for (let j = 0.05; j <= 1; j += 0.1) {
            if (xyData.length % 2 === 0) {
              xyData.push(
                  [x1 + dxx1 * j, y1 + dyy1 * j]
              );
            } else {
              xyData.push(
                  [x1 + dxx2 * j, y1 + dyy2 * j]
              );
            }
          }

          bond_path = graph.append('svg:path')
              .attr('d', self.wigglyBond(xyData))
              .attr('fill', 'none')
              .style('stroke-width', 1)
              .attr('stroke', 'black');
        } else {                                // single plain bond
          xyData = [
            [x1, y1], [x2, y2]
          ];
          bond_path = graph.append('svg:path')
              .attr('d', self.plainBond(xyData))
              .attr('stroke-width', '1')
              .attr('stroke-linecap', 'round')
              .attr('stroke-linejoin', 'round')
              .attr('stroke', 'black');
        }
      } else if (bond.order === 2) {          // double bond
        off = 0.1;
        xOff = off * (y2 - y1) / l;
        yOff = off * (x1 - x2) / l;
        xyData = [
          [x1 + xOff, y1 + yOff], [x2 + xOff, y2 + yOff],
          [x1 - xOff, y1 - yOff], [x2 - xOff, y2 - yOff]
        ];
        bond_path = graph.append('svg:path').attr('d', self.plainBond(xyData))
            .attr('stroke-width', '1')
            .style('fill', 'none')
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('stroke', 'black');
      } else if (bond.order === 3) {          // triple bond
        off = 0.15;
        xOff = off * (y2 - y1) / l;
        yOff = off * (x1 - x2) / l;
        xyData = [
          [x1, y1], [x2, y2],
          [x1 + xOff, y1 + yOff], [x2 + xOff, y2 + yOff],
          [x1 - xOff, y1 - yOff], [x2 - xOff, y2 - yOff]
        ];
        bond_path = graph.append('svg:path')
            .attr('d', self.plainBond(xyData))
            .attr('stroke-width', '1')
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('stroke', 'black');
      }
      if (a1.is('H') || a2.is('H')) {
        bond_path.classed('bond-H', true);
      }
    });
    self.avgL /= this.bonds().length; // get average bond length
  };

  /**
   * Draws the atoms onto the SVG element. Note that the atoms are drawn
   * on top of the bonds.
   */
  SVStructure.prototype.drawAtoms = function () {
    const graph = this.graph;
    const avgL = this.avgL;
    const x = this.x_scale;
    const y = this.y_scale;
    this.atoms().forEach(function(atom) {
      const g = graph.append('svg:g')
          .attr('transform', 'translate(' + x(atom.x) + ',' + y(atom.y) + ')');
      g.attr('class', 'atom');
      // Add NMR classes
      if ( (atom.is('C') || atom.is('N') ) && (atom.bonded_Hs().length > 0) ) {
        g.classed('nmr-1h', true);
      }
      if ( atom.is('C') ) {
        g.classed('nmr-13c', true);
      }
      if (atom.is('H')) {
        g.classed('atom-H', true);
        if (atom.isBondedTo('C') || atom.isBondedTo('N')) {
          g.classed('nmr-1h', true);
        }
      }
      g.attr('data-atom-number', atom.number);
      g.attr('data-atom-id', atom.id);
      // draw a white circle underneath the text to clean up bonds
      g.append('svg:circle')
          // hack: magic number for scaling
          .attr('r', Math.ceil(avgL / 3))
          .attr('fill', 'white')
          .attr('opacity', '1');
      // draw a transparent circle underneath the text for highlighting
      g.append('svg:circle')
          // hack: magic number for scaling
          .attr('r', Math.ceil(avgL / 2))
          .attr('fill-opacity', '0')
          .attr('class', 'overlay');
      // draw the text string
      g.append('text')
          // hack: magic number for scaling
          .attr('dy', Math.ceil(avgL / 4.5))
          .attr('text-anchor', 'middle')
          .attr('font-family', 'sans-serif')
          // hack: magic number for scaling
          .attr('font-size', Math.ceil(avgL / 1.5))
          .attr('fill', atom.color())
          .text(atom.symbol);
      // Draw atom id
      g.append('text')
          // hack: magic number for scaling
          .attr('dy', Math.ceil(avgL / 2) + 2)
          // .attr('dx', Math.ceil(avgL / 3))
          .attr('text-anchor', 'middle')
          .attr('font-family', 'sans-serif')
          // hack: magic number for scaling
          .attr('font-size', Math.ceil(avgL / 2.5))
          .attr('stroke', '#FFF')
          .attr('stroke-width', '2px')
          .attr('fill', '#595')
          .attr('paint-order', 'stroke')
          .classed('atom-id', true)
          .text(atom.display_id);

      if (atom.charge !== 0) {
        let c = atom.charge;
        if (c < 0) {
          c = (c === -1) ? '-' : (c + '-');
        } else {
          c = (c === +1) ? '+' : (c + '+');
        }
        g.append('text')
            .attr('dx', +1 * Math.ceil(avgL / 3))
            .attr('dy', -1 * Math.ceil(avgL / 4.5))
            .attr('text-anchor', 'left')
            .attr('font-family', 'sans-serif')
            // hack: magic number for scaling (half of symbol size)
            .attr('fill', atom.color())
            .attr('font-size', Math.ceil(avgL / 3))
            .text(c);
      }

      if (atom.mass !== 0) {
        g.append('text')
            .attr('dx', -2 * Math.ceil(avgL / 3))
            .attr('dy', -1 * Math.ceil(avgL / 4.5))
            .attr('text-anchor', 'left')
            .attr('font-family', 'sans-serif')
            // hack: magic number for scaling (half of symbol size)
            .attr('font-size', Math.ceil(avgL / 3))
            .attr('fill', atom.color())
            .text(atom.mass);
      }
    })
  };

  /**
   * Calculates the Euclidean distance between two points.
   *
   * @param {number} x1 A x value of first point
   * @param {number} y1 A y value of first point
   * @param {number} x2 A x value of second point
   * @param {number} y2 A y value of second point
   * @returns {number} the Euclidean distance
   */
  const distance = function (x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  };

  SVStructure.prototype.create_bond_functions = function() {
    const x = this.x_scale;
    const y = this.y_scale;
    /**
     * d3v7 line function using the SVG path mini language to draw a plain bond.
     */
    this.plainBond = d3v7.line()
        .x(function (d) {
          return x(d[0]);
        })
        .y(function (d) {
          return y(d[1]);
        });

    /**
     * d3v7 line function using the SVG path mini language to draw a wedge bond.
     */
    this.wedgeBond = d3v7.line()
        .x(function (d) {
          return x(d[0]);
        })
        .y(function (d) {
          return y(d[1]);
        });

    /**
     * d3v7 line function using the SVG path mini language to draw a hash bond.
     */
    this.hashBond = d3v7.line()
        .x(function (d) {
          return x(d[0]);
        })
        .y(function (d) {
          return y(d[1]);
        });

    /**
     * d3v7 line function using the SVG path mini language to draw a wiggly bond.
     */
    this.wigglyBond = d3v7.line()
        .curve(d3v7.curveCardinal)
        .x(function (d) {
          return x(d[0]);
        })
        .y(function (d) {
          return y(d[1]);
        });
  }


  /*
   * Atom properties containing the CPK color values.
   */
  AtomColors = {
    H: '#000000',
    He: '#FFC0CB',
    Li: '#B22222',
    B: '#00FF00',
    C: '#000000',
    N: '#8F8FFF',
    O: '#F00000',
    F: '#DAA520',
    Na: '#0000FF',
    Mg: '#228B22',
    Al: '#808090',
    Si: '#DAA520',
    P: '#FFA500',
    S: '#FFC832',
    Cl: '#00FF00',
    Ca: '#808090',
    Ti: '#808090',
    Cr: '#808090',
    Mn: '#808090',
    Fe: '#FFA500',
    Ni: '#A52A2A',
    Cu: '#A52A2A',
    Zn: '#A52A2A',
    Br: '#A52A2A',
    Ag: '#808090',
    I: '#A020F0',
    Ba: '#FFA500',
    Au: '#DAA520'
  };

  /////////////////////////////////////////////////////////////////////////////
  // Structure Properties (setters/getters)
  /////////////////////////////////////////////////////////////////////////////
  Object.defineProperties(SVStructure.prototype, {
    'selected_atoms': {
      get: function() {
        const self = this;
        const selected = new JSV.SVSet();
        this.container.selectAll('.atom.selected').each(function(){
          const atom_id = d3v7.select(this).attr('data-atom-id');
          selected.push(self.atoms(atom_id));
        });
        return selected
      },
      set: function(atoms) {
        const self = this;
        const container = this.container;
        container.selectAll('.atom').classed('selected', false);
        atoms.forEach(function(atom) {
          container.select('.atom[data-atom-id="' + atom.id + '"]').classed('selected', true);
        });
        self.add_partially_selected_highlighting(atoms);
      }
    }
  });

  SVStructure.prototype.add_partially_selected_highlighting = function(atoms) {
    const self = this;
    const container = this.container;
    container.selectAll('.atom').classed('selected-partially', false);
    if (self.nmr_1H()) {
      const hydrogens = self.hydrogens_from_atoms(atoms);
      let parents = hydrogens.map(function (h) {
        return h.bonded_atoms(1)
      });
      parents = new JSV.SVSet(parents).unique();
      parents.forEach(function(p) {
        let all_Hs_in_list = true;
        const child_Hs = p.bonded_Hs();
        child_Hs.forEach(function(child_H) {
          if (!hydrogens.contains(child_H)) {
            all_Hs_in_list = false;
          }
        });
        if (!all_Hs_in_list) {
          container.select('.atom[data-atom-id="' + p.id + '"]').classed('selected-partially', true);
        }
      });
    }
  }

  SVStructure.prototype.read_data = function (data, format) {
    if (format == 'mol') {
      this.read_mol(data);
    } else if (format == 'nmrml') {
      this.read_nmrml(data);
    } else {
      console.log('Format not recognized: ' + format + '. Must be one of the following: nmrml, mol')
    }
  }

  // Read structure from Chemical Markup Language (nmrml)
  // MUST start with <structure> tag
  // Requires x2js
  // <structure>
  //   <atomList>
  //     <atom id="a1" elementType="C" x="0.6667733333333334" y="-0.38490666666666673"/>
  //     <atom id="a2" elementType="C" x="-0.6667733333333334" y="-1.1550933333333335"/>
  //   </atomList>
  //   <bondList>
  //     <bond atomRefs="a1 a2" order="1"/>
  //   </bondList>
  // </structure>
  SVStructure.prototype.read_nmrml = function (nmrml) {

    const self = this;
    if (!window.X2JS) {
      console.log("X2JS needs to be installed to read nmrML: https://github.com/abdmob/x2js");
      return
    }
    const x2js = new X2JS();
    const json = x2js.xml_str2json(nmrml);
    this.data = nmrml;
    // Empyt any atoms and bonds
    this._atoms = new JSV.SVSet();
    this._bonds = new JSV.SVSet();
    // Validate
    if (!(json.structure && json.structure.atomList && json.structure.atomList.atom && Array.isArray(json.structure.atomList.atom))) {
      console.log('nmrML not formatted correctly: no atoms found');
      return
    }
    if (!(json.structure && json.structure.bondList && json.structure.bondList.bond && Array.isArray(json.structure.bondList.bond))) {
      console.log('nmrML not formatted correctly: no bonds found');
      return
    }

    // Parse atoms
    json.structure.atomList.atom.forEach(function(json_atom, index) {
      const atom = new Atom({
        id: json_atom._id.replace(/\D/g, ''),
        x: parseFloat(json_atom._x),
        y: parseFloat(json_atom._y),
        z: parseFloat(json_atom._z),
        symbol: json_atom._elementType,
        number: index + 1, // base-1 atom-index
      });
      atom.display_id = atom.id;
      self._atoms.push(atom);
    })

    // Parse Bonds
    json.structure.bondList.bond.forEach(function(json_bond) {
      const atom_ids = json_bond._atomRefs.split(/\s+/);
      const a1 = self.atoms(atom_ids[0].replace(/\D/g, ''));
      const a2 = self.atoms(atom_ids[1].replace(/\D/g, ''));
      const bond = new Bond({
        a1: a1,
        a2: a2,
        order: parseInt(json_bond._order)
        // values 0 (plain),1 (wedge),4 (wiggly),6 (hash)
        // stereo: parseInt(json_bond._??)
      });
      self._bonds.push(bond);
      // Connect atoms with bonds and connected atoms
      a1._bonds.push(bond);
      a2._bonds.push(bond);
      a1._bonded_atoms.push(a2);
      a2._bonded_atoms.push(a1);
    });
    if(this.use_jsmol) this.generate_molfile(json)


    // self.addAtomDisplayIDs();
    self.draw();
  }

  SVStructure.prototype.generate_molfile = function(json){
    let self = this;
    let atom_coordinate = function(coord){
      let formatted = "  "
      if(typeof coord === "undefined"){
        formatted += "  0.0000"
      } else {
        coord = parseFloat(coord).toFixed(4)
        if (coord >= 0) formatted += " ";
        if (Math.abs(coord) < 10) formatted += " ";
        formatted += `${coord}`
      }
      return formatted
    }

    self.mol_file = `\nJSpectraViewer\n\n ${json.structure.atomList.atom.length} ${json.structure.bondList.bond.length} 0 0 0 0 0 0 0 0999 V2000`
    json.structure.atomList.atom.forEach(function(json_atom) {
      self.mol_file += `\n${atom_coordinate(json_atom._x)}${atom_coordinate(json_atom._y)}${atom_coordinate(json_atom._z)}`
      self.mol_file += ` ${json_atom._elementType}   0  0  0  0  0  0  0  0  0  0  0  0`
    })

    json.structure.bondList.bond.forEach(function(json_bond) {
      let atom_ids = json_bond._atomRefs.split(/\s+/);
      const id_1 = parseInt(atom_ids[0].replace(/\D/g,''))
      const id_2 = parseInt(atom_ids[1].replace(/\D/g,''))
      self.mol_file += (id_1 < 10 ) ? `\n  ${id_1}` : `\n ${id_1}`
      self.mol_file += (id_2 < 10 ) ? `  ${id_2}` : ` ${id_2}`
      self.mol_file += `  ${json_bond._order}  0  0  0  0`
    })
    self.mol_file += '\nM  END'
    return
  }


  SVStructure.prototype.read_mol = function (molfile) {
    let props;
    const self = this;
    const lines = molfile.split(/\r\n|\n/),
        counter = lines[3].match(/\d+/g),
        nAtoms = parseFloat(counter[0]),
        nBonds = parseFloat(counter[1]);
    const offset = 4; // the first three lines belong to the header block
    this.title = lines[1];
    this.data = molfile;
    // Empyt any atoms and bonds
    this._atoms = new JSV.SVSet();
    this._bonds = new JSV.SVSet();
    // Parse Atom Block
    for (let i = offset; i < nAtoms + offset; i++) {
      let atom = lines[i].match(/-*\d+\.\d+|\w+/g);
      atom = new Atom({
        x: parseFloat(atom[0]),
        y: parseFloat(atom[1]),
        z: parseFloat(atom[2]),
        symbol: atom[3],
        number: i - offset + 1, // base-1 atom-index
        mass: 0,    // deprecated
        charge: 0   // deprecated
      });
      // atom.id = 'a' + atom.number;
      atom.id = atom.number;
      atom.display_id = atom.number;
      this._atoms.push(atom);
    }
    // Parse Bond Block
    for (let j = nAtoms + offset; j < nAtoms + nBonds + offset; j++) {
      let bond = lines[j].match(/\d+/g);
      const a1 = this.atoms(parseInt(bond[0]));
      const a2 = this.atoms(parseInt(bond[1]));
      bond = new Bond({
        a1: a1,
        a2: a2,
        // values 1, 2, 3
        order: parseInt(bond[2]),
        // values 0 (plain),1 (wedge),4 (wiggly),6 (hash)
        stereo: parseInt(bond[3])
      });
      this._bonds.push(bond);
      // Connect atoms with bonds and connected atoms
      a1._bonds.push(bond);
      a2._bonds.push(bond);
      a1._bonded_atoms.push(a2);
      a2._bonded_atoms.push(a1);
    }
    // Parse Properties Block
    for (let k = (nAtoms + nBonds) + offset; k < lines.length; k++) {
      if (lines[k].indexOf('M  ISO') !== -1) {
        props = lines[k].match(/-*\d+/g);
        for (let l = 0, m = 1; l < props[0]; l++, m += 2) {
          this.atoms(props[m]).mass = parseInt(props[m + 1], 10);
        }
      } else if (lines[k].indexOf('M  CHG') !== -1) {
        props = lines[k].match(/-*\d+/g);
        for (let l = 0, m = 1; l < props[0]; l++, m += 2) {
          atoms[props[m] - 1].charge = parseInt(props[m + 1], 10);
          this.atoms(props[m]).charge = parseInt(props[m + 1], 10);
        }
      }
    }
    // self.addAtomDisplayIDs();
    self.draw();
  }

  SVStructure.prototype.loadJsmolScript = function(url, callback){
    let script = document.createElement("script")
    script.type = "text/javascript";

    if (script.readyState){  //IE
      script.onreadystatechange = function(){
        if (script.readyState === "loaded" ||
            script.readyState === "complete"){
          script.onreadystatechange = null;
          callback();
        }
      };
    }
    else {  //Others
      script.onload = function(){
        callback();
      };
    }
    script.src = url;
    document.getElementsByTagName("head")[0].appendChild(script);
  }

  SVStructure.prototype.atom_picked = function(){
    let sv = window.sv;
    let assignment_table = sv.assignment_table
    let structure = window.sv.structure;

    let index  = arguments[2] + 1;
    let atoms = new JSV.SVSet(structure.atoms(index));
    let peaks = new JSV.SVSet();

    Jmol.script(jmol_jspectraviewer, `select carbon; colour halos grey; select atomno = ${index}; colour halos blue;`)

    let cluster = assignment_table.cluster_from_atoms(atoms);

    if (cluster) {
      peaks = cluster.peaks();
      atoms = cluster.atoms();
    }

    // Select peaks in viewer
    sv.selection._elements = peaks.unique();
    sv.draw();

    // Select peaks and atoms in table
    assignment_table.selected_peaks = peaks;
    assignment_table.selected_atoms = structure.LCA_from_nmr_atoms(atoms);

    // Select cluster row in table
    assignment_table.table.selectAll('tbody tr').classed('selected', false);
    if (cluster) {
      assignment_table.table.select('tbody tr[data-cluster-path-id='+cluster.path_id()+']').classed('selected', true);
    }
  }

  SVStructure.prototype.run_jsmol = function(){
    // Height and width of the JSmol applet
    let parent_div = this.container
    let width = parseFloat(parent_div.style('width'))-10, height = parseFloat(parent_div.style('height'))-30

    let load_type = "INLINE"

    let labels = `labels off; select ${(this.nmr_nucleus === "13C") ? 'carbon' : 'hydrogen'}; label %a;`
    let show_hydrogens = this.show_hydrogen ? 'set showHydrogens TRUE;' : 'set showHydrogens FALSE;'
    let background = "background white;";
    let callbacks = 'set PickCallback "sv.structure.atom_picked";'
    let molfile = this.mol_file;

    let Info = {
      width: width,
      height: height,
      debug: false,
      color : "#EAF0F2",
      use: "HTML5",   // JAVA HTML5 WEBGL are all options
      j2sPath: "/jsmol/j2s", // this needs to point to where the j2s directory is.
      multipleBondSpacing : 0.9,
      zoomlarge: true,
      allowJavaScript: true
    };

    Info.script = 'load ' + load_type + ' "' + molfile +
        '"; color labels black; font labels 20; set antialiasDisplay; wireframe 15; spacefill 55; select carbon; halos on; colour halos grey;' +
        labels + show_hydrogens + background + callbacks
    $("#view-3d").html(Jmol.getAppletHtml('jmol_jspectraviewer', Info))

    this.atom_picked()

  }

  /**
   * Parses the molfile, extracting the molecule title from the
   * header block, two dimensional coordinates, symbol, charge,
   * and mass difference information extracted from the atom block,
   * connectivity and stereo information from the bond block.
   *
   * @param {string} molfile A URL to the MDL molfile (REST web service)
   * @param {string} id An element identifier or the element itself
   */
  SVStructure.prototype.draw = function () {
    let self = this;
    this.graph = this.initSVG();   // layout SVG
    this.avgL = 0;
    if(!this.use_jsmol) {
      this.drawBonds();
      this.drawAtoms();
      this.addInteractivity();
    } else{
      this.container.append('div').attr('id', 'view-3d').attr('style', 'position: relative; z-index: 0;')
      try {
        self.run_jsmol()
      }
      catch(e){
        self.loadJsmolScript("/jsmol/JSmol.min.js", function(){
          self.run_jsmol()
          self.initialize_jsmol_atom_picking()
        })
      }
    }
    this.toggleH(this.show_hydrogen);
    this.toggleAtomNumbers(this.show_atom_numbers);
  };

  SVStructure.prototype.initialize_jsmol_atom_picking = function(){

  }

  SVStructure.prototype.atoms = function(term) {
    return this._atoms.get(term)
  }

  SVStructure.prototype.bonds = function(term) {
    return this._bonds.get(term)
  }

  SVStructure.prototype.addInteractivity = function () {
    const self = this;
    const container = this.container;
    container.on('mouseenter', function() {
      container.selectAll('.atom').style('cursor', 'default');
      if (self.nmr_1H()) {
        container.selectAll('.atom.nmr-1h')
            .classed('highlight', true)
            .style('cursor', 'pointer');
      } else if (self.nmr_13C()) {
        container.selectAll('.atom.nmr-13c')
            .classed('highlight', true)
            .style('cursor', 'pointer');
      }
    });
    container.on('mouseleave', function() {
      container.selectAll('.atom').classed('highlight', false);
    });

    container.selectAll('.atom').on('click', function(event) {
      const atom_id = d3v7.select(this).attr('data-atom-id');
      let clicked_atom;
      if (atom_id) {
        clicked_atom = self.atoms(atom_id);
        if (self.nmr_1H()) {
          self.select_clicked_atoms_for_1H_nmr(clicked_atom, d3v7.event.shiftKey);
        } else  if (self.nmr_13C()) {
          self.select_clicked_atoms_for_13C_nmr(clicked_atom, d3v7.event.shiftKey);
        }
      }
      self.trigger('structure-click');
      event.stopPropagation();
    });

    container.on('click', function(event) {
      self.selected_atoms = [];
      self.trigger('structure-click');
    });
  }

  SVStructure.prototype.select_clicked_atoms_for_1H_nmr = function (clicked_atom, shift_key) {
    const self = this;
    let selected_atoms = this.selected_atoms;
    if (shift_key) {
      // Prevent selection of text when shift-clicking
      window.getSelection().removeAllRanges()
      if (selected_atoms.contains(clicked_atom)) {
        if (clicked_atom.is('H')) {
          const parent = clicked_atom.bonded_atoms(1);
          selected_atoms = selected_atoms.remove(parent).remove(clicked_atom);
        } else {
          clicked_atom.bonded_Hs().forEach(function(bonded_H) {
            selected_atoms = selected_atoms.remove(bonded_H);
          });
          selected_atoms = selected_atoms.remove(clicked_atom);
        }
      } else {
        selected_atoms.push(clicked_atom);
      }
    } else {
      selected_atoms = new JSV.SVSet(clicked_atom);
    }
    self.selected_atoms = selected_atoms;

  }

  SVStructure.prototype.select_clicked_atoms_for_13C_nmr = function (clicked_atom, shift_key) {
    const self = this;
    let selected_atoms = this.selected_atoms;
    if (shift_key) {
      // Prevent selection of text when shift-clicking
      window.getSelection().removeAllRanges()
      if (selected_atoms.contains(clicked_atom)) {
        selected_atoms = selected_atoms.remove(clicked_atom);
      } else {
        selected_atoms.push(clicked_atom);
      }
    } else {
      selected_atoms = new JSV.SVSet(clicked_atom);
    }
    self.selected_atoms = selected_atoms;
  }

  // toggle H visibility
  SVStructure.prototype.toggleH = function (show) {
    this.show_hydrogen = (show === undefined) ? !this.show_hydrogen : show;
    if (this.show_hydrogen) {
      d3v7.selectAll('.atom-H, .bond-H').style('display', 'inline');
      this.button_toggle_H.classed('button-on', true)
      this.button_toggle_H.text('Hide H')
      if(typeof Jmol !== 'undefined') Jmol.script(jmol_jspectraviewer, "select all; set showHydrogens TRUE;")
    } else {
      d3v7.selectAll('.atom-H, .bond-H').style('display', 'none');
      this.button_toggle_H.classed('button-on', false)
      this.button_toggle_H.text('Show H')
      if(typeof Jmol !== 'undefined') Jmol.script(jmol_jspectraviewer, "select all; set showHydrogens FALSE;")
    }
  }

  SVStructure.prototype.toggleAtomNumbers = function (show) {
    this.show_atom_numbers = (show === undefined) ? !this.show_atom_numbers : show;
    if (this.show_atom_numbers) {
      d3v7.selectAll('.atom-id').style('display', 'inline');
      this.button_toggle_numbers.classed('button-on', true);
      this.button_toggle_numbers.text('Hide #');
      if(typeof Jmol !== 'undefined'){
        if(this.nmr_nucleus === "13C"){
          Jmol.script(jmol_jspectraviewer, "select carbon; labels %a;")
        } else{
          Jmol.script(jmol_jspectraviewer, "select hydrogen; labels %a;")
        }
      }
    } else {
      d3v7.selectAll('.atom-id').style('display', 'none');
      this.button_toggle_numbers.classed('button-on', false);
      this.button_toggle_numbers.text('Show #');
      if(typeof Jmol !== 'undefined'){
        if(this.nmr_nucleus === "13C"){
          Jmol.script(jmol_jspectraviewer, "select carbon; labels %e;")
        } else{
          Jmol.script(jmol_jspectraviewer, "select hydrogen; labels %e;")
        }
      }
    }
  }

  // Create atom display numbers using modified Morgan Algorithm
  // Note: the display ids are only visible in the structure and in the
  // assignment table. They have no effect on the underlying atom ids.
  // So the method can be changed without worrying about the ids stored in the nmrML.
  SVStructure.prototype.addAtomDisplayIDs = function () {
    const self = this;
    const atoms = new JSV.SVSet(self.atoms().filter(function (a) {
      return !a.is('H')
    }));
    atoms.each(function() { this.morgan_num = 1; });
    let morgan_numbers = new JSV.SVSet();
    let unique_size = -1;
    while (unique_size != morgan_numbers.unique().length) {
      // Reset numbers
      unique_size = morgan_numbers.unique().length;
      morgan_numbers = new JSV.SVSet();
      // Calculate morgan numbers for each atom
      atoms.forEach(function(atom) {
        let temp = 0;
        atom.bonded_atoms().each(function() {
          if (!this.is('H')) {
            temp += this.morgan_num;
          }
        });
        atom.morgan_temp = temp;
      });
      atoms.forEach(function(atom) {
        atom.morgan_num = atom.morgan_temp;
        morgan_numbers.push(atom.morgan_num);
      });
    }
    atoms.order_by('morgan_num', true);

    let current_atom = atoms[0];
    let current_id = 1;
    let next_atom;
    while (current_atom) {
      current_atom.display_id = current_id;
      let possible_atoms = current_atom.bonded_atoms().filter(function (a) {
        return !a.is('H') && a.display_id == undefined
      });
      possible_atoms = new JSV.SVSet(possible_atoms);
      if (possible_atoms.length > 0) {
        next_atom = possible_atoms.order_by('morgan_num', true)[0];
      } else {
        next_atom = atoms.find(function(a) { return a.display_id == undefined });
      }
      current_atom = next_atom;
      current_id += 1;
    }
    this.addHydrogenDisplayIDs();
  }

  SVStructure.prototype.addHydrogenDisplayIDs = function () {
    const indexMap = ['a', 'b', 'c', 'd'];
    this.atoms().forEach(function(atom) {
      if (atom.is('H')) { return; }
      atom.bonded_Hs().forEach(function(hydrogen, index) {
        hydrogen.display_id = atom.display_id + indexMap[index];
      });
    });
  }

  SVStructure.prototype.hydrogens_from_atoms = function (atoms) {
    const hydrogens = new JSV.SVSet();
    atoms.forEach(function(atom) {
      if (atom.toString() === 'Atom') {
        if (atom.is('H')) {
          hydrogens.push(atom);
        } else {
          hydrogens.merge(atom.bonded_Hs());
        }
      }
    });
    return hydrogens.unique()
  }

  SVStructure.prototype.nmr_atoms_from_atoms = function (atoms) {
    const self = this;
    if (self.nmr_1H()) {
      return self.hydrogens_from_atoms(atoms);
    }
    if (self.nmr_13C()) {
      return new JSV.SVSet( atoms.filter(function(atom) { return atom.is('C'); }) ).unique();
    }
  }

  // LCA: Least Common Ancestor
  // Atoms can be hydrogens and/or LCA atoms
  // Return a simplified list of atoms to represent the significant hydrogens.
  // If a Carbon has 2 hydrogens and they are both in the list of atoms, then the Carbon atom
  // is included instead of the hydrogens.
  // If only one of the 2 hydrogens is in the list, then only the one hydrogen atom is included
  SVStructure.prototype.LCA_from_hydrogens = function (atoms) {
    const lca = new JSV.SVSet();
    if (!atoms || atoms.empty()) { return lca }
    const hydrogens = this.hydrogens_from_atoms(atoms);
    let parents = hydrogens.map(function (h) {
      return h.bonded_atoms(1)
    });
    parents = new JSV.SVSet(parents).unique();
    parents.forEach(function(p) {
      let all_Hs_in_list = true;
      const listed_Hs = new JSV.SVSet();
      const child_Hs = p.bonded_Hs();
      child_Hs.forEach(function(child_H) {
        if (hydrogens.contains(child_H)) {
          listed_Hs.push(child_H);
        } else {
          all_Hs_in_list = false;
        }
      });
      if (all_Hs_in_list) {
        lca.push(p);
      } else {
        lca.merge(listed_Hs);
      }
    });

    return lca.unique()
  }


  SVStructure.prototype.LCA_from_nmr_atoms = function (atoms) {
    const self = this;
    if (self.nmr_1H()) {
      return self.hydrogens_from_atoms(atoms);
    }
    if (self.nmr_13C()) {
      return new JSV.SVSet( atoms.filter(function(atom) { return atom.is('C'); }) ).unique();
    }
  }

  SVStructure.prototype.LCA_and_hydrogens = function (atoms) {
    const hydrogens = this.hydrogens_from_atoms(atoms);
    const lca = this.LCA_from_hydrogens(atoms);
    return hydrogens.merge(lca).unique();
  }

  SVStructure.prototype.LCA_and_nmr_atoms = function (atoms) {
    const self = this;
    if (self.nmr_1H()) {
      return self.LCA_and_hydrogens(atoms);
    }
    if (self.nmr_13C()) {
      return new JSV.SVSet( atoms.filter(function(atom) { return atom.is('C'); }) ).unique();
    }
  }

  function Atom(options) {
    options = options || {};
    this.x = JSV.default_for(options.x, 0);
    this.y = JSV.default_for(options.y, 0);
    this.z = JSV.default_for(options.z, 0);
    this.id = options.id;
    this.symbol = JSV.default_for(options.symbol, 0);
    this.index = JSV.default_for(options.index, 0);
    this.number = JSV.default_for(options.number, 1);
    this.mass = JSV.default_for(options.mass, 0);
    this.charge = JSV.default_for(options.charge, 0);
    this._bonds = new JSV.SVSet();
    this._bonded_Hs = new JSV.SVSet();
    this._bonded_atoms = new JSV.SVSet();
  }

  Atom.prototype.toString = function() {
    return "Atom"
  }

  Atom.prototype.bonds = function(term) {
    return this._bonds.get(term)
  }

  Atom.prototype.bonded_atoms = function(term) {
    return this._bonded_atoms.get(term)
  }

  Atom.prototype.bonded_Hs = function(term) {
    const filtered = this.bonded_atoms().filter(function (atom) {
      return atom.is('H')
    });
    return new JSV.SVSet(filtered)
  }

  Atom.prototype.is = function(symbol) {
    return this.symbol == symbol
  }

  Atom.prototype.isBondedTo = function(symbol) {
    return this.bonded_atoms().some(function(a) { return a.symbol == symbol })
  }

  Atom.prototype.color = function() {
    return d3v7.rgb(AtomColors[this.symbol]);
  }

  function Bond(options) {
    options = options || {};
    this.a1 = options.a1
    this.a2 = options.a2
    this.order = JSV.default_for(options.order, 1);
    this.stereo = JSV.default_for(options.stereo, 0);
    this._atoms = new JSV.SVSet([this.a1, this.a2]);
  }

  Bond.prototype.toString = function() {
    return "Bond"
  }

  Bond.prototype.atoms = function(term) {
    return this._atoms.get(term)
  }

  JSV.SVStructure = SVStructure;

})(JSpectraViewer);
