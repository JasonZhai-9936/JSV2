import * as JSV from './Utils.js'
import { SVPath } from './SVPath.js';
import { SVSet } from './SVSet.js';
export class SVSelection extends SVPath {
/**
   * The SVSelection object controls selections of peaks, etc on Viewer.
   * Selections do not work with spectra created from xy data. The spectra must
   * be created with compound data or as peak lists.
   * The following options can be set when creating a [SpectraViewer](SpectraViewer.js.html):
   *
   *  Option                | Default     | Description
   *  ----------------------|-------------------------------------------------
   *  element_type          | _undefined_ | What type of elements are to be selected ('peak', 'cluster', 'compound', _undefined_)
   *  allow_multiselect     | true        | Allow the selection of multiple elements using the Shift Key
   *  allow_adjust          | true        | Allow the selected elements to be moved
   *  allow_width_adjust    | true        | Allow the width of the selected elements to be changed
   *  allow_peak_creation   | false       | Allow new peaks to be created by holding 'A' or 'âŒ˜' while clicking on the viewer
   *  show_bounds           | true        | Show the upper and lower bounds markers for the selection on the x-axis, if available
   *  show_indicators       | false       | Show mark on x-axis below each element selected
   *  display_info          | true        | Display selection details in the top corner of the Viewer
   *  constrain_adjust      | _undefined_ | When adjusting the selection, should parent elements of selection also be adjusted. For example if constrain_ajdust is 'compound', then when a peak is adjusted, all the peaks from the parent compound will also be adjusted in amplitude. Options are 'cluster', 'compound' or _undefined_.
   *  restriction_spectrum_id | _undefined  | Resrict selection to only work with the spectrum with this ID.
   *  possible_elements     | _undefined_ | Restrict selection to only these elements [Array or [SVSet](SVSet.js.html)]
   *  display               | {fill: 'rgba(150, 150, 150, 0.2)'} | Display options as described in [SVPath](SVPath.js.html)
   *
   *
   * @param {Object} sv The [SpectraViewer](SpectraViewer.js.html) object
   * @param {Object} options Options for how the selection/adjustments should work. Described below.
   * @return {SVSelection}
*/

    constructor(sv, options) {
        super(options);
        // SVPath.call(this);
        const self = this;
        this.sv = sv;
        this.element_type = options.element_type;
        this.allow_multiselect = JSV.default_for(options.allow_multiselect, true);
        this.allow_adjust = JSV.default_for(options.allow_adjust, true);
        this.allow_width_adjust = JSV.default_for(options.allow_width_adjust, true);
        this.allow_peak_creation = JSV.default_for(options.allow_peak_creation, false);
        this.show_bounds = JSV.default_for(options.show_bounds, true);
        this.show_indicators = JSV.default_for(options.show_indicators, false);
        this.display_info = JSV.default_for(options.display_info, true);
        this.constrain_adjust = options.constrain_adjust
        this.restriction_spectrum_id = options.restriction_spectrum_id;
        this.possible_elements = options.possible_elements;
        let display_defaults = { fill: 'rgba(150, 150, 150, 0.2)', visible: true };
        this.display_settings(JSV.merge(display_defaults, options.display));
        this.handle_spacer = JSV.pixel(10);
        this.handle_size = JSV.pixel(15);
        this._elements = new SVSet();
        this.initialize_selection_events();
        // this.popup_box = this.sv.sv_wrapper.append('div').attr('class', 'jsv-select-popup-box').style('display', 'none');
        this.popup_box = this.sv.sv_wrapper.append('div').attr('class', 'jsv-select-popup-box').style('visibility', 'hidden');
        this.text_container = this.popup_box.append('div').attr('class', 'jsv-select-text-container');
        this.draw = function() {
          if (self.present()) {
            // Call SVPath draw method
            SVSelection.prototype.draw.apply(this, arguments);
            // First argument is the context; Second argument is the scale
            self.draw_adjust_handles(arguments[0], arguments[1]);
          }
          // Draw box with selection information
          (self.present() && self.display_info) ? self.show_popup_box() : self.hide_popup_box();
        }     
    }


    peaks(term) {
        const peaks = new SVSet();
        let i = 0;
        const len = this._elements.length;
        for (; i < len; i++) {
          peaks.merge(this._elements[i].peaks());
        }
        return peaks.get(term);
    }
    
    elements(term) {
        return this._elements.get(term);
    }
    
    clear() {
        this.sv.trigger('selection-clear');
        this._elements = new SVSet();
        this.sv.trigger('selection-empty');
        return this
    }
    
    add_element(element) {
        this._elements.push(element);
        // Remove any previous highlighting
        this.sv.highlight.remove();
        this.sv.trigger('selection-add');
        return this
    }
    
    remove_element(element) {
        this._elements = new SVSet( this._elements.filter(function(e) { return e != element }) );
        this.sv.trigger('selection-remove');
        if (this.empty()) this.sv.trigger('selection-empty');
        return this
    }
    
    size() {
        return this._elements.length;
    }
    
    present() {
        return this._elements.length > 0;
    }
    
    empty() {
        return this._elements.length == 0;
    }
    
    contains(element) {
        return this._elements.contains(element);
    }
    
    delete() {
        this.peaks().each(function() { this.delete(); });
        this.update();
        this.clear();
        this.sv.trigger('adjust-end');
        this.sv.full_draw();
    }
    
    hide_popup_box() {
        // this.popup_box.style('display', 'none');
        this.popup_box.style('visibility', 'hidden');
    }
    
    show_popup_box() {
        const element = this.highlighted_element;
        // Increase popup width before adding text, so text_container is not compressed
        this.popup_box.style('width', '100%');
        const position = this.sv.axis_x_reverse ? 'right' : 'left';
        this.popup_box.style(position, this.sv.axis_y_gutter + JSV.pixel(2) + 'px');
        this.text_container.html(this.info_text());
        // this.popup_box.style('display', 'block').style('width', parseInt(this.text_container.style('width')) + 20);
        const box_width = this.text_container.node().offsetWidth + 20;
        this.popup_box.style('visibility', 'visible').style('width', box_width + 'px');
    }
    
    info_text() {
        let compound_text = '', cluster_text = '', peak_text = '';
        const compounds = this.compounds();
        const clusters = this.clusters();
        const peaks = this.peaks();
        if (compounds.length == 1) {
          const compound = compounds[0];
          compound_text = compound.name;
          if (compound.concentration !== undefined) {
            compound_text + ' [' + compound.display_concentration() + ']';
          }
        } else {
          compound_text = compounds.length + ' compounds';
        }
        if (clusters.length == 1) {
          const cluster = clusters[0];
          cluster_text = 'cluster: ' + cluster.center().toFixed(3) + ' ppm';
        } else {
          cluster_text = clusters.length + ' clusters';
        }
        if (peaks.length == 1) {
          const peak = peaks[0];
          peak_text = 'peak: ' + peak.center.toFixed(3) + ' ppm';
        } else {
          peak_text = peaks.length + ' peaks';
        }
        let text = '<p>' + compound_text + '</p><p>' + cluster_text + '</p><p>' + peak_text + '</p>';
        return text;
    }
    
    compounds(term) {
        const compounds = new SVSet();
        this.peaks().forEach(function(peak) {
          compounds.push(peak.compound());
        });
        return compounds.unique().get(term);
    }
    
    clusters(term) {
        const clusters = new SVSet();
        this.peaks().forEach(function(peak) {
          clusters.push(peak.cluster());
        });
        return clusters.unique().get(term);
    }
    
    adjust_concentration() {
        return this.element_type == 'compound' || this.constrain_adjust == 'compound';
    }
    
    draw_adjust_handles(context, scale) {
        const self = this;
        const sv = this.sv;
        let spacer_direction;
        if (self.allow_adjust && self.allow_width_adjust && self.present()) {
          const spacer = this.handle_spacer;
          const handle_size = this.handle_size;
          const domains = sv.get_peak_domains(self.peaks(), true);
          const width_min = scale.x(d3v7.min(domains[0]));
          const width_max = scale.x(d3v7.max(domains[0]));
          if (sv.axis_x_reverse) {
            this.handle_min_x = width_min + spacer;
            this.handle_max_x = width_max - spacer - handle_size;
            spacer_direction = -1;
          } else {
            this.handle_min_x = width_min - spacer - handle_size;
            this.handle_max_x = width_max + spacer;
            spacer_direction = 1;
          }
          const half_height = (scale.y(d3v7.max(domains[1]) / 2));
          this.handle_y = half_height - (handle_size / 2);
    
          context.translate(0.5, 0.5);
          // Handles
          context.beginPath();
          context.strokeStyle = 'rgba(50, 50, 50, 0.9)';
          context.rect(this.handle_min_x, this.handle_y, handle_size, handle_size);
          context.rect(this.handle_max_x, this.handle_y, handle_size, handle_size);
          context.stroke();
    
          // Line to Handles
          context.beginPath();
          context.strokeStyle = 'rgba(150, 150, 150, 0.5)';
          context.moveTo(width_min, half_height);
          context.lineTo(width_min - (spacer * spacer_direction), half_height);
          context.moveTo(width_max, half_height);
          context.lineTo(width_max + (spacer * spacer_direction), half_height);
    
          // context.moveTo(width_x1 - spacer, half_height);
          // context.lineTo(width_x1, half_height);
          // context.moveTo(width_x2, half_height);
          // context.lineTo(width_x2 + spacer, half_height);
          context.stroke();
    
          context.translate(-0.5, -0.5);
        }
    }
    
    // Draw bounds of single selected element, if the element
    // has lower_bound and upper_bound properties and a center function.
    draw_bounds(context, scale) {
        const self = this;
        const size = JSV.pixel(10);
        const sv = this.sv;
        if ( should_draw_bounds() ) {
          const element = this.elements(1);
          const domains = sv.get_peak_domains(self.peaks(), true);
          const y = scale.y.range()[0];
          const lower_x = scale.x(element.lower_bound);
          const upper_x = scale.x(element.upper_bound);
          const center = scale.x(element.center());
    
          context.save();
          context.translate(0.5, 0.5);
          context.beginPath();
          context.lineWidth = 2;
          // Set color
          if ( (element.center() < element.lower_bound) || (element.center() > element.upper_bound) ) {
            context.strokeStyle = 'red';
            context.fillStyle = 'red';
          } else {
            context.strokeStyle = 'blue';
            context.fillStyle = 'white';
          }
          // upper bound
          context.moveTo(lower_x, y);
          context.lineTo(lower_x + size, y - size);
          context.lineTo(lower_x + size, y + size);
          context.lineTo(lower_x, y);
          // lower bound
          context.moveTo(upper_x, y);
          context.lineTo(upper_x - size, y - size);
          context.lineTo(upper_x - size, y + size);
          context.lineTo(upper_x, y);
          // center line
          context.moveTo(center, y - size);
          context.lineTo(center, y + size);
    
          context.fill();
          context.stroke();
    
          context.translate(-0.5, -0.5);
          context.restore();
        }
    
        function should_draw_bounds() {
          const element = self.elements(1);
          return self.show_bounds &&
              self.size() == 1 &&
              typeof element.center == 'function' &&
              JSV.isNumeric( element.center() ) &&
              JSV.isNumeric( element.lower_bound ) &&
              JSV.isNumeric( element.upper_bound );
        }
    }
    
      // Draw indicators on x-axis for each element selected
    draw_indicators(context, scale) {
        const self = this;
        const size = JSV.pixel(10);
        const sv = this.sv;
        if ( self.show_indicators ) {
          const y = scale.y.range()[0];
          context.save();
          context.translate(0.5, 0.5);
          self.elements().forEach(function(element) {
            let center;
            if (typeof element.center == 'function') {
              center = element.center();
            } else {
              center = element.center;
            }
            if (center !== undefined) {
              center = scale.x(center);
              context.beginPath();
              context.lineWidth = JSV.pixel(2);
              // Set color
              context.strokeStyle = 'green';
              context.fillStyle = 'green';
              context.moveTo(center, y - size);
              context.lineTo(center, y + size);
    
              context.fill();
              context.stroke();
            }
          });
    
          context.translate(-0.5, -0.5);
          context.restore();
        }
    
    }
    
    mouse_in_handle() {
        const self = this;
        const sv = this.sv;
        let handle;
        if (self.allow_adjust && self.allow_width_adjust && self.present()) {
          const x = sv.scale.x(sv.mx);
          const y = sv.scale.y(sv.my);
          if ( (y > this.handle_y) && (y < this.handle_y + this.handle_size) ) {
            if ( (x > this.handle_max_x) && (x < this.handle_max_x + this.handle_size) ) handle = 'left';
            if ( (x > this.handle_min_x) && (x < this.handle_min_x + this.handle_size) ) handle = 'right';
          }
        }
        return handle;
    }
    
    mouse_in_selection() {
        const self = this;
        const sv = this.sv;
        if (self.present()) {
          const x = sv.scale.x(sv.mx);
          const y = sv.scale.y(sv.my);
          const y_for_mouse_x = JSV.sum_of_peaks(sv.mx, self.peaks());
          return (sv.my <= y_for_mouse_x && sv.my >= 0);
        }
    }
    
    update() {
        const paths = new SVSet();
        this.constrained_peaks().forEach(function(peak) {
          paths.push(peak, peak.cluster(), peak.compound(), peak.spectrum());
        });
        paths.unique().forEach(function(p) { p.update(); });
    }
    
    constrained_peaks() {
        const self = this;
        let peaks;
        if (self.constrain_adjust) {
          peaks = new SVSet();
          self.peaks().forEach(function(peak) {
            if (peak[self.constrain_adjust]) {
              peaks.merge(peak[self.constrain_adjust]().peaks());
            }
          });
          peaks = peaks.unique();
        } else {
          peaks = self.peaks();
        }
        return peaks;
    }
    
    /**
     * Initialize Selectiona and  Adjust Fit.
     */
    initialize_selection_events() {
        const sv = this.sv;
        const self = this;
        let x_mouse, y_mouse, dx_mouse, dy_mouse, dx_axis, dy_axis, selected_handle;
        let select_rect, added_elements, select_box_elements, x_start, y_start;
        let max_amplitude, new_amplitude;
        let do_not_clear;
    
        sv.svg.on('mousedown.selection', function(event) {
          // initial_selected_elements = self.elements();
          do_not_clear = false;
          const down_x = event.x;
          const down_y = event.y;
          if (active_selection(event) && self.allow_adjust) {
            adjuststart(event);
            sv.svg.on('mousemove.fit', function() { adjusting(event) });
            sv.svg.on('mouseup.fit', function() {
              adjustend();
              sv.svg.on('mousemove.fit', null);
              sv.svg.on('mouseup.fit', null);
            })
          } else if (select_box_mode(event) && self.allow_multiselect) {
            selectstart();
            sv.svg.on('mousemove.fit', function() { selecting(event) });
            sv.svg.on('mouseup.fit', function() {
              selectend();
              sv.svg.on('mousemove.fit', null);
              sv.svg.on('mouseup.fit', null);
            })
          } else {
            sv.svg.on('mouseup.selection', function(event) {
              if (down_x == event.x && down_y == event.y) {
                if (create_peak_mode(event)) {
                  create_peak();
                } else if (!do_not_clear) {
                  self.clear();
                }
              }
              sv.svg.on('mouseup.selection', null);
            });
          }
        })
    
        function create_peak_mode(event) {
          // 65: 'a'
          // return ( self.allow_peak_creation && ( sv.create_peak_mode || (sv.keyval() == '65') || (d3v7.event.altKey && d3v7.event.metaKey) ) );
          return ( self.allow_peak_creation && ( sv.create_peak_mode || (sv.keyval() == '65') || (event.metaKey) ) );
        }
    
        function multi_select_mode(event) {
          // 83: 's'
          // return ( self.allow_multiselect && ((sv.keyval() == '83') || (d3v7.event.altKey)) );
          return ( self.allow_multiselect && ((sv.keyval() == '83') || (event.shiftKey)) );
        }
    
        function select_box_mode(event) {
          return ( multi_select_mode(event) && !self.mouse_in_handle() && !find_element_mouse_over() );
        }
    
        function find_element_mouse_over() {
          return sv.find_element_mouse_over(self.element_type, self.restriction_spectrum_id, self.possible_elements, self.visible_only);
        }
    
        function active_selection(event) {
          if (self.mouse_in_handle()) return true;
          if (create_peak_mode(event)) return false;
          let active;
    
          const element = find_element_mouse_over();
          const mouse_in_selection = self.mouse_in_selection();
    
          if (element || mouse_in_selection) {
            // Multiselect Mode: remove or add elements
            if (multi_select_mode(event)) {
              if (self.contains(element)) {
                self.remove_element(element);
                active = false;
                do_not_clear = true;
              } else if (!mouse_in_selection) {
                self.add_element(element);
                active = true;
              }
              // Selecting new element
            } else if (!mouse_in_selection) {
              self.clear();
              self.add_element(element);
              // sv.trigger('element_selected');
              active = true;
              do_not_clear = true;
              // Mouse is under sum line of selection
            } else {
              active = true;
            }
            // sv.full_draw();
            sv.fast_calc_draw();
          } else {
            // No element selected
            // self.clear();
            active = false
          }
          return active;
        }
    
        // function adjuststart() {
        //   x_mouse = d3v7.event.x;
        //   y_mouse = d3v7.event.y;
        //   selected_handle = self.mouse_in_handle();
        //   sv.svg.style('cursor', 'grabbing');
        // }
    
        function adjuststart(event) {
          x_mouse = event.x;
          y_mouse = event.y;
          selected_handle = self.mouse_in_handle();
          sv.svg.style('cursor', 'grabbing');
        }


        // function adjusting() {
        //   d3v7.event.stopPropagation(); // silence other listeners
        //   do_not_clear = true;
        //   dx_mouse = d3v7.event.x - x_mouse;
        //   dy_mouse = d3v7.event.y - y_mouse;
        //   x_mouse = d3v7.event.x
        //   y_mouse = d3v7.event.y
        //   dx_axis = sv.pixels_to_units_of_axis('x', dx_mouse);;
        //   dy_axis = sv.pixels_to_units_of_axis('y', dy_mouse);;
        //   if (selected_handle) {
        //     // Set width
        //     const direction = selected_handle == 'right' ? 1 : -1;
        //     self.peaks().forEach(function(peak) {
        //       // TODO: Scale the width change to the maximum width
        //       peak.width = peak.width - (direction * dx_axis * 2);
        //       if (peak.width < 0.00001) peak.width = 0.00001;
        //     });
        //   } else {
        //     // Save original amplitudes for concentration adjustments
        //     if (self.adjust_concentration()) {
        //       self.compounds().forEach(function(c) {
        //         c.orig_amplitude = d3v7.max(c.peaks(), function(p) { return p.amplitude; });
        //       });
        //     }
        //     // Set amplitude
        //     // Scale the amplitude change to the maximum peak
        //     const peaks = self.constrained_peaks();
        //     max_amplitude = d3v7.max(peaks, function(p) { return p.amplitude; });
        //     if (max_amplitude <= 0) max_amplitude = 0.00001;
        //     peaks.forEach(function(peak) {
        //       new_amplitude = peak.amplitude + ( dy_axis / max_amplitude * peak.amplitude );
        //       peak.set_amplitude(new_amplitude);
        //     });
        //     // Set center
        //     self.peaks().forEach(function(peak) {
        //       peak.set_center(peak.center + dx_axis);
        //     });
        //     // Adjust concentrations
        //     if (self.adjust_concentration()) {
        //       self.compounds().forEach(function(c) {
        //         const highest_amplitude = d3v7.max(c.peaks(), function (p) {
        //           return p.amplitude;
        //         });
        //         c.concentration = c.concentration * highest_amplitude / c.orig_amplitude;
        //       });
        //     }
        //   }
        //   // TODO: scroll viewer when dragging selection outside of view
        //   sv.trigger('adjust');
        //   sv.fast_calc_draw();
        // }
    


        function adjusting(event) {
          event.stopPropagation(); // silence other listeners
          do_not_clear = true;

          dx_mouse = event.x - x_mouse;
          dy_mouse = event.y - y_mouse;
          x_mouse = event.x;
          y_mouse = event.y;

          dx_axis = sv.pixels_to_units_of_axis('x', dx_mouse);
          dy_axis = sv.pixels_to_units_of_axis('y', dy_mouse);

          if (selected_handle) {
            // Set width
            const direction = selected_handle === 'right' ? 1 : -1;
            self.peaks().forEach(function(peak) {
              peak.width = peak.width - (direction * dx_axis * 2);
              if (peak.width < 0.00001) peak.width = 0.00001;
            });
          } else {
            // Save original amplitudes for concentration adjustments
            if (self.adjust_concentration()) {
              self.compounds().forEach(function(c) {
                c.orig_amplitude = d3v7.max(c.peaks(), function(p) { return p.amplitude; });
              });
            }

            // Set amplitude
            const peaks = self.constrained_peaks();
            max_amplitude = d3v7.max(peaks, function(p) { return p.amplitude; });
            if (max_amplitude <= 0) max_amplitude = 0.00001;

            peaks.forEach(function(peak) {
              new_amplitude = peak.amplitude + (dy_axis / max_amplitude * peak.amplitude);
              peak.set_amplitude(new_amplitude);
            });

            // Set center
            self.peaks().forEach(function(peak) {
              peak.set_center(peak.center + dx_axis);
            });

            // Adjust concentrations
            if (self.adjust_concentration()) {
              self.compounds().forEach(function(c) {
                const highest_amplitude = d3v7.max(c.peaks(), function(p) {
                  return p.amplitude;
                });
                c.concentration = c.concentration * highest_amplitude / c.orig_amplitude;
              });
            }
          }

          sv.trigger('adjust');
          sv.fast_calc_draw();
        }

    
        function adjustend() {
          self.update();
          sv.svg.style('cursor', 'grab');
          sv.trigger('adjust-end', self.compounds());
          sv.full_draw();
        }
    
        function selectstart() {
          // if (self.empty()) self._elements = initial_selected_elements;
          added_elements = new SVSet();
          const mouse_pos = d3v7.mouse(sv.canvas);
          x_start = mouse_pos[0];
          y_start = mouse_pos[1];
          select_rect = sv.svg.append('rect').
          attr('class', 'select-box').
          attr('x', x_start).attr('y', y_start).attr('width', 0).attr('height', 0);
        }
    
        // function selecting() {
        //   d3v7.event.stopPropagation(); // silence other listeners
        //   do_not_clear = true;
        //   // const mouse_pos = d3v7.mouse(sv.canvas);
        //   const mouse_pos = sv.mouse(sv.canvas);  // d3v7.mouse is deprecated in version 5 or 6, have to use d3.pointer instead (which is sv.mouse)
        //   let x_new, y_new;
        //   x_new = mouse_pos[0];
        //   y_new = mouse_pos[1];
        //   const select_x = d3v7.min([x_start, x_new]);
        //   const select_y = d3v7.min([y_start, y_new]);
        //   const width = Math.abs(x_new - x_start);
        //   const height = Math.abs(y_new - y_start);
        //   select_rect.attr('x', select_x).attr('y', select_y).
        //   attr('width', width).attr('height', height);
        //   const select_box_elements = elements_in_select_box(select_x, select_y, width, height);
        //   // Add new elements to selection
        //   select_box_elements.forEach(function(element) {
        //     if (!self.contains(element)) {
        //       self.add_element(element);
        //       added_elements.push(element);
        //     }
        //   });
        //   // Remove elements that are no longer selected
        //   added_elements = new SVSet(added_elements.filter(function(element) {
        //     if (!select_box_elements.contains(element)) {
        //       self.remove_element(element);
        //       return false;
        //     }
        //     return true;
        //   }));
        //   sv.fast_draw();
        // }
    

        function selecting(event) {
          event.stopPropagation(); // silence other listeners
          do_not_clear = true;

          // Use modern pointer API (wrapped in sv.mouse)
          const mouse_pos = sv.mouse(sv.canvas);
          let x_new = mouse_pos[0];
          let y_new = mouse_pos[1];

          const select_x = d3v7.min([x_start, x_new]);
          const select_y = d3v7.min([y_start, y_new]);
          const width = Math.abs(x_new - x_start);
          const height = Math.abs(y_new - y_start);

          select_rect
            .attr('x', select_x)
            .attr('y', select_y)
            .attr('width', width)
            .attr('height', height);

          const select_box_elements = elements_in_select_box(select_x, select_y, width, height);

          // Add new elements to selection
          select_box_elements.forEach(function(element) {
            if (!self.contains(element)) {
              self.add_element(element);
              added_elements.push(element);
            }
          });

          // Remove elements that are no longer selected
          added_elements = new SVSet(added_elements.filter(function(element) {
            if (!select_box_elements.contains(element)) {
              self.remove_element(element);
              return false;
            }
            return true;
          }));

          sv.fast_draw();
        }

        function selectend() {
          select_rect.remove();
          sv.full_draw();
        }
    
        function elements_in_select_box(x, y, width, height) {
          const selected_elements = new SVSet();
          let x_plot;
          const y_plot = sv.scale.y.invert(JSV.pixel(y + height));
          const elements = sv.elements(self.element_type, self.restriction_spectrum_id, self.possible_elements, self.visible_only);
          let e = 0;
          const len = elements.length;
          for (; e < len; e++) {
            const element = elements[e];
            for (let i = 0; i < width; i++) {
              x_plot = sv.scale.x.invert( JSV.pixel(x + i) );
              if (y_plot < JSV.sum_of_peaks(x_plot, element.peaks())) {
                selected_elements.push(element);
                break;
              }
            }
          }
          return selected_elements;
        }
    
        function create_peak() {
          let cluster, width;
          if (self.present()) {
            // Add peak to cluster of first peak in selection
            // TODO: change to cluster of closest peak to mouse click
            cluster = self.peaks(1).cluster();
            width = d3v7.mean(self.peaks(), function(p) { return p.width});
          } else {
            // Add peak to new cluster of first compound of first spectra (or to restriction_spectrum)
            let spectrum;
            if (self.restriction_spectrum_id) {
              spectrum = sv.spectra(self.restriction_spectrum_id);
            } else {
              spectrum = sv.spectra().filter(function(s) { return s.compounds().present(); })[0];
            }
            cluster = new Cluster();
            spectrum.compounds(1).add_cluster(cluster);
            if (spectrum.peaks().present()) {
              width = d3v7.mean(spectrum.peaks(), function(p) { return p.width; });
            } else {
              width = 0.003;
            }
          }
          const peak = new Peak({width: width, center: 0});
          cluster.add_peak(peak);
          const mouse_xy = sv.mouse(sv.canvas);
          peak.set_center(sv.scale.x.invert(mouse_xy[0]));
          peak.set_amplitude(sv.scale.y.invert(mouse_xy[1]));
          sv.trigger('adjust-peak-created', peak);
          if (self.element_type == 'peak') {
            self.add_element(peak);
          } else if (self.empty() && self.element_type == 'cluster') {
            self.add_element(cluster);
          } else if (self.empty() && self.element_type == 'compound') {
            self.add_element(cluster.compound());
          }
          adjustend();
        }
    }
}