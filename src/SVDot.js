import * as d3 from 'd3';
import * as JSV from './Utils.js';

// 2D contour levels: CONTOUR_COUNT positive and CONTOUR_COUNT negative levels,
// each CONTOUR_MULTIPLIER times the previous one
const CONTOUR_COUNT = 5;
const CONTOUR_MULTIPLIER = 1.75;

export default class SVDot {

    static plot_id = 0;

    /**
     * Objects that will be drawn as paths should inherit form SVPath
     * (e.g. [Spectrum](Spectrum.js.html), [Peak](Peak.js.html), etc)
     * @param {Object} options Properties for the canvas context to use when drawing the path
     *
     *   - _color_ [default: 'black']
     *   - _fill_ [default: '']
     *   - _lineWidth_ [default: by chart type, see JSV.line_width_for]
     *   - _visible_ [default: true]
     *   - _dash_ [default: []]
     *
     * @param {Object} meta User-defined _key_:_value_ pairs to add to the SVPath.
     */
    constructor(options, meta) {
        options = options || {};
        this.meta = meta || {};
        this.dotSize = JSV.default_for(options.dotSize, 1);
        this.lineWidth = options.lineWidth;  // undefined: use the width for the viewer's chart type (JSV.line_width_for)
        this.color = JSV.default_for(options.color, 'black');
        this.visible = JSV.default_for(options.visible, true);
        this.plot_id();
    };

    plot_id() {
        let new_id = this.generate_plot_id();
        this.path_id = function() { return new_id; }
        return new_id;
    }

    generate_plot_id() {
        return 'plot-id-' + SVDot.plot_id++;
    }

    attr(attributes) {
        const keys = Object.keys(attributes);
        let i = 0;
        const len = keys.length;
        for (; i < len; i++) {
            this[keys[i]] = attributes[keys[i]];
        }
        return this;
    }

    display_settings(options) {
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


    sum(a) {
        return a.reduce((acc, val) => acc + val)
    }

    mean(a) {
        return this.sum(a) / a.length
    }

    stddev(arr) {
        const arr_mean = this.mean(arr)
        const r = function(acc, val) {
            return acc + ((val - arr_mean) * (val - arr_mean))
        }
        return Math.sqrt(arr.reduce(r, 0.0) / arr.length)
    }

    // Determine best data to use for drawing based on 'fast' and 'calculate' and the
    // available data in the SVPath.
    data_for_draw() {
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

    // Contour levels: CONTOUR_COUNT levels spaced geometrically by CONTOUR_MULTIPLIER,
    // starting at (standard deviation of the intensities) x threshold. The threshold
    // is set with the scroll wheel.
    contour_levels(z, threshold) {
        if (this._z_stddev === undefined) this._z_stddev = this.stddev(z);
        const start = this._z_stddev * threshold;
        const levels = [];
        for (let i = 0; i < CONTOUR_COUNT; i++) {
            levels.push(start * CONTOUR_MULTIPLIER ** i);
        }
        return levels;
    }

    // Intensity contours of a row-major grid of values (one row per y value), with
    // coordinates converted from grid indices to the x/y data units (ppm)
    calculate_contours(x, y, values, levels) {
        const contours = d3.contours().size([x.length, y.length]).thresholds(levels)(values);
        // d3 places grid value i at coordinate i + 0.5; axis values are evenly spaced
        const to_units = (i, axis) => axis[0] + (i - 0.5) * (axis[1] - axis[0]);
        contours.forEach((level) => {
            level.coordinates.forEach((polygon) => polygon.forEach((ring) => ring.forEach((point) => {
                point[0] = to_units(point[0], x);
                point[1] = to_units(point[1], y);
            })));
        });
        return contours;
    }

    draw_contours(context, scale, contours, color) {
        context.strokeStyle = color;
        contours.forEach((level) => level.coordinates.forEach((polygon) => polygon.forEach((ring) => {
            context.beginPath();
            ring.forEach((point, i) => {
                const px = scale.x(point[0]);
                const py = scale.y(point[1]);
                if (i === 0) {
                    context.moveTo(px, py);
                } else {
                    context.lineTo(px, py);
                }
            });
            context.stroke();
        })));
    }

    draw(context, scale, fast, scaled_height, x_range, threshold) {

        if (this.visible) {
            let data = this.data_for_draw();

            // Recalculate the contours only when the contour threshold changes
            if (this.contour_threshold !== threshold) {
                this.contour_threshold = threshold;
                const levels = this.contour_levels(data.z, threshold);
                // Negative contours are the positive contours of the negated intensities,
                // so each one encloses a negative peak
                if (!this._negated_z) this._negated_z = data.z.map((v) => -v);
                this.positive_contours = this.calculate_contours(data.x, data.y, data.z, levels);
                this.negative_contours = this.calculate_contours(data.x, data.y, this._negated_z, levels);
            }

            // Plot contours, clipped to the plot area
            const x_pixels = scale.x.range();
            const y_pixels = scale.y.range();
            context.save();
            context.beginPath();
            context.rect(Math.min(...x_pixels), Math.min(...y_pixels),
                Math.abs(x_pixels[1] - x_pixels[0]), Math.abs(y_pixels[1] - y_pixels[0]));
            context.clip();
            context.lineWidth = JSV.default_for(this.lineWidth, JSV.line_width_for(this._sv));
            this.draw_contours(context, scale, this.positive_contours, 'blue');
            this.draw_contours(context, scale, this.negative_contours, 'red');
            context.restore();

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
                let horizontal_1d = d3.scaleLinear()
                    .domain([x_proj_min, x_proj_max])
                    .range([0, -(scaled_height * 0.12) + 10]);

                let vertical_1d = d3.scaleLinear()
                    .domain([y_proj_min, y_proj_max])
                    .range([0, -(x_range[0] * 0.08) + 10]);

                context.lineWidth = JSV.default_for(this.lineWidth, JSV.line_width_for(this._sv));
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




}