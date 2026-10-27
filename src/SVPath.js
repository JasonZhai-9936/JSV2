import * as JSV from "./Utils.js";
import { SVSet } from "./SVSet.js";
import { line, area, curveLinear, curveMonotoneX } from 'd3-shape';
// may need to replace curveMonotoneX with curveLinear (used in the original version)


let path_id = 0;
export class SVPath {

    constructor(options, meta) {
        console.log("SVPath.constructor() spectrum, meta", options, meta);
        options = options || {};
        this.meta = meta || {};
        this.y_axis_elevation = 10;
        this.lineWidth = options.lineWidth;  // undefined: use the width for the viewer's chart type (JSV.line_width_for)
        this.color     = JSV.default_for(options.display?.color, 'black');
        this.visible   = JSV.default_for(options.visible, true);
        this.dash      = JSV.default_for(options.dash, []);
        this.fill      = options.fill;
        this.path_id();
    }

    path_id() {
        const new_id = this.generate_path_id();
        this.path_id = function() { return new_id; }
        return new_id;
    }

    generate_path_id() {
        return "path-id-" + path_id++;
    }

    attr(attributes) {
        const keys = Object.keys(attributes);
        for (let i=0; i<keys.length; i++) {
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

    // Determine best data to use for drawing based on 'fast' and 'calculate' and the
    // available data in the SVPath.
    data_for_draw(scale, fast, calculate, pixel_skip) {
        let data;
        const has_data = this.xy_data != undefined;

        if (this.phasing && has_data && this.xy_data.yi != undefined) {
            let ph;
            const y = [];
            const len = this.xy_data.length();
            for (let i=0; i<len; i++) {
                ph = Math.PI * (1*this.ph0 + 1*(len-i-1)*this.ph1/len) / 180.0;
                y.push( ( Math.cos(ph) * this.xy_data.y[i] ) + ( Math.sin(ph) * this.xy_data.yi[i] ) );
            }
            data = {
                x: this.xy_data.x,
                y: y
            }
        } 
       
        else if (has_data) {
            data = fast ? this.simple_xy_data : this.xy_data;
        } else if (this.peaks().length > 0) {
            // Calculated mode is used for simulated spectra that have no raw data points
            if (!pixel_skip) pixel_skip = 1;
            const number_of_points = scale.x.range_diff() / JSV.pixel_ratio / pixel_skip;
            const fast_calc = pixel_skip > 1;
            data = JSV.xy_from_peaks(this.peaks(), number_of_points, scale.x.domain()[0], scale.x.domain()[1], fast_calc);
        } else {
            data = {x: [0], y: [0]};
            console.error('No data or Peaks for SVPath:');
        }
        return data;
    }

    draw(context, scale, fast, calculate, pixel_skip) {
        if (this.visible) {
            const data = this.data_for_draw(scale, fast, calculate, pixel_skip);
            if (!data || !data.x || data.x.length === 0) return;

            const y_axis_elevation = 10;
            
            // Expanded index range (buffer of 5 points) ensures the line straddles the visible boundaries, preventing it from vanishing on deep zoom.
            let min_index = Math.max(0, JSV.index_of_value(data.x, scale.x.domain()[0], false) - 5);
            let max_index = Math.min(data.x.length - 1, JSV.index_of_value(data.x, scale.x.domain()[1], true) + 5);
            
            context.translate(0.5, 0.5);

            // Prepare the data points
            const points = [];
            for (let i = min_index; i <= max_index; i++) {
                points.push({
                    x: data.x[i],
                    y: data.y[i]
                });
            }

            if (points.length < 2) {
                context.translate(-0.5, -0.5);
                return;
            }

            // Use D3's area generator if filling is needed
            if (this.fill) {
                const areaGenerator = area()
                    .x(d => scale.x(d.x))
                    //Changed y0 to use the bottom of canvas instead of scale.y(0) to prevent horizontal line at y=0
                    .y0(scale.y.range()[0])
                    .y1(d => scale.y(d.y) - y_axis_elevation)
                    .curve(curveMonotoneX)
                    .context(context);

                context.beginPath();
                areaGenerator(points);
                context.fillStyle = this.fill;
                context.fill();
            }

            // Use D3's line generator
            const lineGenerator = line()
                .x(d => scale.x(d.x))
                .y(d => scale.y(d.y) - y_axis_elevation)
                .curve(curveMonotoneX)
                .context(context);

            context.beginPath();
            lineGenerator(points);
            context.lineWidth = JSV.default_for(this.lineWidth, JSV.line_width_for(this._sv));
            context.strokeStyle = this.color;
            context.setLineDash(this.dash);
            context.stroke();

            context.translate(-0.5, -0.5);
        }
    }

}