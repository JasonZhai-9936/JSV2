import * as JSV from './Utils.js';

export class SVData {
    
    constructor(data) {
        if (data === undefined) {
            data = {
                x: [],
                y: []
            }
        }

        // If data is an array of objects, convert them
        if (data instanceof Array) {
            data = array_to_object(data);
        }

        // Confirm x and y are the same length
        if (data.x.length != data.y.length) {
            throw new Error('SVData: x and y data are not the same length');
        }
        if (data.yi && (data.yi.length != data.x.length)) {
            throw new Error('SVData: y and yi data are not the same length');
        }

        // Confirm arrays start at lowest x value first. If not, reverse them.
        const reverse_data = (data.x[0] > data.x[data.x.length - 1]);

        this.x = reverse_data ? data.x.reverse() : data.x;
        this.y = reverse_data ? data.y.reverse() : data.y;
        this.yi = (data.yi && reverse_data) ? data.yi.reverse() : data.yi;

        // console.log("SVData.constructor() this.x", this.x);
        // console.log("SVData.constructor() this.y", this.y);
    }

    length() {
        return this.x.length;
    }

    asArray() {
        const data = [];
        let point;
        let i = 0;
        const len = this.length();
        console.log("SVData.asArray() len", len);
        for (; i < len; i++) {
            point = { x: this.x[i], y: this.y[i] }
            if (this.yi) { point.yi = this.yi[i]; }
            data.push(point);
        }
        // console.log("SVData.asArray() data", data);
        return data;   
    }

    index_of(search_value, upper) {
        return JSV.index_of_value(this.x, search_value, upper);
    }

    simplify(tolerance, highQuality) {
        return new SVData(JSV.simplify(this, tolerance, highQuality))
    }

    array_to_object(data) {
        const x = [], y = [], yi = [];
        let i = 0;
        const len = data.length;
        for (; i < len; i++) {
            x.push(data[i].x);
            y.push(data[i].y);
            if (data[0].yi) { yi.push(data[i].yi); }
        }
        const object = {x: x, y: y};
        if (data[0] && data[0].yi) { object.yi = yi; }
        return object;
    }



}