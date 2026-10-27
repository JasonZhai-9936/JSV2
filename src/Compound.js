import { SVPath } from "./SVPath";
import * as JSV from "./Utils.js";
import { SVSet } from "./SVSet.js";
import { Cluster } from "./Cluster.js";
import * as d3 from 'd3'
import X2JS from "x2js";
import { SVData } from "./SVData.js";
export class Compound extends SVPath {
    constructor(data = {}, display, meta) {
        super(display, meta);
        this._clusters = new SVSet();
        this.id = data.id;
        this.name = data.name;
        this.concentration = data.concentration;
        this.original_concentration = data.concentration;

        console.log("Compound data.clusters", data.clusters, data);
        if (data.clusters) {
            data.clusters.forEach(cluster_data => {
                this.add_cluster(new Cluster(cluster_data));
            });
        }
        this.update();
    }

    toString() {
        return 'Compound';
    }

    add_cluster(cluster) {
        this._clusters.push(cluster);
        cluster._compound = this;
    }

    update() {
        this.x_min = JSV.peak_min(this.peaks());
        this.x_max = JSV.peak_max(this.peaks());
        this.xy_data = new SVData(JSV.xy_from_peaks(this.peaks(), 5000, this.x_min, this.x_max));
        this.simple_xy_data = this.xy_data.simplify(0.0005, true);
        this._clusters.order_by('center');
        console.log("updating compound x_min, x_max, xy_data, simple_xy_data, and clusters", this);
        console.log("compound.peaks()", this.peaks());
        console.log("compound._clusters", this._clusters);
    }

    clusters(term) {
        return this._clusters.get(term);
    }

    peaks(term) {
        const peaks = new SVSet();
        this._clusters.forEach(cluster => {
            peaks.merge(cluster.peaks());
        });
        return peaks.get(term);
    }

    spectrum() {
        return this._spectrum;
    }

    intersect(x, y, margin) {
        const cy = JSV.sum_of_peaks(x, this.peaks());
        return y <= cy && y >= 0;
    }

    display_concentration() {
        return JSV.round(this.concentration, 1) + ' \u03BCM';
    }

    center() {
        let center;
        if (this.peaks().present()) {
            center = d3.mean(this.peaks(), p => p.center);
        }
        return center;
    }

    atom_assignment_nmrml() {
        if (!window.X2JS) {
            console.log("X2JS needs to be installed to create nmrML: https://github.com/abdmob/x2js");
            return;
        }
        const formatter = d3.format('.2f');
        const x2js = new X2JS();
        const json = { atomAssignmentList: { multiplet: [] } };
        this.clusters().forEach(cluster => {
            const peaks = [];
            cluster.peaks().forEach(peak => {
                peaks.push({
                    _center: peak.center,
                    _amplitude: peak.amplitude,
                    _width: peak.width
                });
            });
            const multiplet = {
                _center: formatter(cluster.center()),
                atoms: { _atomRefs: cluster.atom_refs.join(' ') },
                multiplicity: cluster.nmrml_multiplet_json(),
                peakList: { peak: peaks }
            };
            json.atomAssignmentList.multiplet.push(multiplet);
        });
        //   let nmrml = x2js.json2xml_str(json);
        let nmrml = x2js.xml2js(json);
        nmrml = nmrml.replace(/><\/peak>/g, '/>');
        return nmrml;
    }
}
