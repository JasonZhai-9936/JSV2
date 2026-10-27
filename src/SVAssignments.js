import * as d3 from 'd3';
import * as JSV from './Utils.js';
import { SVSet } from './SVSet.js';
import { SVEvents } from './SVEvents.js';



export class SVAssignments {

    constructor(sv, options = {}) {
        const self = this;
        this.sv = sv;
        this.struct = sv.structure;
        console.log("SVAssignment.struct", this.struct)
        this.container_id = options.containerID;
        this.container = d3.select(this.container_id);
        this.table = this.container.append('table').classed('jsv-assignment-table', true);
        console.log("Table initialized:", this.container_id, this.container, this.table)
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
        // this.edit_mode = true; // calls update_table
    }

    nmr_1H() {
        return this.nmr_nucleus && this.nmr_nucleus.toUpperCase() == '1H'
    }

    nmr_13C() {
        return this.nmr_nucleus && this.nmr_nucleus.toUpperCase() == '13C'
    }

    get_columns() {
        const self = this;
        const struct = self.struct;
        const formatter = d3.format('.2f');
    
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
          { heading: "No. H's", class: 'center', html: function(row)  { 
              // If atoms list is empty, return 0
              if (!row.atoms || row.atoms.length === 0) return 0;

              // Check if we are in Proton NMR mode
              if (self.nmr_1H()) {
                  let h_count = 0;
                  row.atoms.forEach(atom => {
                      if (atom.symbol === 'H') {
                          // It's explicitly a Hydrogen, count it
                          h_count++; 
                      } else {
                          // It's a heavy atom (e.g. Carbon), count its attached Hydrogens
                          // Note: This relies on the structure having explicit hydrogens
                          const attached_Hs = atom.bonded_Hs ? atom.bonded_Hs() : [];
                          h_count += attached_Hs.length;
                      }
                  });
                  // If we found attached H's, return that count. 
                  // If 0 (maybe implicit H structure), fall back to row.atoms.length
                  return h_count > 0 ? h_count : row.atoms.length;
              }
              
              // Default/Carbon NMR behavior
              return row.atoms.length; 
          }},

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

    // Table code concept: https://vis4.net/blog/posts/making-html-tables-in-d3-doesnt-need-to-be-a-pain/
    update_table_header() {
        this.table.select('thead').remove();
        this.table.append('thead')
            .append('tr')
            .append('th')
            .attr('class', 'center')
            .attr('style', 'font-size: larger')
            .attr('colspan', this.columns.length)
            .text("Peak Assignment Table")
        this.table.select('thead')
            .append('tr')
            .selectAll('th')
            .data(this.columns).enter()
            .append('th')
            .attr('class', function(col) { return col.class })
            .text(function(col) { return col.heading });
    }

    
    update_table() {
        // console.log('TABLE UPDATED')
        const self = this;
        const struct = this.struct;
        const table = this.table;
        const columns = this.columns;
        // Get row data from SV
        let rows = [];
        // Make the cluster navigator static
        this.sv._cluster_navigation.static_compounds = this.sv.compounds();

        let row;
        console.log("this.sv.clusters()", this.sv.clusters())
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
        d3.selectAll('.atom-badge').each(function() {
        const badge = d3.select(this);
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

    make_sortable() {
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
            const atom_id = d3.select(evt.item).attr('data-atom-id');
            if (atom_id) {
                atom = struct.atoms(atom_id);
            }
            if (atom && new_cluster && old_cluster) {
                const moved_atoms = struct.nmr_atoms_from_atoms([atom]);
                atoms = new_cluster.atoms().merge(moved_atoms).unique();
                new_cluster._atoms = atoms;
                old_cluster._atoms = new SVSet(old_cluster._atoms.filter(function(a) { return !moved_atoms.contains(a) }));
                self.update_table();
            }
            self.select_peaks_and_atoms(self.selected_atoms);
            },
            onEnd: function(evt) {
            const atom_id = d3.select(evt.item).attr('data-atom-id');
            if (atom_id) {
                atom = struct.atoms(atom_id);
                self.selected_atoms = new SVSet(atom);
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
            const peak_id = d3.select(evt.item).attr('data-peak-id');
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
            const peak_id = d3.select(evt.item).attr('data-peak-id');
            if (peak_id) {
                peak = sv.peaks(peak_id);
                self.selected_peaks = new SVSet(peak);
                self.select_peaks_and_atoms(self.selected_peaks);
            }
            }
        })

        });
    }

    add_table_events() {
        const self = this;
        const table = this.table;
        const sv = this.sv;
        const struct = this.struct;

        table.selectAll('tbody tr').on('click', function() {
            table.selectAll('tbody tr').classed('selected', false);
            d3.select(this).classed('selected', true);
            const path_id = d3.select(this).attr('data-cluster-path-id');
            const cluster = sv.clusters(path_id);
            console.log("SVAssignment.add_table_events, cluster:", cluster);
            self.select_peaks_and_atoms(cluster);
            sv.move_to_peaks(cluster.peaks(), sv._cluster_navigation.speed, 2);
        })

        // table.selectAll('tbody .atom-badge').on('click', function() {
        //     let selected_atoms = self.selected_atoms;
        //     const atom_id = d3.select(this).attr('data-atom-id');
        //     const clicked_atom = struct.atoms(atom_id);
        //     if (d3.event.shiftKey) {
        //         window.getSelection().removeAllRanges()
        //         if (selected_atoms.contains(clicked_atom)) {
        //             selected_atoms = selected_atoms.remove(clicked_atom);
        //         } else {
        //             selected_atoms.push(clicked_atom);
        //         }
        //     } else {
        //         selected_atoms = new SVSet(clicked_atom);
        //     }
        //     self.selected_atoms = selected_atoms;
        //     self.select_peaks_and_atoms(self.selected_atoms);
        //     sv.move_to_peaks(self.cluster_from_atoms(self.selected_atoms).peaks(), sv._cluster_navigation.speed, 2);
        //     d3.event.stopPropagation();
        // })

        table.selectAll('tbody .atom-badge').on('click', function(event) {
            let selected_atoms = self.selected_atoms;
            const atom_id = d3.select(this).attr('data-atom-id');
            const clicked_atom = struct.atoms(atom_id);

            if (event.shiftKey) {
                window.getSelection().removeAllRanges();
                if (selected_atoms.contains(clicked_atom)) {
                    selected_atoms = selected_atoms.remove(clicked_atom);
                } else {
                    selected_atoms.push(clicked_atom);
                }
            } else {
                selected_atoms = new SVSet(clicked_atom);
            }

            self.selected_atoms = selected_atoms;
            self.select_peaks_and_atoms(self.selected_atoms);
            sv.move_to_peaks(
                self.cluster_from_atoms(self.selected_atoms).peaks(),
                sv._cluster_navigation.speed,
                2
            );

            event.stopPropagation();
        });



        // table.selectAll('tbody .peak-badge').on('click', function() {
        //     let selected_peaks = self.selected_peaks;
        //     const peak_id = d3.select(this).attr('data-peak-id');
        //     const clicked_peak = sv.peaks(peak_id);
        //     if (d3.event.shiftKey) {
        //         window.getSelection().removeAllRanges()
        //         if (selected_peaks.contains(clicked_peak)) {
        //             selected_peaks = selected_peaks.remove(clicked_peak);
        //         } else {
        //             selected_peaks.push(clicked_peak);
        //         }
        //     } else {
        //         selected_peaks = new SVSet(clicked_peak);
        //     }
        //     self.selected_peaks = selected_peaks;
        //     self.select_peaks_and_atoms(self.selected_peaks);
        //     sv.move_to_peaks(self.selected_peaks, sv._cluster_navigation.speed, 2);
        //     d3.event.stopPropagation();
        // })

        table.selectAll('tbody .peak-badge').on('click', function(event) {
            let selected_peaks = self.selected_peaks;
            const peak_id = d3.select(this).attr('data-peak-id');
            const clicked_peak = sv.peaks(peak_id);

            if (event.shiftKey) {
                window.getSelection().removeAllRanges();
                if (selected_peaks.contains(clicked_peak)) {
                    selected_peaks = selected_peaks.remove(clicked_peak);
                } else {
                    selected_peaks.push(clicked_peak);
                }
            } else {
                selected_peaks = new SVSet(clicked_peak);
            }

            self.selected_peaks = selected_peaks;
            self.select_peaks_and_atoms(self.selected_peaks);
            sv.move_to_peaks(self.selected_peaks, sv._cluster_navigation.speed, 2);

            event.stopPropagation();
        });



        // // Add Atoms
        // table.selectAll('tbody tr .add-atoms').on('click', function() {
        //     const cluster = self.cluster_from_table_child(this);
        //     // Add to spectra viewer
        //     if (cluster) {
        //         cluster._atoms = struct.nmr_atoms_from_atoms(struct.selected_atoms);
        //     }
        //     d3.event.stopPropagation();
        //     // Add to table cell
        //     self.update_table();
        //     self.select_peaks_and_atoms(cluster);
        //     return false
        // });

        table.selectAll('tbody tr .add-atoms').on('click', function(event) {
            const cluster = self.cluster_from_table_child(this);

            // Add to spectra viewer
            if (cluster) {
                cluster._atoms = struct.nmr_atoms_from_atoms(struct.selected_atoms);
            }

            event.stopPropagation();

            // Add to table cell
            self.update_table();
            self.select_peaks_and_atoms(cluster);

            return false;
        });


    }

    add_sv_events() {
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

    add_struct_events() {
        console.log("SVAssignment.add_struct_events, struct:", this.struct);
        const self = this;
        const struct = this.struct;
        struct.on('structure-click.assign', function() {
            struct.selected_atoms = struct.LCA_and_nmr_atoms(struct.selected_atoms);
            console.log("SVAssignment.add_struct_events, selected_atoms:", struct.selected_atoms);
            self.select_peaks_and_atoms(struct.selected_atoms);
        });
    }

    // Provide a single cluster or a SVSet of peaks or atoms
    // If a single cluster or the peaks and atoms make up a single cluster
    // then atoms, peaks and the cluster row will be selected.
    // If no cluster can be selected then just the peaks or atoms are selected.
    select_peaks_and_atoms(selection) {
        const self = this;
        const sv = this.sv;
        const struct = this.struct;
        const table = this.table;
        let cluster;
        let peaks = new SVSet();
        let atoms = new SVSet();

        // Determine what selection is
        if (selection) {
            console.log("SVAssignment.select_peaks_and_atoms, selection:", selection);
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
            console.log("SVAssignment.select_peaks_and_atoms, peaks.present:", peaks.present(), "cluster:", cluster);
        }
        if (atoms.present()) {
            cluster = this.cluster_from_atoms(atoms);
            console.log("SVAssignment.select_peaks_and_atoms, atoms.present:", atoms.present(), "cluster:", cluster);
        }
        if (cluster) {
            peaks = cluster.peaks();
            atoms = cluster.atoms();
            console.log("SVAssignment.select_peaks_and_atoms, cluster:", cluster, "peaks:", peaks, "atoms:", atoms);
        }

        // Select atoms in structure
        if (struct) {
            let atoms_to_highlight = new SVSet();

            if (atoms && atoms.length > 0) {
                // Handle Proton vs Carbon NMR logic
                if (struct.nmr_1H()) {
                    atoms_to_highlight = struct.LCA_from_hydrogens(atoms);
                } else {
                    atoms_to_highlight = atoms;
                }
            }

            // Call the 3Dmol highlighter we added in Step 1
            if (typeof struct.highlight_atoms === 'function') {
                struct.highlight_atoms(atoms_to_highlight);
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

    cluster_from_peaks(peaks) {
        let cluster;
        this.sv.clusters().forEach(function(c) {
        if (c.peaks().equals(peaks)) {
            cluster = c;
        }
        });
        return cluster
    }

    cluster_from_atoms(atoms) {
        let cluster;
        const struct = this.struct;
        console.log("SVAssignment.cluster_from_atoms, atoms:", atoms)
        console.log("SVAssignment.cluster_from_atoms, struct:", this.struct)
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
    cluster_from_table_child(element) {
        if (!element) { return; }
        let cluster;
        let found = false;
        let currentNode = element;
        while (!found) {
        localName = currentNode.localName.toUpperCase();
        if (localName == 'TR') {
            found = true;
            const path_id = d3.select(currentNode).attr('data-cluster-path-id');
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

    get selected_atoms() {
        const self = this;
        const selected = new SVSet();
        this.container.selectAll('.atom-badge.selected').each(function () {
          const atom_id = d3.select(this).attr('data-atom-id');
          selected.push(self.struct.atoms(atom_id));
        });
        return selected;
    }
    
    // setter for selected_atoms
    set selected_atoms(atoms) {
        const container = this.container;
        container.selectAll('.atom-badge').classed('selected', false);
        atoms.forEach(atom => {
            container
            .selectAll(`.atom-badge[data-atom-id="${atom.id}"]`)
            .classed('selected', true);
        });
    }
    
    // getter for selected_peaks
    get selected_peaks() {
        const self = this;
        const selected = new SVSet();
        this.container.selectAll('.peak-badge.selected').each(function () {
            const peak_id = d3.select(this).attr('data-peak-id');
            selected.push(self.sv.peaks(peak_id));
        });
        return selected;
    }
    
    // setter for selected_peaks
    set selected_peaks(peaks) {
        const container = this.container;
        container.selectAll('.peak-badge').classed('selected', false);
        peaks.forEach(peak => {
            container
            .select(`.peak-badge[data-peak-id="${peak.path_id()}"]`)
            .classed('selected', true);
        });
    }
    
    // getter for edit_mode
    get edit_mode() {
        return this._edit_mode;
    }
    
    // setter for edit_mode
    set edit_mode(mode) {
        const sv = this.sv;
        this._edit_mode = mode;
        if (this._edit_mode) {
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
        this.update_table();
        this.select_peaks_and_atoms(sv.selection.peaks());
        sv.draw();
    }
    
    // getter for nmr_nucleus
    get nmr_nucleus() {
    return this._nmr_nucleus;
    }
    
    // setter for nmr_nucleus
    set nmr_nucleus(nucleus) {
    this._nmr_nucleus = nucleus;
    this.columns = this.get_columns();
    if (this.struct) this.struct.nmr_nucleus = nucleus;
    this.update_table_header();
    this.update_table();
    }
}



export class SVClusterNavigator {

    constructor(sv, id) {
        const self = this;
        this.sv = sv;
        this.id = id;
        this.speed = 400;
        this.active_ids = [];
        this.container = d3.select(id);
        // If set at some point the navigator will always show this compound
        // If undefined the current selection will be use
        this.static_compounds;
        this.table = this.container.append('table').style('display', 'none')
            .attr('class', 'jsv-cluster-navigator');
        this.thead = this.table.append('thead');
        // this.thead.html('<tr><th>Compound</th><th>Concentration</th><th>Clusters</th></tr>')
        this.tbody = this.table.append('tbody');
    
        sv.on('selection-add.cluster-navigator', function() {
          self.table.style('display', 'block');
          self.update_table();
        });
        if (sv.selection.present()) sv.trigger('selection-add.cluster-navigator');
    
        sv.on('selection-remove.cluster-navigator', function() {
          self.update_table();
        });
    
        sv.on('adjust-end.cluster-navigator', function() {
          self.update_table();
        });
    
        sv.on('selection-empty.cluster-navigator', function() {
          if (!self.static_compounds) {
            self.table.style('display', 'none');
          }
        });
    
    
        d3.select('.jsv-cluster-navigator')
            .on('click', function(event) {
              const target = d3.select(event.target);
              window.getSelection().removeAllRanges()
              if (target.classed('cluster-unit')) {
                self.move_to_cluster(target.node());
              } else if (target.classed('jsv-cluster-nav')) {
                self.cycle_clusters(target);
              }
            });
    }

    update_table() {
        const compounds = this.static_compounds || this.sv.selection.compounds();
        // this.tbody.html( update_rows(this.sv.selection.compounds()) );
        this.tbody.html( this.update_rows(compounds) );
        if (this.active_ids.length > 0) {
            d3.selectAll(this.active_ids.join(',')).classed('active', true);
        }
        this.sv.trigger('cluster-navigator-updated')
    }

    update_rows(compounds) {
        // console.log("compounds", compounds)
        let nav = this;
        return compounds.map(function(c) { 
            console.log("in SVAssignment, c:", c) 
            return nav.compound_row(c); 
        }).join('');
    }

    compound_row(compound) {
        let html = '<tr>'
        if (compound.name !== undefined) {
            html += '<td>' + compound.name + '</td>'
        }
        if (compound.concentration !== undefined) {
            html += '<td>' + compound.display_concentration() + '</td>'
        }
        html += '<td>' + this.cluster_cell(compound.clusters()) + '</td></tr>';
        return html
        // return '<tr><td>'+ compound.name + '</td><td>' + compound.display_concentration() + '</td><td>' + cluster_cell(compound.clusters()) + '</td></tr>';
    }

    cluster_cell(clusters) {
        let self = this;
        console.log("CLUSTERS:", clusters)
        // clusters.order_by('center', true);
        clusters = clusters.sort((a, b) => b.meta.nmrml_cluster_index - a.meta.nmrml_cluster_index);
        console.log("CLUSTERS-ORDERED:", clusters)
        const nav_arrows = "<span class='jsv-cluster-nav jsv-cluster-nav-left'>&#10094;</span>&nbsp;<span class='jsv-cluster-nav jsv-cluster-nav-right'>&#10095;</span>";
        return nav_arrows + clusters.map(function(c) { return self.cluster_div(c); }).join('');
    }
    cluster_div(cluster) {
        return '<div class="cluster-unit" style="display: inline-block; text-decoration: underline; text-decoration-style: dashed;" id="' + cluster.path_id() + '">' + cluster.center().toFixed(2) + '</div>';
    }

    cycle_clusters(target) {
        const forward = target.classed('jsv-cluster-nav-right');
        console.log("target", target)
        const parent = d3.select(target.node().parentNode);
        console.log("parent", parent);
        const active = parent.select('.active');
        const cluster_units = Array.from(parent.selectAll('.cluster-unit'));
        console.log("cluster_units", cluster_units);
        const cluster_ids = cluster_units.map(function (c) {
            return c.id;
        });
        let index = active.node() ? cluster_ids.indexOf(active.node().id) : -1;

        if (index < 0) {
            index = 0;
        } else if (forward) {
            index = (index + 1 < cluster_ids.length) ? index + 1 : 0;
        } else {
            index = (index - 1 < 0) ? cluster_ids.length - 1 : index -1;
        }
        const new_cluster = parent.select('#' + cluster_ids[index]);
        this.move_to_cluster(new_cluster.node());
    }

    move_to_cluster(cluster_node) {
        const cluster = this.sv.clusters(cluster_node.id);
        this.sv.move_to_peaks(cluster.peaks(), this.speed, 2);
        d3.select(cluster_node.parentNode).selectAll('.cluster-unit').classed('active', false);
        d3.select(cluster_node).classed('active', true);
        this.active_ids = d3.selectAll('.cluster-unit.active')[0].map(function(c) { return '#' + c.id; });
        sv.selection.clear();
        sv.selection.add_element(cluster);
    }

    detach() {
        this.sv.off('.cluster-navigator');
        this.table.remove();
    }

    get static_compounds() {
        return this._static_compounds;
    }

    set static_compounds(compounds) {
        this._static_compounds = compounds;
        this.table.style('display', 'block');
        this.update_table();
    }
    


}