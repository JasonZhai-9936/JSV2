import * as JSV from "./Utils.js"
import { SVSet } from "./SVSet.js";


let path_id = 0;
export class SVBar {

    constructor(options, meta) {
        console.log("SVBar.constructor()")
        options = options || {};
        this.meta = meta || {};
        this.y_axis_elevation = 10;
        this.lineWidth = options.lineWidth;  // undefined: use the width for the viewer's chart type (JSV.line_width_for)
        this.color = JSV.default_for(options.display?.color, 'black');
        this.visible = JSV.default_for(options.visible, true);
        this.dash = JSV.default_for(options.dash, []);
        this.fill = options.fill;
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
        } else if ((calculate && this.peaks().length > 0) || (!has_data && this.peaks().length > 0)) {
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

    draw(context, scale, fast, calculate, pixel_skip) {
        if (this.visible) {
            const data = this.data_for_draw(scale, fast, calculate, pixel_skip);
            const y_axis_elevation = 10;
            const min_index = JSV.index_of_value(data.x, scale.x.domain()[0], false);
            const max_index = JSV.index_of_value(data.x, scale.x.domain()[1], true);
            context.translate(0.5, 0.5);

            // Prepare the data points
            const points = [];
            for (let i = min_index; i <= max_index; i++) {
                points.push({
                    x: data.x[i],
                    y: data.y[i]
                });
            }

            // Draw bars
            const calculatedWidth = Math.abs(scale.x(data.x[min_index + 1]) - scale.x(data.x[min_index])) * 0.8;
            const barWidth = Math.min(calculatedWidth, 2); // Cap at 2 pixels for LC-MS/EIMS

            points.forEach(point => {
                const x = scale.x(point.x) - barWidth / 2; // Center the bar on the x-coordinate
                let y, height;
                
                if (point.y < 0) {
                    // Negative Y (mirror plot): bars extend downward from y=0
                    y = scale.y(0);  // Start exactly at baseline
                    height = scale.y(point.y) - scale.y(0);  // Positive height downward
                } else {
                    // Positive Y (normal): bars extend upward from y=0
                    y = scale.y(point.y);  // Top of the bar (no elevation for consistency)
                    height = scale.y(0) - scale.y(point.y); // Height from top to baseline
                }
                
                const width = barWidth;

                context.beginPath();
                context.rect(x, y, width, height);
                context.fillStyle = this.color || 'steelblue'; // Default bar color
                context.fill();
            });

            // Optional: Outline bars
            context.lineWidth = JSV.default_for(this.lineWidth, JSV.line_width_for(this._sv));
            context.strokeStyle = this.color || 'black';
            points.forEach(point => {
                const x = scale.x(point.x) - barWidth / 2;
                let y, height;
                
                if (point.y < 0) {
                    // Negative Y (mirror plot): bars extend downward
                    y = scale.y(0);
                    height = scale.y(point.y) - scale.y(0);
                } else {
                    // Positive Y (normal): bars extend upward
                    y = scale.y(point.y);  // No elevation for consistency
                    height = scale.y(0) - scale.y(point.y);
                }
                
                const width = barWidth;

                context.beginPath();
                context.rect(x, y, width, height);
                context.stroke();
            });

            context.translate(-0.5, -0.5);
        }
    }


}