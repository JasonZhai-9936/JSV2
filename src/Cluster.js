import { SVPath } from "./SVPath";
import * as JSV from "./Utils.js";
import { SVSet } from "./SVSet.js";
import { Peak } from "./Peak.js";
import * as d3 from 'd3'
export class Cluster extends SVPath {
  constructor(data = {}, display, meta) {
      const displayDefaults = { visible: false };
      const mergedDisplay = JSV.merge(displayDefaults, data.display, display);
      const mergedMeta = JSV.merge(data.meta, meta);
      super(mergedDisplay, mergedMeta);

      this._peaks = new SVSet();
      this._atoms = new SVSet();
      this.lower_bound = JSV.number(data.lower_bound);
      this.upper_bound = JSV.number(data.upper_bound);
      this.weight = JSV.number(data.weight);
      this.protons = JSV.number(data.protons);

      if (data.peaks) {
          data.peaks.forEach(peakData => {
              this.add_peak(new Peak(peakData));
          });
      }
  }

  toString() {
      return 'Cluster';
  }

  add_peak(peak) {
      this._peaks.push(peak);
      this.multiplet_type = undefined;
      peak._cluster = this;
  }

  update() {
      this._peaks.order_by('center');
  }

  peaks(term) {
      return this._peaks.get(term);
  }

  compound() {
      return this._compound;
  }

  spectrum() {
      return this.compound().spectrum();
  }

  center() {
      let center;
      if (this.peaks().present()) {
          center = d3.mean(this.peaks(), p => p.center);
      }
      return center;
  }

  atoms(term) {
      return this._atoms.get(term);
  }

  determine_multiplet_type() {
      const peaks = this.peaks();
      let type = 'm';
      if (peaks.length === 1) {
          type = 's';
      } else if (peaks.length === 2) {
          type = 'd';
      } else if (peaks.length === 3) {
          type = 't';
      } else if (peaks.length === 4) {
          type = doubleOfDoublets(peaks) ? 'dd' : 'q';
      } else if (peaks.length === 5) {
          type = 'quint';
      } else if (peaks.length === 6) {
          type = tripletOfDoublets(peaks) ? 'td' : 'dt';
      }
      return type;
  }

  nmrml_multiplet_json() {
      let json;
      switch (this.multiplet_type) {
          case 's':
              json = { _cvRef: 'NMRCV', _accession: 'NMR:1000194', _name: 'singlet feature' };
              break;
          case 'd':
              json = { _cvRef: 'NMRCV', _accession: 'NMR:1000184', _name: 'doublet feature' };
              break;
          case 't':
              json = { _cvRef: 'NMRCV', _accession: 'NMR:1000185', _name: 'triplet feature' };
              break;
          case 'q':
              json = { _cvRef: 'NMRCV', _accession: 'NMR:1000186', _name: 'quatruplet feature' };
              break;
          case 'dd':
              json = { _cvRef: 'NMRCV', _accession: 'NMR:1000192', _name: 'doublet of doublets feature' };
              break;
          case 'quint':
              json = { _cvRef: 'NMRCV', _accession: 'NMR:1000195', _name: 'quintet feature' };
              break;
          case 'dt':
              json = { _cvRef: 'NMRCV', _accession: 'NMR:1000196', _name: 'doublet of triplets feature' };
              break;
          case 'td':
              json = { _cvRef: 'NMRCV', _accession: 'NMR:1000197', _name: 'triplet of doublets feature' };
              break;
          default:
              json = { _cvRef: 'NMRCV', _accession: 'NMR:1400305', _name: 'multiplet feature' };
      }
      return json;
  }

  get multiplet_type() {
      if (!this._multiplet_type) {
          this._multiplet_type = this.determine_multiplet_type();
      }
      return this._multiplet_type;
  }

  set multiplet_type(type) {
      this._multiplet_type = type;
  }

  get atom_refs() {
      if (this.atoms().length > 0) {
          return this.atoms().map(a => a.id);
      } else {
          return this._atom_refs || [];
      }
  }

  set atom_refs(refs) {
      this._atom_refs = refs;
  }

  get dir_dim_atom_refs() {
      return this._dir_dim_atom_refs;
  }

  set dir_dim_atom_refs(refs) {
      this._dir_dim_atom_refs = refs;
  }

  get indir_dim_atom_refs() {
      return this._indir_dim_atom_refs;
  }

  set indir_dim_atom_refs(refs) {
      this._indir_dim_atom_refs = refs;
  }
}

const doubleOfDoublets = peaks => {
  const within = 0.1;
  const heights = peaks.map(p => p.amplitude);
  const maxHeight = d3.max(heights);
  const rangeMin = maxHeight * (1 - within);
  const rangeMax = maxHeight * (1 + within);
  return heights.every(h => h >= rangeMin && h <= rangeMax);
};

const tripletOfDoublets = peaks => {
  const heights = peaks.map(p => p.amplitude);
  const middleHeight = d3.min(heights.slice(2, 3));
  const checkHeights = heights.slice(0, 1).concat(heights.slice(4, 5));
  return checkHeights.every(h => h <= middleHeight);
};
