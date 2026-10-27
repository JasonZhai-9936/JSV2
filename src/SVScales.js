import * as d3 from 'd3';


export class LinearScale {
    constructor() {
        const d3_scale = d3.scaleLinear();
        
        d3_scale.min = (x) => {
            if (!arguments.length) return d3_scale.domain()[0];
            if (x > d3_scale.max()) {
                throw new Error("x must be less than domain max: " + d3_scale.max());
            }

            d3_scale.domain([x, d3_scale.max()]);
            return d3_scale;
        }

        d3_scale.max = (x) => {
            if (!arguments.length) return d3_scale.domain()[1];
            if (x < d3_scale.min()) {
                throw new Error("x must be greater than domain min: " + d3_scale.min());
            }

            d3_scale.domain([d3_scale.min(), x]);
            return d3_scale;
        }

        d3_scale.diff = () => {
            return Math.abs(d3_scale.max() - d3_scale.min());
        }

        d3_scale.range_diff = () => {
            return Math.abs(d3_scale.range()[1] - d3_scale.range()[0]);
        }

        d3_scale.range_min = () => {
            return d3.min(d3_scale.range());
        }

        d3_scale.range_max = () => {
            return d3.max(d3_scale.range());
        }

        return d3_scale;
    }
}




export class SVScale {
    constructor(sv, isZoomBox) {
        this.x = new LinearScale();
        this.y = new LinearScale();
        this.initialized = false;
        this.sv = sv;
        this.isZoomBox = isZoomBox || false;
    }

    clamp() {
        this.x.clamp(true);
        this.y.clamp(true);
    }

    update(data) {
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
        })

        data.x.forEach((x) => {
            if(x < x_min) x_min = x;
        })

        data.y.concat(current_y_max).forEach((y) => {
            if(y > y_max) y_max = y;
        })

        data.y.forEach((y) => {
            if(y < y_min) y_min = y;
        })

        // Update scale boundaries
        this.x.domain([x_min, x_max]);
        this.y.domain([y_min, y_max]);
        if (this.sv?.has_mirror_plot) {
            this.y.tickFormat(d => Math.abs(d));
        }
        this.initialized = true;
    }
}