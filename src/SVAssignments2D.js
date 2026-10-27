import * as d3 from 'd3';
import * as JSV from './Utils.js';
import { SVSet } from './SVSet.js';

// Size of the zoom window around a cross peak, as a fraction of the full axis range
const ZOOM_FRACTION = 0.1;

// Nucleus label for each element, used in the table headers
const NUCLEUS_LABELS = { H: '1H', C: '13C', N: '15N' };

export class SVAssignments2D {
    /**
     * Assignment table for 2D NMR spectra (e.g. 1H-13C HSQC).
     * Each row is a cross peak: a direct dimension (x) shift, an indirect
     * dimension (y) shift and the assigned atoms. Clicking a row zooms the
     * viewer to the cross peak and highlights its atoms in the structure;
     * clicking an atom in the structure selects its row.
     *
     *  Option                | Default     | Description
     *  ----------------------|-------------------------------------------------
     *  containerID           | _undefined_ | CSS selector of the element to draw the table in
     *  data                  | _undefined_ | [assignmentData] from DataParser (2D-NMR)
     *
     * @param {SpectraViewer2D} sv The viewer
     * @param {Object} options Options described above
     */
    constructor(sv, options = {}) {
        this.sv = sv;
        this.struct = sv.structure;
        this.container_id = options.containerID;
        this.container = d3.select(this.container_id);
        const compound = options.data && options.data[0];
        this.rows = this.build_rows(compound ? compound.cross_peaks : []);
        this.selected_row = undefined;

        // Replace any table left from a previously loaded spectrum
        this.container.selectAll('table.jsv-assignment-table').remove();
        this.table = this.container.append('table').classed('jsv-assignment-table', true);
        this.update_table();
    }

    toString() {
        return 'SVAssignments2D';
    }

    // nmrML atom refs look like "C1" or "H13". Only use the atom if its element
    // matches the ref, since some files number hydrogens differently from the atom list.
    resolve_refs(refs) {
        const atoms = new SVSet();
        if (!this.struct) return atoms;
        refs.forEach((ref) => {
            const symbol = ref.replace(/[^A-Za-z]/g, '');
            const atom = this.struct.atoms(ref.replace(/\D/g, ''));
            if (atom && (!symbol || atom.symbol === symbol)) atoms.push(atom);
        });
        return atoms;
    }

    build_rows(cross_peaks) {
        return (cross_peaks || []).map((cross_peak, index) => {
            const x_atoms = this.resolve_refs(cross_peak.x.atom_refs);
            const y_atoms = this.resolve_refs(cross_peak.y.atom_refs);
            let hydrogens = new SVSet(x_atoms.filter((atom) => atom.is('H')).concat(y_atoms.filter((atom) => atom.is('H'))));
            const heavy_atoms = new SVSet(x_atoms.filter((atom) => !atom.is('H')).concat(y_atoms.filter((atom) => !atom.is('H'))));

            // A 1H-X cross peak is a one-bond correlation: if the hydrogen refs can't be
            // matched to hydrogens bonded to the heavy atom, use the bonded hydrogens instead.
            const bonded_hydrogens = new SVSet();
            heavy_atoms.forEach((atom) => bonded_hydrogens.merge(atom.bonded_Hs()));
            const refs_have_hydrogens = cross_peak.x.atom_refs.concat(cross_peak.y.atom_refs).some((ref) => /^H/i.test(ref));
            if (refs_have_hydrogens && bonded_hydrogens.length > 0 && !hydrogens.some((h) => bonded_hydrogens.includes(h))) {
                hydrogens = bonded_hydrogens;
            }

            return {
                number: index + 1,
                x: cross_peak.x.center,
                y: cross_peak.y.center,
                x_refs: cross_peak.x.atom_refs,
                y_refs: cross_peak.y.atom_refs,
                atoms: new SVSet(heavy_atoms.concat(hydrogens)),
            };
        });
    }

    nucleus_label(refs, fallback) {
        const symbol = refs && refs[0] ? refs[0].replace(/[^A-Za-z]/g, '').toUpperCase() : '';
        return NUCLEUS_LABELS[symbol] || fallback;
    }

    get_columns() {
        const formatter = d3.format('.2f');
        const first = this.rows[0];
        const x_label = this.nucleus_label(first && first.x_refs, 'F2');
        const y_label = this.nucleus_label(first && first.y_refs, 'F1');

        const atoms_html = (row) => {
            if (this.struct && row.atoms.length > 0) {
                return row.atoms.map((atom) =>
                    "<div class='jsv-badge atom-badge atom-badge-symbol-" + atom.symbol + "' data-atom-id='" + atom.id + "'>" + atom.symbol + atom.id + "</div>"
                ).join('');
            }
            return row.x_refs.concat(row.y_refs).map((ref) => "<div class='jsv-badge atom-badge'>" + ref + "</div>").join('');
        };

        return [
            { heading: 'Row No.', class: 'cluster-number center', html: (row) => row.number },
            { heading: x_label + ' Shift (ppm)', class: 'center', html: (row) => formatter(row.x) },
            { heading: y_label + ' Shift (ppm)', class: 'center', html: (row) => formatter(row.y) },
            { heading: 'Atom No.', class: 'atom-cell', html: atoms_html },
        ];
    }

    update_table() {
        const columns = this.get_columns();
        const table = this.table;
        table.selectAll('*').remove();

        table.append('thead')
            .append('tr')
            .append('th')
            .attr('class', 'center')
            .attr('style', 'font-size: larger')
            .attr('colspan', columns.length)
            .text('Peak Assignment Table');
        table.select('thead')
            .append('tr')
            .selectAll('th')
            .data(columns).enter()
            .append('th')
            .attr('class', (col) => col.class)
            .text((col) => col.heading);

        const tbody = table.append('tbody');
        if (this.rows.length === 0) {
            tbody.append('tr').append('td')
                .attr('colspan', columns.length)
                .style('text-align', 'center')
                .html('No Assignments');
            return;
        }
        tbody.selectAll('tr')
            .data(this.rows).enter()
            .append('tr')
            .attr('data-row-number', (row) => row.number)
            .selectAll('td')
            .data((row) => columns.map((col) => ({ class: col.class, html: col.html(row) })))
            .enter()
            .append('td')
            .attr('class', (cell) => cell.class)
            .html((cell) => cell.html);

        const self = this;
        tbody.selectAll('tr').on('click', function(event, row) {
            self.select_row(row, true);
        });
    }

    // Select a row: highlight it in the table, highlight its atoms in the
    // structure and mark its cross peak. Optionally zoom to the cross peak.
    select_row(row, zoom) {
        this.selected_row = row;
        this.table.selectAll('tbody tr').classed('selected', (r) => r === row);
        if (this.struct && typeof this.struct.highlight_atoms === 'function') {
            this.struct.highlight_atoms(row ? row.atoms : new SVSet());
        }
        if (row && zoom) {
            this.zoom_to(row);
        } else {
            this.sv.draw();
        }
    }

    zoom_to(row) {
        const sv = this.sv;
        const x_boundary = sv.boundary.x.domain();
        const y_boundary = sv.boundary.y.domain();
        const dx = Math.abs(x_boundary[1] - x_boundary[0]) * ZOOM_FRACTION / 2;
        const dy = Math.abs(y_boundary[1] - y_boundary[0]) * ZOOM_FRACTION / 2;
        sv.move_to([[row.x - dx, row.x + dx], [row.y - dy, row.y + dy]], 500);
    }

    // Called by SVStructure when an atom is clicked in the 3D viewer. Selects the
    // row containing the atom; repeated clicks cycle through rows that share it.
    on_structure_atom_click(atom) {
        const matches = this.rows.filter((row) => row.atoms.some((a) => a.id == atom.id));
        if (matches.length === 0) return;
        const current = matches.indexOf(this.selected_row);
        const row = matches[(current + 1) % matches.length];
        this.select_row(row, true);
        const node = this.table.select("tbody tr[data-row-number='" + row.number + "']").node();
        if (node && node.scrollIntoView) node.scrollIntoView({ block: 'nearest' });
    }

    // Draw a marker on each cross peak. Called from SpectraViewer2D.draw, on the
    // same (translated) context and scales as the contours.
    draw_markers(context, scale) {
        const x_range = scale.x.range();
        const y_range = scale.y.range();
        const x_min = Math.min(...x_range), x_max = Math.max(...x_range);
        const y_min = Math.min(...y_range), y_max = Math.max(...y_range);

        context.save();
        context.font = JSV.pixel(11) + 'px Sans-Serif';
        context.textBaseline = 'middle';
        this.rows.forEach((row) => {
            const px = scale.x(row.x);
            const py = scale.y(row.y);
            if (px < x_min || px > x_max || py < y_min || py > y_max) return;
            const selected = row === this.selected_row;
            const radius = JSV.pixel(selected ? 8 : 5);

            context.beginPath();
            context.arc(px, py, radius, 0, 2 * Math.PI);
            context.lineWidth = JSV.pixel(selected ? 2.5 : 1.5);
            context.strokeStyle = selected ? '#00a000' : 'rgba(220, 120, 0, 0.9)';
            if (selected) {
                context.fillStyle = 'rgba(0, 200, 0, 0.3)';
                context.fill();
            }
            context.stroke();

            context.fillStyle = selected ? '#007000' : 'rgba(180, 90, 0, 0.9)';
            context.fillText(row.number, px + radius + JSV.pixel(2), py - radius);
        });
        context.restore();
    }
}
