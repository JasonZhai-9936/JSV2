import * as JSV from './Utils.js';
import { Rect } from './Rect.js';
export class SVLegend {
    constructor(sv) {
        this.sv = sv;
        this.max_label_length = 0;
        this.margin_top = JSV.pixel(5);
        this.margin_side = JSV.pixel(10);
        this.key_label_space = JSV.pixel(5);
        this.key_width = JSV.pixel(10);
        this.line_width = JSV.pixel(3);
        this.text_height = JSV.pixel(18);
        this.items = [];

        let self = this
        sv.svg.on('click.legend', function(event) {
            let pt = sv.mouse(event, sv.canvas);
            for (let i=0, len=self.items.length; i < len; i++) {
                let item = self.items[i];
                if (item.rect.contains_pt(pt[0], pt[1]) && sv.legend_show) {
                    item.path.visible = !item.path.visible;
                    sv.full_draw();
                }
            }
        });
    }
    bottom() {
        const text_y = (this.sv.zoombox.visible ? JSV.pixel(this.sv.zoombox.height) : 0) + this.margin_top;
        return this.sv.legend_show ? this.offset_y : text_y;
    }
    
    update() {
        const sv = this.sv;
        const context = sv.context;
        this.offset_y = (sv.zoombox.visible ? JSV.pixel(sv.zoombox.height) : 0) + this.margin_top;
        const offset_x = this.margin_side;
        context.font = sv.adjust_font(1, 'monospace');
        this.items = [];
        for (let i = 0; i < sv.spectra().length; i++) {
            const spectrum = sv.spectra()[i];
            // if (! spectrum.active) continue;
            const item = new SVLegendItem(this);
            const rect = new Rect();
            rect.y = this.offset_y;
            rect.height = this.text_height;
            rect.width = this.key_width + this.key_label_space + context.measureText(spectrum.name).width;
            // Position below the zoombox on the right side (for all axis directions)
            const zoombox_right = JSV.pixel(sv.width) - JSV.pixel(sv.zoombox.width) - 1;
            rect.x = zoombox_right;
            item.rect = rect;
            item.path = spectrum;
            this.offset_y += this.text_height;
            this.items.push(item);
            console.log(">>", item.path, spectrum, sv.spectra())
            this.max_label_length = Math.max(item.path.name.length, this.max_label_length);
        }
    }
    
    draw() {
        const sv = this.sv;
        const context = sv.context;
        context.save();
        context.textAlign = 'left';
        context.textBaseline = 'middle';
        context.font = sv.adjust_font(1, 'monospace');
        for (let i = 0; i < this.items.length; i++) {
            this.items[i].draw(this.max_label_length);
        }
        context.restore();
    }
}


export class SVLegendItem {

    constructor(legend, path, rect) {
        this.legend = legend;
        this.sv = legend.sv;
        this.path = path; // e.g. spectra
        this.rect = rect; // Rect defining space in legend
    }

    key_x1() {
        return this.sv.axis_x_reverse ?
            this.rect.x :
            this.rect.x + this.rect.width - this.legend.key_width;
      }
    
    key_x2() {
        return this.key_x1() + this.legend.key_width;
    }

    key_y() {
        return this.rect.y + (this.rect.height / 2);
    }

    label_x() {
    return this.sv.axis_x_reverse ?
        this.rect.x + this.legend.key_width + this.legend.key_label_space :
        this.rect.x;
    }


    draw(label_len) {
        let rect = this.rect;
        this.sv.context.clearRect(rect.x, rect.y, rect.width, rect.height);
        if (this.path.visible) this.draw_key();
        this.draw_label(label_len);
    }

    draw_key() {
        let context = this.sv.context;
        context.beginPath();
        context.moveTo(this.key_x1(), this.key_y());
        context.lineTo(this.key_x2(), this.key_y());
        context.lineWidth = this.legend.line_width;
        context.strokeStyle = this.path.color;
        context.setLineDash(this.path.dash);
        context.stroke();
    }

    draw_label(label_len) {
        this.sv.context.fillStyle = this.path.visible ? 'black' : '#999';
        let checkbox = this.path.visible ? "\u2612" : "\u2610"
        let label =  `${this.path.name.padEnd(label_len)} ${checkbox}`
        this.sv.context.fillText(label, this.label_x(), this.key_y())
    }
}