
import * as JSV from './Utils.js';
import { SVSet } from './SVSet.js';

export class SVAnnotation {

    constructor(sv, options={}) {
        const self = this;
        this.sv = sv;
        this.highlighted_label;
        this.point_gap = JSV.default_for(options.point_gap, JSV.pixel(12));
        this.label_color = JSV.default_for(options.label_color, '#5555DD');
        this.visible = JSV.default_for(options.visible, true);
        this.hover = JSV.default_for(options.hover, true);
        this.labels = new SVSet();
        this.visible_labels = new SVSet();
        // Test label-click
        // sv.on('label-click', function(label) {
        //   console.log(label.text)
        // })
        sv.svg.on('mousedown.label', function() {
          if (self.highlighted_label && self.hover) {
            sv.trigger('label-click', self.highlighted_label);
          }
        }); 
    }


    get(term) {
        return this.labels.get(term);
    }
    
    update() {
        const sv = this.sv;
        const labels = sv.labels ? sv.labels.get() : new SVSet();
        sv.spectra().forEach(function(spectrum) {
          if (spectrum.visible && spectrum.active && spectrum.labels) {
            labels.push.apply(labels, spectrum.labels.get())
          }
        });
        this.labels = labels;
    
        let visible_labels = this.reduce_labels_by_view();
        visible_labels = this.reduce_labels_by_height(visible_labels);
        visible_labels = this.adjust_labels(visible_labels);
        this.visible_labels = visible_labels;
    }
    
    rect_for_label(label) {
        const sv = this.sv;
        let rect, x, y;
        const point_x = sv.scale.x(label.x);
        const point_y = sv.scale.y(label.y);
        const text_width = sv.context.measureText(label.text).width;
        const text_height = JSV.pixel(label.font_size);
        if (label.vertical) {
          x = point_x - (text_height/2);
          y = point_y - text_width - this.point_gap;
          rect = new Rect(x, y, text_height, text_width);
        } else {
          x = point_x - (text_width/2);
          y = point_y - text_height - this.point_gap;
          rect = new Rect(x, y, text_height, text_width);
        }
        return rect;
    }
    
    // Return labels within view
    reduce_labels_by_view(labels) {
        if (!labels) labels = this.labels;
        const scale = this.sv.scale;
        return labels.filter(function(label) { return (label.x > scale.x.min() && label.x < scale.x.max() && label.y < scale.y.max())})
    }
    
    // Return only highest labels of overlapping sets
    reduce_labels_by_height(labels) {
        if (!labels) labels = this.labels;
        const scale = this.sv.scale;
        const font_min = 6;
        const reduced = new SVSet();
    
        let i = 0;
        const len = labels.length;
        let label;
        for (; i < len; i++) {
            console.log("in reduce_labels_by_height", labels)    
            label = labels[i];
            label.font_size = font_min;
            label.rect = this.rect_for_label(label);
            label.adjust_rect(reduced);
            if (label.stack_level < 3) {
                reduced.push(label);
            }
        }
    
        return reduced;
    }
    
    adjust_labels(labels) {
        const sv = this.sv;
        let peak, label, label_rects, spectra_overlap, adjusted_labels;
        // Number of stacked labels to accept before trying to reduce the font size
        const max_stack = 1;
        // space between label line and peak/label
        const line_spacer = JSV.pixel(2);
        // minimum gap between peak and label
        const peak_gap = JSV.pixel(12);
        const font_max = 13;
        const font_min = 8;
        const font_range = font_max - font_min;
        let font_current = font_max;
        let font_current_min = font_min;
    
        const scale = sv.scale;
        const context = sv.context;
        context.save();
        let bad_stack = true;
        while(bad_stack) {
          bad_stack = false;
          adjusted_labels = new SVSet();
          context.font = JSV.pixel(font_current) + "px Arial";
          // Adjust min font based on zoom level
          font_current_min = font_min + Math.round(font_range * sv.zoom_x / sv.zoom_max);
          let i = 0;
          const len = labels.length;
          for (; i < len; i++) {
            label = labels[i];
            label.font_size = font_current;
            label.rect = this.rect_for_label(label);
            // spectra_overlap = this.label_over_spectra(label, this.sv.peaks());
            label.adjust_rect(adjusted_labels);
            if ( (label.stack_level > max_stack) && font_current > font_current_min) {
              bad_stack = true;
              font_current -= 1;
              break;
            } else {
              adjusted_labels.push(label);
            }
          }
        }
        return labels;
    }
    
    // Check if the bottom line of rect overlaps with sumline created from peaks
    label_over_spectra(label, peaks, tolerance) {
        const sv = this.sv;
        const x_vals = [];
        for (let i=0, len=label.rect.width; i < len; i++) {
          x_vals.push(sv.scale.x.invert(label.rect.x + i));
        }
        const y = sv.scale.y.invert(label.rect.bottom());
        let overlap = false;
        for (let i=0, len=x_vals.length; i < len; i++) {
          if (y < JSV.sum_of_peaks(x_vals[i], peaks)) {
            overlap = true;
            break;
          }
        }
        return overlap;
    }
    
    draw() {
        if (!this.visible) { return }
        const sv = this.sv;
        const context = sv.context;
        const scale = sv.scale;
        let label;
        const line_spacer = JSV.pixel(2);
        context.save();
    
        this.update();
        const visible_labels = this.visible_labels;
        // Draw the label lines, joining the peak to the label
        for (let i=0, len=visible_labels.length; i < len; i++) {
          label = visible_labels[i];
          const line_x = scale.x(label.x);
          const line_y1 = scale.y(label.y) - line_spacer;
          const line_y2 = label.rect.bottom() + line_spacer;
          context.beginPath();
          context.moveTo(line_x, line_y1);
          context.lineTo(line_x, line_y2);
          context.strokeStyle = '#999999';
          context.lineWidth = JSV.pixel(0.5);
          context.stroke();
        }
    
        // Draw the labels
        context.fillStyle = this.label_color;
        for (let i=0, len=visible_labels.length; i < len; i++) {
          label = visible_labels[i];
          if (label === this.highlighted_label) {
            context.font = "bold " + context.font;
          } else {
            context.font = context.font.replace('bold ', '');
          }
          context.textBaseline = 'top';
          if (label.vertical) {
            context.textAlign = 'right';
            context.save();
            context.translate(label.rect.x, label.rect.y);
            context.rotate(-Math.PI/2);
            context.fillText(label.text, 0, 0);
            context.restore();
          } else {
            context.textAlign = 'left';
            context.fillText(label.text, label.rect.x, label.rect.y);
          }
        }
        context.restore();
    }
    
    check_hover() {
        const sv = this.sv;
        let label;
        if (this.hover) {
          const x = sv.scale.x(sv.mx);
          const y = sv.scale.y(sv.my);
          const old_label = this.highlighted_label;
          let current_label;
    
          let i = 0;
          const len = this.visible_labels.length;
          for (; i < len; i++) {
            label = this.visible_labels[i];
            if (label.rect.contains_pt(x, y)) {
              current_label = label;
              break;
            }
          }
          if (old_label != current_label) {
            this.highlighted_label = current_label;
            this.sv.trigger('click-start');
            sv.full_draw();
          }
          if (this.highlighted_label) {
            sv.svg.style('cursor', 'pointer');
          } else {
            sv.svg.style('cursor', 'move');
          }
        }
    }
    
    
}