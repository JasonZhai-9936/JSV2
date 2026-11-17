
// uncomment this to before building with Parcel for npm
// Parcel index.js
import "./styles/jsv.css";
import DataParser from "./DataParser";
import { SpectraViewer1D, SpectraViewer2D } from './SpectraViewer.js';
import { build_2d_nmrml, predict_hsqc, encode_float64_base64 } from './NMR2D.js';


// JSmol needs to be loaded separately, not bundled with Parcel
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

// loadJSmol().then(Jmol => {
//     console.log("JSmol loaded", Jmol);
// }).catch(err => {
//     console.error("Failed to load JSmol", err);
// });



// Public API: the viewer classes, the parser and the 2D nmrML helpers
export { SpectraViewer1D, SpectraViewer2D, DataParser, build_2d_nmrml, predict_hsqc, encode_float64_base64 };
// For UMD/global builds (Parcel will pick this up automatically):
if (typeof window !== 'undefined') {
    window.JSV2 = { SpectraViewer1D, SpectraViewer2D, DataParser, build_2d_nmrml, predict_hsqc, encode_float64_base64 };
}