import * as d3 from 'd3';
import DataParser from './DataParser.js';
class Data {

    constructor(viewer, options={}) {
        this.viewer = viewer;
        this.options = options;
        // this.validateOptions()
        console.log("Data constructed", this.options);
        this.packageData();
        this.createLineGenerator();
    }

    validateOptions() {
        // checks all minimum requirements are passed along in options
        // if (!this.options?.dataArray?.x) 
    }

    packageData() {
        // Package file or dataArray into x and y arrays; normalize if necessary
        // self.x and self.y are used for all downstream calculations and rendering

        if (this.options.dataArray) {  // first priority over file
            this.x = this.options.dataArray.x;
            this.y = this.options.dataArray.y;
        } else if (this.options.file) {
            let parser = new DataParser(this.viewer, this.options.file);
            let data = parser.parseFile();
            this.x = data.x;
            this.y = data.y;
            // TODO: Implement the parser methods
        } else {
            throw new Error("No dataArray or file option provided to Data.")
        }
        if (this.x.length !== this.y.length) throw new Error("X and Y arrays are not of same length", this.x, this.y);
        
        if (this.options.normalize) this.normalizeToOne();
        this.maxY = d3.max(this.y)
        this.minY = d3.min(this.y)
        this.maxX = d3.max(this.x)
        this.minX = d3.min(this.x)
        console.log("Data packaged", this.minX, this.maxX, this.minY, this.maxY);
    }

    createLineGenerator() {
        // Create the line generator function
        const data = this.x.map((d, i) => ({x: d, y: this.y[i]}));
        this.lineGenerator = d3.line()
            .x(d => this.viewer.axis.xScale(d.x))             // Set x based on the data and scale
            .y(d => this.viewer.axis.yScale(d.y))             // Set y based on the data and scale
            .curve(d3.curveMonotoneX)                         // Optional: smooths the line
        
    }

    normalizeToOne() {
        let max = d3.max(this.y);
        this.y = d3.map(this.y, (d) => d / max );
        console.log("Data normalized", this.y);
    }

    getSkippedData(skipInterval) {
        
    }

    draw1DSpectrum() {
        const data = this.x.map((d, i) => ({x: d, y: this.y[i]}));
        // Append the path for the line chart
        this.linePath = this.viewer.SVG.append("path")
            .datum(data)            // Binds data to the line
            .attr("fill", "none")
            .attr("stroke", this.options.style.strokeColor)
            .attr("stroke-width", this.options.style.strokeWidth)
            .attr("d", this.lineGenerator(data))

    }




}

export default Data;