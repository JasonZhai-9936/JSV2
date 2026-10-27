
import { SVSet } from "./SVSet.js";
import * as d3 from "d3";


export let pixel_ratio = 1.0;
export function set_pixel_ratio(new_ratio) {
    pixel_ratio = new_ratio;
}

export let _viewers = new SVSet();
console.log("_viewers set initialized", _viewers);
export function viewers(term) {
    // let _viewers = new SVSet();
    return _viewers.get(term);
}



// Stroke width (px) of spectrum lines, bar outlines and 2D contours.
// Chart types listed in LINE_WIDTHS override the default.
export const DEFAULT_LINE_WIDTH = 1;
export const LINE_WIDTHS = {
    '1D-IR': 3.9375,
    '1D-UV': 3.9375,
};

// Line width for the spectra drawn in viewer _sv_ (based on its chart type)
export function line_width_for(sv) {
    const width = sv ? LINE_WIDTHS[sv.chart_type] : undefined;
    return (width === undefined) ? DEFAULT_LINE_WIDTH : width;
}

/**
   * Return the _default_value_ if _value_ is undefined
   * @param {Object} value         Returned if it is defined
   * @param {Object} default_value Returned if _value_ is undefined
   * @return {Object}
*/
export function default_for(value, default_value) {
    return (value === undefined) ? default_value : value;
}

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
export function pixel(px) {
    return px * pixel_ratio;
}

export function get_pixel_ratio(canvas) {
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

export function scale_resolution(canvas, ratio) {
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
export function unique_id(id_base, start, current_ids) {
    let id;
    console.log('generating unique_id', current_ids);
    do {
        id = id_base + start;
        start++;
    } while (current_ids.indexOf(id) > -1);
    return id;
}


export function merge() {
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
            for (; key_i < key_len; key_i++) {
                key = keys[key_i];
                data[key] = object[key];
            }
        }
    }
    return data;
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
export function index_of_value(data, search_value, upper) {
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
 * Returns the number of milliseconds elapsed since the supplied time.
 * The returned time will have 'ms' appended to it.
 * @param {Integer} old_time Old time in milliseconds
 * @return {Integer}
 */
export function elapsed_time(old_time) {
    const elapsed = (new Date().getTime()) - old_time;
    return elapsed + ' ms';
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
export function lorentzian(x_value, center, width, amplitude) {
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
export function sum_of_peaks(x_value, peaks) {
    let sum = 0;
    let peak;
    for (let i = 0; i < peaks.length; i++) {
        peak = peaks[i];
        sum += lorentzian(x_value, peak.center, peak.width, peak.amplitude);
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
export function xy_from_peaks(peaks, number_of_points, lowerlim, upperlim, fast) {
    if (fast) peaks = peaks_in_range(peaks, lowerlim, upperlim, 6);
    const peaks_in_view = peaks_in_range(peaks, lowerlim, upperlim);
    const centers = peaks_in_view.order_by('center').map(function (p) {
      return p.center;
    });
    let xpos = lowerlim;
    const xmax = upperlim;
    const x = [], y = [];
    const delta = ((upperlim - lowerlim) / number_of_points);
    while (xpos < xmax) {
      x.push(xpos);
      y.push(sum_of_peaks(xpos, peaks));
      if (centers[0] && (centers[0] <= xpos + delta) ) {
        xpos = centers.shift();
      } else {
        xpos += delta;
      }
    }
    // Add last point
    x.push(upperlim);
    y.push(sum_of_peaks(upperlim, peaks));
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
export function peaks_in_range(peaks, lowerlim, upperlim, range) {
    range = range || 0;
    const new_peaks = new SVSet();
    peaks.forEach(function(peak) {
      if ( (peak_min([peak], range) < upperlim) && (peak_max([peak], range) > lowerlim ) ) {
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
export function peak_min(peaks, widths) {
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
export function peak_max(peaks, widths) {
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
export function number(n) {
    if (n === undefined) return;
    return Number(n);
}

/**
 * Convience function to determine if an object is a number.
 * @param {Object} n The object to check
 * @return {Boolean}
 */
export function isNumeric(n) {
    return isFinite(n) && parseFloat(n) == n;
}

/**
 * Return the number of decimal places found in _num_.
 *
 * @param {Number} num The number to check
 * @return {Number}
 */
export function decimalPlaces(num) {
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
export function colors (len, center, width, alpha, freq1, freq2, freq3,
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

export function test_colors(colors) {
    colors.forEach(function(color) {
      document.write( '<font style="color:' + color + '">&#9608;</font>')
    })
    document.write( '<br/>')
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
export function simplify(points, tolerance, highestQuality) {
    console.log("simplifying points with input", points);
    const length = points.x.length;
    if (length <= 1) return points;

    let _points = points;
    let pts = new Array(length);
    for (let i=0; i < length; i++) {
        pts[i] = i;
    }

    const sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

    pts = highestQuality ? pts : Simplify.simplifyRadialDist(pts, sqTolerance);
    pts = Simplify.simplifyDouglasPeucker(pts, sqTolerance, _points);
    // console.log("simplified points after Radial and Douglas", pts);

    const x = new Array(pts.length);
    const y = new Array(pts.length);
    for (let i=0, len=pts.length; i < len; i++) {
        // console.log("pts[i]", pts[i]);
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
    // console.log("simplify points", points);
    return points
}


// simplification using optimized Douglas-Peucker algorithm with recursion elimination
export class Simplify {
    _points = [];

    // basic distance-based simplification
    static simplifyRadialDist(pts, sqTolerance) {

        let prevPoint = pts[0];
        const newPoints = [prevPoint];
        let pt;

        let i = 1;
        const len = pts.length;
        for (; i < len; i++) {
            pt = pts[i];

            if (Simplify.getSqDist(pt, prevPoint) > sqTolerance) {
                newPoints.push(pt);
                prevPoint = pt;
            }
        }

        if (prevPoint !== pt) newPoints.push(pt);

        return newPoints;
    }

    static simplifyDouglasPeucker(pts, sqTolerance, _points) {

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
                sqDist = Simplify.getSqSegDist(_points, pts[i], pts[first], pts[last]);

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

    // square distance from a point to a segment
    static getSqSegDist(_points, p, p1, p2) {

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


    // square distance between 2 points
    static getSqDist(p1, p2) {
        const dx = _points.x[p1] - _points.x[p2],
            dy = _points.y[p1] - _points.y[p2];

        return dx * dx + dy * dy;
    }
}

export class SVLabel {
    label_id = 0;

    constructor(label_set, data, display, meta, label_id) {
      data = data || {};
      let display_defaults = { vertical: true, font_size: 12 };
      display = merge(display_defaults, data.display, display);
      this.meta = merge(data.meta, meta);
  
      this.label_set = label_set;
      this.vertical = display.vertical;
      this.font_size = display.font_size;
      // this.id = data.id;
      // this.name = data.name || this.id;
      this.text = data.text;
      this.x = data.x;
      this.y = data.y;
      this.stack_level = 0;
      this._label_id(label_id);
    }
  
    _label_id(label_id) {
      const new_id = this.generate_label_id(label_id);
      this.label_id = function() { return new_id; }
      return new_id;
    }
  
    generate_label_id(label_id) {
      return 'label-id-' + label_id++;
    }
  
    // Adjust the rect so it does not overlap any rects in rect_array
    // Returns an object with the adjusted rect and how many levels the
    // rect had to be stacked to not overlap any more.
    adjust_rect(labels) {
      const overlap = true;
      let count = 0;
      while( this.overlap(labels) ) {
        this.rect.y -= JSV.pixel(this.font_size) * 2;
        count += 1;
      }
      this.stack_level = count
    }
  
    overlap(labels) {
      return this.rect.overlap( labels.map( function(label) { return label.rect; } ) );
    }


}

export class SVLabelSet {

    constructor(options) {
        options = options || {};
        this.spectrum = options.spectrum;
        this.labels = new SVSet();
    }

    get(term) {
        return this.labels.get(term);
    }

    add(data, display, meta) {
        this.labels.push(new SVLabel(data, display, meta));
    }


    // If the SVLabelSet is associated with a spectrum with peaks those labels will be added
    add_peaks() {
        if (this.spectrum) {
            const peaks = this.spectrum.peaks()
            let i = 0;
            const len = peaks.length;
            for (; i<len; i++) {
                const peak = peaks[i]
                const y = sum_of_peaks(peaks.center, peak.spectrum().peaks())
                this.add({ x: peak.center, y: y, text: peak.label() })
            }
        }
    }

    // If the SVLabelSet is associated with a spectrum with peaks those labels will be regenerated
    update_peaks() {
        if (this.spectrum) {
            // TODO: only remove peak associated labels
            this.labels = new SVSet();
            this.add_peaks();
        }
    }

}


export class SVDialog {

    constructor(sv, options) {
        options = options || {};
        const self = this;
        this.wrapper = sv.sv_wrapper.node();
    
        this.fade_time = default_for(options.fade_time, 500);
        this.header_text = default_for(options.header_text, '');
        this.content_text = default_for(options.content_text, '');
        this.height = default_for(options.height, 300);
        this.width = default_for(options.width, 300);
        this.buttons = options.buttons
    
        this.box = d3.select(this.wrapper).append('div')
            .style('display', 'none')
            .attr('class', 'jsv-dialog');
    
        this.header = this.box.append('div')
            .attr('class', 'jsv-dialog-header')
            .html(this.header_text);
    
        this.dismiss = this.box.append('div')
            .attr('class', 'jsv-dialog-dismiss')
            .html('X')
            .on('click', function() { self.close(); });
    
        this.contents = this.box.append('div')
            .attr('class', 'jsv-dialog-contents jsv-scroll');
    
        if (this.buttons) {
          this.footer = this.box.append('div')
              .attr('class', 'jsv-dialog-footer');
          this.generate_buttons();
        }
    
        this.contents.html(this.content_text);
    
        this.adjust_size();
    
        return self;
    }


    visible() {
        return (this.box.style('display') != 'none');
    }
    
    
    open() {
        this.adjust_size();
        this.box.style('display', 'block');
        this.box.transition().duration(this.fade_time)
            .style('opacity', 1);
        return this;
    }
    
    close() {
        this.box.transition().duration(this.fade_time)
            .style('opacity', 0)
            .on('end', function() {
              d3.select(this).style('display', 'none');
            });
        return this;
    }
    
    generate_buttons() {
        const self = this;
        const labels = Object.keys(this.buttons);
        labels.forEach(function(label) {
          self.footer.append('button')
              .html(label)
              .attr('class', 'jsv-button')
              .on('click', function() { self.buttons[label].call(self) });
        });
    
    }
    
    adjust_size() {
        // Minimum buffer between dialog and edges of container (times 2)
        const buffer = 50;
        const wrapper_width = this.wrapper.offsetWidth;
        const wrapper_height = this.wrapper.offsetHeight;
        let width = this.width;
        let height = this.height;
    
        if (this.height > wrapper_height - buffer) height = wrapper_height - buffer;
        if (this.width > wrapper_width - buffer) width = wrapper_width - buffer;
    
        const header_height = 40;
        const footer_height = this.buttons ? 35 : 0;
        const content_height = height - header_height - footer_height;
    
        this.box
            .style('width', width + 'px')
            .style('height', height + 'px')
    
        this.contents
            .style('height', content_height + 'px');
    }


}


/**
 * Rounds the number use d3v7.round. The only reason to use this method
 * is that it sets the default number of decimal places to 2.
 * @param {Number} value Number to round
 * @param {Integer} places Number of decimal places to round [Default: 2]
 * @return {Number}
 */
export function round(value, places=2) {
    return d3v7.round(value, places);
}