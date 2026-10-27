import $ from 'jquery';
// import * as Jmol from "./lib/jsmol/JSmol.min.js";
import * as d3 from 'd3';
import * as JSV from './Utils.js';
import { SVSet } from './SVSet.js';
import { SVEvents } from './SVEvents.js';
import X2JS from 'x2js';
window.X2JS = X2JS;
import * as $3Dmol from '3dmol';


const ELEMENT_COLORS = {
    'C': '#017700',
    'H': '#fea500'
}







export default class SVStructure {
    /**
     * The SVStructure object controls the displaying of a chemical structure.
     * SVStructure requires the [X2JS library](https://github.com/abdmob/x2js) to read structures in nmrML format.
     * The following options can be set when creating a
     * [SpectraViewer](SpectraViewer.js.html):
     *
     *  Option                | Default     | Description
     *  ----------------------|-------------------------------------------------
     *  container_id          | _undefined_ | ID of dom element where the structure will be draw (e.g. '#my-structure')
     *  width                 | 200         | Width of strucutre panel
     *  height                | 200         | Height of strucutre panel
     *  data                  | _undefined_ | Structure data as a string. It can be in molfile or nmrML format.
     *  format                | mol         | Structure data format: 'mol' or 'nmrML'. The nmrML format is similar to CML.
     *  show_hydrogen         | false       | Show hydrogens in structure
     *  show_atom_numbers     | true        | Show atom numbers in structure
     *  nmr_nucleus           | _undefined_ | NMR nucleus ('13C', '1H', or _undefined_)
     *
     *
     * @param {Object} options Options for how the Structure should work. Described below.
     * @return {SVSelection}
     */
    constructor(sv, options) {
        this.sv = sv;
        console.log("SVStructure constructor starting", options)
        this.container_id = options.containerID
        this.width = options.width || 200,   // width of the panel
        this.height = options.height || 200,  // height of the panel
        this.container = d3.select(this.container_id); //element id or the element itself to be the container for the image
        this.container.classed('js-structure', true);
        this.data = options.data;
        this.formatted_data = this.reformat_props_for_3dmol(options.data[0].structure_data.structure);
        this.format = options.format || 'mol';
        this.x_scale;     // linear d3 x scale function
        this.y_scale;     // linear d3 y scale function
        this.avgL = 0;    // scaled average bond length (for font size scaling)

        this.show_hydrogen = JSV.default_for(options.show_hydrogen, false);
        this.show_atom_numbers = JSV.default_for(options.show_atom_numbers, false);
        this.use_jsmol = JSV.default_for(options.use_jsmol, false);
        this.nmr_nucleus = options.nmr_nucleus;
        this.interactive_1H = true;
        // this._atoms = new SVSet(); // Removed: handled in reformat_props_for_3dmol
        // this._bonds = new SVSet(); // Removed: handled in reformat_props_for_3dmol

        // console.log("SVStructure constructor", this.data)
        // if (this.data) {
        //     this.read_data(this.data, this.format);
        // }

        // Setup SVEvents
        this.handlers = new SVEvents();
        this.on = this.handlers.on
        this.off = this.handlers.off
        this.trigger = this.handlers.trigger

        this.init3DMol();
    }

    init3DMol() {
        console.log("3DMol initializing", $3Dmol, this.data)
        // 1. Save to 'this' so the class can use it later
        this.viewer = $3Dmol.createViewer('mol-3d', {
            backgroundColor: 'black',
        });
        
        // 2. EXPOSE TO WINDOW for console testing
        window.myViewer = this.viewer; 

        // Update references below to use 'this.viewer' instead of 'viewer'
        const model = this.viewer.addModel();
        model.addAtoms(this.formatted_data['atoms'])

        this.viewer.setStyle({}, { 
            stick: { radius: 0.15 }, 
            sphere: { radius: 0.4, colorscheme: "Jmol"}
        });
        this.viewer.zoomTo();
        this.viewer.render();
        console.log("3DMol initialized", this.viewer, model);
        
        // Label display state: 'full' = H43, 'symbol' = H, 'none' = no labels
        this.labelMode = 'full';
        this.addAtomLabels();
        
        // Add click handler for atoms - clicking an atom selects its cluster
        const self = this;
        this.viewer.setClickable({}, true, function(atom, viewer, event, container) {
            if (!atom || !atom.serial) return;
            
            console.log('3D atom clicked:', atom.serial);
            
            // Get the atom object from the structure
            const atomObj = self.sv.structure.atoms(atom.serial);
            if (!atomObj) {
                console.log('Atom object not found for serial', atom.serial);
                return;
            }

            // 2D assignment tables (SVAssignments2D) select and zoom to their own cross peaks
            if (self.sv.assignment_table && typeof self.sv.assignment_table.on_structure_atom_click === 'function') {
                self.sv.assignment_table.on_structure_atom_click(atomObj);
                return;
            }

            // Find which cluster contains this atom (must pass array of atom objects, not IDs)
            const cluster = self.sv.assignment_table.cluster_from_atoms([atomObj]);
            
            if (cluster) {
                console.log('Found cluster for atom', atom.serial, ':', cluster);
                // Select the cluster (highlights molecule and row)
                self.sv.assignment_table.select_peaks_and_atoms(cluster);
                // Zoom the graph to the peak
                self.sv.move_to_peaks(
                    cluster.peaks(),
                    self.sv._cluster_navigation.speed,
                    2
                );
            } else {
                console.log('No cluster found for atom', atom.serial);
            }
        });
        
        console.log("3D atom click handler installed");
    }

    // Add labels to hydrogen atoms
    addAtomLabels() {
        if (!this.viewer) return;
        
        // Remove existing labels first
        this.viewer.removeAllLabels();
        
        if (this.labelMode === 'none') return;
        
        // Add labels to all hydrogen atoms
        const self = this;
        const hydrogenAtoms = this.formatted_data['atoms'].filter(a => a.elem === 'H');
        
        hydrogenAtoms.forEach(function(atom) {
            let labelText = '';
            if (self.labelMode === 'full') {
                labelText = atom.elem + atom.serial;  // "H43"
            } else if (self.labelMode === 'symbol') {
                labelText = atom.elem;  // "H"
            }
            
            if (labelText) {
                self.viewer.addLabel(labelText, {
                    position: {x: atom.x, y: atom.y, z: atom.z},
                    fontSize: 12,
                    fontColor: 'white',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    backgroundOpacity: 0.5
                });
            }
        });
        
        this.viewer.render();
    }
    
    // Set label display mode and update labels
    setLabelMode(mode) {
        this.labelMode = mode;  // 'full', 'symbol', or 'none'
        this.addAtomLabels();
    }

    // Highlight specific atoms by their serial ID using 3Dmol.js
    highlight_atoms(atoms) {
        if (!this.viewer) return;

        // 1. Clear previous shapes 
        this.viewer.removeAllShapes();

        // 2. Reset the molecule to default style
        this.viewer.setStyle({}, { 
            stick: { radius: 0.15 }, 
            sphere: { radius: 0.4, colorscheme: "Jmol"}
        });

        // 3. Add a transparent green sphere "halo" around selected atoms
        if (atoms && atoms.length > 0) {
            atoms.forEach(atom => {
                // Ensure we have valid coordinates
                if (typeof atom.x !== 'undefined') {
                    this.viewer.addSphere({
                        center: {x: atom.x, y: atom.y, z: atom.z},
                        radius: 1.2,        // Larger than the atom to create a "halo"
                        color: '#00FF00',   // Green
                        alpha: 0.6,         // 0.6 transparency 
                        clickable: false    
                    });
                }
            });
        }

        this.viewer.render();
    }

    // FIXED VERSION - handles both nmrML formats correctly
    reformat_props_for_3dmol(data) {
        this._atoms = new SVSet();
        let formatted_atoms = { 'atoms': [], 'bonds': [], 'bondOrders': [] };
    
        // ID mapping: maps string IDs (like "1", "a1", etc.) to array indices
        const idToIndexMap = {};
        const serialToIndexMap = {}; // Also map serial numbers to indices

        // 1. Build atom list and create mappings
        data.atomList.atom.forEach((atom, i) => {
            const rawId = atom['@_id'];
            const serial = parseInt(rawId.replace(/\D/g, ''));
            const x = parseFloat(atom['@_x']);
            const y = parseFloat(atom['@_y']);
            const z = parseFloat(atom['@_z']);

            // Map BOTH the raw ID and the serial number to this index
            idToIndexMap[rawId] = i;
            serialToIndexMap[serial] = i;

            formatted_atoms['atoms'].push({
                serial: serial,
                elem: atom['@_elementType'],
                x: x, 
                y: y, 
                z: z,
                bonds: [],
                bondOrder: []
            });

            const svAtom = new Atom({
                id: serial,
                symbol: atom['@_elementType'],
                x, y, z,
                number: serial
            });
        
            // Explicitly set display_id for the assignment table's Atom no. col
            svAtom.display_id = serial.toString();
        
            this._atoms.push(svAtom);
        });

        console.log("Atom ID mappings:", { idToIndexMap, serialToIndexMap });

        // 2. Process bonds with robust parsing
        data.bondList.bond.forEach((bond, bondIndex) => {
            // Split by whitespace and filter out empty strings
            let bondRefs = bond['@_atomRefs'].split(/\s+/).filter(ref => ref.trim() !== '');
            
            if (bondRefs.length !== 2) {
                console.warn(`Bond ${bondIndex} has unexpected atomRefs format:`, bond['@_atomRefs'], 'parsed as:', bondRefs);
                return;
            }
            
            let id1 = bondRefs[0];
            let id2 = bondRefs[1];
        
            // Try to find indices using multiple strategies
            let idx1 = idToIndexMap[id1];
            let idx2 = idToIndexMap[id2];
            
            // Fallback: try parsing as serial numbers
            if (idx1 === undefined || idx2 === undefined) {
                const serial1 = parseInt(id1.replace(/\D/g, ''));
                const serial2 = parseInt(id2.replace(/\D/g, ''));
                
                if (idx1 === undefined) {
                    idx1 = serialToIndexMap[serial1];
                }
                if (idx2 === undefined) {
                    idx2 = serialToIndexMap[serial2];
                }
            }
            
            let order = parseInt(bond['@_order']);

            if (idx1 !== undefined && idx2 !== undefined) {
                // Add bond connections to formatted atoms
                formatted_atoms['atoms'][idx1].bonds.push(idx2);
                formatted_atoms['atoms'][idx1].bondOrder.push(order);
                formatted_atoms['atoms'][idx2].bonds.push(idx1);
                formatted_atoms['atoms'][idx2].bondOrder.push(order);
                
                // Store bond info
                formatted_atoms['bonds'].push({
                    index: bondIndex,
                    a1: formatted_atoms['atoms'][idx1].serial,
                    a2: formatted_atoms['atoms'][idx2].serial,
                    order: order
                });
                formatted_atoms['bondOrders'].push(order);
                
                // Connect atoms in internal registry (for LCA/highlighting)
                const serial1 = formatted_atoms['atoms'][idx1].serial;
                const serial2 = formatted_atoms['atoms'][idx2].serial;
                const atom1 = this.atoms(serial1);
                const atom2 = this.atoms(serial2);
                
                if (atom1 && atom2) {
                    atom1._bonded_atoms.push(atom2);
                    atom2._bonded_atoms.push(atom1);
                } else {
                    console.warn(`Could not find SVAtom instances for serials: ${serial1}, ${serial2}`);
                }
            } else {
                console.error(`Could not find indices for bond atoms: ${id1} (idx: ${idx1}), ${id2} (idx: ${idx2})`);
            }
        });

        console.log("Formatted atoms for 3Dmol:", formatted_atoms);
        console.log(`Total atoms: ${formatted_atoms.atoms.length}, Total bonds: ${formatted_atoms.bonds.length}`);
        
        return formatted_atoms;
    }

    nmr_1H() {
        return this.nmr_nucleus && this.nmr_nucleus.toUpperCase() == '1H'
    }

    nmr_13C() {
        return this.nmr_nucleus && this.nmr_nucleus.toUpperCase() == '13C'
    }


    /**
     * Initializes the viewport and appends it to the element identified
     * by the given identifier. The linear d3 x- and y-scales are set
     * to translate from the viewport coordinates to the mol coordinates.
     */
    initSVG() {
        const self = this;
        const container = this.container;
        console.log("SVStructure initSVG self", self)
        // x minimum and maximum
        const xExtrema = d3.extent(self.atoms(), function (atom) {
            return atom.x;
        });
        // y minimum and maximum
        const yExtrema = d3.extent(self.atoms(), function (atom) {
            return atom.y;
        });

        // dimensions of molecule graph
        const m = [15, 15, 20, 15];   // margins
        self.margins = m;
        let wp = self.width - m[1] - m[3];   // width
        let hp = self.height - m[0] - m[2];   // height

        // Scale the image to the contrained dimension
        const container_ratio = wp / hp;
        self.structure_ratio = ( xExtrema[1] - xExtrema[0] ) / ( yExtrema[1] - yExtrema[0] );
        const constrained_dim = (container_ratio >= self.structure_ratio) ? 'height' : 'width';
        if (constrained_dim == 'height') {
        wp = hp * self.structure_ratio;
        } else {
        hp = wp / self.structure_ratio;
        }
        self.wp = wp;
        self.hp = hp;
        // X scale will fit all values within pixels 0-w
        self.x_scale = d3.scaleLinear().domain([xExtrema[0], xExtrema[1]]).range([m[1], wp-m[3]]);
        // Y scale will fit all values within pixels h-0
        self.y_scale = d3.scaleLinear().domain([yExtrema[0], yExtrema[1]]).range([hp-m[2], m[0]]);

        // Adjust container
        container.style({
            height: self.height + 'px',
            width: self.width + 'px'
        })

        self.add_menu_bar();
        if(!this.use_jsmol) self.add_resizer();

        // Remove any previous structure
        // container.select('svg').remove();
        container.select('div.js-graph-div').remove();
        let graph = null;
        if(!this.use_jsmol) {
        self.graph_div = container.append('div')
            .attr('class', 'js-graph-div')
            .style({
                width: wp + 'px',
                height: hp + 'px',
                margin: '0 auto',
                'margin-top': ((self.height - hp - m[0]) / 2) + 'px',
                // border: '1px solid black'
            })
        graph = self.graph_div.append('svg:svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .append('svg:g');
        }
        return graph;
    };

    // add_menu_bar() {
    //     const self = this;
    //     // Remove any previous menu bar
    //     self.container.select('div.menubar').remove();
    //     const menu = self.container.insert('div', ":first-child")
    //         .attr('class', 'menubar');
    //     self.button_toggle_H = menu.append('div')
    //         .attr('class', 'toggle-hydrogens menu-button button-on')
    //         .style('width', '60px')
    //         .text('Show H')
    //         .on('click', function() {
    //         self.toggleH();
    //         d3.event.stopPropagation();
    //         });
    //     self.button_toggle_numbers = menu.append('div')
    //         .attr('class', 'toggle-atom-ids menu-button button-on')
    //         .text('Show #')
    //         .style('width', '60px')
    //         // .style('padding-bottom', '50px')
    //         .on('click', function() {
    //             self.toggleAtomNumbers();
    //             d3.event.stopPropagation();
    //         });
    //     let feedback = "Click and drag to rotate the structure";
    //     self.feedback_div = menu.append('p')
    //         .attr('class', 'feedback')
    //         .text(feedback);
    //     self.menu_buttons_width  = self.button_toggle_numbers.offsetWidth + self.button_toggle_numbers.offsetWidth;
    //     // self.menu_title = menu.append('div')
    //     //     .attr('class', 'structure-title')
    //     //     .style('width', self.menu_buttons_width + 'px')
    //     //     .text(self.title);
    // }

    add_menu_bar() {
        const self = this;

        // Remove any previous menu bar
        self.container.select('div.menubar').remove();

        const menu = self.container.insert('div', ":first-child")
            .attr('class', 'menubar');

        self.button_toggle_H = menu.append('div')
            .attr('class', 'toggle-hydrogens menu-button button-on')
            .style('width', '60px')
            .text('Show H')
            .on('click', function(event) {
                self.toggleH();
                event.stopPropagation(); // ✅ updated
            });

        self.button_toggle_numbers = menu.append('div')
            .attr('class', 'toggle-atom-ids menu-button button-on')
            .text('Show #')
            .style('width', '60px')
            .on('click', function(event) {
                self.toggleAtomNumbers();
                event.stopPropagation(); // ✅ updated
            });

        let feedback = "Click and drag to rotate the structure";
        self.feedback_div = menu.append('p')
            .attr('class', 'feedback')
            .text(feedback);

        self.menu_buttons_width = self.button_toggle_numbers.offsetWidth + self.button_toggle_H.offsetWidth;
    }



    add_resizer() {
        const self = this;
        const m = self.margins;
        const wp = self.wp;
        const hp = self.hp;
        const body = d3.select('body');
        // self.resizer = self.container.append('div')
        //     .attr('class', 'js-structure-resizer')
        //     .on('mousedown.resizer', function() {
        //         let x_mouse = d3.event.x;
        //         let y_mouse = d3.event.y;
        //         d3.event.preventDefault();
        //         body.on('mousemove.resizer', function() {
        //             // window.getSelection().removeAllRanges()
        //             dx_mouse = d3.event.x - x_mouse;
        //             dy_mouse = d3.event.y - y_mouse;
        //             x_mouse = d3.event.x
        //             y_mouse = d3.event.y
        //             self.height = self.height + dy_mouse;
        //             self.width = self.width + dx_mouse;
        //             self.container.style({
        //             height: self.height + 'px',
        //             width: self.width + 'px'
        //             })
        //             const container_ratio = self.width / self.height;
        //             const constrained_dim = (container_ratio >= self.structure_ratio) ? 'height' : 'width';
        //             let ratio;
        //             if (constrained_dim == 'height') {
        //             ratio = (self.height - m[0] - m[2]) / hp;
        //             } else {
        //             ratio = (self.width - m[1] - m[3]) / wp;
        //             }
        //             self.graph.attr('transform', 'scale(' + ratio + ',' + ratio + ')');
        //             const graph_div_height = hp * ratio;
        //             const graph_div_top_margin = (self.height - graph_div_height - m[0]) / 2;
        //             self.graph_div.style({
        //             width: wp * ratio + 'px',
        //             height: hp * ratio + 'px',
        //             'margin-top': graph_div_top_margin + 'px'
        //             })
        //             self.menu_title.style('width', self.width - self.menu_buttons_width + 'px');
        //             self.trigger('structure-resize');
        //         });
        //         body.on('mouseup.resizer', function() {
        //             body.on('mousemove.resizer', null);
        //             body.on('mouseup.resizer', null);
        //         });
        //     })
        //     .on('click.resizer', function() {
        //     d3.event.stopPropagation();
        //     });
        self.resizer = self.container.append('div')
            .attr('class', 'js-structure-resizer')
            .on('mousedown.resizer', function(event) {
                let x_mouse = event.x;
                let y_mouse = event.y;

                event.preventDefault();

                body.on('mousemove.resizer', function(event) {
                    // window.getSelection().removeAllRanges()
                    let dx_mouse = event.x - x_mouse;
                    let dy_mouse = event.y - y_mouse;
                    x_mouse = event.x;
                    y_mouse = event.y;

                    self.height = self.height + dy_mouse;
                    self.width = self.width + dx_mouse;

                    self.container
                        .style('height', self.height + 'px')
                        .style('width', self.width + 'px');

                    const container_ratio = self.width / self.height;
                    const constrained_dim = (container_ratio >= self.structure_ratio) ? 'height' : 'width';

                    let ratio;
                    if (constrained_dim === 'height') {
                        ratio = (self.height - m[0] - m[2]) / hp;
                    } else {
                        ratio = (self.width - m[1] - m[3]) / wp;
                    }

                    self.graph.attr('transform', `scale(${ratio},${ratio})`);

                    const graph_div_height = hp * ratio;
                    const graph_div_top_margin = (self.height - graph_div_height - m[0]) / 2;

                    self.graph_div
                        .style('width', wp * ratio + 'px')
                        .style('height', hp * ratio + 'px')
                        .style('margin-top', graph_div_top_margin + 'px');

                    self.menu_title.style('width', self.width - self.menu_buttons_width + 'px');

                    self.trigger('structure-resize');
                });

                body.on('mouseup.resizer', function(event) {
                    body.on('mousemove.resizer', null);
                    body.on('mouseup.resizer', null);
                });
            })
            .on('click.resizer', function(event) {
                event.stopPropagation();
            });

        // Draw the resizer icon
        const resizer_path = [
        {x: 9, y: 4}, {x: 4, y: 4}, {x: 4, y: 9}, {x: 4, y: 4}, // Top Left
        {x: 16, y: 16}, // Join line
        {x: 16, y: 11}, {x: 16, y: 16}, {x: 11, y: 16} // Bottom Right
        ];
        const line_function = d3.svg.line()
            .x(function (d) {
            return d.x;
            })
            .y(function (d) {
            return d.y;
            })
            .interpolate("linear");
        const resizer_svg = self.resizer.append('svg')
            .style({
            width: '100%',
            height: '100%'
            })
            .append('path')
            .attr("d", line_function(resizer_path))
            .attr("stroke", "grey")
            .attr("stroke-width", 1)
            .attr("stroke-linejoin", 'round')
            .attr("stroke-linecap", 'round')
            .attr("fill", "none");

    }

    /**
     * Draws the bonds onto the SVG element. Note that the bonds are drawn
     * first before anything else is added.
     */
    drawBonds() {
        const self = this;
        const graph = this.graph;
        const x = this.x_scale;
        const y = this.y_scale;
        this.create_bond_functions();
        this.bonds().forEach(function(bond) {
        let dxx1;
        let dyy1;
        let dxx2;
        let dyy2;
        const a1 = bond.a1;
        const a2 = bond.a2;
        let bond_path;

        // apply backing by calculating the unit vector and
        // subsequent scaling: shortens the drawn bond
        const dox = a2.x - a1.x,
            doy = a2.y - a1.y,
            l = Math.sqrt(dox * dox + doy * doy),
            dx = (dox / l) * (0.2),
            dy = (doy / l) * (0.2);

        // get adjusted x and y coordinates
        const x1 = a1.x + dx,
            y1 = a1.y + dy,
            x2 = a2.x - dx,
            y2 = a2.y - dy;

        // update average bond length for font scaling
        self.avgL += distance(x(x1), y(y1), x(x2), y(y2));

        let off,    // offset factor for stereo bonds
            xOff,   // total offset in x
            yOff,   // total offset in y
            xyData = []; // two dimensional data array
        if (bond.order === 1) {                 // single bond
            if (bond.stereo === 1) {            // single wedge bond
            const length = distance(x1, y1, x2, y2);
            off = 0.1;
            xOff = off * (y2 - y1) / length;
            yOff = off * (x1 - x2) / length;
            xyData = [
                [x1, y1],
                [x2 + xOff, y2 + yOff],
                [x2 - xOff, y2 - yOff]
            ];
            bond_path = graph.append('svg:path')
                .style('fill', 'black')
                .style('stroke-width', 1)
                .attr('d', self.wedgeBond(xyData));
            } else if (bond.stereo === 6) {     // single hash bond
            off = 0.2;
            xOff = off * (y2 - y1) / l;
            yOff = off * (x1 - x2) / l;
            dxx1 = x2 + xOff - x1;
            dyy1 = y2 + yOff - y1;
            dxx2 = x2 - xOff - x1;
            dyy2 = y2 - yOff - y1;
            for (let j = 0.05; j <= 1; j += 0.15) {
                xyData.push(
                    [x1 + dxx1 * j, y1 + dyy1 * j],
                    [x1 + dxx2 * j, y1 + dyy2 * j]
                );
            }

            bond_path = graph.append('svg:path')
                .style('fill', 'none')
                .style('stroke-width', 1)
                .attr('d', self.hashBond(xyData))
                .attr('stroke', 'black');
            } else if (bond.stereo === 4) {     // single wiggly bond
            off = 0.2;
            xOff = off * (y2 - y1) / l;
            yOff = off * (x1 - x2) / l;
            dxx1 = x2 + xOff - x1;
            dyy1 = y2 + yOff - y1;
            dxx2 = x2 - xOff - x1;
            dyy2 = y2 - yOff - y1;
            for (let j = 0.05; j <= 1; j += 0.1) {
                if (xyData.length % 2 === 0) {
                xyData.push(
                    [x1 + dxx1 * j, y1 + dyy1 * j]
                );
                } else {
                xyData.push(
                    [x1 + dxx2 * j, y1 + dyy2 * j]
                );
                }
            }

            bond_path = graph.append('svg:path')
                .attr('d', self.wigglyBond(xyData))
                .attr('fill', 'none')
                .style('stroke-width', 1)
                .attr('stroke', 'black');
            } else {                                // single plain bond
            xyData = [
                [x1, y1], [x2, y2]
            ];
            bond_path = graph.append('svg:path')
                .attr('d', self.plainBond(xyData))
                .attr('stroke-width', '1')
                .attr('stroke-linecap', 'round')
                .attr('stroke-linejoin', 'round')
                .attr('stroke', 'black');
            }
        } else if (bond.order === 2) {          // double bond
            off = 0.1;
            xOff = off * (y2 - y1) / l;
            yOff = off * (x1 - x2) / l;
            xyData = [
            [x1 + xOff, y1 + yOff], [x2 + xOff, y2 + yOff],
            [x1 - xOff, y1 - yOff], [x2 - xOff, y2 - yOff]
            ];
            bond_path = graph.append('svg:path').attr('d', self.plainBond(xyData))
                .attr('stroke-width', '1')
                .style('fill', 'none')
                .attr('stroke-linecap', 'round')
                .attr('stroke-linejoin', 'round')
                .attr('stroke', 'black');
        } else if (bond.order === 3) {          // triple bond
            off = 0.15;
            xOff = off * (y2 - y1) / l;
            yOff = off * (x1 - x2) / l;
            xyData = [
            [x1, y1], [x2, y2],
            [x1 + xOff, y1 + yOff], [x2 + xOff, y2 + yOff],
            [x1 - xOff, y1 - yOff], [x2 - xOff, y2 - yOff]
            ];
            bond_path = graph.append('svg:path')
                .attr('d', self.plainBond(xyData))
                .attr('stroke-width', '1')
                .attr('stroke-linecap', 'round')
                .attr('stroke-linejoin', 'round')
                .attr('stroke', 'black');
        }
        if (a1.is('H') || a2.is('H')) {
            bond_path.classed('bond-H', true);
        }
        });
        self.avgL /= this.bonds().length; // get average bond length
    };

    /**
     * Draws the atoms onto the SVG element. Note that the atoms are drawn
     * on top of the bonds.
     */
    drawAtoms() {
        const graph = this.graph;
        const avgL = this.avgL;
        const x = this.x_scale;
        const y = this.y_scale;
        this.atoms().forEach(function(atom) {
        const g = graph.append('svg:g')
            .attr('transform', 'translate(' + x(atom.x) + ',' + y(atom.y) + ')');
        g.attr('class', 'atom');
        // Add NMR classes
        if ( (atom.is('C') || atom.is('N') ) && (atom.bonded_Hs().length > 0) ) {
            g.classed('nmr-1h', true);
        }
        if ( atom.is('C') ) {
            g.classed('nmr-13c', true);
        }
        if (atom.is('H')) {
            g.classed('atom-H', true);
            if (atom.isBondedTo('C') || atom.isBondedTo('N')) {
            g.classed('nmr-1h', true);
            }
        }
        g.attr('data-atom-number', atom.number);
        g.attr('data-atom-id', atom.id);
        // draw a white circle underneath the text to clean up bonds
        g.append('svg:circle')
            // hack: magic number for scaling
            .attr('r', Math.ceil(avgL / 3))
            .attr('fill', 'white')
            .attr('opacity', '1');
        // draw a transparent circle underneath the text for highlighting
        g.append('svg:circle')
            // hack: magic number for scaling
            .attr('r', Math.ceil(avgL / 2))
            .attr('fill-opacity', '0')
            .attr('class', 'overlay');
        // draw the text string
        g.append('text')
            // hack: magic number for scaling
            .attr('dy', Math.ceil(avgL / 4.5))
            .attr('text-anchor', 'middle')
            .attr('font-family', 'sans-serif')
            // hack: magic number for scaling
            .attr('font-size', Math.ceil(avgL / 1.5))
            .attr('fill', atom.color())
            .text(atom.symbol);
        // Draw atom id
        g.append('text')
            // hack: magic number for scaling
            .attr('dy', Math.ceil(avgL / 2) + 2)
            // .attr('dx', Math.ceil(avgL / 3))
            .attr('text-anchor', 'middle')
            .attr('font-family', 'sans-serif')
            // hack: magic number for scaling
            .attr('font-size', Math.ceil(avgL / 2.5))
            .attr('stroke', '#FFF')
            .attr('stroke-width', '2px')
            .attr('fill', '#595')
            .attr('paint-order', 'stroke')
            .classed('atom-id', true)
            .text(atom.display_id);

        if (atom.charge !== 0) {
            let c = atom.charge;
            if (c < 0) {
            c = (c === -1) ? '-' : (c + '-');
            } else {
            c = (c === +1) ? '+' : (c + '+');
            }
            g.append('text')
                .attr('dx', +1 * Math.ceil(avgL / 3))
                .attr('dy', -1 * Math.ceil(avgL / 4.5))
                .attr('text-anchor', 'left')
                .attr('font-family', 'sans-serif')
                // hack: magic number for scaling (half of symbol size)
                .attr('fill', atom.color())
                .attr('font-size', Math.ceil(avgL / 3))
                .text(c);
        }

        if (atom.mass !== 0) {
            g.append('text')
                .attr('dx', -2 * Math.ceil(avgL / 3))
                .attr('dy', -1 * Math.ceil(avgL / 4.5))
                .attr('text-anchor', 'left')
                .attr('font-family', 'sans-serif')
                // hack: magic number for scaling (half of symbol size)
                .attr('font-size', Math.ceil(avgL / 3))
                .attr('fill', atom.color())
                .text(atom.mass);
        }
        })
    };

    /**
     * Calculates the Euclidean distance between two points.
     *
     * @param {number} x1 A x value of first point
     * @param {number} y1 A y value of first point
     * @param {number} x2 A x value of second point
     * @param {number} y2 A y value of second point
     * @returns {number} the Euclidean distance
     */
    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    };

    create_bond_functions() {
        const x = this.x_scale;
        const y = this.y_scale;
        /**
         * d3 line function using the SVG path mini language to draw a plain bond.
         */
        this.plainBond = d3.svg.line()
            .interpolate(function (points) {
            let path = points[0][0] + ',' + points[0][1];
            for (let i = 1; i < points.length; i++) {
                if (i % 2 === 0) {
                path += 'M' + points[i][0] + ',' + points[i][1];
                } else {
                path += 'L' + points[i][0] + ',' + points[i][1];
                }
            }
            return path;
            })
            .x(function (d) {
            return x(d[0]);
            })
            .y(function (d) {
            return y(d[1]);
            });

        /**
         * d3 line function using the SVG path mini language to draw a wedge bond.
         */
        this.wedgeBond = d3.svg.line()
            .x(function (d) {
            return x(d[0]);
            })
            .y(function (d) {
            return y(d[1]);
            });

        /**
         * d3 line function using the SVG path mini language to draw a hash bond.
         */
        this.hashBond = d3.svg.line()
            .interpolate(function (points) {
            let path = points[0][0] + ',' + points[0][1];
            for (let i = 1; i < points.length; i++) {
                if (i % 2 === 0) {
                path += 'M' + points[i][0] + ',' + points[i][1];
                } else {
                path += 'L' + points[i][0] + ',' + points[i][1];
                }
            }
            return path;
            })
            .x(function (d) {
            return x(d[0]);
            })
            .y(function (d) {
            return y(d[1]);
            });

        /**
         * d3 line function using the SVG path mini language to draw a wiggly bond.
         */
        this.wigglyBond = d3.svg.line()
            .interpolate('cardinal')
            .x(function (d) {
            return x(d[0]);
            })
            .y(function (d) {
            return y(d[1]);
            });
    }


    /*
    * Atom properties containing the CPK color values.
    */
    AtomColors = {
        H: '#000000',
        He: '#FFC0CB',
        Li: '#B22222',
        B: '#00FF00',
        C: '#000000',
        N: '#8F8FFF',
        O: '#F00000',
        F: '#DAA520',
        Na: '#0000FF',
        Mg: '#228B22',
        Al: '#808090',
        Si: '#DAA520',
        P: '#FFA500',
        S: '#FFC832',
        Cl: '#00FF00',
        Ca: '#808090',
        Ti: '#808090',
        Cr: '#808090',
        Mn: '#808090',
        Fe: '#FFA500',
        Ni: '#A52A2A',
        Cu: '#A52A2A',
        Zn: '#A52A2A',
        Br: '#A52A2A',
        Ag: '#808090',
        I: '#A020F0',
        Ba: '#FFA500',
        Au: '#DAA520'
    };

//   /////////////////////////////////////////////////////////////////////////////
//   // Structure Properties (setters/getters)
//   /////////////////////////////////////////////////////////////////////////////
//   Object.defineProperties(SVStructure.prototype, {
//     'selected_atoms': {
//       get: function() {
//         const self = this;
//         const selected = new SVSet();
//         this.container.selectAll('.atom.selected').each(function(){
//           const atom_id = d3.select(this).attr('data-atom-id');
//           selected.push(self.atoms(atom_id));
//         });
//         return selected
//       },
//       set: function(atoms) {
//         const self = this;
//         const container = this.container;
//         container.selectAll('.atom').classed('selected', false);
//         atoms.forEach(function(atom) {
//           container.select('.atom[data-atom-id="' + atom.id + '"]').classed('selected', true);
//         });
//         self.add_partially_selected_highlighting(atoms);
//       }
//     }
//   });

    get selectedAtoms() {
        const selected = new SVSet();
        this.container.selectAll('.atom.selected').each(function () {
        const atomId = d3.select(this).attr('data-atom-id');
        selected.push(this.atoms(atomId));
        });
        return selected;
    }

    set selectedAtoms(atoms) {
        this.container.selectAll('.atom').classed('selected', false);
        atoms.forEach(atom => {
        this.container.select(`.atom[data-atom-id="${atom.id}"]`).classed('selected', true);
        });
        this.add_partially_selected_highlighting(atoms);
    }

    add_partially_selected_highlighting(atoms) {
        const self = this;
        const container = this.container;
        container.selectAll('.atom').classed('selected-partially', false);
        if (self.nmr_1H()) {
        const hydrogens = self.hydrogens_from_atoms(atoms);
        let parents = hydrogens.map(function (h) {
            return h.bonded_atoms(1)
        });
        parents = new SVSet(parents).unique();
        parents.forEach(function(p) {
            let all_Hs_in_list = true;
            const child_Hs = p.bonded_Hs();
            child_Hs.forEach(function(child_H) {
            if (!hydrogens.contains(child_H)) {
                all_Hs_in_list = false;
            }
            });
            if (!all_Hs_in_list) {
            container.select('.atom[data-atom-id="' + p.id + '"]').classed('selected-partially', true);
            }
        });
        }
    }

    async read_data(data, format) {
        console.log("Reading data...", data, format)
        if (format == 'mol') {
            await this.read_mol(data);
        } else if (format == 'nmrml') {
            console.log('Reading nmrml format');
            await this.read_nmrml(data);
        } else {
        console.log('Format not recognized: ' + format + '. Must be one of the following: nmrml, mol')
        }
    }

  // Read structure from Chemical Markup Language (nmrml)
  // MUST start with <structure> tag
  // Requires x2js
  // <structure>
  //   <atomList>
  //     <atom id="a1" elementType="C" x="0.6667733333333334" y="-0.38490666666666673"/>
  //     <atom id="a2" elementType="C" x="-0.6667733333333334" y="-1.1550933333333335"/>
  //   </atomList>
  //   <bondList>
  //     <bond atomRefs="a1 a2" order="1"/>
  //   </bondList>
  // </structure>
    async read_nmrml(nmrml) {
        // console.log("Reading nmrml...")
        // const self = this;
        // // window.X2JS = window.X2JS || require('x2js');
        // if (!window.X2JS) {
        //     console.log("X2JS needs to be installed to read nmrML: https://github.com/abdmob/x2js");
        //     return
        // } else {
        //     console.log('xml2json found', window.X2JS)
        // }
        // const x2js = new window.X2JS();
        // console.log("x2js", x2js)
        // // const x2js = new window.X2JS();
        // // const json = x2js.xml_str2json(nmrml);
        // const json = x2js.xml2js(nmrml);
        // console.log("json", json)
        // this.data = nmrml;
        // // Empyt any atoms and bonds
        // // Validate
        // if (!(json.structure && json.structure.atomList && json.structure.atomList.atom && Array.isArray(json.structure.atomList.atom))) {
            //     console.log('nmrML not formatted correctly: no atoms found');
            //     return
            // }
            // if (!(json.structure && json.structure.bondList && json.structure.bondList.bond && Array.isArray(json.structure.bondList.bond))) {
                //     console.log('nmrML not formatted correctly: no bonds found');
                //     return
                // }
                
        // THIS IS THE OTHER HALF OF parse_assignment_data from np-mrd's jspec. The input comes from options.assignmentTable.structure
        // which was parsed by DataParser.js
        const self = this;
        this._atoms = new SVSet();
        this._bonds = new SVSet();
        console.log("Reading nmrml structure...", nmrml);
        // Parse atoms
        nmrml.structure.atomList.atom.forEach(function(json_atom, index) {
            console.log("Parsing atom", json_atom);
            const atom = new Atom({
                id: json_atom._id.replace(/\D/g, ''),
                x: parseFloat(json_atom._x),
                y: parseFloat(json_atom._y),
                symbol: json_atom._elementType,
                number: index + 1, // base-1 atom-index
            });
            atom.display_id = atom.id;
            self._atoms.push(atom);
        })

        // Parse Bonds
        nmrml.structure.bondList.bond.forEach(function(json_bond) {
            const atom_ids = json_bond._atomRefs.split(/\s+/);
            const a1 = self.atoms(atom_ids[0].replace(/\D/g, ''));
            const a2 = self.atoms(atom_ids[1].replace(/\D/g, ''));
            const bond = new Bond({
                a1: a1,
                a2: a2,
                order: parseInt(json_bond._order)
                // values 0 (plain),1 (wedge),4 (wiggly),6 (hash)
                // stereo: parseInt(json_bond._??)
        });
        self._bonds.push(bond);
        // Connect atoms with bonds and connected atoms
        a1._bonds.push(bond);
        a2._bonds.push(bond);
        a1._bonded_atoms.push(a2);
        a2._bonded_atoms.push(a1);
        });
        if(this.use_jsmol) this.generate_molfile(nmrml);


        // self.addAtomDisplayIDs();
        await self.draw();
    }

    generate_molfile(json){
        console.log("Generating molfile...")
        let self = this;
        let atom_coordinate = function(coord){
        let formatted = "  "
        if(typeof coord === "undefined"){
            formatted += "  0.0000"
        } else {
            coord = parseFloat(coord).toFixed(4)
            if (coord >= 0) formatted += " ";
            if (Math.abs(coord) < 10) formatted += " ";
            formatted += `${coord}`
        }
        return formatted
        }

        self.mol_file = `\nJSpectraViewer\n\n ${json.structure.atomList.atom.length} ${json.structure.bondList.bond.length} 0 0 0 0 0 0 0 0999 V2000`
        json.structure.atomList.atom.forEach(function(json_atom) {
        self.mol_file += `\n${atom_coordinate(json_atom._x)}${atom_coordinate(json_atom._y)}${atom_coordinate(json_atom._z)}`
        self.mol_file += ` ${json_atom._elementType}   0  0  0  0  0  0  0  0  0  0  0  0`
        })

        json.structure.bondList.bond.forEach(function(json_bond) {
        let atom_ids = json_bond._atomRefs.split(/\s+/);
        const id_1 = parseInt(atom_ids[0].replace(/\D/g,''))
        const id_2 = parseInt(atom_ids[1].replace(/\D/g,''))
        self.mol_file += (id_1 < 10 ) ? `\n  ${id_1}` : `\n ${id_1}`
        self.mol_file += (id_2 < 10 ) ? `  ${id_2}` : ` ${id_2}`
        self.mol_file += `  ${json_bond._order}  0  0  0  0`
        })
        self.mol_file += '\nM  END'
        return
    }


    async read_mol(molfile) {
        let props;
        const self = this;
        console.log("Reading molfile...", molfile)
        const lines = molfile.split(/\r\n|\n/),
            counter = lines[3].match(/\d+/g),
            nAtoms = parseFloat(counter[0]),
            nBonds = parseFloat(counter[1]);
        const offset = 4; // the first three lines belong to the header block
        this.title = lines[1];
        this.data = molfile;
        // Empyt any atoms and bonds
        this._atoms = new SVSet();
        this._bonds = new SVSet();
        // Parse Atom Block
        for (let i = offset; i < nAtoms + offset; i++) {
        let atom = lines[i].match(/-*\d+\.\d+|\w+/g);
        atom = new Atom({
            x: parseFloat(atom[0]),
            y: parseFloat(atom[1]),
            symbol: atom[3],
            number: i - offset + 1, // base-1 atom-index
            mass: 0,    // deprecated
            charge: 0   // deprecated
        });
        // atom.id = 'a' + atom.number;
        atom.id = atom.number;
        atom.display_id = atom.number;
        this._atoms.push(atom);
        }
        // Parse Bond Block
        for (let j = nAtoms + offset; j < nAtoms + nBonds + offset; j++) {
        let bond = lines[j].match(/\d+/g);
        const a1 = this.atoms(parseInt(bond[0]));
        const a2 = this.atoms(parseInt(bond[1]));
        bond = new Bond({
            a1: a1,
            a2: a2,
            // values 1, 2, 3
            order: parseInt(bond[2]),
            // values 0 (plain),1 (wedge),4 (wiggly),6 (hash)
            stereo: parseInt(bond[3])
        });
        this._bonds.push(bond);
        // Connect atoms with bonds and connected atoms
        a1._bonds.push(bond);
        a2._bonds.push(bond);
        a1._bonded_atoms.push(a2);
        a2._bonded_atoms.push(a1);
        }
        // Parse Properties Block
        for (let k = (nAtoms + nBonds) + offset; k < lines.length; k++) {
            if (lines[k].indexOf('M  ISO') !== -1) {
                props = lines[k].match(/-*\d+/g);
                for (let l = 0, m = 1; l < props[0]; l++, m += 2) {
                this.atoms(props[m]).mass = parseInt(props[m + 1], 10);
                }
            } else if (lines[k].indexOf('M  CHG') !== -1) {
                props = lines[k].match(/-*\d+/g);
                for (let l = 0, m = 1; l < props[0]; l++, m += 2) {
                atoms[props[m] - 1].charge = parseInt(props[m + 1], 10);
                this.atoms(props[m]).charge = parseInt(props[m + 1], 10);
                }
            }
        }
        // self.addAtomDisplayIDs();
        await self.draw();
    }

    loadJsmolScript(url, callback){
        console.log("Loading JSmol script from", url)
        let script = document.createElement("script")
        script.type = "text/javascript";

        if (script.readyState){  //IE
            script.onreadystatechange = function(){
                if (script.readyState === "loaded" ||
                    script.readyState === "complete"){
                script.onreadystatechange = null;
                callback();
                }
            };
        }
        else {  //Others
            script.onload = function(){
                callback();
            };
        }
        script.src = url;
        document.getElementsByTagName("head")[0].appendChild(script);
    }

    atom_picked(){
        // let sv = window.sv;
        // let assignment_table = sv.assignment_table
        // let structure = window.sv.structure;
        // console.log("IN ATOM_PICKED", Jmol)
        // console.log("jmol_jspectraviewer", jmol_jspectraviewer)
        if (arguments.length < 3) return;
        let sv = this.sv;
        console.log("this", this, window)
        console.log("sv", sv)
        let assignment_table = sv.assignment_table
        let structure = this
        console.log("atom_picked", structure, this.structure, sv)

        let index  = arguments[2] + 1;
        let atoms = new SVSet(structure.atoms(index));
        let peaks = new SVSet();

        // Jmol.script(jmol_jspectraviewer, `select carbon; colour halos grey; select atomno = ${index}; colour halos blue;`)

        let cluster = assignment_table.cluster_from_atoms(atoms);

        if (cluster) {
            peaks = cluster.peaks();
            atoms = cluster.atoms();
        }

        // Select peaks in viewer
        sv.selection._elements = peaks.unique();
        sv.draw();

        // Select peaks and atoms in table
        assignment_table.selected_peaks = peaks;
        assignment_table.selected_atoms = structure.LCA_from_nmr_atoms(atoms);

        // Select cluster row in table
        assignment_table.table.selectAll('tbody tr').classed('selected', false);
        if (cluster) {
        assignment_table.table.select('tbody tr[data-cluster-path-id='+cluster.path_id()+']').classed('selected', true);
        }
    }


    async runJSmolApplet() {
        console.log("Running JSmol...");

        // Dynamically load JSmol if not already available
        if (!window.Jmol) {
            await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = new URL('./lib/jsmol/JSmol.min.js', import.meta.url);
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
            });
        }

        this.Jmol = window.Jmol;
        const parentDiv = this.container;
        const width = parseFloat(parentDiv.style('width')) - 10;
        const height = parseFloat(parentDiv.style('height')) - 30;

        const load_type = "INLINE";
        const nucleus = this.nmr_nucleus;
        const showHydrogens = this.show_hydrogen;
        const molfile = this.mol_file;
        console.log("molfile", molfile, "nucleus", nucleus, "showHydrogens", showHydrogens);
        const labels = `labels off; select ${nucleus === "13C" ? "carbon" : "hydrogen"}; label %a;`;
        const show_hydrogens = showHydrogens ? "set showHydrogens TRUE;" : "set showHydrogens FALSE;";
        const background = "background white;";
        const callbacks = 'set PickCallback "sv.structure.atom_picked";';

        const j2sBaseFileUrl = new URL('./lib/jsmol/j2s/core/package.js', import.meta.url);
        const j2sPath = j2sBaseFileUrl.toString().replace(/\/core\/package\.js$/, '');
        console.log("j2sPath", j2sPath);

        let Info = {
            width: width,
            height: height,
            debug: false,
            color: "#EAF0F2",
            use: "HTML5",
            // j2sPath: new URL('./lib/jsmol/j2s', import.meta.url).toString(),
            j2sPath: j2sPath, // Use the dynamically constructed path
            multipleBondSpacing: 0.9,
            zoomlarge: true,
            allowJavaScript: true,
            script: `load ${load_type} "${molfile}"; color labels black; font labels 20; set antialiasDisplay; wireframe 15; spacefill 55; select carbon; halos on; colour halos grey; ${labels} ${show_hydrogens} ${background} ${callbacks}`
        };
        // Info.script = `
        // load $caffeine;
        // wireframe 40;
        // spacefill 23%;
        // zoom 100;
        // `;

        // Inject the JSmol viewer
        document.getElementById('view-3d').innerHTML = this.Jmol.getAppletHtml('jmol_jspectraviewer', Info);
        console.log("JSmol applet initialized", this.Jmol.getAppletHtml('jmol_jspectraviewer', Info));
        console.log("Info.j2sPath", Info.j2sPath)

        // Trigger any custom logic after initialization
        // this.atom_picked();
    }

    run_jsmol(){
        console.log("Running JSmol...")
        // Height and width of the JSmol applet
        let parent_div = this.container
        let width = parseFloat(parent_div.style('width'))-10, height = parseFloat(parent_div.style('height'))-30

        let load_type = "INLINE"

        let labels = `labels off; select ${(this.nmr_nucleus === "13C") ? 'carbon' : 'hydrogen'}; label %a;`
        let show_hydrogens = this.show_hydrogen ? 'set showHydrogens TRUE;' : 'set showHydrogens FALSE;'
        let background = "background white;";
        let callbacks = 'set PickCallback "sv.structure.atom_picked";'
        let molfile = this.mol_file;

        let Info = {
            width: width,
            height: height,
            debug: false,
            color : "#EAF0F2",
            use: "HTML5",   // JAVA HTML5 WEBGL are all options
            j2sPath: "./lib/jsmol/j2s", // this needs to point to where the j2s directory is.
            multipleBondSpacing : 0.9,
            zoomlarge: true,
            allowJavaScript: true
        };

        Info.script = 'load ' + load_type + ' "' + molfile +
            '"; color labels black; font labels 20; set antialiasDisplay; wireframe 15; spacefill 55; select carbon; halos on; colour halos grey;' +
            labels + show_hydrogens + background + callbacks
        $("#view-3d").html(this.Jmol.getAppletHtml('jmol_jspectraviewer', Info))

        this.atom_picked()

    }

    /**
     * Parses the molfile, extracting the molecule title from the
     * header block, two dimensional coordinates, symbol, charge,
     * and mass difference information extracted from the atom block,
     * connectivity and stereo information from the bond block.
     *
     * @param {string} molfile A URL to the MDL molfile (REST web service)
     * @param {string} id An element identifier or the element itself
     */
    // draw() {
    //     let self = this;
    //     this.graph = this.initSVG();   // layout SVG
    //     this.avgL = 0;
    //     console.log("Drawing structure...")
    //     if(!this.use_jsmol) {
    //         this.drawBonds();
    //         this.drawAtoms();
    //         this.addInteractivity();
    //     } else {
    //         this.container.append('div').attr('id', 'view-3d').attr('style', 'position: relative; z-index: 0;')
    //         try {
    //             self.run_jsmol()
    //         }
    //         catch(e){
    //             console.log("Error running JSmol", e)
    //             console.log("Loading JSmol script...")
    //             self.loadJsmolScript("/jsmol/JSmol.min.js", function(){
    //                 console.log("JSmol script loaded")
    //                 self.run_jsmol()
    //                 self.initialize_jsmol_atom_picking()
    //             })
    //         }
    //     }
    //     this.toggleH(this.show_hydrogen);
    //     this.toggleAtomNumbers(this.show_atom_numbers);
    // };

    async draw() {
        console.log("Drawing structure with Jmol...", window.Jmol);
        this.graph = this.initSVG();   // layout SVG
        this.avgL = 0;
        console.log("Drawing structure...");

        if (!this.use_jsmol) {
            console.log("Drawing structure without JSmol...");
            this.drawBonds();
            this.drawAtoms();
            this.addInteractivity();
        } else {
            console.log("this.use_jsmol", this.use_jsmol);
            this.container
                .append('div')
                .attr('id', 'view-3d')
                .attr('style', 'position: relative; z-index: 0;');

            try {
                console.log("Running JSmol viewer...");
                await this.runJSmolApplet();  // ⬅️ New modular async call
                console.log("JSmol viewer initialized");
                this.initialize_jsmol_atom_picking?.();
            } catch (e) {
                console.error("Error running JSmol viewer:", e);
            }
        }

        this.toggleH(this.show_hydrogen);
        this.toggleAtomNumbers(this.show_atom_numbers);
    }


    initialize_jsmol_atom_picking(){

    }

    atoms(term) {
        // If no term, return all atoms
        if (term === undefined || term === null) {
            return this._atoms;
        }

        // 1. Handle Array of terms (e.g. ["43"])
        if (Array.isArray(term)) {
            const foundAtoms = new SVSet();
            term.forEach(t => {
                // Recursive call for each item
                const atom = this.atoms(t); 
                if (atom) {
                    foundAtoms.push(atom);
                } else {
                    console.warn(`SVStructure: Could not find atom for term "${t}"`);
                }
            });
            return foundAtoms;
        }

        // 2. Handle Single Term Lookup (Robust Matching)
        let found = this._atoms.get(term);

        if (!found) {
            const termInt = parseInt(term);
            const termStr = term.toString();

            found = this._atoms.find(atom => 
                atom.id === term ||          // Exact match
                atom.id === termInt ||       // Number match
                atom.id == term ||           // Loose match
                atom.serial === termInt ||   // Serial match
                atom.number === termInt ||   // Number prop match
                atom.stringId === termStr || // Explicit string ID match
                atom.index === termInt       // Index match (last resort)
            );
        }
        return found;
    }

    bonds(term) {
        return this._bonds.get(term)
    }

    addInteractivity() {
        const self = this;
        const container = this.container;
        container.on('mouseenter', function() {
        container.selectAll('.atom').style('cursor', 'default');
        if (self.nmr_1H()) {
            container.selectAll('.atom.nmr-1h')
                .classed('highlight', true)
                .style('cursor', 'pointer');
        } else if (self.nmr_13C()) {
            container.selectAll('.atom.nmr-13c')
                .classed('highlight', true)
                .style('cursor', 'pointer');
        }
        });
        container.on('mouseleave', function() {
        container.selectAll('.atom').classed('highlight', false);
        });

        // container.selectAll('.atom').on('click', function() {
        //     const atom_id = d3.select(this).attr('data-atom-id');
        //     let clicked_atom;
        //     if (atom_id) {
        //         clicked_atom = self.atoms(atom_id);
        //         if (self.nmr_1H()) {
        //             self.select_clicked_atoms_for_1H_nmr(clicked_atom, d3.event.shiftKey);
        //         } else  if (self.nmr_13C()) {
        //             self.select_clicked_atoms_for_13C_nmr(clicked_atom, d3.event.shiftKey);
        //         }
        //     }
        //     self.trigger('structure-click');
        //     d3.event.stopPropagation();
        // });
        container.selectAll('.atom').on('click', function(event) {
            const atom_id = d3.select(this).attr('data-atom-id');
            let clicked_atom;

            if (atom_id) {
                clicked_atom = self.atoms(atom_id);

                if (self.nmr_1H()) {
                    self.select_clicked_atoms_for_1H_nmr(clicked_atom, event.shiftKey);
                } else if (self.nmr_13C()) {
                    self.select_clicked_atoms_for_13C_nmr(clicked_atom, event.shiftKey);
                }
            }

            self.trigger('structure-click');
            event.stopPropagation();
        });

        container.on('click', function() {
            self.selected_atoms = [];
            self.trigger('structure-click');
        });
    }

    select_clicked_atoms_for_1H_nmr(clicked_atom, shift_key) {
        const self = this;
        let selected_atoms = this.selected_atoms;
        if (shift_key) {
        // Prevent selection of text when shift-clicking
        window.getSelection().removeAllRanges()
        if (selected_atoms.contains(clicked_atom)) {
            if (clicked_atom.is('H')) {
            const parent = clicked_atom.bonded_atoms(1);
            selected_atoms = selected_atoms.remove(parent).remove(clicked_atom);
            } else {
            clicked_atom.bonded_Hs().forEach(function(bonded_H) {
                selected_atoms = selected_atoms.remove(bonded_H);
            });
            selected_atoms = selected_atoms.remove(clicked_atom);
            }
        } else {
            selected_atoms.push(clicked_atom);
        }
        } else {
        selected_atoms = new SVSet(clicked_atom);
        }
        self.selected_atoms = selected_atoms;

    }

    select_clicked_atoms_for_13C_nmr(clicked_atom, shift_key) {
        const self = this;
        let selected_atoms = this.selected_atoms;
        if (shift_key) {
        // Prevent selection of text when shift-clicking
        window.getSelection().removeAllRanges()
        if (selected_atoms.contains(clicked_atom)) {
            selected_atoms = selected_atoms.remove(clicked_atom);
        } else {
            selected_atoms.push(clicked_atom);
        }
        } else {
        selected_atoms = new SVSet(clicked_atom);
        }
        self.selected_atoms = selected_atoms;
    }

    // toggle H visibility
    toggleH(show) {
        this.show_hydrogen = (show === undefined) ? !this.show_hydrogen : show;
        if (this.show_hydrogen) {
        d3.selectAll('.atom-H, .bond-H').style('display', 'inline');
        this.button_toggle_H.classed('button-on', true)
        this.button_toggle_H.text('Hide H')
        if(typeof this.Jmol !== 'undefined') this.Jmol.script(jmol_jspectraviewer, "select all; set showHydrogens TRUE;")
        } else {
        d3.selectAll('.atom-H, .bond-H').style('display', 'none');
        this.button_toggle_H.classed('button-on', false)
        this.button_toggle_H.text('Show H')
        if(typeof this.Jmol !== 'undefined') this.Jmol.script(jmol_jspectraviewer, "select all; set showHydrogens FALSE;")
        }
    }

    toggleAtomNumbers(show) {
        this.show_atom_numbers = (show === undefined) ? !this.show_atom_numbers : show;
        if (this.show_atom_numbers) {
        d3.selectAll('.atom-id').style('display', 'inline');
        this.button_toggle_numbers.classed('button-on', true);
        this.button_toggle_numbers.text('Hide #');
        if(typeof this.Jmol !== 'undefined'){
            if(this.nmr_nucleus === "13C"){
                this.Jmol.script(jmol_jspectraviewer, "select carbon; labels %a;")
            } else{
                this.Jmol.script(jmol_jspectraviewer, "select hydrogen; labels %a;")
            }
        }
        } else {
        d3.selectAll('.atom-id').style('display', 'none');
        this.button_toggle_numbers.classed('button-on', false);
        this.button_toggle_numbers.text('Show #');
        if(typeof Jmol !== 'undefined'){
            if(this.nmr_nucleus === "13C"){
                this.Jmol.script(jmol_jspectraviewer, "select carbon; labels %e;")
            } else{
                this.Jmol.script(jmol_jspectraviewer, "select hydrogen; labels %e;")
            }
        }
        }
    }

    // Create atom display numbers using modified Morgan Algorithm
    // Note: the display ids are only visible in the structure and in the
    // assignment table. They have no effect on the underlying atom ids.
    // So the method can be changed without worrying about the ids stored in the nmrML.
    addAtomDisplayIDs() {
        const self = this;
        const atoms = new SVSet(self.atoms().filter(function (a) {
        return !a.is('H')
        }));
        atoms.each(function() { this.morgan_num = 1; });
        let morgan_numbers = new SVSet();
        let unique_size = -1;
        while (unique_size != morgan_numbers.unique().length) {
        // Reset numbers
        unique_size = morgan_numbers.unique().length;
        morgan_numbers = new SVSet();
        // Calculate morgan numbers for each atom
        atoms.forEach(function(atom) {
            let temp = 0;
            atom.bonded_atoms().each(function() {
            if (!this.is('H')) {
                temp += this.morgan_num;
            }
            });
            atom.morgan_temp = temp;
        });
        atoms.forEach(function(atom) {
            atom.morgan_num = atom.morgan_temp;
            morgan_numbers.push(atom.morgan_num);
        });
        }
        atoms.order_by('morgan_num', true);

        let current_atom = atoms[0];
        let current_id = 1;
        let next_atom;
        while (current_atom) {
        current_atom.display_id = current_id;
        let possible_atoms = current_atom.bonded_atoms().filter(function (a) {
            return !a.is('H') && a.display_id == undefined
        });
        possible_atoms = new SVSet(possible_atoms);
        if (possible_atoms.length > 0) {
            next_atom = possible_atoms.order_by('morgan_num', true)[0];
        } else {
            next_atom = atoms.find(function(a) { return a.display_id == undefined });
        }
        current_atom = next_atom;
        current_id += 1;
        }
        this.addHydrogenDisplayIDs();
    }

    addHydrogenDisplayIDs() {
        const indexMap = ['a', 'b', 'c', 'd'];
        this.atoms().forEach(function(atom) {
        if (atom.is('H')) { return; }
        atom.bonded_Hs().forEach(function(hydrogen, index) {
            hydrogen.display_id = atom.display_id + indexMap[index];
        });
        });
    }

    hydrogens_from_atoms(atoms) {
        const hydrogens = new SVSet();
        atoms.forEach(function(atom) {
        if (atom.toString() === 'Atom') {
            if (atom.is('H')) {
            hydrogens.push(atom);
            } else {
            hydrogens.merge(atom.bonded_Hs());
            }
        }
        });
        return hydrogens.unique()
    }

    nmr_atoms_from_atoms(atoms) {
        const self = this;
        if (self.nmr_1H()) {
        return self.hydrogens_from_atoms(atoms);
        }
        if (self.nmr_13C()) {
        return new SVSet( atoms.filter(function(atom) { return atom.is('C'); }) ).unique();
        }
    }

    // LCA: Least Common Ancestor
    // Atoms can be hydrogens and/or LCA atoms
    // Return a simplified list of atoms to represent the significant hydrogens.
    // If a Carbon has 2 hydrogens and they are both in the list of atoms, then the Carbon atom
    // is included instead of the hydrogens.
    // If only one of the 2 hydrogens is in the list, then only the one hydrogen atom is included
    LCA_from_hydrogens(atoms) {
        console.log("getting LCA from hydrogens", atoms);
        const lca = new SVSet();
        if (!atoms || atoms.empty()) { 
            console.log("No atoms provided for LCA calculation");
            return lca 
        }
        const hydrogens = this.hydrogens_from_atoms(atoms);
        let parents = hydrogens.map(function (h) {
            return h.bonded_atoms(1)
        });
        parents = new SVSet(parents).unique();
        parents.forEach(function(p) {
            let all_Hs_in_list = true;
            const listed_Hs = new SVSet();
            const child_Hs = p.bonded_Hs();
            child_Hs.forEach(function(child_H) {
                if (hydrogens.contains(child_H)) {
                    listed_Hs.push(child_H);
                } else {
                    all_Hs_in_list = false;
                }
            });
            if (all_Hs_in_list) {
                lca.push(p);
            } else {
                lca.merge(listed_Hs);
            }
        });
        console.log("LCA from hydrogens", lca);
        return lca.unique()
    }


    LCA_from_nmr_atoms(atoms) {
        const self = this;
        if (self.nmr_1H()) {
        return self.hydrogens_from_atoms(atoms);
        }
        if (self.nmr_13C()) {
        return new SVSet( atoms.filter(function(atom) { return atom.is('C'); }) ).unique();
        }
    }

    LCA_and_hydrogens(atoms) {
        const hydrogens = this.hydrogens_from_atoms(atoms);
        const lca = this.LCA_from_hydrogens(atoms);
        return hydrogens.merge(lca).unique();
    }

    LCA_and_nmr_atoms(atoms) {
        const self = this;
        if (self.nmr_1H()) {
        return self.LCA_and_hydrogens(atoms);
        }
        if (self.nmr_13C()) {
        return new SVSet( atoms.filter(function(atom) { return atom.is('C'); }) ).unique();
        }
    }

}



class Atom {

    constructor(options) {
        options = options || {};
        this.x = JSV.default_for(options.x, 0);
        this.y = JSV.default_for(options.y, 0);
        this.z = JSV.default_for(options.z, 0);
        this.id = options.id;
        this.symbol = JSV.default_for(options.symbol, 0);
        this.index = JSV.default_for(options.index, 0);
        this.number = JSV.default_for(options.number, 1);
        this.mass = JSV.default_for(options.mass, 0);
        this.charge = JSV.default_for(options.charge, 0);
        this._bonds = new SVSet();
        this._bonded_Hs = new SVSet();
        this._bonded_atoms = new SVSet();
    }

    toString() {
        return "Atom"
    }

    bonds(term) {
        return this._bonds.get(term)
    }

    bonded_atoms(term) {
        return this._bonded_atoms.get(term)
    }

    bonded_Hs(term) {
        const filtered = this.bonded_atoms().filter(function (atom) {
        return atom.is('H')
        });
        return new SVSet(filtered)
    }

    is(symbol) {
        return this.symbol == symbol
    }

    isBondedTo(symbol) {
        return this.bonded_atoms().some(function(a) { return a.symbol == symbol })
    }

    color() {
        return d3v7.rgb(AtomColors[this.symbol]);
    }
}


class Bond {
    constructor(options) {
        options = options || {};
        this.a1 = options.a1
        this.a2 = options.a2
        this.order = JSV.default_for(options.order, 1);
        this.stereo = JSV.default_for(options.stereo, 0);
        this._atoms = new SVSet([this.a1, this.a2]);
    }

    toString() {
        return "Bond"
    }

    atoms(term) {
        return this._atoms.get(term)
    }
}