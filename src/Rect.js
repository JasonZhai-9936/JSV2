

export class Rect {

    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    bottom() {
        return this.y + this.height;
    }
    
    top() {
        return this.y;
    }
    
    left() {
        return this.x;
    }
    
    right() {
        return this.x + this.width;
    }
    
    // Check if rect overlaps with any rects in rect_array
    overlap(rect_array) {
        // Gap between labels
        const width_gap = JSV.pixel(4);
        const r1 = this;
        let overlap = false;
        let i = 0;
        const len = rect_array.length;
        for (; i < len; i++){
            const r2 = rect_array[i];
            if (r1.x <= r2.right() && r2.x <= (r1.right() + width_gap) && r1.y <= r2.bottom() && r2.y <= r1.bottom()) {
            overlap = true;
            break;
            }else{
            overlap = false;
            }
        }
        return overlap;
    }

    contains_pt(x, y) {
        return ( x >= this.x && x <= (this.x + this.width) && y >= this.y && y <= (this.y + this.height) )
    }


} 