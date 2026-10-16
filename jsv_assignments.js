// jsv_assignments.js - SVAssignments (1D & 2D tables) + JSpectraViewer.initialize()
// Load order: 8 of 8 — must be loaded last
//
//////////////////////////////////////////////////////////////////////////////
// SpectraViewer Assignment Table
//////////////////////////////////////////////////////////////////////////////
// NOTE: requires Sortable to move peaks and atom badges
// https://github.com/RubaXa/Sortable
(function(JSV) {

  /**
   * The SVAssignments object controls peak and atom assignments of clusters on
   * Viewer. The [Sortable](https://github.com/RubaXa/Sortable) library is
   * required to move peak and atom badges.
   * The following options can be set when creating a
   * [SpectraViewer](SpectraViewer.js.html):
   *
   *  Option                | Default     | Description
   *  ----------------------|-------------------------------------------------
   *  container_id          | _undefined_ | ID of dom element where the structure will be draw (e.g. '#my-structure')
   *  nmr_nucleus           | 1H          | One of '1H' or '13C'
   *  edit_mode             | false       | Can the assignments be manually edited?
   *
   *
   * @param {Object} sv The [SpectraViewer](SpectraViewer.js.html) object
   * @param {Object} options Options for how Assignment Table should work. Described below.
   * @return {SVSelection}
   */
  function SVAssignments(sv, options = {}) {
    const self = this;
    this.sv = sv;
    this.struct = sv.structure;
    this.container_id = options.container_id;
    this.container = d3v7.select(this.container_id);
    this.table = this.container.append('table').classed('jsv-assignment-table', true);
    this.nmr_nucleus = JSV.default_for(options.nmr_nucleus, '1H'); // Sets up table header
    if (!window.Sortable) {
      console.log("Sortable needs to be installed to make peaks/atoms dragable: https://github.com/RubaXa/Sortable");
      this.sortable = false;
    }
    this.add_sv_events();
    if (this.struct) {
      this.add_struct_events();
    }
    this.edit_mode = options.edit_mode; // calls update_table
  }

  SVAssignments.prototype.nmr_1H = function () {
    return this.nmr_nucleus && this.nmr_nucleus.toUpperCase() == '1H'
  }

  SVAssignments.prototype.nmr_13C = function () {
    return this.nmr_nucleus && this.nmr_nucleus.toUpperCase() == '13C'
  }


  SVAssignments.prototype.get_columns = function() {
    const self = this;
    const struct = self.struct;
    const formatter = d3v7.format('.2f');

    const create_atoms_html = function(atoms, atom_refs) {
      let html = "";
      if ( atoms && atoms.length > 0) {
        const lca_atoms = struct.LCA_from_nmr_atoms(atoms);
        html = lca_atoms.map(function(atom) {
          return "<div class='jsv-badge atom-badge' data-atom-id='"+atom.id+"'>"+atom.display_id+"</div>"
        }).join('');
      } else if (atom_refs && atom_refs.length > 0) {
        html =  atom_refs.map(function(ref) {
          return "<div class='jsv-badge atom-badge' data-atom-id=''>"+ref+"</div>"
        }).join('');
      }
      return html
    }

    const create_add_atoms_html = function(atoms, index) {
      return "<div class='add-atoms-container'><a class='add-atoms jsv-btn' href='javascript:void(0)'>+</a><div>";
    }

    const create_peak_centers_html = function(peaks) {
      return peaks.reverse().map(function(peak) {
        return "<span class='jsv-badge peak-badge' data-peak-id='"+peak.path_id()+"'>"+formatter(peak.center)+"</span>"
      }).join('')
    }

    const columns = [
      { heading: 'Row No.', class: 'cluster-number center', html: function(row)  { return row.number }},
      { heading: 'Cluster Midpoint', class: 'center', html: function(row)  { return formatter(row.center)}},
      { heading: 'No. Peaks', class: 'center', html: function(row)  { return row.peak_num }},
      { heading: 'Coupling Type', class: 'center', html: function(row)  { return row.multiplet_type }},
      { heading: "No. H's", class: 'center', html: function(row)  { return row.atoms.length }},
      { heading: 'Atom No.', class: 'atom-cell', html: function(row)  { return create_atoms_html(row.atoms, row.atom_refs) }},
      { heading: '', class: 'add-atom-cell', html: function(row, i)  { return create_add_atoms_html(row.atoms, i) }},
      { heading: 'Peak Centers (ppm)', class: 'peak-cell', html: function(row)  { return create_peak_centers_html(row.peaks) }}
    ];
    if (self.nmr_13C()) {
      columns[4].heading = "No. C's";
    }
    if (!struct) {
      // Remove H's, Atoms and '' columns
      columns.splice(4, 3);
    }
    return columns
  }

  // Table code concept: https://vis4.net/blog/posts/making-html-tables-in-d3v7-doesnt-need-to-be-a-pain/
  SVAssignments.prototype.update_table_header = function() {
    this.table.select('thead').remove();
    this.table.append('thead')
        .append('tr')
        .append('th')
        .attr('class', 'center')
        .attr('style', 'font-size: larger')
        .attr('colspan', this.columns.length)
        .text("Assignment Table")
    this.table.select('thead')
        .append('tr')
        .selectAll('th')
        .data(this.columns).enter()
        .append('th')
        .attr('class', function(col) { return col.class })
        .text(function(col) { return col.heading });
  }

  SVAssignments.prototype.update_table = function() {
    // console.log('TABLE UPDATED')
    const self = this;
    const struct = this.struct;
    const table = this.table;
    const columns = this.columns;
    // Get row data from SV
    rows = [];
    // Make the cluster navigator static
    this.sv._cluster_navigation.static_compounds = this.sv.compounds();

    this.sv.clusters().each(function(index) {
      row = {
        path_id: this.path_id(),
        number: index + 1,
        center: this.center(),
        peak_num: this.peaks().length,
        peaks: this.peaks(),
        multiplet_type: this.multiplet_type,
        atoms: this.atoms(),
        atom_refs: this.atom_refs
      };
      rows.push(row);
    });
    // Remove old data
    table.select('tbody').remove();
    // Add new data
    if (rows.length > 0) {
      table.append('tbody')
          .selectAll('tr')
          .data(rows).enter()
          .append('tr').attr('data-cluster-path-id', function(row) { return row.path_id })
          .selectAll('td')
          .data(function(row, i) {
            return columns.map(function(col) {
              const cell = {};
              Object.keys(col).forEach(function(key) {
                cell[key] = (typeof col[key] == 'function') ? col[key](row, i) : col[key];
              });
              return cell
            });
          }).enter()
          .append('td')
          .html(function(col) { return col.html })
          .attr('class', function(col) { return col.class });
    } else {
      table.append('tbody').append('tr').append('td')
          .attr('colspan', columns.length)
          .style('text-align', 'center')
          .html('No Clusters')
    }

    // Add table events
    this.add_table_events();

    // Adjust Atom Badge colors
    d3v7.selectAll('.atom-badge').each(function() {
      const badge = d3v7.select(this);
      const atom = struct.atoms(badge.text());
      if (atom) {
        badge.classed('atom-badge-symbol-'+ atom.symbol, true);
      }
    });

    if (self.edit_mode) {
      this.make_sortable();
    } else {
      // Hide add atoms button, which are visible by default
      table.selectAll('.add-atoms').style('display', 'none');
    }
  }

  SVAssignments.prototype.make_sortable = function() {
    const self = this;
    const table = this.table;
    const struct = this.struct;
    table.classed('editable', true);
    // Make Atoms sortable
    table.selectAll('tbody tr .atom-cell').each(function() {
      Sortable.create(this, {
        draggable: '.atom-badge', group: 'atoms', animation: 150, ghostClass: 'badge-ghost',
        onAdd: function(evt) {
          let atom;
          const new_cluster = self.cluster_from_table_child(evt.item);
          const old_cluster = self.cluster_from_table_child(evt.from);
          // console.log(old_cluster.path_id() + ' -> ' + new_cluster.path_id());
          const atom_id = d3v7.select(evt.item).attr('data-atom-id');
          if (atom_id) {
            atom = struct.atoms(atom_id);
          }
          if (atom && new_cluster && old_cluster) {
            const moved_atoms = struct.nmr_atoms_from_atoms([atom]);
            atoms = new_cluster.atoms().merge(moved_atoms).unique();
            new_cluster._atoms = atoms;
            old_cluster._atoms = new JSV.SVSet(old_cluster._atoms.filter(function(a) { return !moved_atoms.contains(a) }));
            self.update_table();
          }
          self.select_peaks_and_atoms(self.selected_atoms);
        },
        onEnd: function(evt) {
          const atom_id = d3v7.select(evt.item).attr('data-atom-id');
          if (atom_id) {
            atom = struct.atoms(atom_id);
            self.selected_atoms = new JSV.SVSet(atom);
            self.select_peaks_and_atoms(self.selected_atoms);
          }
        }
      })
    });

    // Make peaks sortable
    table.selectAll('tbody tr td.peak-cell').each(function() {
      Sortable.create(this, {
        draggable: '.peak-badge', group: 'peaks', animation: 150, ghostClass: 'badge-ghost',
        onAdd: function(evt) {
          let peak;
          const new_cluster = self.cluster_from_table_child(evt.item);
          const old_cluster = self.cluster_from_table_child(evt.from);
          // console.log(old_cluster.path_id() + ' -> ' + new_cluster.path_id());
          const peak_id = d3v7.select(evt.item).attr('data-peak-id');
          if (peak_id) {
            peak = sv.peaks(peak_id);
          }
          if (peak && new_cluster && old_cluster) {
            // old_cluster._peaks = new JSV.SVSet(old_cluster._peaks.filter(function(p) { return p != peak }));
            // Remove peak from previous cluster
            peak.delete();
            // Add peak to cluster and update
            new_cluster.add_peak(peak);
            new_cluster.update();
            if (sv._cluster_navigation) {
              sv._cluster_navigation.update_table();
            }
            self.update_table();
          }
          self.select_peaks_and_atoms(self.selected_peaks);
        },
        onEnd: function(evt) {
          const peak_id = d3v7.select(evt.item).attr('data-peak-id');
          if (peak_id) {
            peak = sv.peaks(peak_id);
            self.selected_peaks = new JSV.SVSet(peak);
            self.select_peaks_and_atoms(self.selected_peaks);
          }
        }
      })

    });
  }

  SVAssignments.prototype.add_table_events = function() {
    const self = this;
    const table = this.table;
    const sv = this.sv;
    const struct = this.struct;

    table.selectAll('tbody tr').on('click', function() {
      table.selectAll('tbody tr').classed('selected', false);
      d3v7.select(this).classed('selected', true);
      const path_id = d3v7.select(this).attr('data-cluster-path-id');
      const cluster = sv.clusters(path_id);
      self.select_peaks_and_atoms(cluster);
      sv.move_to_peaks(cluster.peaks(), sv._cluster_navigation.speed, 2);
    })

    table.selectAll('tbody .atom-badge').on('click', function() {
      let selected_atoms = self.selected_atoms;
      const atom_id = d3v7.select(this).attr('data-atom-id');
      const clicked_atom = struct.atoms(atom_id);
      if (d3v7.event.shiftKey) {
        window.getSelection().removeAllRanges()
        if (selected_atoms.contains(clicked_atom)) {
          selected_atoms = selected_atoms.remove(clicked_atom);
        } else {
          selected_atoms.push(clicked_atom);
        }
      } else {
        selected_atoms = new JSV.SVSet(clicked_atom);
      }
      self.selected_atoms = selected_atoms;
      self.select_peaks_and_atoms(self.selected_atoms);
      sv.move_to_peaks(self.cluster_from_atoms(self.selected_atoms).peaks(), sv._cluster_navigation.speed, 2);
      d3v7.event.stopPropagation();
    })

    table.selectAll('tbody .peak-badge').on('click', function() {
      let selected_peaks = self.selected_peaks;
      const peak_id = d3v7.select(this).attr('data-peak-id');
      const clicked_peak = sv.peaks(peak_id);
      if (d3v7.event.shiftKey) {
        window.getSelection().removeAllRanges()
        if (selected_peaks.contains(clicked_peak)) {
          selected_peaks = selected_peaks.remove(clicked_peak);
        } else {
          selected_peaks.push(clicked_peak);
        }
      } else {
        selected_peaks = new JSV.SVSet(clicked_peak);
      }
      self.selected_peaks = selected_peaks;
      self.select_peaks_and_atoms(self.selected_peaks);
      sv.move_to_peaks(self.selected_peaks, sv._cluster_navigation.speed, 2);
      d3v7.event.stopPropagation();
    })

    // Add Atoms
    table.selectAll('tbody tr .add-atoms').on('click', function() {
      const cluster = self.cluster_from_table_child(this);
      // Add to spectra viewer
      if (cluster) {
        cluster._atoms = struct.nmr_atoms_from_atoms(struct.selected_atoms);
      }
      d3v7.event.stopPropagation();
      // Add to table cell
      self.update_table();
      self.select_peaks_and_atoms(cluster);
      return false
    });

  }

  SVAssignments.prototype.add_sv_events = function() {
    const self = this;
    const struct = self.struct;
    const sv = self.sv;
    sv.on('adjust-end.assign', function() {
      self.update_table();
      self.select_peaks_and_atoms(sv.selection.peaks());
    });
    sv.on('adjust-peak-created.assign', function(peak) {
      const cluster = peak.cluster();
      if (cluster.peaks().length == 1) {
        cluster._atoms = struct.nmr_atoms_from_atoms(struct.selected_atoms);
      }
    });
    sv.on('selection-add.assign', function() {
      self.select_peaks_and_atoms(sv.selection.peaks());
    });
    sv.on('selection-remove.assign', function() {
      self.select_peaks_and_atoms(sv.selection.peaks());
    });
    sv.on('selection-clear.assign', function() {
      self.select_peaks_and_atoms(undefined);
    });
  }

  SVAssignments.prototype.add_struct_events = function() {
    const self = this;
    const struct = this.struct;
    struct.on('structure-click.assign', function() {
      struct.selected_atoms = struct.LCA_and_nmr_atoms(struct.selected_atoms);
      self.select_peaks_and_atoms(struct.selected_atoms);
    });
  }

  // Provide a single cluster or a SVSet of peaks or atoms
  // If a single cluster or the peaks and atoms make up a single cluster
  // then atoms, peaks and the cluster row will be selected.
  // If no cluster can be selected then just the peaks or atoms are selected.
  SVAssignments.prototype.select_peaks_and_atoms = function(selection) {
    const self = this;
    const sv = this.sv;
    const struct = this.struct;
    const table = this.table;
    let cluster;
    let peaks = new JSV.SVSet();
    let atoms = new JSV.SVSet();

    // Determine what selection is
    if (selection) {
      if (selection.toString() == 'Cluster') {
        cluster = selection;
      } else if (selection.toString() == 'SVSet' || Array.isArray(selection)) {
        const first_item = selection[0];
        if (first_item) {
          if (selection[0].toString() == 'Atom') {
            atoms = selection;
          } else if (selection[0].toString() == 'Peak') {
            peaks = selection;
          }
        }
      } else {
        console.log("Unknown Selection")
      }
    }

    // Determine peaks, atoms, cluster
    if (peaks.present()) {
      cluster = this.cluster_from_peaks(peaks);
    }
    if (atoms.present()) {
      cluster = this.cluster_from_atoms(atoms);
    }
    if (cluster) {
      peaks = cluster.peaks();
      atoms = cluster.atoms();
    }

    // Select atoms in structure
    if (struct) {
      if(struct.use_jsmol && typeof Jmol !== "undefined") {
        if(struct.nmr_1H()) {
          let selected = struct.LCA_from_hydrogens(atoms);
          Jmol.script(jmol_jspectraviewer, `select carbon; colour halos grey; select atomno = ${selected[0].id.replace(/\D/g, '')}; colour halos blue;`)
        } else {
          Jmol.script(jmol_jspectraviewer, `select carbon; colour halos grey; select atomno = ${atoms[0].id.replace(/\D/g, '')}; colour halos blue;`)
        }
      }
      else {
        struct.selected_atoms = struct.LCA_and_nmr_atoms(atoms);
      }
    }
    // Select peaks in viewer
    sv.selection._elements = peaks.unique();
    sv.draw();
    // Select peaks and atoms in table
    self.selected_peaks = peaks;
    if (struct) {
      self.selected_atoms = struct.LCA_from_nmr_atoms(atoms);
    }
    // Select cluster row in table
    table.selectAll('tbody tr').classed('selected', false);
    if (cluster) {
      table.select('tbody tr[data-cluster-path-id='+cluster.path_id()+']').classed('selected', true);
    }
  }

  SVAssignments.prototype.cluster_from_peaks = function(peaks) {
    let cluster;
    this.sv.clusters().forEach(function(c) {
      if (c.peaks().equals(peaks)) {
        cluster = c;
      }
    });
    return cluster
  }

  SVAssignments.prototype.cluster_from_atoms = function(atoms) {
    let cluster;
    const struct = this.struct;
    const nmr_atoms = struct.nmr_atoms_from_atoms(atoms);
    this.sv.clusters().forEach(function(c) {
      const cluster_nmr_atoms = struct.nmr_atoms_from_atoms(c.atoms());
      if (cluster_nmr_atoms.equals(nmr_atoms)) {
        cluster = c;
      }
    });
    return cluster
  }

  // Given an element in a table row, find the cluster represented by the row.
  SVAssignments.prototype.cluster_from_table_child = function(element) {
    if (!element) { return; }
    let cluster;
    let found = false;
    let currentNode = element;
    while (!found) {
      localName = currentNode.localName.toUpperCase();
      if (localName == 'TR') {
        found = true;
        const path_id = d3v7.select(currentNode).attr('data-cluster-path-id');
        if (path_id) {
          cluster = this.sv.clusters(path_id);
        }
      } else if (localName == 'TABLE') {
        found = true
      } else {
        currentNode = currentNode.parentNode;
        if (!currentNode) {
          found = true;
        }
      }
    }
    return cluster
  }

  /////////////////////////////////////////////////////////////////////////////
  // Assignment Properties (setters/getters)
  /////////////////////////////////////////////////////////////////////////////
  Object.defineProperties(SVAssignments.prototype, {
    'selected_atoms': {
      get: function() {
        const self = this;
        const selected = new JSV.SVSet();
        this.container.selectAll('.atom-badge.selected').each(function(){
          const atom_id = d3v7.select(this).attr('data-atom-id');
          selected.push(self.struct.atoms(atom_id));
        });
        return selected
      },
      set: function(atoms) {
        const self = this;
        const container = this.container;
        container.selectAll('.atom-badge').classed('selected', false);
        atoms.forEach(function(atom) {
          container.selectAll('.atom-badge[data-atom-id="' + atom.id + '"]').classed('selected', true);
        });
      }
    },
    'selected_peaks': {
      get: function() {
        const self = this;
        const selected = new JSV.SVSet();
        this.container.selectAll('.peak-badge.selected').each(function(){
          const peak_id = d3v7.select(this).attr('data-peak-id');
          selected.push(self.sv.peaks(peak_id));
        });
        return selected
      },
      set: function(peaks) {
        const self = this;
        const container = this.container;
        container.selectAll('.peak-badge').classed('selected', false);
        peaks.forEach(function(peak) {
          container.select('.peak-badge[data-peak-id="' + peak.path_id() + '"]').classed('selected', true);
        });
      }
    },
    'edit_mode': {
      get: function() {
        return this._edit_mode;
      },
      set: function(mode) {
        const self = this;
        const sv = self.sv;
        self._edit_mode = mode;
        if (self._edit_mode) {
          sv.selection.element_type = 'peak';
          sv.selection.allow_multiselect = true;
          sv.selection.allow_adjust = true;
          sv.selection.allow_width_adjust = true;
          sv.selection.allow_peak_creation = true;
          if (sv.highlight) sv.highlight.element_type = 'peak';
        } else {
          sv.selection.element_type = 'cluster';
          sv.selection.allow_multiselect = true;
          sv.selection.allow_adjust = false;
          sv.selection.allow_width_adjust = false;
          sv.selection.allow_peak_creation = false;
          if (sv.highlight) sv.highlight.element_type = 'cluster';
        }
        self.update_table();
        self.select_peaks_and_atoms(sv.selection.peaks());
        sv.draw();
      }
    },
    'nmr_nucleus': {
      get: function() {
        return this._nmr_nucleus;
      },
      set: function(nucleus) {
        this._nmr_nucleus = nucleus;
        this.columns = this.get_columns();
        if(this.struct) this.struct.nmr_nucleus = nucleus;
        this.update_table_header();
        this.update_table();
      }
    }
  });



  JSV.SVAssignments = SVAssignments;

})(JSpectraViewer);
//////////////////////////////////////////////////////////////////////////////
// SpectraViewer Assignment Table
//////////////////////////////////////////////////////////////////////////////
// NOTE: requires Sortable to move peaks and atom badges
// https://github.com/RubaXa/Sortable
(function(JSV) {

  /**
   * The SVAssignments2D object controls peak and atom assignments of clusters on
   * the 2D Viewer. The [Sortable](https://github.com/RubaXa/Sortable) library is
   * required to move peak and atom badges.
   * The following options can be set when creating a
   * [SpectraViewer](SpectraViewer.js.html):
   *
   *  Option                | Default     | Description
   *  ----------------------|-------------------------------------------------
   *  container_id          | _undefined_ | ID of dom element where the structure will be draw (e.g. '#my-structure')
   *  edit_mode             | false       | Can the Assignments2D be manually edited?
   *
   *
   * @param {Object} sv The [SpectraViewer](SpectraViewer.js.html) object
   * @param {Object} options Options for how Assignment Table should work. Described below.
   * @return {SVSelection}
   */
  function SVAssignments2D(sv, options= {}) {
    const self = this;
    this.sv = sv;
    this.struct = sv.structure;
    this.container_id = options.container_id;
    this.container = d3v7.select(this.container_id);
    this.table = this.container.append('table').classed('jsv-assignment-table', true);
    this.nmr_nucleus = "2D";
    if (!window.Sortable) {
      console.log("Sortable needs to be installed to make peaks/atoms dragable: https://github.com/RubaXa/Sortable");
      this.sortable = false;
    }
    this.add_sv_events();
    if (this.struct) {
      this.add_struct_events();
    }
    this.edit_mode = options.edit_mode; // calls update_table
  }

  SVAssignments2D.prototype.nmr_1H = function () {
    return this.nmr_nucleus && this.nmr_nucleus.toUpperCase() == '1H'
  }

  SVAssignments2D.prototype.nmr_13C = function () {
    return this.nmr_nucleus && this.nmr_nucleus.toUpperCase() == '13C'
  }


  SVAssignments2D.prototype.get_columns = function() {
    const self = this;
    const struct = self.struct;
    const formatter = d3v7.format('.2f');

    const create_atoms_html = function(atoms, atom_refs) {
      let html = "";
      if ( atoms && atoms.length > 0) {
        const lca_atoms = struct.LCA_from_nmr_atoms(atoms);
        html = lca_atoms.map(function(atom) {
          return "<div class='jsv-badge atom-badge' data-atom-id='"+atom.id+"'>"+atom.display_id+"</div>"
        }).join('');
      } else if (atom_refs && atom_refs.length > 0) {
        html =  atom_refs.map(function(ref) {
          return "<div class='jsv-badge atom-badge' data-atom-id=''>"+ref+"</div>"
        }).join('');
      }
      return html
    }

    const create_add_atoms_html = function(atoms, index) {
      return "<div class='add-atoms-container'><a class='add-atoms jsv-btn' href='javascript:void(0)'>+</a><div>";
    }

    const create_peak_centers_html = function(peaks) {
      return peaks.reverse().map(function(peak) {
        return "<span class='jsv-badge peak-badge' data-peak-id='"+peak.path_id()+"'>"+formatter(peak.center)+"</span>"
      }).join('')
    }

    const columns = [
      { heading: 'Row No.', class: 'cluster-number center', html: function(row)  { return row.number }},
      { heading: 'Dir. Dim. Center', class: 'center', html: function(row)  { return formatter(row.peaks[0])}},
      { heading: 'Indir. Dim. Center', class: 'center', html: function(row)  { return formatter(row.peaks[1])}},
      { heading: 'Coupling Type', class: 'center', html: function(row)  { return row.multiplet_type }},
      { heading: 'Dir. Dim. Atom No.', class: 'atom-cell center', html: function(row)  { return create_atoms_html(row.atoms, row.dir_dim_atom_refs) }},
      { heading: 'Indir. Dim. Atom No.', class: 'atom-cell center', html: function(row)  { return create_atoms_html(row.atoms, row.indir_dim_atom_refs) }}
    ];
    // if (!struct) {
    //   // Remove H's, Atoms and '' columns
    //   columns.splice(4, 3);
    // }
    return columns
  }

  // Table code concept: https://vis4.net/blog/posts/making-html-tables-in-d3v7-doesnt-need-to-be-a-pain/
  SVAssignments2D.prototype.update_table_header = function() {
    this.table.select('thead').remove();
    this.table.append('thead')
        .append('tr')
        .append('th')
        .attr('class', 'center')
        .attr('style', 'font-size: larger')
        .attr('colspan', this.columns.length)
        .text("Assignment Table")
    this.table.select('thead')
        .append('tr')
        .selectAll('th')
        .data(this.columns).enter()
        .append('th')
        .attr('class', function(col) { return col.class })
        .text(function(col) { return col.heading });
  }

  SVAssignments2D.prototype.update_table = function() {
    // console.log('TABLE UPDATED')
    const self = this;
    const struct = this.struct;
    const table = this.table;
    const columns = this.columns;
    // Get row data from SV
    rows = [];
    // Make the cluster navigator static
    this.sv._cluster_navigation.static_compounds = this.sv.compounds();

    this.sv.clusters().each(function(index) {
      row = {
        path_id: this.path_id(),
        number: index + 1,
        center: this.center(),
        peak_num: this.peaks().length,
        peaks: this.peaks(),
        multiplet_type: this.multiplet_type,
        atoms: this.atoms(),
        dir_dim_atom_refs: this.dir_dim_atom_refs(),
        indir_dim_atom_refs: this.indir_dim_atom_refs()
      };
      rows.push(row);
    });
    // Remove old data
    table.select('tbody').remove();
    // Add new data
    if (rows.length > 0) {
      table.append('tbody')
          .selectAll('tr')
          .data(rows).enter()
          .append('tr').attr('data-cluster-path-id', function(row) { return row.path_id })
          .selectAll('td')
          .data(function(row, i) {
            return columns.map(function(col) {
              const cell = {};
              Object.keys(col).forEach(function(key) {
                cell[key] = (typeof col[key] == 'function') ? col[key](row, i) : col[key];
              });
              return cell
            });
          }).enter()
          .append('td')
          .html(function(col) { return col.html })
          .attr('class', function(col) { return col.class });
    } else {
      table.append('tbody').append('tr').append('td')
          .attr('colspan', columns.length)
          .style('text-align', 'center')
          .html('No Clusters')
    }

    // Add table events
    this.add_table_events();

    // Adjust Atom Badge colors
    d3v7.selectAll('.atom-badge').each(function() {
      const badge = d3v7.select(this);
      const atom = struct.atoms(badge.text());
      if (atom) {
        badge.classed('atom-badge-symbol-'+ atom.symbol, true);
      }
    });

    if (self.edit_mode) {
      this.make_sortable();
    } else {
      // Hide add atoms button, which are visible by default
      table.selectAll('.add-atoms').style('display', 'none');
    }
  }

  SVAssignments2D.prototype.make_sortable = function() {
    const self = this;
    const table = this.table;
    const struct = this.struct;
    table.classed('editable', true);
    // Make Atoms sortable
    table.selectAll('tbody tr .atom-cell').each(function() {
      Sortable.create(this, {
        draggable: '.atom-badge', group: 'atoms', animation: 150, ghostClass: 'badge-ghost',
        onAdd: function(evt) {
          let atom;
          const new_cluster = self.cluster_from_table_child(evt.item);
          const old_cluster = self.cluster_from_table_child(evt.from);
          // console.log(old_cluster.path_id() + ' -> ' + new_cluster.path_id());
          const atom_id = d3v7.select(evt.item).attr('data-atom-id');
          if (atom_id) {
            atom = struct.atoms(atom_id);
          }
          if (atom && new_cluster && old_cluster) {
            const moved_atoms = struct.nmr_atoms_from_atoms([atom]);
            atoms = new_cluster.atoms().merge(moved_atoms).unique();
            new_cluster._atoms = atoms;
            old_cluster._atoms = new JSV.SVSet(old_cluster._atoms.filter(function(a) { return !moved_atoms.contains(a) }));
            self.update_table();
          }
          self.select_peaks_and_atoms(self.selected_atoms);
        },
        onEnd: function(evt) {
          const atom_id = d3v7.select(evt.item).attr('data-atom-id');
          if (atom_id) {
            atom = struct.atoms(atom_id);
            self.selected_atoms = new JSV.SVSet(atom);
            self.select_peaks_and_atoms(self.selected_atoms);
          }
        }
      })
    });

    // Make peaks sortable
    table.selectAll('tbody tr td.peak-cell').each(function() {
      Sortable.create(this, {
        draggable: '.peak-badge', group: 'peaks', animation: 150, ghostClass: 'badge-ghost',
        onAdd: function(evt) {
          let peak;
          const new_cluster = self.cluster_from_table_child(evt.item);
          const old_cluster = self.cluster_from_table_child(evt.from);
          // console.log(old_cluster.path_id() + ' -> ' + new_cluster.path_id());
          const peak_id = d3v7.select(evt.item).attr('data-peak-id');
          if (peak_id) {
            peak = sv.peaks(peak_id);
          }
          if (peak && new_cluster && old_cluster) {
            // old_cluster._peaks = new JSV.SVSet(old_cluster._peaks.filter(function(p) { return p != peak }));
            // Remove peak from previous cluster
            peak.delete();
            // Add peak to cluster and update
            new_cluster.add_peak(peak);
            new_cluster.update();
            if (sv._cluster_navigation) {
              sv._cluster_navigation.update_table();
            }
            self.update_table();
          }
          self.select_peaks_and_atoms(self.selected_peaks);
        },
        onEnd: function(evt) {
          const peak_id = d3v7.select(evt.item).attr('data-peak-id');
          if (peak_id) {
            peak = sv.peaks(peak_id);
            self.selected_peaks = new JSV.SVSet(peak);
            self.select_peaks_and_atoms(self.selected_peaks);
          }
        }
      })

    });
  }

  SVAssignments2D.prototype.add_table_events = function() {
    const self = this;
    const table = this.table;
    const sv = this.sv;
    const struct = this.struct;

    table.selectAll('tbody tr').on('click', function() {
      table.selectAll('tbody tr').classed('selected', false);
      d3v7.select(this).classed('selected', true);
      const path_id = d3v7.select(this).attr('data-cluster-path-id');
      const cluster = sv.clusters(path_id);
      self.select_peaks_and_atoms(cluster);
      sv.move_to_peaks(cluster.peaks(), sv._cluster_navigation.speed, 2);
    })

    table.selectAll('tbody .atom-badge').on('click', function() {
      let selected_atoms = self.selected_atoms;
      const atom_id = d3v7.select(this).attr('data-atom-id');
      const clicked_atom = struct.atoms(atom_id);
      if (d3v7.event.shiftKey) {
        window.getSelection().removeAllRanges()
        if (selected_atoms.contains(clicked_atom)) {
          selected_atoms = selected_atoms.remove(clicked_atom);
        } else {
          selected_atoms.push(clicked_atom);
        }
      } else {
        selected_atoms = new JSV.SVSet(clicked_atom);
      }
      self.selected_atoms = selected_atoms;
      self.select_peaks_and_atoms(self.selected_atoms);
      sv.move_to_peaks(self.cluster_from_atoms(self.selected_atoms).peaks(), sv._cluster_navigation.speed, 2);
      d3v7.event.stopPropagation();
    })

    table.selectAll('tbody .peak-badge').on('click', function() {
      let selected_peaks = self.selected_peaks;
      const peak_id = d3v7.select(this).attr('data-peak-id');
      const clicked_peak = sv.peaks(peak_id);
      if (d3v7.event.shiftKey) {
        window.getSelection().removeAllRanges()
        if (selected_peaks.contains(clicked_peak)) {
          selected_peaks = selected_peaks.remove(clicked_peak);
        } else {
          selected_peaks.push(clicked_peak);
        }
      } else {
        selected_peaks = new JSV.SVSet(clicked_peak);
      }
      self.selected_peaks = selected_peaks;
      self.select_peaks_and_atoms(self.selected_peaks);
      sv.move_to_peaks(self.selected_peaks, sv._cluster_navigation.speed, 2);
      d3v7.event.stopPropagation();
    })

    // Add Atoms
    table.selectAll('tbody tr .add-atoms').on('click', function() {
      const cluster = self.cluster_from_table_child(this);
      // Add to spectra viewer
      if (cluster) {
        cluster._atoms = struct.nmr_atoms_from_atoms(struct.selected_atoms);
      }
      d3v7.event.stopPropagation();
      // Add to table cell
      self.update_table();
      self.select_peaks_and_atoms(cluster);
      return false
    });

  }

  SVAssignments2D.prototype.add_sv_events = function() {
    const self = this;
    const struct = self.struct;
    const sv = self.sv;
    sv.on('adjust-end.assign', function() {
      self.update_table();
      self.select_peaks_and_atoms(sv.selection.peaks());
    });
    sv.on('adjust-peak-created.assign', function(peak) {
      const cluster = peak.cluster();
      if (cluster.peaks().length == 1) {
        cluster._atoms = struct.nmr_atoms_from_atoms(struct.selected_atoms);
      }
    });
    sv.on('selection-add.assign', function() {
      self.select_peaks_and_atoms(sv.selection.peaks());
    });
    sv.on('selection-remove.assign', function() {
      self.select_peaks_and_atoms(sv.selection.peaks());
    });
    sv.on('selection-clear.assign', function() {
      self.select_peaks_and_atoms(undefined);
    });
  }

  SVAssignments2D.prototype.add_struct_events = function() {
    const self = this;
    const struct = this.struct;
    struct.on('structure-click.assign', function() {
      struct.selected_atoms = struct.LCA_and_nmr_atoms(struct.selected_atoms);
      self.select_peaks_and_atoms(struct.selected_atoms);
    });
  }

  // Provide a single cluster or a SVSet of peaks or atoms
  // If a single cluster or the peaks and atoms make up a single cluster
  // then atoms, peaks and the cluster row will be selected.
  // If no cluster can be selected then just the peaks or atoms are selected.
  SVAssignments2D.prototype.select_peaks_and_atoms = function(selection) {
    const self = this;
    const sv = this.sv;
    const struct = this.struct;
    const table = this.table;
    let cluster;
    let peaks = new JSV.SVSet();
    let atoms = new JSV.SVSet();

    // Determine what selection is
    if (selection) {
      if (selection.toString() == 'Cluster') {
        cluster = selection;
      } else if (selection.toString() == 'SVSet' || Array.isArray(selection)) {
        const first_item = selection[0];
        if (first_item) {
          if (selection[0].toString() == 'Atom') {
            atoms = selection;
          } else if (selection[0].toString() == 'Peak') {
            peaks = selection;
          }
        }
      } else {
        console.log("Unknown Selection")
      }
    }

    // Determine peaks, atoms, cluster
    if (peaks.present()) {
      cluster = this.cluster_from_peaks(peaks);
    }
    if (atoms.present()) {
      cluster = this.cluster_from_atoms(atoms);
    }
    if (cluster) {
      peaks = cluster.peaks();
      atoms = cluster.atoms();
    }

    // Select atoms in structure
    if (struct) {
      if(struct.use_jsmol && typeof Jmol !== "undefined") {
        if(struct.nmr_1H()) {
          let selected = struct.LCA_from_hydrogens(atoms);
          Jmol.script(jmol_jspectraviewer, `select carbon; colour halos grey; select atomno = ${selected[0].id.replace(/\D/g, '')}; colour halos blue;`)
        } else {
          Jmol.script(jmol_jspectraviewer, `select carbon; colour halos grey; select atomno = ${atoms[0].id.replace(/\D/g, '')}; colour halos blue;`)
        }
      }
      else {
        struct.selected_atoms = struct.LCA_and_nmr_atoms(atoms);
      }
    }
    // Select peaks in viewer
    sv.selection._elements = peaks.unique();
    sv.draw();
    // Select peaks and atoms in table
    self.selected_peaks = peaks;
    if (struct) {
      self.selected_atoms = struct.LCA_from_nmr_atoms(atoms);
    }
    // Select cluster row in table
    table.selectAll('tbody tr').classed('selected', false);
    if (cluster) {
      table.select('tbody tr[data-cluster-path-id='+cluster.path_id()+']').classed('selected', true);
    }
  }

  SVAssignments2D.prototype.cluster_from_peaks = function(peaks) {
    let cluster;
    this.sv.clusters().forEach(function(c) {
      if (c.peaks().equals(peaks)) {
        cluster = c;
      }
    });
    return cluster
  }

  SVAssignments2D.prototype.cluster_from_atoms = function(atoms) {
    let cluster;
    const struct = this.struct;
    const nmr_atoms = struct.nmr_atoms_from_atoms(atoms);
    this.sv.clusters().forEach(function(c) {
      const cluster_nmr_atoms = struct.nmr_atoms_from_atoms(c.atoms());
      if (cluster_nmr_atoms.equals(nmr_atoms)) {
        cluster = c;
      }
    });
    return cluster
  }

  // Given an element in a table row, find the cluster represented by the row.
  SVAssignments2D.prototype.cluster_from_table_child = function(element) {
    if (!element) { return; }
    let cluster;
    let found = false;
    let currentNode = element;
    while (!found) {
      localName = currentNode.localName.toUpperCase();
      if (localName == 'TR') {
        found = true;
        const path_id = d3v7.select(currentNode).attr('data-cluster-path-id');
        if (path_id) {
          cluster = this.sv.clusters(path_id);
        }
      } else if (localName == 'TABLE') {
        found = true
      } else {
        currentNode = currentNode.parentNode;
        if (!currentNode) {
          found = true;
        }
      }
    }
    return cluster
  }

  /////////////////////////////////////////////////////////////////////////////
  // Assignment Properties (setters/getters)
  /////////////////////////////////////////////////////////////////////////////
  Object.defineProperties(SVAssignments2D.prototype, {
    'selected_atoms': {
      get: function() {
        const self = this;
        const selected = new JSV.SVSet();
        this.container.selectAll('.atom-badge.selected').each(function(){
          const atom_id = d3v7.select(this).attr('data-atom-id');
          selected.push(self.struct.atoms(atom_id));
        });
        return selected
      },
      set: function(atoms) {
        const self = this;
        const container = this.container;
        container.selectAll('.atom-badge').classed('selected', false);
        atoms.forEach(function(atom) {
          container.selectAll('.atom-badge[data-atom-id="' + atom.id + '"]').classed('selected', true);
        });
      }
    },
    'selected_peaks': {
      get: function() {
        const self = this;
        const selected = new JSV.SVSet();
        this.container.selectAll('.peak-badge.selected').each(function(){
          const peak_id = d3v7.select(this).attr('data-peak-id');
          selected.push(self.sv.peaks(peak_id));
        });
        return selected
      },
      set: function(peaks) {
        const self = this;
        const container = this.container;
        container.selectAll('.peak-badge').classed('selected', false);
        peaks.forEach(function(peak) {
          container.select('.peak-badge[data-peak-id="' + peak.path_id() + '"]').classed('selected', true);
        });
      }
    },
    'edit_mode': {
      get: function() {
        return this._edit_mode;
      },
      set: function(mode) {
        const self = this;
        const sv = self.sv;
        self._edit_mode = mode;
        if (self._edit_mode) {
          sv.selection.element_type = 'peak';
          sv.selection.allow_multiselect = true;
          sv.selection.allow_adjust = true;
          sv.selection.allow_width_adjust = true;
          sv.selection.allow_peak_creation = true;
          if (sv.highlight) sv.highlight.element_type = 'peak';
        } else {
          sv.selection.element_type = 'cluster';
          sv.selection.allow_multiselect = true;
          sv.selection.allow_adjust = false;
          sv.selection.allow_width_adjust = false;
          sv.selection.allow_peak_creation = false;
          if (sv.highlight) sv.highlight.element_type = 'cluster';
        }
        self.update_table();
        // self.select_peaks_and_atoms(sv.selection.peaks());
        sv.draw();
      }
    },
    'nmr_nucleus': {
      get: function() {
        return this._nmr_nucleus;
      },
      set: function(nucleus) {
        this._nmr_nucleus = nucleus;
        this.columns = this.get_columns();
        if(this.struct) this.struct.nmr_nucleus = nucleus;
        this.update_table_header();
        this.update_table();
      }
    }
  });



  JSV.SVAssignments2D = SVAssignments2D;

})(JSpectraViewer);
JSpectraViewer.initialize();
