# JSpectraViewer (jsv2)

A JavaScript library for interactive, web-based visualization of spectral data for small-molecule omics research.

## Overview

JSpectraViewer renders NMR, mass spectrometry, infrared (IR), infrared ion (IRIS) and UV/Vis spectra directly in the browser, with no plugins or stand-alone software required. Spectra can be zoomed, panned, compared as mirror plots and exported as images. For NMR spectra with peak assignments, JSpectraViewer shows an interactive assignment table linked to a 3D molecular structure viewer, so observed peaks can be related to the atoms that produce them.

The library provides three main components:

- **DataParser** reads spectrum files and returns the data ready for display.
- **SpectraViewer1D** displays 1D spectra (NMR, IR, IRIS, UV/Vis, EI-MS, LC-MS).
- **SpectraViewer2D** displays 2D NMR spectra as contour plots.

## Supported spectrum types and file formats

| Spectrum | Viewer | Displayed as | File formats |
|---|---|---|---|
| 1D NMR | SpectraViewer1D | Line | nmrML, JCAMP-DX, XY/CSV/TSV |
| 2D NMR (e.g. 1H-13C HSQC) | SpectraViewer2D | Contours with 1D projections | nmrML |
| IR / IRIS | SpectraViewer1D | Line | XML, JCAMP-DX, XY/CSV/TSV |
| UV/Vis | SpectraViewer1D | Line | JCAMP-DX, XY/CSV/TSV |
| EI-MS | SpectraViewer1D | Bars | mzML, XML, XY/CSV/TSV |
| LC-MS | SpectraViewer1D | Bars | mzML, XY/CSV/TSV |

Peak assignments and molecular structures are read from nmrML files and shown in the assignment table and 3D structure viewer for both 1D and 2D NMR.

## Installation

Install from npm:

```bash
npm install jsv2
```

or with yarn:

```bash
yarn add jsv2
```

Then import the components you need:

```js
import { DataParser, SpectraViewer1D, SpectraViewer2D } from 'jsv2';
```

D3.js, 3Dmol.js, X2JS, Fast-XML-Parser and jQuery are installed automatically as dependencies. JSmol is optional and only needed if the structure viewer is set to use it instead of 3Dmol.js; it must be loaded separately in the page.

## Citation

If you use JSpectraViewer in your work, please cite:

> JSpectraViewer: A web-based spectral visualization tool for small-molecule omics research.
> Sukanta Saha, Jason Zhai, Vasuk Gautam, Harrison Peters, Jason Grant, Mark Berjanskii, Eponine Oler, Krishna M. Kovur, Prashanthi Kovur, David S. Wishart.
