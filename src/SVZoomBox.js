import * as JSV from './Utils.js';
import * as d3 from "d3";
import { SVScale } from "./SVScales.js"

export class SVZoomBox {
    constructor(sv) {
        this._visible = false;
        this.sv = sv;

        // Set up zoom box size based on the percentage provided in options
        let percentage = sv.zoombox_size || 10;
        this.width = sv.width * percentage / 100;
        this.height = sv.height * percentage / 100;
        this.adjusting = false;
        this._spectra = [];
    
        // Create the SVG container for the zoom box
        this.svg = sv.sv_wrapper.append('svg')
            .attr('width', this.width + 1)
            .attr('height', this.height + 1)
            .style('position', 'absolute')
            .style('top', 0)
            .style('left', sv.width - this.width - 1);  // Always top-right
    
        // Draw the background/border of the zoom box
        this.border = this.svg.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('fill', 'white')
            .attr('stroke', '#BBB');
    
        // Set initial scales for the zoom box context
        this.scale = new SVScale(sv, true);
        
        // Respect Y-axis reversal (for IR single graphs)
        let y_range = (this.sv.axis_y_reverse && !this.sv.has_mirror_plot) ? [0, this.height] : [this.height, 0];
        this.scale.y.range(y_range);
        
        // Ensure the internal x-range of the zoom box matches the viewer's x-direction
        let x_range = this.sv.axis_x_reverse ? [this.width, 0] : [0, this.width];
        this.scale.x.range(x_range);
    
        // Initialize the D3 brush for selecting areas within the zoom box
        this.initialize_brushing();
    
        // D3 line generator for rendering the mini-spectra inside the box
        this.spectra_function = d3.line()
            .x((d) => this.scale.x(d.x))
            .y((d) => this.scale.y(d.y))
            .curve(d3.curveMonotoneX); // Use monotone curve for smoother lines
    }

    get visible() {
        return this._visible;
    }

    set visible(val) {
        this._visible = val;
        if (this._visible) {
            this.svg.style('display', 'block');
        } else {
            this.svg.style('display', 'none');
        }
        console.log('setting zoombox visible', this.sv)
        this.sv.legend.update();
        this.sv.draw();
    }

    initialize_brushing() {
        const zb = this;
        const sv = zb.sv;
        
        // Brush extent must always be [[min_x, min_y], [max_x, max_y]] in pixel coordinates
        // When axis is reversed, range is [width, 0], so we need to use Math.min/max
        const x_min = Math.min(zb.scale.x.range()[0], zb.scale.x.range()[1]);
        const x_max = Math.max(zb.scale.x.range()[0], zb.scale.x.range()[1]);
        const y_min = Math.min(zb.scale.y.range()[0], zb.scale.y.range()[1]);
        const y_max = Math.max(zb.scale.y.range()[0], zb.scale.y.range()[1]);
        
        zb.brush = d3.brush()
            .extent([[x_min, y_min], [x_max, y_max]])
            .on('start', brushstart)
            .on('brush', brushing)
            .on('end', brushend);

        zb.select_brush = zb.svg.append("g")
            .attr("class", "active-brush")
            .call(zb.brush);
    
        function brushstart(event) {
            if (event.sourceEvent) event.sourceEvent.preventDefault(); // Prevent text cursor
        }
    
        function brushing(event) {
            // Store the extent but don't update the view yet - this keeps the brush outline visible while dragging
            if (!(event.selection === null) && !zb.adjusting) {
                let extent;
                if (sv.axis_y_lock !== false) {
                    const ex = event.selection;
                    const x1 = ex[0][0];
                    const x2 = ex[1][0];
                    // Set y1 to the min y domain
                    const y1 = zb.scale.y.domain()[0];
                    const mouse_y = zb.scale.y.invert(d3.pointer(event, zb.svg.node())[1]);
                    const max_y = zb.scale.y.domain()[1];
                    let y2 = Math.min(mouse_y, max_y);
                    y2 = Math.max(y1, y2);
                    // Convert x coordinates - when axis is reversed, domain is [max, min]
                    const x1_val = zb.scale.x.invert(x1);
                    const x2_val = zb.scale.x.invert(x2);
                    extent = [[Math.min(x1_val, x2_val), Math.max(x1_val, x2_val)], [0, y2]];
                }
                if (!extent) {
                    // With reversed axis, the scale domain is [high, low] instead of [low, high]
                    // But scale.invert() still works correctly - it just returns the actual domain value
                    // So we need to get BOTH corner values and sort them
                    const x1_val = zb.scale.x.invert(event.selection[0][0]);  // Top-left x
                    const x2_val = zb.scale.x.invert(event.selection[1][0]);  // Bottom-right x
                    const y1_val = zb.scale.y.invert(event.selection[0][1]);  // Top-left y
                    const y2_val = zb.scale.y.invert(event.selection[1][1]);  // Bottom-right y
                    
                    // Format as [[x_min, x_max], [y_min, y_max]] for move_to
                    // Always ensure proper domain ordering
                    extent = [[Math.min(x1_val, x2_val), Math.max(x1_val, x2_val)], 
                            [Math.min(y1_val, y2_val), Math.max(y1_val, y2_val)]];
                }
                // Store extent for use in brushend
                zb.pending_extent = extent;
            }

            // DEBUG INFO
            if (sv.debug) {
                sv.debug_data.zbox['X1'] = JSV.round(zb.brush.extent()[0][0]);
                sv.debug_data.zbox['Y1'] = JSV.round(zb.brush.extent()[0][1]);
                sv.debug_data.zbox['X2'] = JSV.round(zb.brush.extent()[1][0]);
                sv.debug_data.zbox['Y2'] = JSV.round(zb.brush.extent()[1][1]);
            }
        }
    
        function brushend(event) {
            if(!zb.adjusting) {
                // Now update the view only when brushing ends, using the stored extent
                if (zb.pending_extent) {
                    const extent = zb.pending_extent;
                    // extent is already in format [[x_min, x_max], [y_min, y_max]]
                    sv.move_to(extent, 0);
                    zb.pending_extent = null;
                }
                // Force setting next zoom to update zoom level
                sv.zoom_axis = '';
                sv.draw();
            }
        }    
        
    }

    add_spectrum(spectrum) {
        const boundary = this.sv.boundary;
        console.log('boundary', boundary)
        console.log('Setting zoombox scale to:', boundary.x.domain(), boundary.y.domain())
        
        // Update Y range if axis is reversed (but not for mirror plots)
        let y_range = (this.sv.axis_y_reverse && !this.sv.has_mirror_plot) ? [0, this.height] : [this.height, 0];
        this.scale.y.range(y_range);
        
        this.scale.x.domain(boundary.x.domain());
        this.scale.y.domain(boundary.y.domain());
        console.log('Zoombox scale domain after:', this.scale.x.domain(), this.scale.y.domain())
        // if (spectrum.color === 'blue') return
        console.log("spectrum in zoombox.add_spectrum", spectrum)
        console.log('adding zoombox.add_spectrum', spectrum.simple_xy_data.asArray(), this.spectra_function(spectrum.simple_xy_data.asArray()))
        console.log('spectrum.add_to_zoom_box', spectrum.add_to_zoom_box)
        if (!spectrum.add_to_zoom_box) return;
        if (this.sv.chart_type == "1D-NMR") {
            this.svg.append('path')
                .attr('id', spectrum.id)
                .attr('d', this.spectra_function(spectrum.simple_xy_data.asArray()))
                .attr('stroke', spectrum.color)
                .attr('stroke-width', 0.5)
                .attr('fill', 'none');
        } else if (this.sv.chart_type == "1D-EIMS") {
            // Extract data points
            console.log('spectrum.simple_xy_data.asArray()', spectrum.simple_xy_data.asArray())
            const data = spectrum.simple_xy_data.asArray();

            // Determine bar width based on x spacing
            const calculatedWidth = data.length > 1
                ? Math.abs(this.scale.x(data[1].x) - this.scale.x(data[0].x)) * 0.8
                : 2;
            const barWidth = Math.min(calculatedWidth, 2); // Cap at 2 pixels
            console.log('barWidth', barWidth)
            // Draw bars
            data.forEach(point => {
                console.log('adding bar', point)
                const x = this.scale.x(point.x) - barWidth / 2; // Center bar on x value
                let y, height;
                
                if (point.y < 0) {
                    // Negative Y (mirror plot): bars extend downward from y=0
                    y = this.scale.y(0);
                    height = this.scale.y(point.y) - this.scale.y(0);
                } else {
                    // Positive Y (normal): bars extend upward from y=0
                    y = this.scale.y(point.y);
                    height = this.scale.y(0) - this.scale.y(point.y);
                }

                this.svg.append('rect')
                    .classed('spectrum-' + spectrum.id, true)  // Add class for removal
                    .attr('x', x)
                    .attr('y', y)
                    .attr('width', barWidth)
                    .attr('height', height)
                    .attr('fill', spectrum.color || 'steelblue')
                    .attr('stroke', 'none');
            });
            console.log('ADDED BARS')

        } else if (this.sv.chart_type === "1D-LCMS") {
            const data = spectrum.simple_xy_data.asArray();
            const calculatedWidth = data.length > 1
                ? Math.abs(this.scale.x(data[1].x) - this.scale.x(data[0].x)) * 0.8
                : 2;
            const barWidth = Math.min(calculatedWidth, 2);
            data.forEach(point => {
                const x = this.scale.x(point.x) - barWidth / 2;
                let y, height;
                if (point.y < 0) {
                    y = this.scale.y(0);
                    height = this.scale.y(point.y) - this.scale.y(0);
                } else {
                    y = this.scale.y(point.y);
                    height = this.scale.y(0) - this.scale.y(point.y);
                }
                this.svg.append('rect')
                    .classed('spectrum-' + spectrum.id, true)
                    .attr('x', x)
                    .attr('y', y)
                    .attr('width', barWidth)
                    .attr('height', height)
                    .attr('fill', spectrum.color || 'steelblue')
                    .attr('stroke', 'none');
            });
        } else if (this.sv.chart_type === "1D-IR" || this.sv.chart_type === "1D-UV") {
            this.svg.append('path')
                .attr('id', spectrum.id)
                .attr('d', this.spectra_function(spectrum.simple_xy_data.asArray()))
                .attr('stroke', spectrum.color)
                .attr('stroke-width', 0.5)
                .attr('fill', 'none');
        }

        // Redraw brush
        this.set_zoom_area(boundary);

        this._spectra.push(spectrum.id);
        console.log('this._spectra', this._spectra)
    }

    update() {
        const self = this;
        const sv = this.sv;
        
        // Always maintain top-right positioning
        this.svg.style('left', sv.width - this.width - 1);

        this.sv.all_spectra().forEach(function(spectrum) {
            self.remove_spectra(spectrum.id);
            if (spectrum.active) {
                self.add_spectrum(spectrum);
            }
        });
    }

    set_zoom_area(scale) {
        let zb = this;
        // Calculate coordinates - convert domain values to zoombox pixel coordinates
        let x1 = zb.scale.x(scale.x.domain()[0]);
        let x2 = zb.scale.x(scale.x.domain()[1]);
        let y1 = zb.scale.y(scale.y.domain()[0]);
        let y2 = zb.scale.y(scale.y.domain()[1]);

        // Ensure brush coordinates are in correct order (top-left to bottom-right)
        // For brush, we need [[x_min_pixel, y_min_pixel], [x_max_pixel, y_max_pixel]]
        const x_min = Math.min(x1, x2);
        const x_max = Math.max(x1, x2);
        const y_min = Math.min(y1, y2);
        const y_max = Math.max(y1, y2);

        // Redraw brush with properly ordered coordinates
        zb.adjusting = true;
        zb.select_brush.call(zb.brush.move, [[x_min, y_min], [x_max, y_max]]);
        zb.adjusting = false;
    }

    remove_spectra(id) {
        // Remove paths (for line charts like NMR, IR, UV)
        this.svg.select('path#' + id).remove();
        // Remove rects (for bar charts like EIMS) - use class selector
        this.svg.selectAll('rect.spectrum-' + id).remove();
        this._spectra = this._spectra.filter(function(s) {
            return s !== id;
        });
    }


}