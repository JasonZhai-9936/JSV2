import "./styles/jsv.css";
import * as d3 from "d3";
import Data from "./Data.js";
import DataParser from "./DataParser.js";
import * as JSV from "./Utils.js";
import { SVSet } from "./SVSet.js";
import { SVScale } from "./SVScales.js";
import { SVLegend } from "./SVLegend.js";
import { SVEvents } from "./SVEvents.js";
import { SVSelection } from "./SVSelection.js";
import { SVAnnotation } from "./SVAnnotation.js";
import { SVZoomBox } from "./SVZoomBox.js";
import { SVHighlighter } from "./SVHighlighter.js";
import { SVMenu } from "./SVMenu.js";
import { SVHelp } from "./SVHelp.js";
import { Spectrum, Spectrum2D, SpectrumEIMS } from "./Spectrum.js";
import SVSettings from "./SVSettings.js";
import SVStructure from "./SVStructure.js";
import { SVAssignments, SVClusterNavigator } from "./SVAssignments.js";
import { SVAssignments2D } from "./SVAssignments2D.js";
import rgba from "color-rgba";
/**
 * Main API class for creating 1D chart types like NMR, LCMS, GCMS, UV, etc.
 * Propagates options to helper classes like Data, Axis, Grid, etc.
 */
export class SpectraViewer1D {

    constructor(containerId, options={}) {
        console.log("SV OPTIONS:", options)
        this.container = d3.select(containerId);
        this.options = options
        // General viewer options 
        this.title = JSV.default_for(options.chartTitle.text, "");
        this.width = JSV.default_for(options.width, 800);
        this.height = JSV.default_for(options.height, 400);
        this.chart_type = JSV.default_for(options.chartType, "1D-NMR");
        // Axis and grid options
        this.tick_count = JSV.default_for(options.axis.x.ticks, 10);
        this.x_tick_count = JSV.default_for(options.axis.x.ticks, 10);
        this.tick_length = JSV.default_for(options.axis.x.tickLength, 10);
        this.tick_precision = JSV.default_for(options.axis.x.tickPrecision, 3);
        // Allow tickFormat to be either a D3 format string or a custom function
        const xTickFormat = JSV.default_for(options.axis.x.tickFormat, "~g");
        this.axis_x_tick_format = typeof xTickFormat === 'function' ? xTickFormat : d3.format(xTickFormat);
        const yTickFormat = JSV.default_for(options.axis.y.tickFormat, "~g");
        this.axis_y_tick_format = typeof yTickFormat === 'function' ? yTickFormat : d3.format(yTickFormat);
        this.axis_x_title = JSV.default_for(options.axis.x.label.text, "ppm");
        this.axis_y_title = JSV.default_for(options.axis.y.label.text, "Intensity");
        this.axis_x_show = JSV.default_for(options.axis.x.enabled, true);
        this.axis_y_show = JSV.default_for(options.axis.y.enabled, true);
        this.axis_x_grid = JSV.default_for(options.grid.horizontal.enabled, true);
        this.axis_y_grid = JSV.default_for(options.grid.vertical.enabled, true);
        this.axis_x_reverse = JSV.default_for(options.axis.x.reverse, false);
        this.axis_y_reverse = JSV.default_for(options.axis.y.reverse, false);
        this.axis_y_lock = JSV.default_for(options.axis.y.lock, false);
        this.min_boundaries = JSV.default_for(options.axis.minBoundaries, {x: [-1, 10], y: [0, 1.1]});
        // Space required for axes
        this.axis_x_gutter = this.axis_x_show ? JSV.default_for(options.axis.x.gutterSpace, 60) : 0;
        //Increased from 50 to 65 to prevent y-axis numbers from being cut off on the right after x axis flip
        this.axis_y_gutter = this.axis_y_show ? JSV.default_for(options.axis.y.gutterSpace, 65) : 0;
        
        // Zoom and legend options
        this.zoom_max = JSV.default_for(options.controls.options.zoom.max, 100);
        this.zoombox_show = JSV.default_for(options.zoomBox?.enabled, true);
        this.zoombox_size = JSV.default_for(options.zoomBox?.size, 15);
        this.legend_show = JSV.default_for(options.legend?.enabled, true);
        const _datasetTolerance = options.dataset?.[0]?.simplifyTolerance;
        this.simplify_tolerance = JSV.default_for(options.simplifyTolerance, JSV.default_for(_datasetTolerance, null));

        // Debugging and ID options
        this.debug = JSV.default_for(options.debug, false);
        this.debug_data = { time: {}, data: {}, drag: {}, zoom: {}, zbox: {} };
        const current_IDs = () => {
            JSV.viewers().map((viewer) => {return viewer.id});
        }
        this.id = JSV.default_for(options.id, JSV.unique_id('jsv-', 1, ["#graph-1"]));
        this.class = JSV.default_for(options.class, '');

        this.add_header()
        this.add_sv_wrapper()
        this.add_current_key_press_store()
        this.add_canvas()

        // Get pixel ratio and upscale canvas depending on screen resolution
        // http://www.html5rocks.com/en/tutorials/canvas/hidpi/
        JSV.set_pixel_ratio(JSV.get_pixel_ratio(this.canvas));
        JSV.scale_resolution(this.canvas, JSV.pixel_ratio);

        // This would need to be adjusted in width setter
        this.font = this.adjust_font();
        this.axis_title_font = this.adjust_font(1, undefined, 'bold');
        this.axis_y_tick_font = this.adjust_font(1, undefined, undefined, options.axis.y.tickFontOffset);

        this.context = this.canvas.getContext('2d');

        // Add a placeholder function for browsers that don't have setLineDash()
        if (!this.context.setLineDash) {
            this.context.setLineDash = function () {}
        }

        // Set up scales for plot area
        this.y_axis_elevation = 10;
        this.scaled_height = JSV.pixel(this.height - this.axis_x_gutter);
        this.scaled_width  = JSV.pixel(this.width - this.axis_y_gutter);
        // Scale to hold the current x/y scales
        // NOTE: to reverse the axis, reverse the ranges
        this.scale = new SVScale(this);
        // Reverse Y range if requested (will be reset for mirror plots later)
        const y_range = this.axis_y_reverse ? [0, this.scaled_height] : [this.scaled_height, 0];
        this.scale.y.range(y_range);
        this.scale.x.range(this.x_range());
        // boundary to hold domain extents
        this.boundary = new SVScale(this);
        this.boundary.x.range(this.x_range());
        this.boundary.y.range(y_range);
        this.boundary.clamp(true);
        // Set minimum boundaries
        if (options.axis.minBoundaries) {
            // Don't add padding for reversed Y-axis (IR) - keep exact boundaries
            if (!this.axis_y_reverse) {
                options.axis.minBoundaries.y[1] += options.axis.minBoundaries.y[1] * 0.075;  // Add 5% to the y max to all
            }
            for (let i=0; i<options.dataset.length; i++) {
                if (options.dataset[i].isMirrorPlot) {
                    options.axis.minBoundaries.y[0] -= options.axis.minBoundaries.y[0] * 0.05;  // Subtract 5% from the y min to all
                    break;
                }
            }
            this.boundary.update(options.axis.minBoundaries);
            this.scale.update(options.axis.minBoundaries);
        }

        // Initialize containers
        this._spectra = new SVSet();
        // console.log("_spectra set initialized", this._spectra)
        this.add_svg_overlay();
        this.initialize_zooming();
        this.initialize_dragging();

        this.legend = new SVLegend(this);
        d3.select(window)
            .on('keydown', this.keydown)
            .on('keyup', this.keyup);

        this.svg.on('mousemove', (event) => {
            const pos = d3.pointer(event);
            this.mx = this.scale.x.invert(JSV.pixel(pos[0]));
            this.my = this.scale.y.invert(JSV.pixel(pos[1]));
            this.highlight.hover();
            this.annotation.check_hover();
        });

        this.svg.on('mouseover', () => {
            this.contains_mouse = true;
            document.activeElement.blur();  // Remove focus from other elements (e.g. NMRLib editor), so that pressing keys like 'a' or 's' do not continue typing in other elements.
        })

        this.svg.on('mouseout', () => {
            this.contains_mouse = false;
        })

        this.handlers = new SVEvents();
        this.on = this.handlers.on;
        this.off = this.handlers.off;
        this.trigger = this.handlers.trigger;

        if (this.drag_drop_load) {
            this.initialize_drag_drop_load();
        }
        this.selection = new SVSelection(this, JSV.default_for(options.select, {}));
        this.annotation = new SVAnnotation(this);

        this.zoombox = new SVZoomBox(this);
        this.zoombox.visible = this.zoombox_show;
        this.highlight = new SVHighlighter(this, JSV.default_for(options.highlight, {}));
        
        this.menu = new SVMenu(this);
        this.help = new SVHelp(this);
        
        this.initial_settings();
        
        
        // Initialize Structure Viewer
        if (options.assignmentTable?.structure) {
            this.structure = new SVStructure(this, options.assignmentTable);
            console.log("Structure Viewer initialized", this.structure);
        }
        
        // Initialize Assignment Table
        if (options.assignmentTable) {
            this.cluster_navigation_id = options.assignmentTable.clusterNavigationID;
            this.assignment_table = new SVAssignments(this, options.assignmentTable);
        }

        this.has_mirror_plot = false;
        JSV._viewers.push(this);
        console.log("ADDING SPECTRA DATA")
        this.add_spectra_data();
        if (this.options.assignmentTable) {
            this.add_assignment_data();
        }
        // this.add_assignment_data();
        this.draw();
        if (this.options.assignmentTable) {
            this.structure?.atom_picked()  // moved from SVStructure.runJSmolApplet because assignment_table needs to be defined first
        }
    }

    move_to_peaks(peaks, duration, scale = 1) {
        const domains = this.get_peak_domains(peaks);

        // Apply vertical scaling
        domains[1][1] = domains[1][1] * scale;

        // Apply horizontal scaling
        const domain_diff = Math.abs(domains[0][1] - domains[0][0]);
        domains[0][0] = domains[0][0] - (domain_diff - domain_diff / scale);
        domains[0][1] = domains[0][1] + (domain_diff - domain_diff / scale);

        this.move_to(domains, duration);
    }
    /**
     * Returns a 2D array of the x and y domains [[Xmin, Xmax], [Ymin, Ymax]]
     * @param {Array} peaks - Array of peak objects
     * @param {Boolean} exact - Whether to use exact peak boundaries or include margins
     * @returns {Array} [[xMin, xMax], [yMin, yMax]]
     */
    get_peak_domains(peaks, exact = false) {
        if (!peaks || peaks.length === 0) return [[0, 1], [0, 1]];
        const margin_percentage = 0.1;

        let min_peak = peaks[0];
        let max_peak = peaks[0];

        for (let i = 1; i < peaks.length; i++) {
            const peak = peaks[i];
            if (peak.center < min_peak.center) min_peak = peak;
            if (peak.center > max_peak.center) max_peak = peak;
        }

        // Ensure a minimum cluster width of 0.1 PPM. Prevents erros where view frame moves but doesn't zoom
        const cluster_width = Math.max(0.1, Math.abs(max_peak.center - min_peak.center) + (min_peak.width || 0.005));

        let min = min_peak.center - (cluster_width / 2);
        let max = max_peak.center + (cluster_width / 2);

        // Calculate sum of peaks to determine top
        const xy_for_peaks = JSV.xy_from_peaks(peaks, 100, min, max);
        let top = d3.max(xy_for_peaks.y) || d3.max(peaks.map(p => p.amplitude)) || 1;

        if (!exact) {
            const margin = (max - min) * margin_percentage;
            min -= margin;
            max += margin;
            top += top * margin_percentage;
        }

        return [[min, max], [0, top]];
    }

    add_assignment_data() {
        console.log("Linking Assignment Data to Structure...");
        let sv = this;
        
        let assignmentSpectrumSet = sv.spectra(this.options.assignmentTable.data.name);
        let spectrum = null;

        if (assignmentSpectrumSet) {
            if (assignmentSpectrumSet.constructor.name === "SVSet" || Array.isArray(assignmentSpectrumSet)) {
                spectrum = assignmentSpectrumSet[0];
            } else {
                spectrum = assignmentSpectrumSet;
            }
        }

        if (!spectrum) {
            console.error("Error: Could not find the assignment spectrum.");
            return;
        }
        
        if (this.structure) {
            let totalLinked = 0;

            spectrum.clusters().forEach((cluster, index) => {
                // 1. Get Refs from META (where DataParser put them)
                let refs = cluster.meta ? cluster.meta.atom_refs : null;
                
                // 2. If not in meta, check direct property (legacy)
                if (!refs) refs = cluster.atom_refs;

                // 3. FORCE update the cluster so other components see it
                if (refs) {
                    cluster.atom_refs = refs;
                    cluster.meta.atom_refs = refs; // Sync both just in case
                }

                if (refs && refs.length > 0) {
                    // console.log(`Cluster ${index}: Looking for atoms`, refs);
                    
                    const linkedAtoms = new SVSet();
                    
                    // Use the robust atoms() method we fixed in SVStructure
                    // We pass the whole array at once now that SVStructure supports it
                    const found = sv.structure.atoms(refs);
                    
                    if (found && found.length > 0) {
                        linkedAtoms.merge(found);
                    }

                    if (linkedAtoms.length > 0) {
                        cluster._atoms.merge(linkedAtoms);
                        totalLinked += linkedAtoms.length;
                        console.log(`Cluster ${index+1} SUCCESS: Linked to atoms`, refs);
                    } else {
                        console.warn(`Cluster ${index+1} FAILED: Could not find atoms for refs`, refs);
                    }
                }
            });
            
            console.log(`Linkage Complete. Total atoms linked to table: ${totalLinked}`);

            if (spectrum.labels && typeof spectrum.labels.update_peaks === 'function') {
                 spectrum.labels.update_peaks();
            }
        }

        sv.trigger('adjust-end'); 
    }

    add_spectra_data() {
        let data;
        let rgba_color;
        let mirror_plot_datasets = [];  // store mirror plot datasets to add AFTER all other datasets
        let assignment_data;
        if (this.options.dataset) {
            for (let i=0; i<this.options.dataset.length; i++) {
                data = this.options.dataset[i]
                assignment_data = this.options.assignmentTable?.data
                if (data.normalize) {
                    data.dataArray.y = d3.map(data.dataArray.y, (d) => d / d3.max(data.dataArray.y));
                }
                // console.log("adding spectrum", data.dataArray)

                if (data.isMirrorPlot) {
                    mirror_plot_datasets.push(data);
                } else {
                    // if (data.dataArray.y.filter((d) => d < 0).length > 0) {  // If there are negative values, assume it is a mirror plot
                    //     mirror_plot_datasets.push(data);
                    //     continue;
                    // }
                    this.add_spectrum({
                        id: data.name,
                        name: data.name,
                        display: {
                            color: data.style.strokeColor,
                            visible: true   
                        },
                        xy_line: {
                            x: data.dataArray.x,
                            y: data.dataArray.y
                        },
                        compounds: assignment_data
                    })
                }
            }

            // Add mirror plot datasets [MUST BE ADDED AFTER ALL OTHER DATASETS]
            console.log("Adding mirror plot datasets", mirror_plot_datasets)
            for (let i=0; i<mirror_plot_datasets.length; i++) {
                data = mirror_plot_datasets[i];
                this.has_mirror_plot = true;
                this.add_spectrum({
                    id: data.id,
                    name: data.name,
                    display: {
                        color: data.style.strokeColor,
                        visible: true   
                    },
                    xy_line: {
                        x: data.dataArray.x,
                        y: data.dataArray.y.map((d) => -d)
                    } 
                })
            }
        }
    }

    add_spectrum(data, display, meta) {
        // FIXME: Should be done elsewhere and in a better way
        // Determine max number of points from current spectra
        // This is used to draw spectra from peak data
        // let max_points = d3.max(this.spectra().map(function(spectrum) {
        //     console.log("spectrum", spectrum)
        //     return spectrum.xy_data.length();
        // }));
        let max_points = 40000;
        if (!max_points) max_points = 40000;
        this.points_per_ppm = max_points / (this.boundary.x.domain()[1] - this.boundary.x.domain()[0]);

        data.tolerance = JSV.default_for(data.tolerance, this.simplify_tolerance)
        data.number_of_points = JSV.default_for(data.number_of_points, max_points);
        data.min_x = JSV.default_for(data.min_x, this.boundary.x.domain()[0]);
        data.max_x = JSV.default_for(data.max_x, this.boundary.x.domain()[1]);
        const current_ids = this.all_spectra().map((spectrum) => spectrum.name);
        data.id = JSV.default_for(data.id, JSV.unique_id('Spectrum_', 1, current_ids)).replace(/[^a-zA-Z0-9]/g, '_');
        console.log("GENERATING SPECTRUM ID", data.id)
        // If a spectrum ID is provided for x data, use that spectrums x data
        if (data.xy_line && (typeof data.xy_line.x == 'string')) {
            const x_id = data.xy_line.x;
            if ( this.spectra(x_id) ) {
                data.xy_line.x = this.spectra(x_id).xy_data.x;
            } else {
                throw new Error("There is no spectrum with the id provided by '" + data.id + "' xy_line.x:" + x_id);
            }
        }
        
        let spectrum;
        console.log("CHART TYPE", this.chart_type)
        if (this.chart_type == "1D-NMR") {           // Spectrum for 1D NMR
            spectrum = (data.toString() == 'Spectrum') ? data : new Spectrum(data, display, meta, this);
        } else if (this.chart_type == "1D-EIMS") {   // EIMS essentially is used as a bar plot variant
            spectrum = (data.toString() == 'Spectrum') ? data : new SpectrumEIMS(data, display, meta, this);
        } else if (this.chart_type == "1D-LCMS") {   
            spectrum = (data.toString() == 'Spectrum') ? data : new SpectrumEIMS(data, display, meta, this);
        } else if (this.chart_type == "1D-IR") {   // Spectrum for 1D IR
            spectrum = (data.toString() == 'Spectrum') ? data : new Spectrum(data, display, meta, this);
        } else if (this.chart_type == "1D-UV") {   // Spectrum for 1D UV
            spectrum = (data.toString() == 'Spectrum') ? data : new Spectrum(data, display, meta, this);
        } 
        spectrum._sv = this;
        // console.log("compounds", this.compounds(this.compounds().length).clusters())
        console.log("spectrum.xy_data", spectrum.xy_data)
        this._spectra.push(spectrum);
        console.log("pushed to this._spectra", this._spectra)
        
        // Skip boundary update for mirror spectrum (already set with negative Y)
        if (spectrum.id !== 'mirror_spectrum') {
            // For reversed Y-axis (IR single), keep fixed boundaries [0, max]
            if (this.axis_y_reverse && !this.has_mirror_plot) {
                // Only update X boundary, keep Y fixed at minBoundaries
                this.boundary.update({ x: spectrum.xy_data.x, y: this.min_boundaries.y });
                this.scale.update({ x: spectrum.xy_data.x, y: this.min_boundaries.y });
            } else {
                this.boundary.update(spectrum.xy_data);
                this.scale.update(spectrum.xy_data);
            }
            
            // Add right padding for LCMS/EIMS so last peak isn't at edge
            // Also ensure X always starts at 0 (m/z is always positive)
            if (this.chart_type === '1D-LCMS' || this.chart_type === '1D-EIMS') {
                const current_x = this.boundary.x.domain();
                this.boundary.update({ x: [0, current_x[1] + 10], y: this.boundary.y.domain() });
                this.scale.update({ x: [0, current_x[1] + 10], y: this.scale.y.domain() });
            }
        }
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

    all_spectra(term) {
        return this._spectra.get(term);
    }

    add_mirror_spectrum({ x, y, name, color }) {
        const primary_y_max = this.boundary.y.max();
        const y_data_max = Math.max(...y);
        const y_data_min = Math.min(...y);
        const y_range = y_data_max - y_data_min || 1;

        // Normalize Y values for mirror plot
        const y_normalized = y.map(v => ((v - y_data_min) / y_range) * primary_y_max);
        
        const isEIMS = this.chart_type === '1D-EIMS';
        const isIR = this.chart_type === '1D-IR';
        
        // For IR with reversed Y, scale to bottom half and keep positive
        // For others, negate (spectra emanate from center)
        let y_flipped;
        if (isIR && this.axis_y_reverse) {
            // Scale to fill bottom half: map [0, primary_y_max] to [0, -primary_y_max]
            y_flipped = y_normalized.map(v => -v);
        } else {
            y_flipped = y_normalized.map(v => -Math.abs(v));
        }

        const new_y_min = -(primary_y_max * 1.075);
        
        // Set flag BEFORE updating boundaries so add_spectrum knows to skip boundary update
        this.has_mirror_plot = true;
        
        // For mirror plots, always use normal Y range (not reversed)
        // This allows proper top/bottom separation
        const normal_y_range = [this.scaled_height, 0];
        this.scale.y.range(normal_y_range);
        this.boundary.y.range(normal_y_range);
        
        // Use symmetric range for all mirror plots (top and bottom halves)
        const y_max = primary_y_max * 1.075;
        
        // Update min_boundaries so reset_boundaries preserves negative Y
        if (this.min_boundaries) {
            this.min_boundaries.y = [new_y_min, y_max];
        }
        
        this.boundary.update({ x: this.boundary.x.domain(), y: [new_y_min, y_max] });
        this.scale.update({ x: this.scale.x.domain(), y: [new_y_min, y_max] });

        const mirror_tolerance = this.simplify_tolerance !== null
            ? this.simplify_tolerance
            : (Math.abs(new_y_min) * 0.001) || 0.1;

        this.add_spectrum({
            id: 'mirror_spectrum',
            name: name,
            tolerance: mirror_tolerance,
            display: { color: color, visible: true },
            xy_line: { x: x, y: y_flipped },
            isMirrorPlot: isEIMS  // Flag for bar charts to draw downward
        });
        
        // For IR mirror plots, invert the primary spectrum so both point down
        // Do this BEFORE updating zoombox so it gets the inverted data
        if (this.chart_type === '1D-IR' && this.axis_y_reverse) {
            const primary = this.all_spectra().get()[0];
            if (primary && primary.id !== 'mirror_spectrum') {
                // Invert primary spectrum data: flip around y_max
                const y_max = Math.max(...primary.xy_data.y);
                console.log('Inverting primary spectrum, y_max:', y_max);
                console.log('Before inversion:', primary.xy_data.y.slice(0, 5));
                primary.xy_data.y = primary.xy_data.y.map(v => y_max - v);
                primary.simple_xy_data.y = primary.simple_xy_data.y.map(v => y_max - v);
                console.log('After inversion:', primary.xy_data.y.slice(0, 5));
            }
        }
        
        // Update zoombox AFTER inverting data so it renders with correct values
        this.zoombox.update();
        
        // Force complete redraw with inverted data
        if (this.chart_type === '1D-IR' && this.axis_y_reverse && this.has_mirror_plot) {
            this.draw();
        }
        
    }

    remove_mirror_spectrum() {
        this.remove_spectra('mirror_spectrum');
        this.has_mirror_plot = false;
        this.reset_boundaries();
        this.full_draw();
    }


    initialize_drag_drop_load() {

    }

    initialize_zooming() {
        const zoomstart = (event) => {
            if (this.drag_event) return;  // Spectra dragging takes precedence over zooming
            const zoom_y_key_down = event.sourceEvent[this.zoom_y_key];
            this.set_zoom_axis(zoom_y_key_down, event);
            this.set_zoom_cursor(zoom_y_key_down);
            this.trigger('zoom-start');
        }
        const zooming = (event) => {
            if (this.drag_event) return;  // Spectra dragging takes precedence over zooming
            const start_time = new Date().getTime();
            // set up which axis to zoom
            this.set_zoom_axis(event.sourceEvent[this.zoom_y_key], event);
            // scale axes based on current level
            this.scale_axis(this.zoom_axis, event.transform.k, event);
            this.fast_draw();
        
            if (this.debug) {
                console.log('zooming')
            }
        }
        const zoomed = (event) => {
            if (this.drag_event) return;  // Spectra dragging takes precedence over zooming
            this.svg.style('cursor', 'all-scroll');
            this.trigger('zoom-end');
            this.full_draw();
        }

        this.zoom_behavior = d3.zoom()
            .scaleExtent([1, this.zoom_max])
            .on('start', zoomstart)
            .on('zoom', zooming)
            .on('end', zoomed);
        this.svg.call(this.zoom_behavior)
            .on('mousedown.zoom', null)  // Remove click zoom behavior
            .on('dblclick.zoom', null);  // Remove double click zoom behavior

        // d3 keeps one zoom scale for both axes and doesn't see domain changes made by
        // dragging, area zoom or the menu. Before d3 handles each wheel event, start it
        // from the current zoom level of the axis being zoomed.
        this.svg.node().addEventListener('wheel', (event) => {
            const axis = event[this.zoom_y_key] ? 'y' : 'x';
            this.svg.node().__zoom = d3.zoomIdentity.scale(this['zoom_' + axis] || 1);
        }, { capture: true });

        this.zoom_x = 1;
        this.zoom_y = 1;
        this.zoom_axis = 'x';
        this.zoom_y_key = 'altKey';
    }

    /**
     * Zoom the Viewer out completely
     */
    zoom_out_completely() {
        this.move_to([this.boundary.x.domain(), this.boundary.y.domain()], 500);
    }

    set_zoom_cursor(zoom_y_key_down) {
        if (zoom_y_key_down) {
            this.svg.style('cursor', 'ns-resize');
        } else {
            this.svg.style('cursor', 'ew-resize');
        }
    }

    set_zoom_axis(zoom_y_key_down, event) {
        // Change the zoom axis and zoom scale to the current zoom level if the axis is changing
        if (zoom_y_key_down) {
            if (this.zoom_axis != 'y') {
                this.zoom_axis = 'y';
                this.set_zoom_cursor(zoom_y_key_down);
            }
        } else {
            if (this.zoom_axis != 'x') {
                this.zoom_axis = 'x';
                this.set_zoom_cursor(zoom_y_key_down);
            }
        }
    }

    // FIX: Implemented dragging/panning functionality for the main graph
    initialize_dragging() {
        const sv = this;
        
        let drag_start_x = null;
        let drag_start_y = null;
        let initial_x_domain = null;
        let initial_y_domain = null;
        let is_dragging = false;
        // Option/Alt + drag zooms to the dragged area; Option/Alt + click zooms out completely
        let zoom_rect = null;
        let zoom_origin = null;

        const drag_behavior = d3.drag()
            .on('start', function(event) {
                // Only drag if not using other tools (like selection)
                if (event.sourceEvent && event.sourceEvent.shiftKey) {
                    return; // Let shift+drag be used for other things
                }

                if (event.sourceEvent && event.sourceEvent[sv.zoom_y_key]) {
                    zoom_origin = [event.x, event.y];
                    zoom_rect = sv.svg.append('rect')
                        .attr('class', 'jsv-zoom-rect')
                        .attr('style', 'fill: blue; fill-opacity: 0.1; stroke: blue; stroke-opacity: 0.4;')
                        .attr('x', event.x)
                        .attr('y', event.y)
                        .attr('width', 0)
                        .attr('height', 0);
                    return;
                }

                is_dragging = true;
                drag_start_x = event.x;
                drag_start_y = event.y;
                initial_x_domain = sv.scale.x.domain().slice(); // Copy the array
                initial_y_domain = sv.scale.y.domain().slice();
                sv.svg.style('cursor', 'grabbing');
            })
            .on('drag', function(event) {
                if (zoom_rect) {
                    zoom_rect
                        .attr('x', Math.min(zoom_origin[0], event.x))
                        .attr('y', Math.min(zoom_origin[1], event.y))
                        .attr('width', Math.abs(event.x - zoom_origin[0]))
                        .attr('height', Math.abs(event.y - zoom_origin[1]));
                    return;
                }
                if (!is_dragging) return;

                // Calculate the pixel delta
                const dx = event.x - drag_start_x;
                const dy = event.y - drag_start_y;
                
                // Convert pixel delta to domain delta
                const x_range = sv.scale.x.range();
                const y_range = sv.scale.y.range();
                const x_domain_width = Math.abs(initial_x_domain[1] - initial_x_domain[0]);
                const y_domain_height = Math.abs(initial_y_domain[1] - initial_y_domain[0]);
                
                // Calculate domain shift
                const x_range_width = Math.abs(x_range[1] - x_range[0]);
                const y_range_height = Math.abs(y_range[1] - y_range[0]);
                
                // FIX: Account for reversed axis - when axis is reversed, range goes [high, low]
                // so dragging right (positive dx) should decrease domain values
                const x_direction = x_range[1] > x_range[0] ? -1 : 1; // Normal: -1, Reversed: 1
                const y_direction = -1; // Y is always the same
                
                const x_shift = x_direction * (dx / x_range_width) * x_domain_width;
                const y_shift = y_direction * (dy / y_range_height) * y_domain_height;
                
                // Apply shift to domain
                let new_x_domain = [initial_x_domain[0] + x_shift, initial_x_domain[1] + x_shift];
                let new_y_domain = [initial_y_domain[0] + y_shift, initial_y_domain[1] + y_shift];
                
                // Set the new domains
                sv.set_domain('x', new_x_domain);
                sv.set_domain('y', new_y_domain);
                
                // Fast draw during dragging
                sv.fast_draw();
            })
            .on('end', function(event) {
                if (zoom_rect) {
                    zoom_rect.remove();
                    zoom_rect = null;
                    const moved_x = Math.abs(event.x - zoom_origin[0]) > 3;
                    const moved_y = Math.abs(event.y - zoom_origin[1]) > 3;
                    if (moved_x || moved_y) {
                        // An axis the drag barely moved along keeps its current range
                        const sorter = (a, b) => a - b;
                        const x_domain = moved_x ?
                            [zoom_origin[0], event.x].map((px) => sv.scale.x.invert(JSV.pixel(px))).sort(sorter) :
                            sv.scale.x.domain().slice();
                        const y_domain = moved_y ?
                            [zoom_origin[1], event.y].map((px) => sv.scale.y.invert(JSV.pixel(px))).sort(sorter) :
                            sv.scale.y.domain().slice();
                        sv.move_to([x_domain, y_domain], 500);
                    } else {
                        sv.zoom_out_completely();
                    }
                    return;
                }
                if (!is_dragging) return;

                is_dragging = false;
                sv.svg.style('cursor', 'default');
                
                // Full draw at the end for quality
                sv.full_draw();
            });
        
        // Apply drag behavior to the SVG overlay
        sv.svg.call(drag_behavior);
    }
    // Get mouse position in the 'container' taking into account the pixel ratio
    mouse(event, container) {
        return d3.pointer(event, container).map(function(p) { return JSV.pixel(p); });
    }
    
    // Zoom the spectra for the supplied axis based on the current zoom level.
    // - axis: either 'x' or 'y'
    // - zoom: zoom level for the axis
    scale_axis(axis, zoom_level, event) {
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

    // Sets the domain (mininum and maximum value) for the supplied axis
    // after adjusting the domain to make sure it is within the boundaries of
    // the plot. Also adjusts the domain based on max_zoom.
    // - axis: either 'x' or 'y'
    // - domain: array with 2 elements, the min and max value for the domain
    set_domain(axis, domain) {
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

    add_svg_overlay() {
        this.svg = this.sv_wrapper.append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('class', 'svg-viewer')
            .style('position', 'absolute')
            .style('top', 0)
            .style('left', 0)
            .style('cursor', 'all-scroll');

        //TODO: change drag drop options to: none, replace, add
        // This option must be set after the svg is set up
        this.drag_drop_load = JSV.default_for(this.options.dragDropLoad, true);
    }

    // ------------------------------
    // cluster_navigation_id
    // ------------------------------
    get cluster_navigation_id() {
        return this._cluster_navigation_id;
    }
    
    set cluster_navigation_id(val) {
        console.log("Setting cluster_navigation_id", val);
        this._cluster_navigation_id = val;

        if (this._cluster_navigation_id) {
            this._cluster_navigation = new SVClusterNavigator(this, val);
        } else {
            if (this._cluster_navigation) {
            this._cluster_navigation.detach();
            this._cluster_navigation = undefined;
            }
        }
    }
    
    // ------------------------------
    // structure_viewer_id
    // ------------------------------
    get structure_viewer_id() {
        return this._structure_viewer_id;
    }

    set structure_viewer_id(val) {
        this._structure_viewer_id = val;

        if (this._structure_viewer_id) {
            this._structure_viewer = new SVStructure(this, val);
        } else {
            if (this._structure_viewer) {
            this._structure_viewer.detach();
            this._structure_viewer = undefined;
            }
        }
    }

    x_range(width) {
        width = width || this.width;
        const scaled_width = JSV.pixel(width - this.axis_y_gutter);
        const gutter = JSV.pixel(this.axis_y_gutter);

        // Always start the plotting area AFTER the gutter (on the left)
        // and end at the full width.
        return this.axis_x_reverse ?
            [JSV.pixel(width), gutter] : 
            [gutter, JSV.pixel(width)];
    }

    adjust_font(font_factor, font_family, font_style, size_offset) {
        font_factor = font_factor || 1;
        font_family = font_family || 'Sans-Serif';
        font_style = font_style || '';
        // ratio of default font size over default canvas width
        let ratio = 9 / 1400 * font_factor;
        let fontsize = ratio * JSV.pixel(this.width) + JSV.pixel(5 + (size_offset || 0));
        return font_style + ' ' + fontsize + 'pt ' + font_family; 
    }

    add_canvas() {
        // Create the viewer canvas
        // NOTE: anything drawn to the canvas must take the pixel ratio into account
        // and should use the pixel() method.
        this.canvas = this.sv_wrapper.append('canvas')
            .attr("id", this.container.attr('id'))
            .attr("class", 'spectra-viewer ' + this.class)
            .style('border', '1px solid #DDD')
            .attr("width", this.width)
            .attr("height", this.height).node();

        // Check for canvas support
        if (!this.canvas.getContext) {
            this.container.html('<h3>Spectra Viewer requires Canvas, which is not supported by this browser.</h3>');
            throw('[Canvas element not supported]');
        }
    }

    add_header() {
        const header = this.title ? '<h3>' + this.title + '</h3>' : '';
        this.container.html(header)
            .style('width', this.width + 2 + 'px');
    }

    add_sv_wrapper() {
        this.sv_wrapper = this.container.append('div')
            .attr('class', 'sv-wrapper')
            .style('position', 'relative');
    }

    add_current_key_press_store() {
        this.container.append('div')
            .attr('class', 'sv-key-down')
            .style('display', 'none');
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Compounds or a single Compound from all the Spectra in the viewer.
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Compound}
     */
    compounds(term) {
        const compounds = new SVSet();
        let i = 0;
        const len = this._spectra.length;
        for (; i < len; i++) {
            console.log("Merging Compounds", this._spectra[i], this._spectra[i].compounds());
            compounds.merge(this._spectra[i].compounds());
        }
        console.log("Compounds", compounds, this._spectra.length)
        return compounds.get(term);
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Clusters or a single Cluster from all the Spectra in the viewer.
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Cluster}
     */
    clusters(term) {
        const clusters = new SVSet();
        let i = 0;
        const len = this._spectra.length;
        console.log("len", len)
        for (; i < len; i++) {
            console.log("Merging Clusters", this._spectra[i], typeof this._spectra[i]);
            console.log("Prototype", Object.getPrototypeOf(this._spectra[i]));
            clusters.merge(this._spectra[i].clusters());
        }
        console.log("Clusters", clusters, this._spectra.length)
        return clusters.get(term);
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Peaks or a single Peak from all the Spectra in the viewer.
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Peak}
     */
    peaks(term) {
        const peaks = new SVSet();
        let i = 0;
        const len = this._spectra.length;
        for (; i < len; i++) {
        peaks.merge(this._spectra[i].peaks());
        }
        return peaks.get(term);
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Spectra or a single Spectrum from the viewer.
     * If no term is given, only **active** spectra are returned.
     * Otherwise all spectra will be search with the _term_.
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Spectrum}
    */
    spectra(term) {
        if (term) return this._spectra.get(term);
        if (this._spectra.length <= 0) return new SVSet();
        const active_spectra = new SVSet(this._spectra.filter(function (s) {
            return s.active;
        }));
        return active_spectra.get(term);
    }

    /**
     * Draw using simplified data if available. When zoomed in enough
     * the full data will be used.
     */
    fast_draw() {
        // Turn off fast draw when zoomed in 10x or more
        // TODO: determine at what level fast draw should be turned off based on the spectra length
        //       - this would be best if done at the spectrum level
        this.zoom_x < 10 ? this.draw(true) : this.draw();
        // this.draw(true);
    }

    /**
     * Draw using the full data (not simplified).
     * If zoomed in enough so that the number of points in the spectra
     * is less than the number of pixels in the viewer then then lines
     * will be calculated if possible.
     */
    full_draw() {
        const ppm_range = this.scale.x.domain()[1] - this.scale.x.domain()[0];
        const point_range = this.points_per_ppm * ppm_range;
        const pixel_range = Math.abs(this.scale.x.range()[1] - this.scale.x.range()[0]);
        ( (pixel_range / point_range) > 3 ) ? this.draw(false, true, 1) : this.draw(false, false);
    }


    draw(fast, calculated, pixel_skip) {
        const start_time = new Date().getTime();
        fast = fast || false;
        const context = this.context;
        const scale = this.scale;
        console.log("> draw", scale)
        
        // For mirror plots, ensure boundary includes negative Y
        if (this.has_mirror_plot && this.min_boundaries && this.min_boundaries.y[0] < 0) {
            const currentY = this.boundary.y.domain();
            if (currentY[0] >= 0) {
                // Boundary was reset, restore it
                this.boundary.update({ x: this.boundary.x.domain(), y: this.min_boundaries.y });
                this.scale.update({ x: this.scale.x.domain(), y: this.min_boundaries.y });
            }
        }
        
        this.clear();

        // Draw grid lines
        if (this.axis_y_grid) this.draw_grid_lines('y');
        if (this.axis_x_grid) this.draw_grid_lines('x');

        // Draw y=0 baseline for bar-chart spectrum types
        if (['1D-EIMS', '1D-LCMS'].includes(this.chart_type) && this.has_mirror_plot) {
            const y0 = scale.y(0);
            const x0 = scale.x.range()[0];
            const x1 = scale.x.range()[1];
            if (y0 >= 0 && y0 <= this.scaled_height) {
                context.beginPath();
                context.moveTo(x0, y0);
                context.lineTo(x1, y0);
                context.strokeStyle = '#000000';
                context.lineWidth = JSV.pixel(1);
                context.setLineDash([]);
                context.stroke();
            }
        }

        console.log(this.spectra())
        this.spectra().forEach(function(spectrum) {
            console.log("spectrum", spectrum)    
            // Draw compounds
            spectrum.compounds().draw(context, scale, fast, calculated, pixel_skip);
            // Draw clusters
            spectrum.clusters().draw(context, scale, fast, calculated, pixel_skip);
            // Draw peaks
            spectrum.peaks().draw(context, scale, fast, true, pixel_skip);
            // Draw spectra
            spectrum.draw(context, scale, fast, calculated, pixel_skip, this);
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

    clear() {
        this.context.clearRect(0, 0, JSV.pixel(this.width), JSV.pixel(this.height));  
    }

    draw_grid_lines(axis) {
        console.log('draw_grid_lines', this)
        const sv = this;
        const context = this.context;
        const orig_context = context;
        const scale = this.scale;
        this.scale[axis].ticks(this.tick_count).forEach(function(tick) {
            context.beginPath();
            if (axis == 'y') {
                console.log("y grid draw", this)
                context.moveTo(scale.x.range()[0], scale.y(tick) - sv.y_axis_elevation);
                context.lineTo(scale.x.range()[1], scale.y(tick) - sv.y_axis_elevation);
            } else if (axis == 'x') {
                context.moveTo(scale.x(tick), scale.y.range()[0]);
                context.lineTo(scale.x(tick), scale.y.range()[1]);
            }
            context.strokeStyle = 'rgba(210,210,210)';
            context.lineWidth = JSV.pixel(0.5);
            context.stroke();
        })
        this.context = orig_context;
    }

    draw_axes() {
        const scale = this.scale;
        this.context.strokeStyle = 'black';
        this.context.lineWidth = 1;
        
        const y_gutter = JSV.pixel(this.axis_y_gutter);
        const x_gutter = JSV.pixel(this.axis_x_gutter);

        // Clear X-axis area (bottom)
        this.context.clearRect(0, scale.y.range_max(), JSV.pixel(this.width), x_gutter);
        
        // Clear Y-axis area (ALWAYS on the left now)
        this.context.clearRect(0, 0, y_gutter, JSV.pixel(this.height));

        this.context.fillStyle = 'black';
        if (this.axis_y_show) this.draw_y_axis();
        // Zero-line separator removed - looks cleaner without it
        if (this.axis_x_show) this.draw_x_axis();
    }

    draw_x_axis() {
        // Create a variable so we can access the chart in the tick drawing function
        const self = this;
        const tick_length = JSV.pixel(this.tick_length);
        const context = this.context;
        const scale = this.scale;
    
        // Draw axis line
        context.beginPath();
        context.moveTo(scale.x.range()[1], scale.y.range_max());
        context.lineTo(scale.x.range()[0], scale.y.range_max());
        context.stroke();
        // Set up text
        context.textAlign = 'center';
        context.textBaseline = 'top';
        context.font = this.font;
        // Draw ticks and text
        scale.x.ticks(this.x_tick_count).forEach(function(tick_x) {
            context.beginPath();
            context.moveTo(scale.x(tick_x), scale.y.range_max());
            context.lineTo(scale.x(tick_x), scale.y.range_max() + tick_length);
            context.stroke();
            const rounded_tick_x = parseFloat(tick_x.toFixed(self.tick_precision));
            context.fillText(rounded_tick_x, scale.x(tick_x), scale.y.range_max() + tick_length);
        });
        // Draw x label
        if (this.axis_x_title) {
            context.font = this.axis_title_font;
            const label_x = scale.x.range_diff() / 2;
            const label_y = scale.y.range_max() + (3 * tick_length);
            context.fillText(this.axis_x_title, label_x, label_y)
        }
      }
    
    draw_y_axis() {
        const sv = this;
        const context = this.context;
        const scale = this.scale;
        const padding = 5;
        
        // Position the axis line at the end of the gutter
        const axis_x_pos = JSV.pixel(this.axis_y_gutter);
        const tick_length = JSV.pixel(this.tick_length);
        const text_x = axis_x_pos - (tick_length + padding);
        
        const y_axis_elevation = this.has_mirror_plot ? 10 : this.y_axis_elevation;

        // Draw axis line on the left
        context.beginPath();
        context.moveTo(axis_x_pos, scale.y.range()[1] - y_axis_elevation);
        context.lineTo(axis_x_pos, scale.y.range()[0] - y_axis_elevation);
        context.stroke();

        // Set up text for left-side alignment
        context.textAlign = 'right';
        context.textBaseline = 'middle';
        context.font = this.axis_y_tick_font;
        let max_label_width = 0;

        // Draw ticks and text
        scale.y.ticks(this.tick_count).forEach(function(tick_y) {
            context.beginPath();
            context.moveTo(axis_x_pos, scale.y(tick_y) - y_axis_elevation);
            context.lineTo(axis_x_pos - tick_length, scale.y(tick_y) - y_axis_elevation);
            context.stroke();
            
            // For mirror plots, format Y-axis labels
            let label_value;
            if (sv.has_mirror_plot) {
                if (sv.chart_type === '1D-IR' && sv.axis_y_reverse) {
                    // For IR: top half shows 1.0→0, bottom shows 0→1.0
                    // Domain is symmetric: e.g., [-1.075, 1.075]
                    // We want labels to decrease in top half, increase in bottom
                    if (tick_y > 0) {
                        // Top half: invert so 1.075→0, 0.8→0.275, 0→1.075
                        const y_max = sv.boundary.y.domain()[1];
                        label_value = y_max - tick_y;
                    } else {
                        // Bottom half: use absolute value
                        label_value = Math.abs(tick_y);
                    }
                } else {
                    // Non-IR mirror plots: just use absolute value
                    label_value = Math.abs(tick_y);
                }
            } else {
                label_value = tick_y;
            }
            const label = sv.axis_y_tick_format(label_value);
            context.fillText(label, text_x, scale.y(tick_y) - y_axis_elevation);
            
            if (sv.axis_y_title) {
                const label_width = Number(context.measureText(label).width);
                if (label_width > max_label_width) max_label_width = label_width;
            }
        });

        // Draw y label
        if (this.axis_y_title) {
            // Minimal margin from left edge
            const margin = JSV.pixel(1);
            const font_height = /(\d+\.?\d*)pt/.exec(this.axis_title_font)[1];
            context.save();
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.font = this.axis_title_font;
            
            // Position label to the left of tick labels, accounting for their width
            // This prevents overlap with the axis numbers
            const extra_spacing = JSV.pixel(10); // Additional spacing for clarity
            const label_x = margin + (Number(font_height) / 2);
            const label_y = scale.y.range_max() / 2;
            
            context.translate(label_x, label_y);
            context.rotate(-Math.PI / 2); // Standard upward rotation
            context.translate(-label_x, -label_y);
            context.fillText(this.axis_y_title, label_x, label_y);
            context.restore();
        }
    }

    reset_boundaries() {
        const sv = this;
        sv.selection.clear();
        sv.boundary.initialized = false
        sv.scale.initialized = false
        if (sv.min_boundaries) {
          console.log("Resetting boundaries to min_boundaries", sv.min_boundaries)
          sv.boundary.update(sv.min_boundaries);
          sv.scale.update(sv.min_boundaries);
        } else {
          sv.boundary.update({ x: [0, 1], y: [0, 1] })
          sv.scale.update({ x: [0, 1], y: [0, 1] })
        }    
    }

    // http://bl.ocks.org/mbostock/5731979
    /**
     * Move from the current x,y domain to the supplied x/y domain using a transition.
     *
     * @param {Array} domains 2D array containing the min/max for the new X/Y domains:
     *   [ [Xmin, Xmax], [Ymin, Ymax] ]
     * @param {Number} duration Time of move transition in milliseconds
     */
    move_to(domains, duration) {
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

        d3.select(this.canvas).transition()
            .duration(duration)
            .tween('move', function() {
            const interm_domains = d3.interpolateArray(start_domains, end_domains);
            return function(t) {
                sv.set_domain('x', [interm_domains(t)[0], interm_domains(t)[1]]);
                sv.set_domain('y', [interm_domains(t)[2], interm_domains(t)[3]]);
                sv.fast_draw();
            }
            }).on('end', function() { sv.full_draw(); });
        // Reset zoom axis
        sv.zoom_axis = '';
    }


    initial_settings() {
        console.log("INITIAL SETTINGS")
        const self = this;
        this.settings = new SVSettings(this, {
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
    
    
    
    image(width, height) {
        width = width || this.width;
        height = height || this.height;

        // Save current settings
        const orig_context = this.context;
        const zoombox_visible = this.zoombox.visible;

        // Generate new context and scales
        const temp_canvas = d3.select('body').append('canvas')
            .attr('width', width)
            .attr('height', height)
            .node();

        JSV.scale_resolution(temp_canvas, JSV.pixel_ratio);
        this.context = temp_canvas.getContext('2d');

        const scaled_height = JSV.pixel(height - this.axis_x_gutter);
        this.scale.x.range(this.x_range(width));
        this.scale.y.range([scaled_height, 0]);

        this.zoombox.visible = false;

        // Fill white background (otherwise transparent)
        this.context.fillStyle = 'white';
        this.context.fillRect(0, 0, temp_canvas.width, temp_canvas.height);

        // Generate image
        this.full_draw();
        let image = temp_canvas.toDataURL();

        // Restore original settings
        this.scale.x.range(this.x_range());
        this.scale.y.range([this.scaled_height, 0]);
        this.context = orig_context;
        this.zoombox.visible = zoombox_visible;

        // Delete temp canvas
        d3.select(temp_canvas).remove();

        return image;
    }

    keyval() {
        return d3.select('.sv-key-down').html();
    }

    
    elements(element_type, parent, possible_elements, visible_only) {
        const sv = this;
        let elements = possible_elements;
        if (!possible_elements) {
        parent = JSV.default_for(parent, sv);
        if (typeof parent == 'string') {
            parent = sv.spectra(parent);
        }
        if (!parent) {
            elements = new SVSet();
        } else if (element_type == 'peak') {
            elements = parent.peaks();
        } else if (element_type == 'cluster') {
            elements = parent.clusters();
        } else if (element_type == 'compound') {
            elements = parent.compounds();
        } else if (element_type == 'spectrum') {
            elements = parent.spectra();
        } else {
            elements = new SVSet();
        }
        }
        if (visible_only) {
            elements = new SVSet(elements.filter(function(e) { return e.visible; }));
        }
        return elements;
    }


    find_element_mouse_over(element_type, spectrum, possible_elements, visible_only) {
        const sv = this;
        let found_element;
        let elements = sv.elements(element_type, spectrum, possible_elements, visible_only);
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
}


export class SpectraViewer2D {


    
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
    constructor(container, options) {
        // Internal properties
        this._cluster_navigation_id = null;
        this._cluster_navigation = null;
    
        this._structure_viewer_id = null;
        this._structure_viewer = null;

        let sv = this;
        this.container = d3.select(container);
        // Get options
        options = options || {};
        this.title = options.title;
        this.width = JSV.default_for(options.width, 800);
        this.height = JSV.default_for(options.height, 400);
        this.tick_count = JSV.default_for(options.tick_count, 10);
        this.x_tick_count = JSV.default_for(options.x_tick_count, 10);
        this.tick_length = JSV.default_for(options.tick_length, 10);
        this.tick_precision = JSV.default_for(options.tick_precision, 3);
        this.axis_x_tick_format = d3.format(JSV.default_for(options.axis_x_tick_format, '~g'));
        this.axis_y_tick_format = d3.format(JSV.default_for(options.axis_y_tick_format, '~g'));
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
        JSV.set_pixel_ratio(JSV.get_pixel_ratio(this.canvas));
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
        this.scale = new SVScale();
        this.scale.y.range([0, this.scaled_height]);
        // this.axis_x_reverse = false
        this.scale.x.range(this.x_range());

        // boundary hold the domain extents
        this.boundary = new SVScale();
        this.boundary.x.range(this.x_range());
        this.boundary.y.range([this.scaled_height, 0]);
        this.boundary.clamp(true);

        // Set minimun boundaries
        if (this.min_boundaries) {
            this.boundary.update(this.min_boundaries);
            this.scale.update(this.min_boundaries);
        }

        // Initialize containers
        this._spectra = new SVSet();

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
            const pos = d3.pointer(event, this);
            sv.mx = sv.scale.x.invert(JSV.pixel(pos[0]))
            sv.my = sv.scale.y.invert(JSV.pixel(pos[1]))

            sv.annotation.check_hover();

            d3.select('#crosshair_x')
                .attr("x1", 0)
                .attr("y1", pos[1])
                .attr("x2", sv.width)
                .attr("y2", pos[1]);
            d3.select('#crosshair_y')
                .attr("x1", pos[0])
                .attr("y1", 0)
                .attr("x2", pos[0])
                .attr("y2", sv.height);

            if (sv.debug) d3.select("#crosshairs_label").text("x: " + sv.mx + " y: " + sv.my);
        })

        this.zoom_rect = {
            'r': null,
            'origin': null,
            'translated_origin': null,
        }

        sv.svg.call(d3.drag()
            .on('start', this.drag_zoom().start)
            .on('drag', this.drag_zoom().drag)
            .on('end', this.drag_zoom().end)
        );

        this.initialize_zooming();

        d3.select(window)
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
        this.handlers = new SVEvents();
        this.on = this.handlers.on
        this.off = this.handlers.off
        this.trigger = this.handlers.trigger


        this.selection = new SVSelection(this, JSV.default_for(options.select, {}));

        // Initialize Labels
        // this.labels = new JSV.SVLabels(sv);
        this.annotation = new SVAnnotation(sv);

        // Initialize Menu
        this.menu = new SVMenu(sv);

        // Initialize Help
        this.help = new SVHelp(sv);

        this.cluster_navigation_id = options.cluster_navigation_id;

        // Initialize Structure Viewer and Assignment Table from the DataParser's
        // 2D assignment data (assignmentTable.data = [event.detail.assignmentData])
        const assignment_options = options.assignmentTable;
        const assignment_data = assignment_options && assignment_options.data && assignment_options.data[0];
        if (assignment_data && assignment_options.structure && assignment_data.structure_data) {
            this.structure = new SVStructure(this, assignment_options);
            console.log("Structure Viewer set to", this.structure);
        }
        if (assignment_data) {
            this.assignment_table = new SVAssignments2D(sv, assignment_options);
            console.log("Assignment Table 2D set to", this.assignment_table);
        }


        JSV._viewers.push(this);
        // this.initial_settings();
        this.dataset = options.dataset;
        this.add_spectra_data();
        // Draw viewer
        this.draw();
    };

    add_spectra_data() {
        console.log("add_spectra_data")
        console.log(this)
        this.add_spectrum_2d({json_data: this.dataset.dataArray})
    }

    toString() { 
        return 'SpectraViewer2D' 
    }

    // /////////////////////////////////////////////////////////////////////////////
    // // SpectraViewer2D Properties (setters/getters)
    // /////////////////////////////////////////////////////////////////////////////
    // Object.defineProperties(SpectraViewer2D.prototype, {
    //     'cluster_navigation_id': {
    //         get: function() { return this._cluster_navigation_id; },
    //         set: function(val) {
    //             console.log("Setting cluster_navigation_id", val);
    //             this._cluster_navigation_id = val;
    //             if (this._cluster_navigation_id) {
    //                 this._cluster_navigation = new JSV.SVClusterNavigator(this, val);
    //             } else {
    //                 if (this._cluster_navigation) {
    //                     this._cluster_navigation.detach();
    //                     this._cluster_navigation = undefined;
    //                 }
    //             }
    //         }
    //     },
    //     'structure_viewer_id': {
    //         get: function() { return this._structure_viewer_id; },
    //         set: function(val) {
    //             this._structure_viewer_id = val;
    //             if (this._structure_viewer_id) {
    //                 this._structure_viewer = new JSV.SVStructure(this, val);
    //             } else {
    //                 if (this._structure_viewer) {
    //                     this._structure_viewer.detach();
    //                     this._structure_viewer = undefined;
    //                 }
    //             }
    //         }
    //     }
    // });

    
    // ------------------------------
    // cluster_navigation_id
    // ------------------------------
    get cluster_navigation_id() {
        return this._cluster_navigation_id;
    }
    
    set cluster_navigation_id(val) {
        console.log("Setting cluster_navigation_id", val);
        this._cluster_navigation_id = val;

        if (this._cluster_navigation_id) {
            this._cluster_navigation = new SVClusterNavigator(this, val);
        } else {
            if (this._cluster_navigation) {
            this._cluster_navigation.detach();
            this._cluster_navigation = undefined;
            }
        }
    }
    
    // ------------------------------
    // structure_viewer_id
    // ------------------------------
    get structure_viewer_id() {
        return this._structure_viewer_id;
    }

    set structure_viewer_id(val) {
        this._structure_viewer_id = val;

        if (this._structure_viewer_id) {
            this._structure_viewer = new SVStructure(this, val);
        } else {
            if (this._structure_viewer) {
            this._structure_viewer.detach();
            this._structure_viewer = undefined;
            }
        }
    }
    
    x_range(width) {
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
    resize(width, height, fast) {
        this.shift_plot(true);
        this.width = width || this.width;
        this.height = height || this.height;

        this.container
            .style('width', this.width + 'px');
        d3.select(this.canvas)
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

    keyval() {
        return d3.select('.sv-key-down').html();
    }


    // d3.selection.prototype.moveToFront = function() {
    //     return this.each(function() {
    //         this.parentNode.appendChild(this);
    //     });
    // };

    keydown(event) {
        // This has to be done globally on all viewers
        if (event[this.zoom_brush_key]) {
            d3.selectAll('.sv-wrapper .svg-viewer').style('cursor', 'crosshair');
            // d3.selectAll('.zoom-brush').moveToFront();
        }
        d3.selectAll('.sv-key-down').html(event.keyCode);
        // console.log(d3.event);
    }

    keyup(event) {
        // 16 is shift
        if (event.keyCode == 16) {
            d3.selectAll('.sv-wrapper .svg-viewer').style('cursor', 'all-scroll');
            // d3.selectAll('.select-brush').moveToFront();
        }
        // Test external custom cursor
        // d3.selectAll('.sv-wrapper .svg-viewer').style('cursor', "url('http://www.javascriptkit.com/dhtmltutors/cursor-hand.gif'), 'pointer'");
        d3.selectAll('.sv-key-down').html('');
    }


    pixels_to_units_of_axis(axis, number_of_pixels) {
        const sv = this;
        return sv.scale[axis].invert(JSV.pixel(number_of_pixels)) - sv.scale[axis].invert(0);
    }


    // Change the zoom axis and zoom scale to the current zoom level if the axis is changing
    set_zoom_axis(zoom_y_key_down) {
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

    set_zoom_cursor(zoom_y_key_down) {
        if (zoom_y_key_down) {
            this.svg.style('cursor', 'ns-resize');
        } else {
            this.svg.style('cursor', 'ew-resize');
        }
    }

    // Zoom the spectra for the supplied axis based on the current zoom level.
    // - axis: either 'x' or 'y'
    // - zoom: zoom level for the axis
    scale_axis(axis, zoom_level) {
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

    // // Get mouse position in the 'container' taking into account the pixel ratio
    // mouse(container) {
    //     return d3.mouse(container).map(function(p) { return JSV.pixel(p); });
    // }

    // Get mouse position in the 'container' taking into account the pixel ratio
    mouse(event, container) {
        return d3.pointer(event, container).map(function(p) { return JSV.pixel(p); });
    }

    // Translates the spectra for the supplied axis.
    // - axis: either 'x' or 'y'
    // - translation: number of pixels to move the specta  on the axis
    translate_axis(axis, translation) {
        // Calculate new domain based on translation
        const domain = this.scale[axis].range().map(function (r) {
            return r - JSV.pixel(translation);
        }).map(this.scale[axis].invert);
        this.set_domain(axis, domain);
    }

    // Shifts canvas plot to make room for 1D NMR on sides
    shift_plot(reverse=false) {
        if(reverse){
            this.context.translate(-this.x_range()[0] * 0.08, -this.scaled_height * 0.12)
        } else {
            this.context.translate(this.x_range()[0] * 0.08, this.scaled_height * 0.12)
        }
    }

    absolute_to_translated_context(x, y) {
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
    move_to(domains, duration) {
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

        d3.select(this.canvas).transition()
            .duration(duration)
            .tween('move', function() {
                const interm_domains = d3.interpolateArray(start_domains, end_domains);
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
    set_domain(axis, domain) {
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

    axis_y_lock_value(domain) {
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
    zoom_out_completely() {
        const sv = this;
        
        // Get the full extent of the data from the boundary scales
        const x_domain = sv.boundary.x.domain();
        const y_domain = sv.boundary.y.domain();

        // Use the move_to transition to smoothly animate back to full view
        sv.move_to([x_domain, y_domain], 500);

        // Explicitly update internal zoom trackers to prevent scale mismatches
        sv.zoom_x = 1;
        sv.zoom_y = 1;
        // The 2D scroll wheel sets the contour threshold (not the axis zoom), so the
        // d3 zoom transform is left as is to keep the current contour level.
    }

    add_spectrum_2d(data, display, meta) {
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

        const spectrum2D = (data.toString() == 'Spectrum2D') ? data : new Spectrum2D(data, display, meta);
        spectrum2D._sv = this;

        this._spectra.push(spectrum2D);
        this.boundary.update(spectrum2D.xyz_data);
        this.scale.update(spectrum2D.xyz_data);
        this.draw();
    }

    /**
     * Remove all the spectrum with the specified _id_ from the viewer.
     *
     * @param {Number} id ID of spectrum to remove
     */
    remove_spectra(id) {
        this._spectra = new SVSet( this._spectra.filter(function(spectrum) { return spectrum.id != id; }) );
    }

    /**
     * Remove all the spectra from the viewer
     */
    remove_all_spectra() {
        const sv = this;
        sv.selection.clear();
        this.all_spectra().forEach(function(spectrum) { sv.remove_spectra(spectrum.id) });
        sv.reset_boundaries();
    }

    reset_boundaries() {
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
    spectra(term) {
        if (term) return this._spectra.get(term);
        const active_spectra = new SVSet(this._spectra.filter(function (s) {
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
    all_spectra(term) {
        return this._spectra.get(term);
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Compounds or a single Compound from all the Spectra in the viewer.
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Compound}
     */
    compounds(term) {
        const compounds = new SVSet();
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
    clusters(term) {
        const clusters = new SVSet();
        let i = 0;
        const len = this._spectra.length;
        for (; i < len; i++) {
            console.log("Merging Clusters", this._spectra[i], typeof this._spectra[i]);
            console.log("Prototype", Object.getPrototypeOf(this._spectra[i]));
            clusters.merge(this._spectra[i].clusters());
        }
        return clusters.get(term);
    }

    /**
     * Clear the viewer canvas
     */
    clear(fast = false) {
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
    draw(fast, calculated, pixel_skip) {
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
        if (this.assignment_table) this.assignment_table.draw_markers(context, scale);
        this.draw_axes();

        if (this.debug) {
            this.debug_data.time['draw'] = JSV.elapsed_time(start_time);
        }
    }

    /**
     * Draw using the full data (not simplified).
     * 2D spectra are drawn from contours, so there are no 1D peak line shapes
     * to calculate (SpectraViewer2D has no peaks()).
     */
    full_draw() {
        this.draw(false, false);
    }

    /**
     * Draw by calculating the line shapes, using every visible pixel.
     */
    calc_draw() {
        this.draw(false, true, 1);
    }

    /**
     * Draw by calculating the line shapes, skipping several pixels
     */
    fast_calc_draw() {
        // this.draw(true, true, 2);
        this.draw(false, true, 2);
    }

    /**
     * Draw using simplified data if available. When zoomed in enough
     * the full data will be used.
     */
    fast_draw() {
        // Turn off fast draw when zoomed in 10x or more
        // TODO: determine at what level fast draw should be turned off based on the spectra length
        //       - this would be best if done at the spectrum level
        this.draw(true);
        // this.draw(true);
    }

    /**
     * Flash a message on the center of the viewer.
     */
    flash(msg) {
        this.context.font = this.adjust_font(1.5);
        this.context.textAlign = 'center';
        this.context.textBaseline = 'center';
        const x = JSV.pixel(this.width) / 2;
        const y = JSV.pixel(this.height) / 2;
        this.context.fillText(msg, x, y);
    }

    // Draws any information in 'data' onto the left side of the viewer
    draw_debug(y) {
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
    adjust_font(font_factor, font_family, font_style) {
        font_factor = font_factor || 1;
        font_family = font_family || 'Sans-Serif';
        font_style  = font_style  || '';
        // ratio of default font size over default canvas width
        const ratio = 9 / 1400 * font_factor;
        const fontsize = ratio * JSV.pixel(this.width) + JSV.pixel(5);
        return font_style + ' ' + fontsize + 'pt ' + font_family;
    }

    draw_axes() {
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

    draw_x_axis() {
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

    draw_y_axis() {
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
            // Position in the middle of the available gutter space
            // Gutter is to the left of axis_y_gutter position
            // Center the title in that space
            const margin = this.axis_y_gutter / 2;
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

    draw_grid_lines(axis) {
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

    elements(element_type, parent, possible_elements, visible_only) {
        const sv = this;
        let elements = possible_elements;
        if (!possible_elements) {
            parent = JSV.default_for(parent, sv);
            if (typeof parent == 'string') {
                parent = sv.spectra(parent);
            }
            if (!parent) {
                elements = new SVSet();
            } else if (element_type == 'peak') {
                elements = parent.peaks();
            } else if (element_type == 'cluster') {
                elements = parent.clusters();
            } else if (element_type == 'compound') {
                elements = parent.compounds();
            } else if (element_type == 'spectrum') {
                elements = parent.spectra();
            } else {
                elements = new SVSet();
            }
        }
        if (visible_only) {
            elements = new SVSet(elements.filter(function(e) { return e.visible; }));
        }
        return elements;
    }


    image(width, height) {
        width = width || this.width;
        height = height || this.height;

        // Save current settings
        const orig_context = this.context;

        // Generate new context and scales
        const temp_canvas = d3.select('body').append('canvas')
            .attr('width', width)
            .attr('height', height)
            .node();

        JSV.scale_resolution(temp_canvas, JSV.pixel_ratio);
        const orig_x_range = this.scale.x.range();
        const orig_y_range = this.scale.y.range();
        this.context = temp_canvas.getContext('2d');
        // Same offset as the live canvas, which makes room for the 1D projections
        this.shift_plot();

        // The 2D y axis is drawn top-down (see constructor)
        const scaled_height = JSV.pixel(height - this.axis_x_gutter);
        this.scale.x.range(this.x_range(width));
        this.scale.y.range([0, scaled_height]);

        // Generate image
        let image;
        try {
            this.full_draw();
            image = temp_canvas.toDataURL();
        } finally {
            // Restore original settings
            this.scale.x.range(orig_x_range);
            this.scale.y.range(orig_y_range);
            this.context = orig_context;
            // Delete temp canvas
            d3.select(temp_canvas).remove();
        }

        return image;
    }


    /**
     * Initialize Spectra Viewer Zooming.
     */
    initialize_zooming() {
        const sv = this;
        sv.zoom_behavior = d3.zoom()
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


    drag_zoom() {
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
            } else if (event.sourceEvent && event.sourceEvent.altKey) {
                // Option/Alt + click zooms out completely
                sv.zoom_out_completely();
            }
            sv.zoom_rect.r.remove();
        }

        return {
            start: start,
            drag: drag,
            end: end
        };
    }


    initial_settings() {
        console.log("INITIAL SETTINGS")
        const self = this;
        this.settings = new SVSettings(this, {
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
    
}