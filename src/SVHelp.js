import * as JSV from "./Utils.js";

export class SVHelp {
    constructor(sv) {
        this.sv = sv;
        
        const helpContent = `
            <p>The view of the spectra can be scrolled around or scaled using the controls in the menu or by using the various mouse and keyboard shortcuts:</p>
            <h3>Viewer Controls</h3>
            <table class="jsv-table">
                <thead><tr><th>Action</th><th>Command</th></tr></thead>
                <tbody>
                    <tr><td>Zoom In/Out X Axis</td><td>Scroll wheel</td></tr>
                    <tr><td>Zoom In/Out Y Axis</td><td>Option/Alt Key + Scroll wheel</td></tr>
                    <tr><td>Zoom In on Area</td><td>Option/Alt Key + Click and Drag around area</td></tr>
                    <tr><td>Zoom Out Completely</td><td>Option/Alt Key + Click once anywhere on viewer</td></tr>
                    <tr><td>Move Around</td><td>Click and Drag</td></tr>
                </tbody>
            </table>
            <h3>Zoombox Controls (box in upper right corner)</h3>
            <table class="jsv-table">
                <thead><tr><th>Action</th><th>Command</th></tr></thead>
                <tbody>
                    <tr><td>Move Around</td><td>Click and Drag grey selection box</td></tr>
                    <tr><td>Zoom In on Area</td><td>Click on unselected region and drag around new selection</td></tr>
                    <tr><td>Zoom Out Completely</td><td>Click once anywhere in unselected region</td></tr>
                    <tr><td>Alter Zoomed Area</td><td>Click and Drag on sides of grey selection box</td></tr>
                </tbody>
            </table>
            <h3>Troubleshooting</h3>
            <p>If the viewer is not showing any spectra or is slow, try updating to the latest version of your browser. We have found that <a href="https://www.google.com/chrome" target="_blank">Google Chrome</a> is the fastest.</p>
        `;
        
        this.dialog = new JSV.SVDialog(sv, {
            header_text: 'JSpectraViewer (JSV) Help',
            content_text: helpContent,
            buttons: {
                'Close': function() { this.close(); }
            },
            width: 700,
            height: 450
        });
    }
}