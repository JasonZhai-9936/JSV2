import * as d3 from 'd3';
import * as JSV from "./Utils.js";

export class SVMenu {
    

    static generateSVG(sv, width, height) {
        // Get the spectrum data
        const spectra = sv.all_spectra().get();
        const xDomain = sv.scale.x.domain();
        const yDomain = sv.scale.y.domain();
        
        // Calculate scales
        const margin = { top: 50, right: 50, bottom: 60, left: 70 };
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;
        
        const xScale = (x) => margin.left + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotWidth;
        const yScale = (y) => margin.top + plotHeight - ((y - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotHeight;
        
        let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <!-- White background -->
  <rect width="${width}" height="${height}" fill="white"/>
  
  <!-- Title -->
  <text x="${width/2}" y="25" text-anchor="middle" font-size="20" font-weight="bold">${sv.title || 'Spectrum'}</text>
  
  <!-- Grid lines -->
  <g stroke="#e0e0e0" stroke-width="0.5">`;
        
        // Y grid lines
        const yTicks = 10;
        for (let i = 0; i <= yTicks; i++) {
            const y = yDomain[0] + (yDomain[1] - yDomain[0]) * i / yTicks;
            const yPos = yScale(y);
            svg += `
    <line x1="${margin.left}" y1="${yPos}" x2="${width - margin.right}" y2="${yPos}"/>`;
        }
        
        // X grid lines
        const xTicks = 10;
        for (let i = 0; i <= xTicks; i++) {
            const x = xDomain[0] + (xDomain[1] - xDomain[0]) * i / xTicks;
            const xPos = xScale(x);
            svg += `
    <line x1="${xPos}" y1="${margin.top}" x2="${xPos}" y2="${height - margin.bottom}"/>`;
        }
        
        svg += `
  </g>
  
  <!-- Axes -->
  <g stroke="black" stroke-width="2" fill="none">
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"/>
    <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"/>
  </g>
  
  <!-- Axis labels -->
  <g font-size="12" text-anchor="middle">`;
        
        // Y axis labels
        for (let i = 0; i <= yTicks; i++) {
            const y = yDomain[0] + (yDomain[1] - yDomain[0]) * i / yTicks;
            const yPos = yScale(y);
            svg += `
    <text x="${margin.left - 10}" y="${yPos + 4}" text-anchor="end">${y.toFixed(2)}</text>`;
        }
        
        // X axis labels
        for (let i = 0; i <= xTicks; i++) {
            const x = xDomain[0] + (xDomain[1] - xDomain[0]) * i / xTicks;
            const xPos = xScale(x);
            svg += `
    <text x="${xPos}" y="${height - margin.bottom + 20}">${x.toFixed(1)}</text>`;
        }
        
        svg += `
  </g>
  
  <!-- Axis titles -->
  <text x="${width/2}" y="${height - 10}" text-anchor="middle" font-size="14">${sv.axis_x_title || 'X'}</text>
  <text x="20" y="${height/2}" text-anchor="middle" font-size="14" transform="rotate(-90, 20, ${height/2})">${sv.axis_y_title || 'Y'}</text>
  
  <!-- Spectra -->`;
        
        // Draw each spectrum
        spectra.forEach((spectrum, idx) => {
            if (!spectrum.visible) return;
            
            const xData = spectrum.xy_data.x;
            const yData = spectrum.xy_data.y;
            const color = spectrum.color || 'black';
            
            // Generate path data
            let pathData = '';
            for (let i = 0; i < xData.length; i++) {
                const x = xScale(xData[i]);
                const y = yScale(yData[i]);
                pathData += (i === 0 ? 'M' : 'L') + x + ',' + y;
            }
            
            svg += `
  <path d="${pathData}" stroke="${color}" stroke-width="1.5" fill="none"/>`;
        });
        
        svg += `
</svg>`;
        
        return svg;
    }

    static download_image(sv, dialog) {
        const format = sv.sv_wrapper.select('#jsv-save-format').property('value');
        // Images are exported at the viewer's current size
        const height = sv.height;
        const width = sv.width;
        
        dialog.close();
        
        if (format === 'csv') {
            // Export CSV data
            const spectra = sv.all_spectra().get();
            let csv = 'X,Y\n';
            
            if (spectra.length > 0) {
                const spectrum = spectra[0];
                const xData = spectrum.xy_data.x;
                const yData = spectrum.xy_data.y;
                
                for (let i = 0; i < xData.length; i++) {
                    csv += xData[i] + ',' + yData[i] + '\n';
                }
            }
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'spectrum_data.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else if (format === 'svg') {
            // SVG export
            const svgContent = SVMenu.generateSVG(sv, width, height);
            const blob = new Blob([svgContent], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'spectrum.svg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else if (format === 'jpeg') {
            // JPEG export
            const imageData = sv.image(width, height);
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob(function(blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'spectrum.jpg';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 'image/jpeg', 0.95);
            };
            img.src = imageData;
        } else {
            // PNG export with solid white background
            const imageData = sv.image(width, height);
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                // Fill white background first
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob(function(blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'spectrum.png';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 'image/png');
            };
            img.src = imageData;
        }
    }

    static download_html(sv) {
        // SVG and CSV export read 1D line data (xy_data), which 2D spectra don't have
        const line_formats = sv.toString() === 'SpectraViewer2D' ? '' :
            '<option value="svg">SVG Vector</option>' +
            '<option value="csv">CSV Data (X, Y)</option>';
        return   '' +
        '<div class="jsv-alert">Select a format to download the spectrum.</div>' +
        '<div><label class="jsv-label">Format</label><div class="jsv-input-group">' +
        '<select class="jsv-input" id="jsv-save-format" style="width: 100%;">' +
        '<option value="png">PNG Image</option>' +
        '<option value="jpeg">JPEG Image</option>' +
        line_formats +
        '</select></div></div>';
    }

    static line_function() {
        return d3.line()
            .x(function(d) { return d.x; })
            .y(function(d) { return d.y; })
            .curve(d3.curveLinear);
    }

    static button(svg, x, y, width, height, path_group) {
        console.log('button>', svg)
        const button_group = svg.append('g').attr('class', 'jsv-menu-button');
        button_group.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', height)
            .attr('rx', 2)
            .attr('ry', 2)
            .style('stroke-width', 1);
    
        const path = path_group.remove();
        button_group.append('g').
        attr('class', 'jsv-button-image').
        append(function() { return path.node(); });
    
        button_group.attr('transform', 'translate(' + x + '.5,' + y + '.5)')
    
        return button_group;   
    }

    static download_path(svg) {
        const group = svg.append('g');
        const stroke_width = 3;
        group.append('line')
            .attr('x1', 10)
            .attr('y1', 0)
            .attr('x2', 10)
            .attr('y2', 12)
            .attr('stroke-linecap', 'round')
            .attr('stroke-width', stroke_width);;
        group.append('line')
            .attr('x1', 6)
            .attr('y1', 7)
            .attr('x2', 10)
            .attr('y2', 12)
            .attr('stroke-linecap', 'round')
            .attr('stroke-width', stroke_width);
        group.append('line')
            .attr('x1', 14)
            .attr('y1', 7)
            .attr('x2', 10)
            .attr('y2', 12)
            .attr('stroke-linecap', 'round')
            .attr('stroke-width', stroke_width);
        group.append('line')
            .attr('x1', 2)
            .attr('y1', 16)
            .attr('x2', 18)
            .attr('y2', 16)
            .attr('stroke-linecap', 'round')
            .attr('stroke-width', stroke_width);
    
        return group;
    }

    static settings_path(svg) {
        const group = svg.append('g');
        const stroke_width = 4;
        group.append('circle')
            .attr('cx', 10)
            .attr('cy', 10)
            .attr('r', 7)
            .style('fill', 'rgb(75, 75, 75');
        group.append('line')
            .attr('x1', 10)
            .attr('y1', 1)
            .attr('x2', 10)
            .attr('y2', 19)
            .attr('stroke-width', stroke_width);
        group.append('line')
            .attr('x1', 1)
            .attr('y1', 10)
            .attr('x2', 19)
            .attr('y2', 10)
            .attr('stroke-width', stroke_width);
        group.append('line')
            .attr('x1', 3.5)
            .attr('y1', 3.5)
            .attr('x2', 16.5)
            .attr('y2', 16.5)
            .attr('stroke-width', stroke_width);
        group.append('line')
            .attr('x1', 16.5)
            .attr('y1', 3.5)
            .attr('x2', 3.5)
            .attr('y2', 16.5)
            .attr('stroke-width', stroke_width);
        group.append('circle')
            .attr('cx', 10)
            .attr('cy', 10)
            .attr('r', 3)
            .style('fill', 'white');
    
        return group;
    }

    static scale_path(svg, x, y, width, height, angle) {
        const group = svg.append('g');
        const stroke_width = 1;
        const gap = 2;
        const y1_with_gap = y + gap;
        const y2_with_gap = y + height - gap;
        const head_len = 2;
        const center = x + (width / 2);
        group.append('line')
            .attr('x1', x)
            .attr('y1', y)
            .attr('x2', x + width)
            .attr('y2', y)
            .attr('stroke-width', stroke_width);
        group.append('line')
            .attr('x1', x)
            .attr('y1', y + height)
            .attr('x2', x + width)
            .attr('y2', y + height)
            .attr('stroke-width', stroke_width);
        group.append('line')
            .attr('x1', center)
            .attr('y1', y1_with_gap)
            .attr('x2', center)
            .attr('y2', y2_with_gap)
            .attr('stroke-width', stroke_width);
        group.append('line')
            .attr('x1', center)
            .attr('y1', y1_with_gap)
            .attr('x2', center - head_len)
            .attr('y2', y1_with_gap + head_len)
            .attr('stroke-width', stroke_width);
        group.append('line')
            .attr('x1', center)
            .attr('y1', y1_with_gap)
            .attr('x2', center + head_len)
            .attr('y2', y1_with_gap + head_len)
            .attr('stroke-width', stroke_width);
        group.append('line')
            .attr('x1', center)
            .attr('y1', y2_with_gap)
            .attr('x2', center - head_len)
            .attr('y2', y2_with_gap - head_len)
            .attr('stroke-width', stroke_width);;
        group.append('line')
            .attr('x1', center)
            .attr('y1', y2_with_gap)
            .attr('x2', center + head_len)
            .attr('y2', y2_with_gap - head_len)
            .attr('stroke-width', stroke_width);;
    
        group
            .attr('stroke', 'rgb(150, 150, 150)')
            .attr('transform', 'rotate(' + angle + ',' + x + ',' + y + ')');
        return group;
    
    }

    static minus_path(svg) {
        return svg.append('line')
            .attr('x1', 3)
            .attr('y1', 8)
            .attr('x2', 13)
            .attr('y2', 8)
            .attr('stroke-width', 3)
            .attr('stroke', 'black');
    }

    static plus_path(svg) {
        const group = svg.append('g');
        group.append('line')
            .attr('x1', 3)
            .attr('y1', 8)
            .attr('x2', 13)
            .attr('y2', 8)
            .attr('stroke-width', 3)
            .attr('stroke', 'black');
    
        group.append('line')
            .attr('x1', 8)
            .attr('y1', 3)
            .attr('x2', 8)
            .attr('y2', 13)
            .attr('stroke-width', 3)
            .attr('stroke', 'black');
    
        return group;
    }

    static path(svg, path_data) {
        return svg.append('path')
            .attr('d', SVMenu.line_function(path_data))
            .attr('stroke', 'black')
            // .attr('stroke-linecap', 'round')
            .attr("stroke-width", 3)
            .attr("fill", "none");    
    }

    static scroll_interval(sv, axis, translate_px, delay) {
        return setInterval(function() {
            sv.translate_axis(axis, translate_px);
            sv.fast_draw();
        }, delay)
    }

    constructor(sv) {
        console.log("SVMenu constructor")
        const self = this;
        this.sv = sv;
        this.slide_time = 500;
        this._visible = true;
        this.menu = sv.sv_wrapper.append('div')
            .style('visibility', 'hidden')
            .attr('class', 'jsv-menu')
            .on('click', function() { window.getSelection().removeAllRanges() });
    
        this.menu_svg = this.menu.append('svg')
            .attr('width', this.width())
            .attr('height', this.height());
    
        this.handle = sv.sv_wrapper.append('div')
            .attr('class', 'jsv-menu-handle')
            .on('click', function() {
                console.log("handle click", self.opened())
                if (self.opened()) {
                  self.close();
                } else {
                  self.open();
                }
            })
            .on('mouseover', function() { self.handle_mouseover(); })
            .on('mouseout', function() { self.handle_mouseout(); });
        const handle_width = 40;
        const handle_height = 12;
    
        this.handle_svg = this.handle.append('svg')
            .attr('width', handle_width)
            .attr('height', handle_height);
    
        this.stroke_width = 4
        this.handle_data_closed = [ {x: 0, y: 0}, {x: handle_width/2, y: handle_height - this.stroke_width}, {x: handle_width, y: 0} ];
        this.handle_data_opened = [ {x: 0, y: handle_height}, {x: handle_width/2, y: this.stroke_width}, {x: handle_width, y: handle_height} ];
        
        this.draw();
        sv.trigger('domain-change.menu');
        this.open();
        // this.close(0); 
    }

    visible(value) {
        if (arguments.length == 0) return this._visible;
        if (value) {
          this._visible = true;
          this.handle.style('visibility', 'visible');
          this.menu.style('visibility', 'visible');
        } else {
          this._visible = false;
          this.handle.style('visibility', 'hidden');
          this.menu.style('visibility', 'hidden');
        }
    }
    
    opened() {
        return (this.menu.style('visibility') == 'visible');
    }
        
    width() {
        // return this.menu.node().offsetWidth;
        // return this.menu.node().getBoundingClientRect().width;
        return 300;
    }

    height() {
        // return this.menu.node().offsetHeight;
        // return this.menu.node().getBoundingClientRect().height;
        return  41;
    }

    open(duration) {
        console.log("opening menu")
        duration = JSV.default_for(duration, this.slide_time)
        this.menu.style('visibility', 'visible');
        this.menu.transition().duration(duration)
            .style('top', '0px')
            .style('opacity', 1);
    
        this.handle_path.transition().duration(duration).attr('d', SVMenu.line_function()(this.handle_data_opened))
    }
    
    close(duration) {
        duration = JSV.default_for(duration, this.slide_time)
        this.menu.transition().duration(duration)
            .style('top', '-50px')
            .style('opacity', 0)
            .on('end', function() {
              d3.select(this).style('visibility', 'hidden');
            });
    
        this.handle_path.transition().duration(duration).attr('d', SVMenu.line_function()(this.handle_data_closed))
    }
    
    handle_mouseover() {
        this.handle_path.transition().duration(200)
            .attr('stroke', 'black');
    }
    
    handle_mouseout() {
        this.handle_path.transition().duration(200)
            .attr('stroke', 'grey');
    }

    mag_path(svg) {
        let group = svg.append('g');
        group.append('circle')
            .attr('cx', 13)
            .attr('cy', 12)
            .attr('r', 9)
            .style('fill', 'grey');
        group.append('circle')
            .attr('cx', 13)
            .attr('cy', 12)
            .attr('r', 7)
            .style('fill', 'white');
        group.append('line')
            .attr('x1', 17)
            .attr('y1',17)
            .attr('x2', 25)
            .attr('y2', 25)
            .attr('stroke-width', 3)
            .attr('stroke', 'black');
        group.append('line')
            .attr('x1', 9)
            .attr('y1',12)
            .attr('x2', 17)
            .attr('y2', 12)
            .attr('stroke-width', 3)
            .attr('stroke', 'black');
        return group;
    }
    

    draw() {
        const sv = this.sv;
        const self = this;
        let timeout;
        let translate_px = 5;
        let mousedown_delay = 4;
        
        const line = d3.line()
            .x(function(d) { return d.x; })
            .y(function(d) { return d.y; })
            .curve(d3.curveLinear);

        // Handle
        this.handle_path = this.handle_svg.append("path")
            .attr("d", SVMenu.line_function()(this.handle_data_closed))
            .attr("stroke", "grey")
            .attr("stroke-width", this.stroke_width)
            .attr("fill", "none");
    
        if (this.sv.constructor.name === 'SpectraViewer') {
          // Scroll/Move Buttons
          const left_arrow_data = [{x: 11, y: 4}, {x: 4, y: 15}, {x: 11, y: 26}];
          const right_arrow_data = [{x: 4, y: 4}, {x: 11, y: 15}, {x: 4, y: 26}];
    
          const left_arrow = SVMenu.path(this.menu_svg, left_arrow_data);
          const right_arrow = SVMenu.path(this.menu_svg, right_arrow_data);
    
          this.nav_group = this.menu_svg.append('g');
          console.log('nav_group>', this.nav_group)
          this.scroll_left_button = SVMenu.button(this.nav_group, 0, 0, 15, 30, left_arrow);
          this.scroll_right_button = SVMenu.button(this.nav_group, 17, 0, 15, 30, right_arrow);
          this.nav_group.attr('transform', 'translate(' + 7 + ',' + 4 + ')');
    
          this.scroll_left_button.on('mousedown', function () {
            if (d3.select(this).classed('disabled')) return;
            timeout = SVMenu.scroll_interval(sv, 'x', translate_px, mousedown_delay);
            return false;
          })
    
          this.scroll_right_button.on('mousedown', function () {
            if (d3.select(this).classed('disabled')) return;
            timeout = SVMenu.scroll_interval(sv, 'x', -translate_px, mousedown_delay);
            return false;
          })
    
          $(document).mouseup(function () {
            if (timeout) {
              clearInterval(timeout);
              sv.full_draw();
            }
          });
        } else {
          // reset zoom button
          this.reset_zoom_button = SVMenu.button(this.menu_svg, 10, 4, 30, 30, this.mag_path(this.menu_svg));
          this.reset_zoom_button.on('click', function() {
            if (d3.select(this).classed('disabled')) return;
            const new_domains =  [ [-10, 500], [-10, 500]  ];
            sv.move_to(new_domains, 1000)
          })
        }
    
        // Zoom Buttons
        this.zoom_group = this.menu_svg.append('g');
        this.zoom_y_minus_button = SVMenu.button(this.zoom_group, 6, 18, 16, 16, SVMenu.minus_path(this.menu_svg));
        this.zoom_y_plus_button = SVMenu.button(this.zoom_group, 6, 0, 16, 16, SVMenu.plus_path(this.menu_svg));
        this.zoom_x_minus_button = SVMenu.button(this.zoom_group, 25, 9, 16, 16, SVMenu.minus_path(this.menu_svg));
        this.zoom_x_plus_button = SVMenu.button(this.zoom_group, 43, 9, 16, 16, SVMenu.plus_path(this.menu_svg));
        SVMenu.scale_path(this.zoom_group, 0, 0.5, 5, 34, 0);
        SVMenu.scale_path(this.zoom_group, 25.5, 32, 5, 34, -90);
        this.zoom_group.attr('transform', 'translate(' + 55 + ',' + 2 + ')');
    
        this.zoom_x_minus_button.on('click', function() {
          if (d3.select(this).classed('disabled')) return;
          const zoom_diff = sv.scale.x.diff() / 2;
          const new_domains = [[sv.scale.x.min() - zoom_diff, sv.scale.x.max() + zoom_diff], sv.scale.y.domain()];
          sv.move_to(new_domains)
        })
    
        this.zoom_x_plus_button.on('click', function() {
          if (d3.select(this).classed('disabled')) return;
          const zoom_diff = sv.scale.x.diff() / 4;
          const new_domains =  [ [sv.scale.x.min() + zoom_diff, sv.scale.x.max() - zoom_diff], sv.scale.y.domain() ];
          sv.move_to(new_domains)
        })
    
        this.zoom_y_minus_button.on('click', function() {
          if (d3.select(this).classed('disabled')) return;
          const zoom_diff = sv.scale.y.diff() / 2;
          const new_domains =  [ sv.scale.x.domain(), [sv.scale.y.min() - zoom_diff, sv.scale.y.max() + zoom_diff] ];
          sv.move_to(new_domains)
        })
    
        this.zoom_y_plus_button.on('click', function() {
          if (d3.select(this).classed('disabled')) return;
          const zoom_diff = sv.scale.y.diff() / 4;
          const new_domains =  [ sv.scale.x.domain(), [sv.scale.y.min() + zoom_diff, sv.scale.y.max() - zoom_diff] ];
          sv.move_to(new_domains)
        })
    
        // Set button disabled status
        sv.on('domain-change.menu', function() {
          if (sv.zoom_x == 1) {
            self.zoom_x_minus_button.classed('disabled', true);
          } else if (sv.zoom_x >= sv.zoom_max) {
            self.zoom_x_plus_button.classed('disabled', true);
          } else {
            self.zoom_x_minus_button.classed('disabled', false);
            self.zoom_x_plus_button.classed('disabled', false);
          }
          if (sv.zoom_y == 1) {
            self.zoom_y_minus_button.classed('disabled', true);
          } else if (sv.zoom_y >= sv.zoom_max) {
            self.zoom_y_plus_button.classed('disabled', true);
          } else {
            self.zoom_y_minus_button.classed('disabled', false);
            self.zoom_y_plus_button.classed('disabled', false);
          }
          if(sv.constructor.name === "SpectraViewer") {
            if (sv.scale.x.min() == sv.boundary.x.min()) {
              self.scroll_right_button.classed('disabled', true);
            } else {
              self.scroll_right_button.classed('disabled', false);
            }
    
            if (sv.scale.x.max() == sv.boundary.x.max()) {
              self.scroll_left_button.classed('disabled', true);
            } else {
              self.scroll_left_button.classed('disabled', false);
            }
          } else if (sv.zoom_y === 1 && sv.zoom_x === 1){
            self.reset_zoom_button.classed('disabled', true);
          } else {
            self.reset_zoom_button.classed('disabled', false);
          }
        });
    
    
        // Help Button
        const help_icon = this.menu_svg.append('text')
            .attr('x', 15)
            .attr('y', 24)
            .attr('font-family', 'sans-serif')
            .attr('font-size', '26px')
            .attr('stroke-width', 1)
            .attr('fill', 'black')
            .attr('class', 'jsv-button-text')
            .style('text-anchor', 'middle' )
            .text('?');
        this.help_button = SVMenu.button(this.menu_svg, 260, 4, 30, 30, help_icon);
    
        this.help_button.on('click', function() {
          sv.help.dialog.open();
        })
    
        // Save/Download Button
        const download_group = SVMenu.download_path(this.menu_svg)
            .attr('transform', 'translate(5,7)');
    
        this.download_button = SVMenu.button(this.menu_svg, 220, 4, 30, 30, download_group);
        this.download_dialog = new JSV.SVDialog(sv, {
          header_text: 'Save Image',
          content_text: SVMenu.download_html(sv),
          buttons: {
            'Cancel': function() { this.close(); },
            'Generate': function() { SVMenu.download_image(sv, this); }
          }, width: 400,
          height: 250
        });
    
        this.download_button.on('click', function() {
          self.download_dialog.open();
        })
    
        // Settings Button
        const settings_group = SVMenu.settings_path(this.menu_svg)
            .attr('transform', 'translate(5,5)');
    
        this.settings_button = SVMenu.button(this.menu_svg, 180, 4, 30, 30, settings_group);
    
        this.settings_button.on('click', function() {
          sv.settings.open();
        })
    
        // JSV Button
        // TODO: add link to JSV website when available
        const jsv_icon = this.menu_svg.append('text')
            .attr('x', 149)
            .attr('y', 32)
            .attr('font-family', 'sans-serif')
            .attr('font-size', '16px')
            .attr('stroke-width', 1)
            .attr('fill', 'grey')
            .attr('class', 'jsv-button-text')
            .style('text-anchor', 'middle' )
            .text('JSV');
    }
    

}