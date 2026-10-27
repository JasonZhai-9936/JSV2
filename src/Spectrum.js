import * as JSV from "./Utils.js"
import { SVPath } from "./SVPath.js"
import { SVData } from "./SVData.js"
import { SVSet } from "./SVSet.js"
import { SVBar } from "./SVBar.js"
import * as d3 from "d3";
import { Compound } from "./Compound.js"
import { Cluster } from "./Cluster.js"
/**
   * Spectra can be made up from basic xy data, a peak list, or a set of one or
   * more [Compounds](Compound.js.html).
   *
   * Spectrum inherits methods and properties from [SVPath](SVPath.js.html).
   *
   * @param {Object} data Data used to create the Spectrum. See examples described in [SpectraViewer.add_spectrum](SpectraViewer.js.html#add_spectrum).
   * @param {Object} display Display options passed to [SVPath](SVPath.js.html)
   * @param {Object} meta User-defined _key_:_value_ pairs to add to the Spectrum.
   * @return {Spectrum}
*/
export class Spectrum extends SVPath {
    constructor(data, display, meta, sv) {
        console.log("CREATING NEW SPECTRUM with super()", data, display, meta, sv);
        super(data, display, meta);
        let self = this;
        data = data || {};
        let display_defaults = {};
        display = JSV.merge(display_defaults, data.display, display);
        meta = JSV.merge(data.meta, meta);        
        this._sv = sv;
        // let path = new SVPath(this, display, meta);
        // path.call(this, display, meta);
        // this.add_to_zoom_box = data.add_to_zoom_box || true;
        this.id = data.id;
        this.name = data.name || this.id;
        this.tolerance = data.tolerance;
        this.noise;
        this.add_to_zoom_box = JSV.default_for(data.add_to_zoom_box, true);
        this.active = JSV.default_for(data.add_to_zoom_box, true);
        this._active = JSV.default_for(data.active, true);
        // console.log("creating new SVData() for xy_data", data.xy_data);
        this.xy_data = new SVData();
        // console.log("creating new SVData() for simple_xy_data", data.xy_data);
        this.simple_xy_data = new SVData();
        this.labels = new JSV.SVLabelSet({spectrum: this});
        this._compounds = new SVSet();
        
        if (data.compounds) {
            console.log("data.compounds", data.compounds);
            data.compounds.forEach(function(compound_data) {
                console.log("initializing new Compound with compound_data", compound_data);
                self.add_compound(new Compound(compound_data));
            })
        } else if (data.peak_list) {
            const compound_data = { clusters: [ { peaks: data.peak_list } ] };
            self.add_compound(new Compound(compound_data));
        }
    
        if (this.compounds().present()) {
            const number_of_points = JSV.default_for(data.number_of_points, 10000);
            const min_x = JSV.default_for(data.min_x, -1);
            const max_x = JSV.default_for(data.max_x, 11);
            if (!data.xy_line) {
                const xy_line = JSV.xy_from_peaks(self.peaks(), number_of_points, min_x, max_x);
                self.add_xy_line(xy_line);
            }
        }
        if (data.xy_line) {
            this.add_xy_line(data.xy_line);
        }
    
        if (data.labels) {
            data.labels.forEach(function(label) {
                self.labels.add(label);
            });
        }
    
    }

    get active() {
        return this._active;
    }

    set active(val) {
        this._active = val;
        const sv = this._sv;
        if (sv) {
          sv.reset_boundaries();
          sv.all_spectra().each(function() {
            if (this.active) {
              sv.boundary.update(this.xy_data);
              sv.scale.update(this.xy_data);
            }
          });
          sv.zoombox.update();
          sv.legend.update();
        }
    }

    add_xy_line(xy_data) {
        this.xy_data = new SVData(xy_data);
        this.noise = this.calculate_noise();
        const tolerance = this.tolerance || this.noise;
        this.simple_xy_data = this.xy_data.simplify(tolerance, true);
    }


    // Noise is calculated as the difference between the maximum
    // and minimum peak betwen the range.
    // TODO: if region does not exist, use first 0.01 in data
    calculate_noise() {
        // Region to calculate noise
        const region = [-0.05, -0.04];
        const xy_min = this.xy_data.index_of(region[0]);
        const xy_max = this.xy_data.index_of(region[1]);
        const y_noise = this.xy_data.y.slice(xy_min, xy_max);
        return (d3.max(y_noise) - d3.min(y_noise)).toPrecision(2);
    }

    /**
       * Returns an [SVSet](SVSet.js.html) of Compounds or a single Compound from the Spectrum.
       * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
       * @return {SVSet|or|Compound}
    */
    compounds(term) {
        console.log("In spectrum, compounds().this._compounds", this._compounds);
        return this._compounds.get(term)
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Clusters or a single Cluster from the Spectrum.
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Cluster}
     */
    clusters(term) {
        const clusters = new SVSet();
        let i = 0;
        const len = this._compounds.length;
        console.log("In spectrum, clusters().this._compounds", this._compounds);
        for (; i < len; i++) {
          clusters.merge(this._compounds[i].clusters());
        }
        return clusters.get(term);  
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Peaks or a single Peak from the Spectrum.
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Peak}
     */
    peaks(term) {
        const peaks = new SVSet();
        this.compounds().forEach(function(compound) {
        compound.clusters().forEach(function(cluster) {
            peaks.merge(cluster.peaks());
        })
        })
        return peaks.get(term);
    }

    /**
     * Add a [Compound](Compound.js.html) to the spectrum
     * @param {Compound} compound [Compound](Compound.js.html) to add
     */
    add_compound(compound) {
        this._compounds.push(compound);
        compound._spectrum = this;
        // TODO: update xy_data??
    }

}


export class SpectrumEIMS extends SVBar {

    constructor(data, display, meta, sv) {
        console.log("CREATING NEW SpectrumEIMS with super()", data, display, meta, sv);
        super(data, display, meta);
        data = data || {};
        let display_defaults = {};
        display = JSV.merge(display_defaults, data.display, display);
        meta = JSV.merge(data.meta, meta);        
        this._sv = sv;
        // let path = new SVPath(this, display, meta);
        // path.call(this, display, meta);

        this.id = data.id;
        this.name = data.name || this.id;
        this.tolerance = data.tolerance;
        this.noise;
        this.active = true;
        this._active = JSV.default_for(data.active, true);
        this.add_to_zoom_box = JSV.default_for(data.add_to_zoom_box, true);
        this.isMirrorPlot = JSV.default_for(data.isMirrorPlot, false);  // Flag for drawing bars downward
        // console.log("creating new SVData() for xy_data", data.xy_data);
        this.xy_data = new SVData();
        // console.log("creating new SVData() for simple_xy_data", data.xy_data);
        this.simple_xy_data = new SVData();
        this.labels = new JSV.SVLabelSet({spectrum: this});
        this._compounds = new SVSet();
        
        if (data.compounds) {
            data.compounds.forEach(function(compound_data) {
                self.add_compound(new Compound(compound_data));
            })
        } else if (data.peak_list) {
            const compound_data = { clusters: [ { peaks: data.peak_list } ] };
            self.add_compound(new Compound(compound_data));
        }
    
        if (this.compounds().present()) {
            const number_of_points = JSV.default_for(data.number_of_points, 10000);
            const min_x = JSV.default_for(data.min_x, -1);
            const max_x = JSV.default_for(data.max_x, 11);
            if (!data.xy_line) {
                const xy_line = JSV.xy_from_peaks(self.peaks(), number_of_points, min_x, max_x);
                self.add_xy_line(xy_line);
            }
        }
        if (data.xy_line) {
            this.add_xy_line(data.xy_line);
        }
    
        if (data.labels) {
            data.labels.forEach(function(label) {
                self.labels.add(label);
            });
        }
    
    }

    get active() {
        return this._active;
    }

    set active(val) {
        this._active = val;
        const sv = this._sv;
        if (sv) {
          sv.reset_boundaries();
          sv.all_spectra().each(function() {
            if (this.active) {
              sv.boundary.update(this.xy_data);
              sv.scale.update(this.xy_data);
            }
          });
          sv.zoombox.update();
          sv.legend.update();
        }
    }

    add_xy_line(xy_data) {
        this.xy_data = new SVData(xy_data);
        this.noise = this.calculate_noise();
        const tolerance = this.tolerance || this.noise;
        // this.simple_xy_data = this.xy_data.simplify(tolerance, true);
        this.simple_xy_data = this.xy_data;  // use the raw data for now for EIMS

    }


    // Noise is calculated as the difference between the maximum
    // and minimum peak betwen the range.
    // TODO: if region does not exist, use first 0.01 in data
    calculate_noise() {
        // Region to calculate noise
        const region = [-0.05, -0.04];
        const xy_min = this.xy_data.index_of(region[0]);
        const xy_max = this.xy_data.index_of(region[1]);
        const y_noise = this.xy_data.y.slice(xy_min, xy_max);
        return (d3.max(y_noise) - d3.min(y_noise)).toPrecision(2);
    }

    /**
       * Returns an [SVSet](SVSet.js.html) of Compounds or a single Compound from the Spectrum.
       * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
       * @return {SVSet|or|Compound}
    */
    compounds(term) {
        return this._compounds.get(term)
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Clusters or a single Cluster from the Spectrum.
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Cluster}
     */
    clusters(term) {
        const clusters = new SVSet();
        let i = 0;
        const len = this._compounds.length;
        for (; i < len; i++) {
          clusters.merge(this._compounds[i].clusters());
        }
        return clusters.get(term);  
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Peaks or a single Peak from the Spectrum.
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Peak}
     */
    peaks(term) {
        const peaks = new SVSet();
        this.compounds().forEach(function(compound) {
        compound.clusters().forEach(function(cluster) {
            peaks.merge(cluster.peaks());
        })
        })
        return peaks.get(term);
    }

    /**
     * Add a [Compound](Compound.js.html) to the spectrum
     * @param {Compound} compound [Compound](Compound.js.html) to add
     */
    add_compound(compound) {
        this._compounds.push(compound);
        compound._spectrum = this;
        // TODO: update xy_data??
    }
        

}



import SVDot from "./SVDot.js";

export class Spectrum2D extends SVDot {

    /**
     * 2D Spectra are made up from basic xyz data
     *
     * Spectrum2D inherits methods and properties from [SVDot](SVDot.js.html).
     *
     * @param {Object} data Data used to create the Spectrum. See examples described in [SpectraViewer.add_spectrum](SpectraViewer.js.html#add_spectrum).
     * @param {Object} display Display options passed to [SVDot](SVDot.js.html)
     * @param {Object} meta User-defined _key_:_value_ pairs to add to the Spectrum.
     * @return {Spectrum2D}
     */
    constructor(data, display, meta) {
        // Internal/private-like fields
        super(display, meta);
        this._active = false;
        this._sv = null;

        const self = this;
        data = data || { };
        let display_defaults = { };
        display = JSV.merge(display_defaults, data.display, display);
        meta = JSV.merge(data.meta, meta);
        // JSV.SVDot.call(this, display, meta);
        this._compounds = new SVSet();

        this.id = data.id;
        this.name = data.name || this.id;
        // this.tolerance = data.tolerance;
        // this.noise;
        this.active = true;
        this.xyz_data = new SVData2D();

        if(data.compounds) {
            data.compounds
        }

        self.add_xyz_plot(data.json_data);

        if (data.labels) {
            data.labels.forEach(function(label) {
                self.labels.add(label);
            });
        }

    }

    toString() { 
        return 'Spectrum2D'; 
    }

    /**
     * Add a [Compound](Compound.js.html) to the spectrum
     * @param {Compound} compound [Compound](Compound.js.html) to add
     */
    add_compound(compound) {
        this._compounds.push(compound);
        compound._spectrum = this;
        // TODO: update xy_data??
    }

    add_xyz_plot(xyz_data) {
        this.xyz_data = new SVData2D(xyz_data);
        // this.noise = this.calculate_noise();
        // var tolerance = this.tolerance || this.noise
        //this.simple_xy_data = this.xy_data.simplify(tolerance, true);
    }

    /**
     * Returns an [SVSet](SVSet.js.html) of Compounds or a single Compound from the Spectrum.
     * @param {Integer|String|Array} term See [SVSet.get](SVSet.js.html#get) for details.
     * @return {SVSet|or|Compound}
     */
    compounds(term) {
        return this._compounds.get(term)
    }


    // /////////////////////////////////////////////////////////////////////////////
    // // Spectrum Properties (setters/getters)
    // /////////////////////////////////////////////////////////////////////////////
    // Object.defineProperties(Spectrum2D.prototype, {
    //     'active': {
    //         get: function() { return this._active },
    //         set: function(val) {
    //             this._active = val;
    //             const sv = this._sv;
    //             if (sv) {
    //                 sv.reset_boundaries();
    //                 sv.all_spectra().each(function() {
    //                     if (this.active) {
    //                         sv.boundary.update(this.xy_data);
    //                         sv.scale.update(this.xy_data);
    //                     }
    //                 });
    //                 sv.zoombox.update();
    //                 sv.legend.update();
    //             }
    //         }
    //     }
    // });

    get active() {
        return this._active;
    }
    
    set active(val) {
        this._active = val;
        const sv = this._sv;
        if (sv) {
            sv.reset_boundaries();
        
            // Note: arrow function preserves `this` context if needed
            // but using a normal function is fine if referencing `this.active` inside the loop
            sv.all_spectra().each(function() {
                if (this.active) {
                sv.boundary.update(this.xy_data);
                sv.scale.update(this.xy_data);
                }
            });
        
            sv.zoombox.update();
            sv.legend.update();
        }
    }



}



class SVData2D {

    constructor(data) {
        if (data === undefined) {
            data = {x: [], y: [], z: []}
        }
        ;
        // If data is an array of objects convert them.
        if (data instanceof Array) {
            data = this.array_to_object(data);
        }
        // Confirm x and y are the same length
        if (data.z.length != (data.x.length * data.y.length)) {
            throw new Error('z length must be divisible by x and y length!')
        }

        this.x = data.x;
        this.y = data.y;
        this.z = data.z;
    };

    length() {
        return this.x.length;
    }

    asArray() {
        let data = [];
        let point;
        for (let i=0, len=this.length(); i < len; i++) {
            point = { x: this.x[i], y: this.y[i], z: this.z[i] }
            data.push(point);
        }
        return data;
    }

    // SVData2D.prototype.index_of = function(search_value, upper) {
    //     return JSV.index_of_value(this.x, search_value, upper);
    // }

    // SVData2D.prototype.simplify = function(tolerance, highQuality) {
    //     // return new SVData( simplify(this.asArray(), tolerance, highQuality) );
    //     return new SVData( JSV.simplify(this, tolerance, highQuality) );
    // }

    array_to_object(data) {
        let x = [ ], y = [ ], z = [ ];
        let i = 0;
        const len = data.length;
        for (; i < len; i++) {
            x.push(data[i].x);
            y.push(data[i].y);
            z.push(data[i].z);
        }
        let object = {x:x, y:y, z:z};
        return object;
    }






}