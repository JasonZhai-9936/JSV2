import { SVPath } from "./SVPath";
import * as JSV from "./Utils.js";
import { SVSet } from "./SVSet.js";
export class Peak extends SVPath {
  constructor(data = {}, display, meta) {
      const displayDefaults = { visible: false };
      const mergedDisplay = JSV.merge(displayDefaults, data.display, display);
      const mergedMeta = JSV.merge(data.meta, meta);
      super(mergedDisplay, mergedMeta);

      this.center = JSV.number(data.center);
      this.original_amplitude = JSV.number(data.original_amplitude);
      this.amplitude = JSV.number(data.amplitude);
      this.width = JSV.number(data.width);
  }

  toString() {
      return 'Peak';
  }

  set_amplitude(newValue) {
      if (newValue <= 0) newValue = 0.00001;
      this.amplitude = newValue;
  }

  set_center(newValue) {
      this.center = newValue;
  }

  update() {
      // Implement update logic if needed
  }

  delete() {
      const cluster = this.cluster();
      const compound = this.compound();
      const spectrum = this.spectrum();
      const sv = spectrum._sv;

      cluster._peaks = new SVSet(cluster._peaks.filter(p => p !== this));
      cluster.multiplet_type = undefined;

      if (cluster.peaks().empty()) {
          compound._clusters = new SVSet(compound._clusters.filter(c => c !== cluster));
      }

      if (compound.peaks().empty()) {
          spectrum._compounds = new SVSet(spectrum._compounds.filter(c => c !== compound));
      }

      if (spectrum.peaks().empty()) {
          sv._spectra = new SVSet(sv._spectra.filter(c => c !== spectrum));
      }
  }

  peaks() {
      return new SVSet(this);
  }

  cluster() {
      return this._cluster;
  }

  compound() {
      return this.cluster().compound();
  }

  spectrum() {
      return this.compound().spectrum();
  }

  label() {
      return this.center.toFixed(3);
  }
}
