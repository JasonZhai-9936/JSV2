//////////////////////////////////////////////////////////////////////////////
// SpectrumEIMS
// Spectrum class for mass spectrometry data (EIMS, LCMS, MS/MS).
// Renders as vertical bars rather than continuous lines.
//
// Ported from jspectraviewer-rails dev env's Spectrum.js (ES6 modules)
// to specdbi's IIFE-globals style. Structurally parallel to JSV.Spectrum
// but extends JSV.SVBar instead of JSV.SVPath.
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  /**
   * Create a new SpectrumEIMS for mass spectrometry data.
   * @param {Object} data    Peak data (peak_list or compounds)
   * @param {Object} display Display options passed to SVBar
   * @param {Object} meta    User-defined key:value pairs
   * @return {SpectrumEIMS}
   */
  function SpectrumEIMS(data, display, meta) {
    const self = this;
    data = data || {};
    let display_defaults = {};
    display = JSV.merge(display_defaults, data.display, display);
    meta    = JSV.merge(data.meta, meta);
    JSV.SVBar.call(this, display, meta);

    this.id              = data.id;
    this.name            = data.name || this.id;
    this.tolerance       = data.tolerance;
    this.noise           = undefined;
    this.active          = true;
    this.add_to_zoom_box = JSV.default_for(data.add_to_zoom_box, true);
    // Flag for SVBar: when true, bars draw downward from baseline (used by mirror plots)
    this.isMirrorPlot    = JSV.default_for(data.isMirrorPlot, false);

    this.xy_data        = new JSV.SVData();
    this.simple_xy_data = new JSV.SVData();
    this.labels         = new JSV.SVLabelSet({spectrum: this});
    this._compounds     = new JSV.SVSet();

    if (data.compounds) {
      data.compounds.forEach(function(compound_data) {
        self.add_compound(new JSV.Compound(compound_data));
      });
    } else if (data.peak_list) {
      const compound_data = { clusters: [{ peaks: data.peak_list }] };
      self.add_compound(new JSV.Compound(compound_data));
    }

    if (self.compounds().present()) {
      const number_of_points = JSV.default_for(data.number_of_points, 10000);
      const min_x            = JSV.default_for(data.min_x, 0);
      const max_x            = JSV.default_for(data.max_x, 1000);
      if (!data.xy_line) {
        const xy_line = JSV.xy_from_peaks(self.peaks(), number_of_points, min_x, max_x);
        self.add_xy_line(xy_line);
      }
    }
    if (data.xy_line) {
      self.add_xy_line(data.xy_line);
    }

    if (data.labels) {
      data.labels.forEach(function(label) {
        self.labels.add(label);
      });
    }
  }

  JSV.inherits(SpectrumEIMS, JSV.SVBar);

  // IMPORTANT: must return 'Spectrum' so SpectraViewer.add_spectrum's
  // `data.toString() == 'Spectrum'` check correctly identifies wrapped instances.
  SpectrumEIMS.prototype.toString = function() { return 'Spectrum'; }

  /**
   * Add a Compound to the spectrum.
   */
  SpectrumEIMS.prototype.add_compound = function(compound) {
    this._compounds.push(compound);
    compound._spectrum = this;
  }

  /**
   * Update xy_line based on peak data and refresh the zoombox.
   */
  SpectrumEIMS.prototype.update = function() {
    const sv = this._sv;
    const xy_data = JSV.xy_from_peaks(this.peaks(), this.xy_data.length(), sv.boundary.x.min(), sv.boundary.x.max());
    this.add_xy_line(xy_data);
    sv.zoombox.update();
  }

  /**
   * Returns SVSet of Compounds or single Compound from this spectrum.
   */
  SpectrumEIMS.prototype.compounds = function(term) {
    return this._compounds.get(term);
  }

  /**
   * Returns SVSet of Clusters across all compounds (or a single Cluster).
   */
  SpectrumEIMS.prototype.clusters = function(term) {
    const clusters = new JSV.SVSet();
    const compounds = this._compounds;
    for (let i=0, len=compounds.length; i < len; i++) {
      clusters.merge(compounds[i].clusters());
    }
    return clusters.get(term);
  }

  /**
   * Returns SVSet of Peaks across all compounds and clusters.
   */
  SpectrumEIMS.prototype.peaks = function(term) {
    const peaks = new JSV.SVSet();
    this.compounds().forEach(function(compound) {
      compound.clusters().forEach(function(cluster) {
        peaks.merge(cluster.peaks());
      });
    });
    return peaks.get(term);
  }

  /**
   * Set the xy_data array. For EIMS we use the raw data without simplification
   * since the discrete bar rendering doesn't benefit from douglas-peucker.
   */
  SpectrumEIMS.prototype.add_xy_line = function(xy_data) {
    this.xy_data = new JSV.SVData(xy_data);
    this.noise   = this.calculate_noise();
    // Use raw data — bar rendering doesn't simplify like line rendering does.
    this.simple_xy_data = this.xy_data;
  }

  /**
   * Calculate noise level from a small region of the data.
   * Mirrors JSV.Spectrum.calculate_noise (used as a fallback tolerance).
   */
  SpectrumEIMS.prototype.calculate_noise = function() {
    const region = [-0.05, -0.04];
    const xy_min = this.xy_data.index_of(region[0]);
    const xy_max = this.xy_data.index_of(region[1]);
    const y_noise = this.xy_data.y.slice(xy_min, xy_max);
    if (!y_noise || y_noise.length === 0) return 0;
    return (d3v7.max(y_noise) - d3v7.min(y_noise)).toPrecision(2);
  }

  JSV.SpectrumEIMS = SpectrumEIMS;

})(JSpectraViewer);
