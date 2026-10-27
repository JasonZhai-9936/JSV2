import * as d3 from 'd3';
import * as JSV from './Utils.js';
import { SVScale } from './SVScales.js';

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

    find_peaks(z, threshold) {
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

    draw(context, scale, fast, scaled_height, x_range, threshold) {

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
                this.original_scale = new SVScale();
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

                this.posContours = d3.contourDensity()
                    .size([data.x.length * 3, data.y.length * 3])
                    .bandwidth(8)    // smaller = more precision in lines = more lines
                    (positivePeaks);

                this.negContours = d3.contourDensity()
                    .size([data.x.length * 3, data.y.length * 3])
                    .bandwidth(8)    // smaller = more precision in lines = more lines
                    (negativePeaks);
            }

            // Plot contours
            context.lineWidth = JSV.default_for(this.lineWidth, JSV.line_width_for(this._sv));
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