import { XMLParser } from "fast-xml-parser";
import X2JS from "x2js";
console.log("X2JS loaded", X2JS)
import * as d3 from "d3";
import * as JSV from "./Utils.js";
import { SVSet } from "./SVSet.js";

/**
 * For parsing various input data formats: xml, jcamp-jdx, csv, mol, etc.
 * Hooked to the file dropzone element to listen for file uploads.
 */
class DataParser {

    constructor(containerID, options) {
        console.log("setting up data parser", options)
        this.event_target = new EventTarget()
        this.containerID = containerID
        this.expected_data_tag = options?.expectedDataTag || 'spectrumDataArray'
        this.data_type = options?.dataType || '1D-NMR'
        this.custom_parser_function = options?.customDataParser || null

        this.setup_file_dropzone();
        this.add_dropzone_listener(this.custom_parser_function);
    }

    set_data_type(dataType) {
        this.data_type = dataType;
        console.log("data type set to", this.data_type)
    }

    set_expected_data_tag(expectedDataTag) {
        this.expected_data_tag = expectedDataTag;
        console.log("expected data tag set to", this.expected_data_tag)
    }

    addEventListener(eventName, callback) {
        this.event_target.addEventListener(eventName, callback);  // delegate to the eventTarget
    }

    on(eventName, callback) {  // Alias for addEventListener
        this.event_target.addEventListener(eventName, callback);  // delegate to the eventTarget
    }

    setup_file_dropzone() {
        this.dropzone = document.querySelector(this.containerID);
        console.log("in set", this.dropzone)
    }

    add_dropzone_listener(custom_parser_function) {
        console.log("in add")
        this.dropzone.addEventListener('change', (event) => {            
            event.preventDefault();
            event.stopPropagation();
            const files = event.target.files;
            if (files.length > 0) {
                let file = files[0];
                const reader = new FileReader()
                reader.addEventListener('load', (event) => {
                    this.fileContent = reader.result
                    this.fileName = file.name
                    // console.log("> file content", this.fileContent)
                    if (custom_parser_function) {
                        const dataset = custom_parser_function();
                        console.log("dispatching fileParsed event using custom_parser_function with dataset", dataset)
                    } else {  // use default parser
                        try {
                            const dataset = this.parseFile(this.expected_data_tag, ['1D-NMR', '2D-NMR'].includes(this.data_type));
                            console.log("dispatching fileParsed event with dataset", dataset)
                            this.dispatch_event('fileParsed', dataset);  // dataset should contain {x: [], y: [], assignment?: []}
                        } catch (error) {
                            console.error("Error parsing file:", error);
                            this.dispatch_event('fileParseError', {error: error.message, file: file.name});
                        }
                    }

                });
                reader.readAsText(file)
            }

        }, false);
    }

    dispatch_event(eventName, detail) {
        let e = new CustomEvent(eventName, {detail: detail});
        this.event_target.dispatchEvent(e);
    }

    // addEventListener(eventName, callback) {
    //     this.event_target.addEventListener(eventName, callback);  // delegate to the eventTarget
    // }

    get_entries_by_tag(jsonObj, tagName, results = []) {
        // recursively searches for tagName in jsonObj and returns all the values
        console.log('looking for data with tag:', tagName);
        for (const key in jsonObj) {
            if (key === tagName) {
                results.push(jsonObj[key]);
            }
            if (typeof jsonObj[key] === 'object') {
                this.get_entries_by_tag(jsonObj[key], tagName, results);
            }
        }
        return results;
    }

    // Helper function to detect file type based on content and extension
    detectFileType(fileName, content) {
        const extension = fileName.split('.').pop().toLowerCase();
        
        // Check for MOL file
        if (extension === 'mol' || extension === 'sdf') {
            return 'MOL';
        }
        
        // Check for XML-based spectroscopy formats
        if (content.includes('<mzML')) {
            return 'mzML';
        }
        if (content.includes('<nmrML') || content.includes('<spectrumDataArray')) {
            return 'nmrML';
        }
        
        // Check for JCAMP formats
        if (content.includes('##TITLE') || content.includes('##XYDATA')) {
            return 'JCAMP';
        }
        
        // Check for simple delimited formats
        if (extension === 'xy' || extension === 'csv' || extension === 'tsv') {
            return 'DELIMITED';
        }

        // Default to trying spectroscopy parsing
        return 'UNKNOWN_SPECTROSCOPY';
    }

    // Parse MOL file format
    parseMolFile(content) {
        console.log("Parsing MOL file");
        const lines = content.split('\n');
        
        // MOL file structure:
        // Line 1: Molecule name
        // Line 2: User/software info  
        // Line 3: Comments
        // Line 4: Counts line (number of atoms, bonds, etc.)
        // Then atom block, then bond block
        
        if (lines.length < 4) {
            throw new Error("Invalid MOL file format: too few lines");
        }
        
        const name = lines[0].trim();
        const info = lines[1].trim();
        const comments = lines[2].trim();
        const counts = lines[3].trim().split(/\s+/);
        
        if (counts.length < 2) {
            throw new Error("Invalid MOL file format: invalid counts line");
        }
        
        const numAtoms = parseInt(counts[0]);
        const numBonds = parseInt(counts[1]);
        
        console.log(`MOL file contains ${numAtoms} atoms and ${numBonds} bonds`);
        
        // Parse atoms
        const atoms = [];
        for (let i = 4; i < 4 + numAtoms; i++) {
            if (i >= lines.length) break;
            const parts = lines[i].trim().split(/\s+/);
            if (parts.length >= 4) {
                atoms.push({
                    x: parseFloat(parts[0]),
                    y: parseFloat(parts[1]),
                    z: parseFloat(parts[2]),
                    element: parts[3],
                    index: i - 4
                });
            }
        }
        
        // Parse bonds
        const bonds = [];
        for (let i = 4 + numAtoms; i < 4 + numAtoms + numBonds; i++) {
            if (i >= lines.length) break;
            const parts = lines[i].trim().split(/\s+/);
            if (parts.length >= 3) {
                bonds.push({
                    atom1: parseInt(parts[0]) - 1, // MOL files use 1-based indexing
                    atom2: parseInt(parts[1]) - 1,
                    bondType: parseInt(parts[2])
                });
            }
        }
        
        return {
            dataType: 'MOL_STRUCTURE',
            moleculeName: name,
            info: info,
            comments: comments,
            atoms: atoms,
            bonds: bonds,
            numAtoms: numAtoms,
            numBonds: numBonds,
            // Create dummy x,y arrays for compatibility (could be used for 2D projection)
            x: atoms.map(atom => atom.x),
            y: atoms.map(atom => atom.y),
            z: atoms.map(atom => atom.z)
        };
    }

    parseJcampFile(content) {
        console.log("Parsing JCAMP file");
        
        // Extract XYDATA section
        const data_lines = this.extract_jcamp_data(content);
        const xy_data = this.interpolate_jcamp_data(data_lines);
        
        return {
            x: xy_data.x,
            y: xy_data.y,
            dataType: this.data_type
        };
    }

    parseMzmlFile(content) {
        console.log("Parsing mzML file");
        
        // Use existing LCMS parser (works for both LCMS and EIMS mzML files)
        const xy_dataset = this.convert_base64_to_float64_lcms(content, false);
        const xy_data = xy_dataset[0];  // Take first spectrum
        
        return {
            x: xy_data.x,
            y: xy_data.y,
            dataType: this.data_type
        };
    }

    parseDelimitedFile(content) {
        const extension = this.fileName.split('.').pop().toLowerCase();
        const lines = content.split('\n');
        const x = [], y = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            let parts;
            if (extension === 'tsv') {
                parts = trimmed.split('\t');
            } else if (extension === 'csv') {
                parts = trimmed.split(',');
            } else {
                parts = trimmed.split(/\s+/);
            }
            if (parts.length < 2) continue;
            const xVal = parseFloat(parts[0]);
            const yVal = parseFloat(parts[1]);
            if (isNaN(xVal) || isNaN(yVal)) continue; // skip header rows
            x.push(xVal);
            y.push(yVal);
        }
        if (x.length === 0) throw new Error('No numeric data found in file');
        return { x, y, dataType: this.data_type };
    }

    // Helper function to validate base64 string
    isValidBase64(str) {
        if (typeof str !== 'string') {
            return false;
        }
        // Remove whitespace and check if it's a valid base64 string
        const cleanStr = str.replace(/\s/g, '');
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        return base64Regex.test(cleanStr) && cleanStr.length % 4 === 0;
    }

    // Helper function to clean base64 string
    cleanBase64String(str) {
        if (typeof str !== 'string') {
            throw new Error('Input must be a string');
        }
        // Remove whitespace, newlines, and other non-base64 characters
        return str.replace(/[^A-Za-z0-9+/=]/g, '');
    }

    // Helper function to extract base64 string from various data formats
    extractBase64Data(encoded_data) {
        console.log("Extracting base64 from:", typeof encoded_data, encoded_data);

        // Handle different data types
        let base64_string;
        if (typeof encoded_data === 'object') {
            // If it's an object, look for common base64 data fields
            if (encoded_data.binary) {
                base64_string = encoded_data.binary;
            } else if (encoded_data['#text']) {
                base64_string = encoded_data['#text'];
            } else if (encoded_data.value) {
                base64_string = encoded_data.value;
            } else if (encoded_data._) {
                base64_string = encoded_data._;
            } else if (encoded_data.text) {
                base64_string = encoded_data.text;
            } else {
                // Try to find any string property that looks like base64
                const stringProps = Object.keys(encoded_data).filter(key => 
                    typeof encoded_data[key] === 'string' && encoded_data[key].length > 10
                );
                if (stringProps.length > 0) {
                    base64_string = encoded_data[stringProps[0]];
                    console.log(`Using property '${stringProps[0]}' for base64 data`);
                } else {
                    throw new Error(`No valid base64 string found in object. Available properties: ${JSON.stringify(Object.keys(encoded_data))}`);
                }
            }
        } else if (typeof encoded_data === 'string') {
            base64_string = encoded_data;
        } else {
            throw new Error(`Unsupported encoded_data type: ${typeof encoded_data}`);
        }

        return base64_string;
    }

    // The xy data is the content of the spectrumDataArray element, it is an
    // array of 64 bit floats. The array is of the form:
    // [x_1,y_1,x_2,y_2,...,x_n,y_n]  the bytes are encoded as base64. They can
    // also be compressed with zlib.
    // Here is a javascript function to decode the xy data, that returns it as an
    // array with xy points, add true as a second option if the data is
    // compressed:
    convert_base64_to_float64_spectrum(encoded_data, zipped) {
        // function convert_base64_to_float64(encoded_data,zipped) {
        if(typeof zipped === 'undefined') { zipped = false; }

        try {
            // Extract base64 string from various possible formats
            let base64_string = this.extractBase64Data(encoded_data);

            // Clean the base64 string
            base64_string = this.cleanBase64String(base64_string);

            // Validate base64 string
            if (!this.isValidBase64(base64_string)) {
                throw new Error(`Invalid base64 string format. String length: ${base64_string.length}, First 50 chars: ${base64_string.substring(0, 50)}`);
            }

            const byte_string = atob(base64_string);
            let int_array = new Int8Array(byte_string.length);
            if(zipped) {
                int_array = new Zlib.Deflate(int_array);
            }

            for (let i = 0; i < byte_string.length; i++) {
                int_array[i] = byte_string.charCodeAt(i);
            }
            let values = new Float64Array(int_array.buffer);
            // new DataView(int_array.buffer).getFloat64(0, true) // For little endian
            console.log('values decoded >', values);
            let xy_data = {x: [], y: []};
            for (let i = 0; i < values.length; i += 2) {
                xy_data.x.push(values[i]);
                xy_data.y.push(values[i + 1]);
      
                // maxY = (values[i + 1] > maxY) ? values[i + 1] : maxY;
            }
            console.log('xy_data decoded >', xy_data);
            return xy_data;
        } catch (error) {
            console.error("Error in convert_base64_to_float64_spectrum:", error);
            console.log("Encoded data that failed:", encoded_data);
            throw new Error(`Base64 conversion failed: ${error.message}`);
        }
    }

    // The encoded_data is the content of the <binary> elements, it is an
    // array of 64 bit floats. It expects two arrays of 64 bit floats, one for x and one for y like:
    // [x_1, x_2, ..., x_n] and [y_1, y_2, ..., y_n]  the bytes are encoded as base64. They can
    // also be compressed with zlib.
    // Here is a javascript function to decode the xy data, that returns it as an
    // array with xy points, add true as a second option if the data is
    // compressed:
    convert_base64_to_float64_eims(encoded_data, zipped) {
        if (typeof zipped === 'undefined') { zipped = false; }
        
        let xy_data = {x: [], y: []};
        for (let i=0; i<2; i++) {
            try {
                let base64_string = this.extractBase64Data(encoded_data[i]);
                base64_string = this.cleanBase64String(base64_string);
                
                if (!this.isValidBase64(base64_string)) {
                    throw new Error(`Invalid base64 string format in encoded_data[${i}]`);
                }

                const byte_string = atob(base64_string);
                let int_array = new Int8Array(byte_string.length);
                if (zipped) {
                    int_array = new Zlib.Deflate(int_array);
                }
                for (let j = 0; j < byte_string.length; j++) {
                    int_array[j] = byte_string.charCodeAt(j);
                }
                let values = new Float64Array(int_array.buffer);
                for (let j = 0; j < values.length; j++) {
                    if (i === 0) {  // expect first array to be x values
                        xy_data.x.push(values[j]);
                    } else {        // expect second array to be y values
                        xy_data.y.push(values[j]);
                    }
                }
            } catch (error) {
                console.error(`Error processing encoded_data[${i}]:`, error);
                throw new Error(`EIMS base64 conversion failed for array ${i}: ${error.message}`);
            }
            console.log('eims xy_data decoded >', xy_data);
        }
        return xy_data;
    }

    parseFile(customDataTag, hasAssignmentData=false) {
        if (this.custom_parser_function) {
            return this.custom_parser_function();
        }

        // Detect file type first
        const fileType = this.detectFileType(this.fileName, this.fileContent);
        console.log("Detected file type:", fileType);

        // Handle MOL files separately
        if (fileType === 'MOL') {
            return this.parseMolFile(this.fileContent);
        }

        // Handle JCAMP files separately
        if (fileType === 'JCAMP') {
            return this.parseJcampFile(this.fileContent.toString());
        }

        // Handle mzML files separately
        if (fileType === 'mzML') {
            return this.parseMzmlFile(this.fileContent.toString());
        }

        // Handle XY/CSV/TSV files
        if (fileType === 'DELIMITED') {
            return this.parseDelimitedFile(this.fileContent.toString());
        }

        // Handle spectroscopy files (original functionality)
        const parser = new XMLParser();
        const jsonXML = parser.parse(this.fileContent.toString());
        console.log('parsed jsonXML >', jsonXML);
        const dataset = this.get_entries_by_tag(jsonXML, customDataTag);
        console.log('dataset >', dataset);
        let parsed_data = {};
        console.log('data_type >', this.data_type);
        
        if (dataset.length === 0) {
            // Provide more helpful error message based on file type
            if (fileType === 'UNKNOWN_SPECTROSCOPY') {
                throw new Error(`No data found with tag '${customDataTag}'. This appears to be a spectroscopy file, but the expected data format was not found. Please check if your file contains the correct spectral data.`);
            } else {
                throw new Error(`No data found with tag '${customDataTag}'. Check if your file contains the expected data format for ${this.data_type}.`);
            }
        }
        
        if (this.data_type === '1D-NMR') {
            // return this.convert_base64_to_float64_spectrum(dataset[0], false);
            let xy_data = this.convert_base64_to_float64_spectrum(dataset[0], false);
            parsed_data = {
                x: xy_data.x, 
                y: xy_data.y,
                dataType: this.data_type,
            };
            if (hasAssignmentData) {
                try {
                    const assignmentData = this.parse_assignment_data(this.fileContent.toString(), xy_data);
                    console.log('assignmentData >', assignmentData);
                    parsed_data.assignmentData = assignmentData;
                } catch (assignErr) {
                    console.warn('Assignment parsing failed (non-fatal) — returning x/y only:', assignErr.message);
                }
            }
            return parsed_data;
        } else if (this.data_type === '2D-NMR') {
            let xyz_data = this.convert_base64_to_float64_2d_nmrml(this.fileContent.toString());
            console.log('xyz_data >', xyz_data);
            parsed_data = {
                x: xyz_data.x,
                y: xyz_data.y,
                z: xyz_data.z,
                dataType: this.data_type,
            };
            if (hasAssignmentData) {
                try {
                    const assignmentData = this.parse_2d_assignment_data(this.fileContent.toString());
                    console.log('2D assignmentData >', assignmentData);
                    if (assignmentData) parsed_data.assignmentData = assignmentData;
                } catch (assignErr) {
                    console.warn('2D assignment parsing failed (non-fatal) — returning x/y/z only:', assignErr.message);
                }
            }
            return parsed_data;
        } else if (this.data_type === '1D-EIMS') {
            let xy_data = this.convert_base64_to_float64_eims(dataset, false);
            // return xy_data;
            parsed_data = {
                x: xy_data.x, 
                y: xy_data.y,
                dataType: this.data_type,
            };
            return parsed_data;
        } else if (this.data_type === '1D-LCMS') {
            let xy_dataset = this.convert_base64_to_float64_lcms(this.fileContent.toString(), false);
            // mzML files return an array of spectra, take the first one
            const xy_data = xy_dataset[0];
            parsed_data = {
                x: xy_data.x,
                y: xy_data.y,
                dataType: this.data_type,
            };
            return parsed_data;
        } else if (this.data_type === '1D-IR') {
            let xy_data = this.convert_base64_to_float64_ir(this.fileContent.toString(), false);
            parsed_data = {
                x: xy_data.x, 
                y: xy_data.y,
                dataType: this.data_type,
            };
            return parsed_data;
        } else if (this.data_type === "1D-UV") {
            let xy_data = this.convert_base64_to_float64_uv(this.fileContent.toString(), false);
            parsed_data = {
                x: xy_data.x, 
                y: xy_data.y,
                dataType: this.data_type,
            };
            return parsed_data;
        }
    }

    parse_assignment_data(nmrml, xy_data) {
        const atom_assignment_match = nmrml.match(/<atomAssignment[^]*<\/atomAssignment>/);
        console.log("atom_assignment_match", atom_assignment_match)
        let atom_assignment;
        if (atom_assignment_match) {
          atom_assignment = atom_assignment_match[0];
        } else {
          console.log("Could not read nmrML (1). No <atomAssignment> tag found.");
          return
        }
        // Create structure
        const structure_match = atom_assignment.match(/<structure[^]*<\/structure>/);
        console.log("structure_match", structure_match)
        let matched_name;
        // if (sv.structure && structure_match) {
        let structure_data;
        if (structure_match) {
            const name_match = atom_assignment.match(/<identifier.*name="(.*?)"/);
            console.log("name_match", name_match)
            if (name_match) {
                matched_name = name_match[1];
                // sv.structure.title = name_match[1];  // TODO: add in Structure class
            }
            structure_data = this.parse_structure_data(nmrml);
            console.log("structure_data", structure_data)
            //   sv.structure.read_nmrml(structure_match[0]);  // TODO: add in Structure class: mainly for 3d viewer JSMol
        }

        // Extract Spectrometer Frequency to convert Peak Widths from Hz to PPM and detect frequency-position mismatches.
        const freq_match = nmrml.match(/effectiveExcitationField.*value="\s*(.*?)"/);
        const MHz = freq_match ? parseFloat(freq_match[1]) : 1;

        // Determine NMR type (e.g. 13C or 1H)
        const nucleus_match = nmrml.match(/acquisitionNucleus.*name=\"(.*?)\"/);
        console.log("nucleus_match", nucleus_match)
        // if (sv.assignment_table && nucleus_match) {
        let nmr_nucleus_type;
        if (nucleus_match) {
          const nucleus = nucleus_match[1];
          if (nucleus.match(/hydrogen/i) || nucleus.match(/1H/i)) {
            nmr_nucleus_type = '1H';
            // sv.assignment_table.nmr_nucleus = '1H';  // TODO: add in AssignmentTable class
          } else if (nucleus.match(/carbon/i) || nucleus.match(/13C/i)) {
            nmr_nucleus_type = '13C';
            // sv.assignment_table.nmr_nucleus = '13C';  // TODO: add in AssignmentTable class
          }
        }
        // Create Compound
        const x2js = new X2JS();
        // const json = x2js.xml_str2json(atom_assignment);
        const json = x2js.xml2js(atom_assignment);
        console.log("json", json)
        let name;
        try {
          name = json.atomAssignment.chemicalCompound.identifierList.identifier._name;
        } catch(err){
          console.error("nmrML contains no compound identifier")
          name = "Compound";
        }
        const compound = {
            name: name,
            structure_data: structure_data
        };
        const clusters = [];
        let multiplet_list = json.atomAssignment.atomAssignmentList.multiplet;
        console.log("multiplet_list", multiplet_list)
        // return multiplet_list;

        if (multiplet_list) {
            multiplet_list = Array.isArray(multiplet_list) ? multiplet_list : [multiplet_list];
    
            // create a the scale for simulated peaks
            let all_amps = multiplet_list.map((multiplet) => {
                let peak_list = multiplet.peakList.peak
                peak_list = Array.isArray(peak_list) ? peak_list : [peak_list];
                return peak_list.map((p) =>  parseFloat(p._amplitude))
            });
            all_amps = all_amps.flat()
            let y_data_min = xy_data.y[0]
            let y_data_max = xy_data.y[0]
            xy_data.y.forEach(function(val){
                y_data_min = Math.min(val, y_data_min);
                y_data_max = Math.max(val, y_data_max);
            });
            let peaks_scaler = d3.scaleLinear()
                .domain([Math.min(0, Math.min(...all_amps)), Math.max(...all_amps)])
                .range([y_data_min, y_data_max])
            // --- START OF UPDATED LOOP ---
            multiplet_list.forEach(function (multiplet, index) {
                const peaks = [];
                let peak_list = multiplet.peakList.peak;
                peak_list = Array.isArray(peak_list) ? peak_list : [peak_list];
                
                peak_list.forEach((p_data) => {
                    let amplitude = peaks_scaler(parseFloat(p_data._amplitude))
                    let raw_width = parseFloat(p_data._width) || 2.0;

                    // Convert Width from Hz to PPM. Detects if "width" is actually a frequency position 
                    let ppm_width = (raw_width > 100) ? (2.0 / MHz) : (raw_width / MHz);

                    peaks.push({
                        center: parseFloat(p_data._center),
                        amplitude: amplitude,
                        width: ppm_width
                    });
                });

                let atom_refs = [];
                if (multiplet.atoms && multiplet.atoms._atomRefs) {
                    atom_refs = multiplet.atoms._atomRefs
                        .trim()
                        .split(/\s+/)
                        .map(ref => ref.replace(/\D/g, '')); // turns "a1" into "1"
                    
                    console.log(`V2: Parsed Cluster ${index}: Found atom refs`, atom_refs);
                }

                // 2. PASS ATOM REFS TO THE CLUSTER (Inside Meta)
                clusters.push({
                    peaks: peaks, 
                    meta: {
                        nmrml_cluster_index: index,
                        atom_refs: atom_refs // <--- Moved inside meta
                    }
                });
            });
            // --- END OF UPDATED LOOP ---
        }
        compound.clusters = clusters;
        // let label = "Simulated";
        // let visible = false;

        // if(source === "predicted"){
        //     visible = true;
        //     label = "Predicted/Simulated"
        // } else if (source === "simulated"){
        //     visible = true
        // }

        // sv.add_spectrum({id: "Simulated", name: label, display: {color: 'blue', visible: visible}, compounds: [compound]});  TODO: add in SpectraViewer class
        compound.nmr_nucleus_type = nmr_nucleus_type;
        console.log("compound", compound)
        return compound;
    }

    // 2D nmrML (e.g. 1H-13C HSQC) lists each cross peak as two consecutive
    // multiplets in the atomAssignmentList: one per dimension. Returns
    // { name, structure_data, cross_peaks: [{ x: {center, atom_refs}, y: {center, atom_refs} }] }
    // where x is the direct (1H) dimension and y the indirect dimension.
    parse_2d_assignment_data(nmrml) {
        const atom_assignment_match = nmrml.match(/<atomAssignment[^]*<\/atomAssignment>/);
        if (!atom_assignment_match) {
            console.log("Could not read 2D nmrML assignments. No <atomAssignment> tag found.");
            return
        }
        const atom_assignment = atom_assignment_match[0];

        let structure_data;
        if (atom_assignment.match(/<structure[^]*<\/structure>/)) {
            structure_data = this.parse_structure_data(nmrml);
        }

        const x2js = new X2JS();
        const json = x2js.xml2js(atom_assignment);
        let name;
        try {
            name = json.atomAssignment.chemicalCompound.identifierList.identifier._name;
        } catch(err) {
            console.error("nmrML contains no compound identifier")
            name = "Compound";
        }

        let multiplets = (json.atomAssignment.atomAssignmentList || {}).multiplet || [];
        multiplets = Array.isArray(multiplets) ? multiplets : [multiplets];
        const signals = multiplets.map((multiplet) => ({
            center: parseFloat(multiplet._center),
            atom_refs: (multiplet.atoms && multiplet.atoms._atomRefs) ? multiplet.atoms._atomRefs.trim().split(/\s+/) : [],
        })).filter((signal) => !isNaN(signal.center));

        // The proton signal goes on the direct (x) dimension; without atom refs,
        // fall back to the chemical shift range (1H shifts are below ~15 ppm)
        const is_proton = (signal) => signal.atom_refs.length > 0 ? /^H/i.test(signal.atom_refs[0]) : signal.center < 15;
        const cross_peaks = [];
        for (let i = 0; i + 1 < signals.length; i += 2) {
            let direct = signals[i];
            let indirect = signals[i + 1];
            if (!is_proton(direct) && is_proton(indirect)) {
                [direct, indirect] = [indirect, direct];
            }
            cross_peaks.push({ x: direct, y: indirect });
        }

        return {
            name: name,
            structure_data: structure_data,
            cross_peaks: cross_peaks,
        };
    }

    parse_structure_data(nmrml) {

        const self = this;
        if (!window.X2JS) {
            console.log("X2JS needs to be installed to read nmrML: https://github.com/abdmob/x2js");
            return
        }
        // const x2js = new X2JS();
        // const json = x2js.xml_str2json(nmrml);
        // console.log("nmrml parse_structure_data json", json)
        const parser = new XMLParser({
            ignoreAttributes: false,
            // attributeNamePrefix: "_",
        });
        const jsonXML = parser.parse(this.fileContent.toString());
        console.log('parsed jsonXML >>>>', jsonXML);
        this.data = nmrml;
        // Validate
        let structure_data = this.get_entries_by_tag(jsonXML, 'structure');
        if (structure_data.length === 0) {
            console.log('nmrML not formatted correctly: no structure found');
            return
        }
        let json = {};
        json.structure = structure_data[0];
        console.log("get_entries_by_tag structure", json)
        if (!(json.structure && json.structure.atomList && json.structure.atomList.atom && Array.isArray(json.structure.atomList.atom))) {
            console.log('nmrML not formatted correctly: no atoms found');
            return
        }
        if (!(json.structure && json.structure.bondList && json.structure.bondList.bond && Array.isArray(json.structure.bondList.bond))) {
            console.log('nmrML not formatted correctly: no bonds found');
            return
        }
        
        console.log("json.structure", json)
        return json
    }

    extract_jcamp_data(jcamp_string) {
        let lines = jcamp_string.split('\n');
        let data_lines = [];
        for (let i = 0; i < lines.length; i++) {
            // grab the lines that have XY data
            if (lines[i].startsWith('##XYDATA= (X++(Y..Y))')) {  // data pattern MUST follow this 
                for (let j = i + 1; j < lines.length; j++) {
                    if (lines[j].startsWith('##END=')) {
                        break;
                    }
                    data_lines.push(lines[j].trim());
                }
            }
        }

        console.log("data_lines", data_lines);
        return data_lines;
    }

    interpolate_jcamp_data(jcamp_data_lines) {
        let xy_data = {x: [], y: []};
        let increment;
        for (let i = 0; i < jcamp_data_lines.length; i++) {
            let line = jcamp_data_lines[i].split(' ');
            let x_start = parseFloat(line.shift());
            console.log("x_start", x_start, line)

            line = line.map((val) => parseFloat(val));  // line contains y values only now as [0] X is shifted out
            if (i != jcamp_data_lines.length-1) {  // if not the last line; otherwise assume the previous increment (common in jcamp format)
                let next_x_start = parseFloat(jcamp_data_lines[i + 1].split(' ')[0]);
                increment = (next_x_start - x_start)/(line.length);
            }
            console.log("increment", increment, "line", line)
            for (let j = 0; j < line.length; j++) {
                let x_value = x_start + j * increment;
                xy_data.x.push(x_value);
                xy_data.y.push(line[j]);
            }
        }
        console.log("xy_data", xy_data);
        return xy_data;
    }

    convert_base64_to_float64_uv(encoded_data, zipped) {
        console.log("in convert_base64_to_float64_uv", encoded_data, zipped)
        if (typeof zipped === 'undefined') { zipped = false; }
        const data_lines = this.extract_jcamp_data(encoded_data.toString());
        const xy_data = this.interpolate_jcamp_data(data_lines);
        return xy_data;
    }

    convert_base64_to_float64_ir(encoded_data, zipped) {
        console.log("in convert_base64_to_float64_ir", encoded_data, zipped)
        if (typeof zipped === 'undefined') { zipped = false; }
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "_",
        });
        const jsonXML = parser.parse(encoded_data.toString());
        console.log('parsed jsonXML >', jsonXML);

        if (!jsonXML || !jsonXML['ms-ir'] || !jsonXML['ms-ir']['ms-ir-spectrum']) {
            console.error("nmrML not formatted correctly: no ms-ir-spectrum found");
            return;
        }

        let spectrum = jsonXML['ms-ir']['ms-ir-spectrum'].split(" ");  // [x1, y1, x2, y2, ...]
        console.log("spectrum", spectrum);

        let xy_data = {x: [], y: []};
        for (let i = 0; i < spectrum.length; i += 2) {
            xy_data.x.push(parseFloat(spectrum[i]));
            xy_data.y.push(parseFloat(spectrum[i + 1]));
        }

        console.log('xy_data decoded >', xy_data);
        return xy_data;

    }

    convert_base64_to_float64_lcms(nmrml, zipped) {
        // function convert_base64_to_float64(encoded_data,zipped) {
        if(typeof zipped === 'undefined') { zipped = false; }

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "_",
        });
        const jsonXML = parser.parse(nmrml.toString());
        console.log('parsed jsonXML >', jsonXML);
        window.jsonXML = jsonXML;  // for debugging
        if (parseInt(jsonXML?.mzML?.run?.spectrumList?._count) > 0) {
            let dataset = []
            let spectrumList = jsonXML.mzML.run.spectrumList;
            let data = {};
            console.log("spectrumList", spectrumList)
            
            for (let i = 0; i < parseInt(spectrumList._count); i++) {
                let spectrum = Array.isArray(spectrumList.spectrum) ? spectrumList.spectrum[i] : spectrumList.spectrum;
                let binary_data_array = spectrum.binaryDataArrayList.binaryDataArray;
                let x = [];
                let y = [];
                for (let j = 0; j < 2; j++) {  // grab the X and Y data arrays
                    let data_array = binary_data_array[j]
                    console.log("data_array", data_array);
                    // let decoded_array = [];
                    if (data_array.cvParam[1]._name !== 'no compression') {
                        data_array.binary = new Zlib.Deflate(data_array.binary);
                    }
                    console.log("data_array.binary > deflated", data_array.binary);
                    
                    try {
                        const binary_string = atob(data_array.binary);
                        let bytes = new Uint8Array(binary_string.length);
                        for (let k = 0; k < binary_string.length; k++) {
                            bytes[k] = binary_string.charCodeAt(k);
                        }
                        console.log("bytes", bytes);
                        let values = new Float64Array(bytes.buffer);
                        console.log("values", values);
                        if (data_array.cvParam[2]._name === 'm/z array') {
                            x = Array.from(values);
                        } else if (data_array.cvParam[2]._name === 'intensity array') {
                            y = Array.from(values);
                        }
                    } catch (error) {
                        console.error("Error decoding LCMS data:", error);
                        throw new Error(`LCMS base64 conversion failed: ${error.message}`);
                    }
                }
                console.log("x", x);
                console.log("y", y);
                let data_obj = {
                    x: x,
                    y: y,
                }
                dataset.push(data_obj);
            }
            console.log("dataset", dataset);
            return dataset;
        } else {
            console.error("nmrML not formatted correctly: no spectrumList found");
            return;
        }


    }

    convert_base64_to_float64_2d_nmrml(encoded_data, compressed) {
        const coords_regex = {
            x: /<spectrumDataArray2dDirectDimensionF2.*compressed="(true|false)"[^]*>([^]+)<\/spectrumDataArray2dDirectDimensionF2>/,
            y: /<spectrumDataArray2dIndirectDimensionF1.*compressed="(true|false)"[^]*>([^]+)<\/spectrumDataArray2dIndirectDimensionF1>/,
            z: /<spectrumDataArray2dIntensities.*compressed="(true|false)"[^]*>([^]+)<\/spectrumDataArray2dIntensities>/
        };
        
        let xyz_data = {
            x: [],
            y: [],
            z: []
        };
        let dataParser = this;
        Object.entries(coords_regex).forEach(function ([key, re]) {
            // find encoded data
            const data_array_match = encoded_data.match(re);
            if (data_array_match) {
                console.log(`${key} data array found`, data_array_match);
                let compressed = (data_array_match[1] === 'true');
                let encoded_data = data_array_match[2];
                // xyz_data[key] = Array.from(dataParser.convert_base64_to_float64_2d_nmrml(encoded_data, compressed));
                
                try {
                    const byte_string = atob(encoded_data);
                    let int_array = new Int8Array(byte_string.length);
                    if (compressed) {
                        int_array = new Zlib.Deflate(int_array);
                    }
                    for (let j = 0; j < byte_string.length; j++) {
                        int_array[j] = byte_string.charCodeAt(j);
                    }
                    let values = new Float64Array(int_array.buffer);
                    xyz_data[key] = Array.from(values);
                } catch (error) {
                    console.error(`Error decoding 2D NMR ${key} data:`, error);
                    throw new Error(`2D NMR base64 conversion failed for ${key}: ${error.message}`);
                }
            } else {
                console.error(`${key} data array not found`);
            }
        })        
        // let xy_data = {x: [], y: []};
        // let data = []
        // for (let i=0; i<1; i++) {
        // for (let j = 0; j < values.length; j++) {
        //     if (i === 0) {  // expect first array to be x values
        //         xy_data.x.push(values[j]);
        //     } else {        // expect second array to be y values
        //         xy_data.y.push(values[j]);
        //     }
        // }
        console.log('2d data decoded >', xyz_data);
        // }
        return xyz_data;
    
    }

    add_2dnmrml_data(nmrml){
        // let sv = this;
        // if (!window.X2JS) {
        //     console.error("X2JS needs to be installed to read nmrML: https://github.com/abdmob/x2js");
        //     return;
        // }

        // Add Spectrum XYZ plot
        const coords_regex = {
            x: /<spectrumDataArray2dDirectDimensionF2.*compressed="(true|false)"[^]*>([^]+)<\/spectrumDataArray2dDirectDimensionF2>/,
            y: /<spectrumDataArray2dIndirectDimensionF1.*compressed="(true|false)"[^]*>([^]+)<\/spectrumDataArray2dIndirectDimensionF1>/,
            z: /<spectrumDataArray2dIntensities.*compressed="(true|false)"[^]*>([^]+)<\/spectrumDataArray2dIntensities>/
        };
        let xyz_data = {};
        let dataParser = this;
        Object.entries(coords_regex).forEach(function ([key, re]) {
            // find encoded data
            const data_array_match = nmrml.match(re);
            if (data_array_match) {
                console.log(`${key} data array found`, data_array_match);
                let compressed = (data_array_match[1] === 'true');
                let encoded_data = data_array_match[2];
                xyz_data[key] = Array.from(dataParser.convert_base64_to_float64_2d_nmrml(encoded_data, compressed));
            } else {
                console.error(`${key} data array not found`);
            }
        })

        console.log("xyz_data", xyz_data);
        if (Object.keys(coords_regex).every(key => key in xyz_data)) {
            sv.add_spectrum_2d({json_data: xyz_data});

            // Extract part of nmrML of interest
            const atom_assignment_match = nmrml.match(/<atomAssignment[^]*<\/atomAssignment>/);
            let atom_assignment;
            if (atom_assignment_match) {
                atom_assignment = atom_assignment_match[0];
            } else {
                console.log("Could not read nmrML (2). No <atomAssignment> tag found.");
                return
            }
            // Create structure
            const structure_match = atom_assignment.match(/<structure[^]*<\/structure>/);
            if (sv.structure && structure_match) {
                const name_match = atom_assignment.match(/<identifier.*name="(.*?)"/);
                if (name_match) {
                    sv.structure.title = name_match[1];
                }
                sv.structure.read_nmrml(structure_match[0]);
            }
            //sv.assignment_table.nmr_nucleus = 'HSQC'; // only supported format for now
            // Create Compound
            const x2js = new X2JS();
            const json = x2js.xml_str2json(atom_assignment);
            const compound = {name: json.atomAssignment.chemicalCompound.identifierList.identifier._name};
            const clusters = [];
            let multiplet_list = json.atomAssignment.atomAssignmentList.multiplet;
            if (multiplet_list) {
                    multiplet_list = Array.isArray(multiplet_list) ? multiplet_list : [multiplet_list];
                    multiplet_list.forEach(function(multiplet, index) {
                    const peak = [multiplet._dir_dim_center, multiplet._indir_dim_center];
                    clusters.push( {peaks: peak,
                                    meta: {nmrml_cluster_index: index}});
                });
                compound.clusters = clusters;
                // TODO: Add simulated 2D Spectrum to viewer
                if (sv.structure && multiplet_list) {
                    const compound_clusters = sv.compounds(sv.compounds().length).clusters();
                    multiplet_list.forEach((multiplet, index) => {
                        const compound_cluster = compound_clusters.find((c) => {
                            return c.meta.nmrml_cluster_index === index;
                        });
                        if (multiplet.atoms && compound_cluster) {
                            let dir_dim_atom_ids = [];
                            let indir_dim_atom_ids = [];
                            const dir_dim_atom_refs = multiplet.atoms._dir_dim_atomRefs;
                            const indir_dim_atom_refs = multiplet.atoms._indir_dim_atomRefs;

                            if (dir_dim_atom_refs && dir_dim_atom_refs.match(/\w/) &&
                                indir_dim_atom_refs && indir_dim_atom_refs.match(/\w/)) {
                                dir_dim_atom_ids = dir_dim_atom_refs.trim().split(/\s+/);
                                indir_dim_atom_ids = indir_dim_atom_refs.trim().split(/\s+/);
                            }

                            dir_dim_atom_ids.forEach((atom_id, index) => {
                                dir_dim_atom_ids[index] = atom_id.replace(/\D/g, '');
                            });
                            indir_dim_atom_ids.forEach((atom_id, index) => {
                                indir_dim_atom_ids[index] = atom_id.replace(/\D/g, '');
                            });

                            compound_cluster.dir_dim_atom_refs = dir_dim_atom_ids;
                            compound_cluster.indir_dim_atom_refs = indir_dim_atom_refs;
                            const atom_ids = dir_dim_atom_ids
                                .concat(indir_dim_atom_ids.filter((id) => dir_dim_atom_ids.indexOf(id) < 0));
                            compound_cluster._atoms.merge(sv.structure.atoms(atom_ids));

                            switch (multiplet.multiplicity._name.toLowerCase()) {
                                case 'singlet feature':
                                    compound_cluster.multiplet_type = 's';
                                    break;
                                case 'doublet feature':
                                    compound_cluster.multiplet_type = 'd';
                                    break;
                                case 'triplet feature':
                                    compound_cluster.multiplet_type = 't';
                                    break;
                                case 'quartet feature':
                                    compound_cluster.multiplet_type = 'q';
                                    break;
                                case 'doublet of doublets feature':
                                    compound_cluster.multiplet_type = 'dd';
                                    break;
                                case 'doublet of doublet of doublets feature':
                                    compound_cluster.multiplet_type = 'ddd';
                                    break;
                                case 'doublet of doublet of doublets of doublets feature':
                                    compound_cluster.multiplet_type = 'dddd';
                                    break;
                                case 'triplet of doublets feature':
                                    compound_cluster.multiplet_type = 'td';
                                    break;
                                case 'doublet of triplets feature':
                                    compound_cluster.multiplet_type = 'dt';
                                    break;
                                case 'triplet of triplets feature':
                                    compound_cluster.multiplet_type = 'tt';
                                    break;
                                case 'doublet of quartets feature':
                                    compound_cluster.multiplet_type = 'dq';
                                    break;
                                case 'doublet of doublet of triplets feature':
                                    compound_cluster.multiplet_type = 'ddt';
                                    break;
                                case 'doublet of triplet of doublets feature':
                                    compound_cluster.multiplet_type = 'dtd';
                                    break;
                                case 'triplet of doublets of doublets feature':
                                    compound_cluster.multiplet_type = 'tdd';
                                    break;
                                case 'quintet feature':
                                    compound_cluster.multiplet_type = 'quint';
                                    break;
                                case 'multiplet feature':
                                    compound_cluster.multiplet_type = 'm';
                                    break;
                            }

                            // look elsewhere for the multiplicity
                            if (!compound_cluster.hasOwnProperty('multiplet_type')) {
                                switch (multiplet.multiplicity._accession) {
                                    case 'NMR:1000194':
                                        compound_cluster.multiplet_type = 's';
                                        break;
                                    case 'NMR:1000184':
                                        compound_cluster.multiplet_type = 'd';
                                        break;
                                    case 'NMR:1000185':
                                        compound_cluster.multiplet_type = 't';
                                        break;
                                    case 'NMR:1000186':
                                        compound_cluster.multiplet_type = 'q';
                                        break;
                                    case 'NMR:1000192':
                                        compound_cluster.multiplet_type = 'dd';
                                        break;
                                    case 'NMR:1000195':
                                        compound_cluster.multiplet_type = 'qunit';
                                        break;
                                    case 'NMR:1000196':
                                        compound_cluster.multiplet_type = 'dt';
                                        break;
                                    case 'NMR:1000197':
                                        compound_cluster.multiplet_type = 'td';
                                        break;
                                    case 'NMR:1400305':
                                        compound_cluster.multiplet_type = 'm';
                                        break;
                                }
                            }
                        }
                    });
                }
            }
            sv.trigger('adjust-end'); // updates Assignment table (NEED BETTER WAY)
        } else {
            console.error("Could not read in Spectrum Data");
        }

    }

                }
   

export default DataParser;