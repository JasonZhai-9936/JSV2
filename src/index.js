// must import jquery before any other imports
import $ from "jquery";
import "./styles/styles.css";
import { SpectraViewer1D, SpectraViewer2D } from "./SpectraViewer";
import DataParser from "./DataParser";
import {data, assignmentData} from "./1D_data.js";
// import data from "./2D_data.js";
import data from "./eims_data.js";

// These are the API options that the user will provide.
// We need to handle them under the hood via the Viewer class
// and propagate to helper classes like Data, Axis, etc.

const fileDropzone = document.querySelector("#jsv2-file-dropzone");
console.log("dropzoneeee", fileDropzone)

// import jsMolUrl from './lib/jsmol/JSmol.min.js?url';

// function loadJSmol() {
//   if (window.Jmol) return Promise.resolve(window.Jmol);

//   return new Promise((resolve, reject) => {
//     const script = document.createElement('script');
//     script.src = jsMolUrl;  // Hashed path like /dist/JSmol.min.abc123.js
//     script.onload = () => resolve(window.Jmol);
//     script.onerror = reject;
//     document.head.appendChild(script);
//   });
// }


// Load JSmol if not already loaded
// loadJSmol().then(Jmol => {
//     console.log("JSmol loaded", Jmol);
//     // Initialize JSmol with the provided options
// }).catch(error => {
//     console.error("Failed to load JSmol:", error);
// });

// ------------------------------------------------------------------
// Module-level viewer reference so the mirror parser can access the
// same instance after it's constructed.
// ------------------------------------------------------------------
let viewer = null;

// ------------------------------------------------------------------
// PRIMARY file input
// ------------------------------------------------------------------
let dataParser = new DataParser("#jsv2-file-dropzone", {
    // dataType: "1D-EIMS",
    // dataType: "1D-NMR",
    // dataType: "2D-NMR",
    // dataType: "1D-LCMS",
    dataType: "1D-IR",
    // dataType: "1D-UV",
    
    expectedDataTag: "ms-ir-spectrum",
    // expectedDataTag: "spectrum.binary"
    // expectedDataTag: "spectrumDataArray",
    // expectedDataTag: "binary",
    // expectedAssignmentDataTag: "atomAssignmentList"
    // customDataParser: function() {
        
    // }
});

// Add error handler
dataParser.addEventListener("fileParseError", (event) => {
    console.error("File parse error:", event.detail);
    alert(`Error loading file: ${event.detail.error}`);
});

dataParser.addEventListener("fileParsed", (event) => {
    console.log("file parsed", event);
    
    // Check if this is a MOL file (3D structure data)
    if (event.detail.dataType === 'MOL_STRUCTURE') {
        console.log("Processing MOL file for 3D visualization");
        initializeMol3DViewer(event.detail);
        return; // Don't create spectral viewer for MOL files
    }
    
    // Handle spectroscopy files (NMR, etc.) - your existing code
    // console.log("assignmentData", assignmentData);
    // let viewer = new SpectraViewer2D("#graph-1", {
    //     debug: false,
    //     width: 1650,
    //     height: 600,
    //     zoom_min: 0.1,
    //     cluster_navigation_id: '#cluster-navigation',
    //     simplify_tolerance: 0.01,
    //     dataset: {  // MUST BE A JSON OBJECT NOT ARRAY AS 2D VIEWER EXPECTS A SINGLE DATASET with x,y,z
    //         dataArray: {
    //             x: event.detail.x,
    //             y: event.detail.y,
    //             z: event.detail.z
    //         }
    //     },
    //     highlight: {
    //         restriction_spectrum_id: 'Assignment',
    //         element_type: 'peak',
    //         display: { fill: 'rgba(238, 238, 255, 0.7)' },
    //         visible_only: false
    //     },
    //     assignmentTable: {
    //         container_id: '#assignment-table-1',
    //         edit_mode: false
    //     }
    // }); 
    viewer = new SpectraViewer1D("#graph-1", {
        name: "ir-viewer",
        // name: "nmr-viewer",
        width: 1650,
        height: 400,
        margin: {
            top: 50,
            bottom: 50,
            right: 50,
            left: 50
        },
        chartTitle: {
            text: "IR Spectrum",
            // text: "NMR Spectrum",
            // text: "EI-MS Spectrum",
            fontSize: 200,
            color: "black",
            underline: true
        },
        chartType: "1D-IR",
        // chartType: "1D-NMR",
        // chartType: "1D-LCMS",
        // chartType: "1D-UV",

        // NOTE: simplifyTolerance must be at the TOP LEVEL (not inside dataset[]) because
        // SpectraViewer reads options.dataset?.simplifyTolerance where options.dataset is
        // the array — so a per-dataset value is silently ignored.
        // 0.005 is appropriate for 0-1 normalised IR intensity data.
        // For NMR use ~0.0001; for raw IR transmittance (0-100 scale) use ~0.5
        simplifyTolerance: 0.005,
        // simplifyTolerance: 0.0001,  // NMR

        dataset: [
            {   // Either provide dataArray OR fileUpload option [in both cases, eventually x and y should be set to Data.x and Data.y]
                // dataParser: dataParser,
                // dataArray: {
                //     x: event.detail.x,
                //     y: event.detail.y
                // },
                dataArray: {
                //     // x: [0, 2, 3, 4, 5, 6, 7, 8, 9, 11],
                //     // y: [0.0, 0.4, 2, 0.3, 0.0, 1.4, 0.3, 0.2, 0.1, 1]
                //     x: data.x,
                //     y: data.y
                    x: event.detail.x,
                    // IR y is already normalised intensity 0-1, pass through directly.
                    // Do NOT apply (1 - val) * 100 transmittance inversion for IRIS files.
                    y: event.detail.y,
                },
                isMirrorPlot: false,
                // simplifyTolerance here is IGNORED — set it at the top level above instead
                // simplifyTolerance: 0.005,
                normalize: false,  // data is already normalised 0-1
                name: event.detail.assignmentData?.name || "IR Spectrum",
                // name: event.detail.assignmentData?.name || "NMR Spectrum",
                // type: "simulated",  // experimental, simulated
                style: {
                    strokeColor: "red",
                    strokeWidth: 1
                },
            },
        
        //     {   
        //     // dataParser: dataParser,
        //     // dataArray: {
        //     //     x: event.detail.x,
        //     //     y: event.detail.y
        //     // },
        // {
        //     dataArray: {
        //         // x: [0, 2, 3, 4, 5, 6, 7, 8, 9, 11],
        //         // y: [0.0, 0.4, 2, 0.3, 0.0, 1.4, 0.3, 0.2, 0.1, 1]
        //         // x: data.x,
        //         // y: data.y,
        //         x: event.detail.x,
        //         y: event.detail.y,
        //     },
        //     isMirrorPlot: false,
        //     simplifyTolerance: 100,
        //     normalize: false,  // scale y to 1
        //     name: "Test Dummy Data",
        //     type: "experimental",  // experimental, simulated
        //     style: {
        //         strokeColor: "blue",
        //         strokeWidth: 1
        //     },
        //     id: "test-dummy-data-2"
        // },
        ],
        // dataset: {
        //     dataArray: {
        //         x: data.x,
        //         y: data.y,
        //         z: data.z
        //     }
        // },
        axis: {
            minBoundaries: {
                x: [550, 1900],   // IR wavenumber range (cm⁻¹)
                // x: [-1, 12],   // NMR ppm range
                y: [-0.05, 1.1],  // normalised intensity 0-1 with padding
                // y: [-0.1, 1.1], // NMR
            },
            x: {
                enabled: true,
                reverse: true,  // IR/NMR convention: high values on left
                label: {
                    text: "IR Frequency (cm⁻¹)",
                    // text: "Chemical Shift (ppm)",
                    fontSize: 15,
                },
                ticks: 20,
            },
            y: {
                enabled: true,
                label: {
                    text: "Normalized Intensity",
                    // text: "Intensity",
                    fontSize: 15,
                },
                ticks: 11,
            }
        },
        grid: {
            horizontal: {
                enabled: true,
                strokeColor: "steelblue",
                strokeWidth: 0.5,
                opacity: 0.1,
                ticks: 15
            },
            vertical: {
                enabled: true,
                strokeColor: "black",
                strokeWidth: 1,
                opacity: 1,
                ticks: 10
            }
        },
        zoomBox: {
            enabled: true,
            size: 15,
        },
        controls: {
            enabled: true,
            options: {
                zoom: {
                    vertical: true,
                    horizontal: true,
                    max: 100
                },
                pan: {
                    vertical: true,
                    horizontal: true
                },
                reset: true,
                download: {
                    formats: ["png", "svg", "pdf"],
                    filename: "ir_spectrum"
                    // filename: "nmr_spectrum"
                },
                // fullscreen: true
            }
        },
        zoomBox: {
            enabled: true,
            position: "top-right",
            width: 200,
            height: 100,
        },
        // CRITICAL FIX: Don't include assignmentTable at all if no data exists
        // This prevents SVStructure from being created for IR files
        ...(event.detail.assignmentData && {
            assignmentTable: {
                enabled: true,
                containerID: "#assignment-table-1",
                clusterNavigationID: "#cluster-navigation-1",
                data: [event.detail.assignmentData],
                structure: {
                    containerID: '#structure',
                    use_jsmol: true,
                    show_atom_numbers: true,
                    show_hydrogen: true,
                    width: 400,
                    height: 400,
                    format: 'nmrml',
                    data: [event.detail.assignmentData]
                },
            }
        })

    });

    viewer.draw();

    // Expose viewer on window so SVMenu mirror button can access it,
    // and reveal the mirror dropzone now that a primary spectrum is loaded.
    window._jsvViewer = viewer;
    document.getElementById('mirror-dropzone-container').style.display = 'block';

});

// ------------------------------------------------------------------
// MIRROR file input
// Wired up once at module load — the handler guards against viewer
// not yet being set.
// ------------------------------------------------------------------
let mirrorParser = new DataParser("#jsv2-mirror-dropzone", {
    // dataType: "1D-EIMS",
    // dataType: "1D-NMR",
    // dataType: "2D-NMR",
    // dataType: "1D-LCMS",
    dataType: "1D-IR",
    // dataType: "1D-UV",

    expectedDataTag: "ms-ir-spectrum",
    // expectedDataTag: "spectrum.binary"
    // expectedDataTag: "spectrumDataArray",
    // expectedDataTag: "binary",
});

mirrorParser.addEventListener("fileParseError", (event) => {
    console.error("Mirror file parse error:", event.detail);
    alert(`Error loading mirror file: ${event.detail.error}`);
});

mirrorParser.addEventListener("fileParsed", (event) => {
    if (!viewer) {
        alert("Load a primary spectrum first.");
        return;
    }

    viewer.add_mirror_spectrum({
        x: event.detail.x,
        y: event.detail.y,  // 0-1 normalised intensity, no transform needed
        name: event.detail.assignmentData?.name || "Mirror Spectrum",
        color: "blue",
    });
});


// Function to initialize 3DMol viewer for MOL files
function initializeMol3DViewer(molData) {
    console.log("Initializing 3D molecular viewer with data:", molData);
    
    // Try to load 3DMol library
    Promise.resolve().then(() => {
        // Try dynamic import first
        return import('3dmol');
    }).then((mol3d) => {
        const $3Dmol = mol3d.default || mol3d;
        
        // Clear the existing viewer
        const viewerElement = document.getElementById('mol-3d');
        if (!viewerElement) {
            throw new Error("3D viewer element not found");
        }
        
        viewerElement.innerHTML = '';
        
        // Create 3DMol viewer
        const viewer = $3Dmol.createViewer(viewerElement, {
            width: 300,
            height: 300,
            backgroundColor: 'white'
        });
        
        // Convert MOL data to 3DMol format
        const molString = createMolString(molData);
        console.log("Generated MOL string:", molString);
        
        // Add the molecule to the viewer
        viewer.addModel(molString, 'mol');
        
        // Set style: stick representation with spheres
        viewer.setStyle({}, {
            stick: { 
                radius: 0.15,
                colorscheme: 'default'
            },
            sphere: { 
                radius: 0.25,
                colorscheme: 'default'
            }
        });
        
        // Add labels for atoms
        try {
            const model = viewer.getModel(0);
            if (model) {
                const atoms = model.selectedAtoms({});
                atoms.forEach((atom, index) => {
                    if (atom && atom.elem) {
                        viewer.addLabel(atom.elem + (index + 1), {
                            position: atom,
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            fontColor: 'white',
                            fontSize: 10
                        });
                    }
                });
            }
        } catch (labelError) {
            console.warn("Could not add atom labels:", labelError);
        }
        
        // Zoom to fit and render
        viewer.zoomTo();
        viewer.render();
        
        console.log("3D viewer initialized successfully");
        console.log(`Loaded molecule: ${molData.moleculeName} (${molData.numAtoms} atoms, ${molData.numBonds} bonds)`);
        
    }).catch(error => {
        console.error("Error loading 3DMol:", error);
        
        // Fallback: display basic molecular information
        displayMolecularInfo(molData);
    });
}

// Create MOL string from parsed data
function createMolString(molData) {
    let molString = '';
    
    // Header lines
    molString += (molData.moleculeName || 'Molecule') + '\n';
    molString += (molData.info || 'Generated') + '\n';
    molString += (molData.comments || 'From parsed MOL file') + '\n';
    
    // Counts line
    const atomCount = molData.numAtoms.toString().padStart(3, ' ');
    const bondCount = molData.numBonds.toString().padStart(3, ' ');
    molString += `${atomCount}${bondCount}  0  0  0  0  0  0  0  0999 V2000\n`;
    
    // Atom block
    molData.atoms.forEach(atom => {
        const x = atom.x.toFixed(4).padStart(10, ' ');
        const y = atom.y.toFixed(4).padStart(10, ' ');
        const z = atom.z.toFixed(4).padStart(10, ' ');
        const element = atom.element.padEnd(3, ' ');
        molString += `${x}${y}${z} ${element} 0  0  0  0  0  0  0  0  0  0  0  0\n`;
    });
    
    // Bond block
    molData.bonds.forEach(bond => {
        const atom1 = (bond.atom1 + 1).toString().padStart(3, ' '); // Convert to 1-based
        const atom2 = (bond.atom2 + 1).toString().padStart(3, ' ');
        const bondType = bond.bondType.toString().padStart(3, ' ');
        molString += `${atom1}${atom2}${bondType}  0\n`;
    });
    
    molString += 'M  END\n';
    return molString;
}

// Fallback function to display molecular information
function displayMolecularInfo(molData) {
    const viewerElement = document.getElementById('mol-3d');
    if (viewerElement) {
        viewerElement.innerHTML = `
            <div style="padding: 20px; text-align: center; background: #f9f9f9; border-radius: 8px;">
                <h4 style="color: #333; margin-top: 0;">${molData.moleculeName || 'Unknown Molecule'}</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0;">
                    <div><strong>Atoms:</strong> ${molData.numAtoms}</div>
                    <div><strong>Bonds:</strong> ${molData.numBonds}</div>
                </div>
                <div style="font-size: 12px; color: #666; margin-top: 10px;">
                    <div><strong>Info:</strong> ${molData.info || 'N/A'}</div>
                    <div style="margin-top: 5px;"><strong>Comments:</strong> ${molData.comments || 'N/A'}</div>
                </div>
                <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 4px; font-size: 11px;">
                    <strong>Note:</strong> 3D visualization requires 3DMol library.<br>
                    Basic molecular structure information shown instead.
                </div>
                <div style="margin-top: 10px; font-size: 11px; color: #666;">
                    <strong>Atom Types:</strong> ${getUniqueElements(molData.atoms).join(', ')}
                </div>
            </div>
        `;
    }
}

// Helper function to get unique elements
function getUniqueElements(atoms) {
    const elements = atoms.map(atom => atom.element);
    return [...new Set(elements)].sort();
}