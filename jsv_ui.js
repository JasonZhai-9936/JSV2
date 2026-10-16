// jsv_ui.js - ClusterNavigator, Menu, Help, Dialog, Settings, Zoombox
// Load order: 6 of 8
//
//////////////////////////////////////////////////////////////////////////////
// SpectraViewer ClusterNavigator
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  function SVClusterNavigator(sv, id) {
    const self = this;
    this.sv = sv;
    this.id = id;
    this.speed = 400;
    this.active_ids = [];
    this.container = d3v7.select(id);
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


    d3v7.select('.jsv-cluster-navigator')
        .on('click', function(event) {
          const target = d3v7.select(event.target);
          window.getSelection().removeAllRanges()
          if (target.classed('cluster-unit')) {
            self.move_to_cluster(target.node());
          } else if (target.classed('jsv-cluster-nav')) {
            self.cycle_clusters(target);
          }
        });
  }

  SVClusterNavigator.prototype.update_table = function() {
    const compounds = this.static_compounds || this.sv.selection.compounds();
    // this.tbody.html( update_rows(this.sv.selection.compounds()) );
    this.tbody.html( update_rows(compounds) );
    if (this.active_ids.length > 0) {
      d3v7.selectAll(this.active_ids.join(',')).classed('active', true);
    }
    this.sv.trigger('cluster-navigator-updated')
  }

  const update_rows = function(compounds) {
    return compounds.map(function(c) { return compound_row(c); }).join('');
  }

  const compound_row = function(compound) {
    html = '<tr>'
    if (compound.name !== undefined) {
      html += '<td>' + compound.name + '</td>'
    }
    if (compound.concentration !== undefined) {
      html += '<td>' + compound.display_concentration() + '</td>'
    }
    html += '<td>' + cluster_cell(compound.clusters()) + '</td></tr>';
    return html
    // return '<tr><td>'+ compound.name + '</td><td>' + compound.display_concentration() + '</td><td>' + cluster_cell(compound.clusters()) + '</td></tr>';
  }

  const cluster_cell = function(clusters) {
    clusters.order_by('center', true);
    const nav_arrows = "<span class='jsv-cluster-nav jsv-cluster-nav-left'>&#10094;</span>&nbsp;<span class='jsv-cluster-nav jsv-cluster-nav-right'>&#10095;</span>";
    return nav_arrows + clusters.map(function(c) { return cluster_div(c); }).join('');
  }
  const cluster_div = function(cluster) {
    return '<div class="cluster-unit" style="display: inline-block" id="' + cluster.path_id() + '">' + cluster.center().toFixed(2) + '</div>';
  }

  SVClusterNavigator.prototype.cycle_clusters = function(target) {
    const forward = target.classed('jsv-cluster-nav-right');
    const parent = d3v7.select(target.node().parentNode);
    const active = parent.select('.active');
    const cluster_ids = parent.selectAll('.cluster-unit').nodes().map(function (c) {
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

  SVClusterNavigator.prototype.move_to_cluster = function(cluster_node) {
    const cluster = sv.clusters(cluster_node.id);
    sv.move_to_peaks(cluster.peaks(), this.speed, 2);
    d3v7.select(cluster_node.parentNode).selectAll('.cluster-unit').classed('active', false);
    d3v7.select(cluster_node).classed('active', true);
    this.active_ids = d3v7.selectAll('.cluster-unit.active').nodes().map(function(c) { return '#' + c.id; });
    sv.selection.clear();
    sv.selection.add_element(cluster);
  }

  SVClusterNavigator.prototype.detach = function() {
    this.sv.off('.cluster-navigator');
    this.table.remove();
  }

  Object.defineProperties(SVClusterNavigator.prototype, {
    'static_compounds': {
      get: function() {
        return this._static_compounds;
      },
      set: function(compounds) {
        this._static_compounds = compounds;
        this.table.style('display', 'block');
        this.update_table();
      }
    }
  });

  JSV.SVClusterNavigator = SVClusterNavigator;

})(JSpectraViewer);

//////////////////////////////////////////////////////////////////////////////
// SpectraViewer Menu
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  const download_image = function(sv, dialog) {
    const height = sv.sv_wrapper.select('#jsv-save-height').property('value');
    const width = sv.sv_wrapper.select('#jsv-save-width').property('value');
    const image = sv.image(width, height);
    const window_name = 'JSV-Image-' + width + 'x' + height;
    const win = window.open(image, window_name);
    dialog.close();
    setTimeout(function() { win.document.title = window_name }, 100);
  };
  const download_html = function(sv) {
    return   '' +
        '<div class="jsv-alert">Display the viewer image in a new window to download or print. Note that you must allow pop-ups!</div>' +
        '<div><label class="jsv-label">Width</label><div class="jsv-input-group">' +
        '<input class="jsv-input" id="jsv-save-width" type="text" value="' + sv.width + '" /><div class="jsv-input-addon">px</div></div></div>' +
        '<div><label class="jsv-label">Height</label><div class="jsv-input-group">' +
        '<input class="jsv-input" id="jsv-save-height" type="text" value="' + sv.height + '" /><div class="jsv-input-addon">px</div></div></div>';
  };
  const line_function = d3v7.line()
      .x(function(d) { return d.x; })
      .y(function(d) { return d.y; })
      .curve(d3v7.curveLinear);
  const button = function(svg, x, y, width, height, path_group) {
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
  };
  const download_path = function(svg) {
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
  };
  const settings_path = function(svg) {
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
  };
  const scale_path = function(svg, x, y, width, height, angle) {
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
  };
  const minus_path = function(svg) {
    return svg.append('line')
        .attr('x1', 3)
        .attr('y1', 8)
        .attr('x2', 13)
        .attr('y2', 8)
        .attr('stroke-width', 3)
        .attr('stroke', 'black');
  };
  const plus_path = function(svg) {
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
  };
  const path = function(svg, path_data) {
    return svg.append('path')
        .attr('d', line_function(path_data))
        .attr('stroke', 'black')
        // .attr('stroke-linecap', 'round')
        .attr("stroke-width", 3)
        .attr("fill", "none");
  };
// NOTE: need to explicitly state menu and handle sizes here and not just in CSS
  const scroll_interval = function(sv, axis, translate_px, delay) {
    return setInterval(function() {
      sv.translate_axis(axis, translate_px);
      sv.fast_draw();
    }, delay)
  };

// in order to work with hidden elements like tabs
  function SVMenu(sv) {
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
    this.close(0);
  }

  SVMenu.prototype.visible = function(value) {
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

  SVMenu.prototype.opened = function() {
    return (this.menu.style('visibility') == 'visible');
  }

  SVMenu.prototype.width = function() {
    // return this.menu.node().offsetWidth;
    // return this.menu.node().getBoundingClientRect().width;
    return 300;
  }

  SVMenu.prototype.height = function() {
    // return this.menu.node().offsetHeight;
    // return this.menu.node().getBoundingClientRect().height;
    return  41;
  }

  SVMenu.prototype.open = function(duration) {
    duration = JSV.default_for(duration, this.slide_time)
    this.menu.style('visibility', 'visible');
    this.menu.transition().duration(duration)
        .style('top', '0px')
        .style('opacity', 1);

    this.handle_path.transition().duration(duration).attr('d', line_function(this.handle_data_opened))
  }

  SVMenu.prototype.close = function(duration) {
    duration = JSV.default_for(duration, this.slide_time)
    this.menu.transition().duration(duration)
        .style('top', '-50px')
        .style('opacity', 0)
        .on('end', function() {
          d3v7.select(this).style('visibility', 'hidden');
        });

    this.handle_path.transition().duration(duration).attr('d', line_function(this.handle_data_closed))
  }

  SVMenu.prototype.handle_mouseover = function() {
    this.handle_path.transition().duration(200)
        .attr('stroke', 'black');
  }

  SVMenu.prototype.handle_mouseout = function() {
    this.handle_path.transition().duration(200)
        .attr('stroke', 'grey');
  }

  SVMenu.prototype.draw = function() {
    const sv = this.sv;
    const self = this;
    let timeout;
    let translate_px = 5;
    let mousedown_delay = 4;

    // Handle
    this.handle_path = this.handle_svg.append("path")
        .attr("d", line_function(this.handle_data_closed))
        .attr("stroke", "grey")
        .attr("stroke-width", this.stroke_width)
        .attr("fill", "none");

    if(this.sv.constructor.name === 'SpectraViewer') {
      // Scroll/Move Buttons
      const left_arrow_data = [{x: 11, y: 4}, {x: 4, y: 15}, {x: 11, y: 26}];
      const right_arrow_data = [{x: 4, y: 4}, {x: 11, y: 15}, {x: 4, y: 26}];

      const left_arrow = path(this.menu_svg, left_arrow_data);
      const right_arrow = path(this.menu_svg, right_arrow_data);

      this.nav_group = this.menu_svg.append('g');
      this.scroll_left_button = button(this.nav_group, 0, 0, 15, 30, left_arrow);
      this.scroll_right_button = button(this.nav_group, 17, 0, 15, 30, right_arrow);
      this.nav_group.attr('transform', 'translate(' + 7 + ',' + 4 + ')');

      this.scroll_left_button.on('mousedown', function () {
        if (d3v7.select(this).classed('disabled')) return;
        timeout = scroll_interval(sv, 'x', translate_px, mousedown_delay);
        return false;
      })

      this.scroll_right_button.on('mousedown', function () {
        if (d3v7.select(this).classed('disabled')) return;
        timeout = scroll_interval(sv, 'x', -translate_px, mousedown_delay);
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
      this.reset_zoom_button = button(this.menu_svg, 10, 4, 30, 30, mag_path(this.menu_svg));
      this.reset_zoom_button.on('click', function() {
        if (d3v7.select(this).classed('disabled')) return;
        const new_domains =  [ [-10, 500], [-10, 500]  ];
        sv.move_to(new_domains, 1000)
      })
    }

    // Zoom Buttons
    this.zoom_group = this.menu_svg.append('g');
    this.zoom_y_minus_button = button(this.zoom_group, 6, 18, 16, 16, minus_path(this.menu_svg));
    this.zoom_y_plus_button = button(this.zoom_group, 6, 0, 16, 16, plus_path(this.menu_svg));
    this.zoom_x_minus_button = button(this.zoom_group, 25, 9, 16, 16, minus_path(this.menu_svg));
    this.zoom_x_plus_button = button(this.zoom_group, 43, 9, 16, 16, plus_path(this.menu_svg));
    scale_path(this.zoom_group, 0, 0.5, 5, 34, 0);
    scale_path(this.zoom_group, 25.5, 32, 5, 34, -90);
    this.zoom_group.attr('transform', 'translate(' + 55 + ',' + 2 + ')');

    this.zoom_x_minus_button.on('click', function() {
      if (d3v7.select(this).classed('disabled')) return;
      const zoom_diff = sv.scale.x.diff() / 2;
      const new_domains = [[sv.scale.x.min() - zoom_diff, sv.scale.x.max() + zoom_diff], sv.scale.y.domain()];
      sv.move_to(new_domains)
    })

    this.zoom_x_plus_button.on('click', function() {
      if (d3v7.select(this).classed('disabled')) return;
      const zoom_diff = sv.scale.x.diff() / 4;
      const new_domains =  [ [sv.scale.x.min() + zoom_diff, sv.scale.x.max() - zoom_diff], sv.scale.y.domain() ];
      sv.move_to(new_domains)
    })

    this.zoom_y_minus_button.on('click', function() {
      if (d3v7.select(this).classed('disabled')) return;
      const zoom_diff = sv.scale.y.diff() / 2;
      const new_domains =  [ sv.scale.x.domain(), [sv.scale.y.min() - zoom_diff, sv.scale.y.max() + zoom_diff] ];
      sv.move_to(new_domains)
    })

    this.zoom_y_plus_button.on('click', function() {
      if (d3v7.select(this).classed('disabled')) return;
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
    this.help_button = button(this.menu_svg, 260, 4, 30, 30, help_icon);

    this.help_button.on('click', function() {
      sv.help.dialog.open();
    })

    // Save/Download Button
    const download_group = download_path(this.menu_svg)
        .attr('transform', 'translate(5,7)');

    this.download_button = button(this.menu_svg, 220, 4, 30, 30, download_group);
    this.download_dialog = new JSV.SVDialog(sv, {
      header_text: 'Save Image',
      content_text: download_html(sv),
      buttons: {
        'Cancel': function() { this.close(); },
        'Generate': function() { download_image(sv, this); }
      }, width: 400,
      height: 250
    });

    this.download_button.on('click', function() {
      self.download_dialog.open();
    })

    // Settings Button
    const settings_group = settings_path(this.menu_svg)
        .attr('transform', 'translate(5,5)');

    this.settings_button = button(this.menu_svg, 180, 4, 30, 30, settings_group);

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


  let mag_path = function(svg) {
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


  JSV.SVMenu = SVMenu;

})(JSpectraViewer);

//////////////////////////////////////////////////////////////////////////////
// SpectraViewer Help
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  function SVHelp(sv) {
    this.sv = sv;
    const help_text = (sv.toString() === "SpectraViewer") ? help_text_1d : help_text_2d

    this.dialog = new JSV.SVDialog(sv, {
      header_text: 'JSpectraViewer (JSV) Help',
      content_text: help_text,
      width: 700,
      height: 350
    });

  }

  let help_text_1d = '' +
      'The view of the spectra can be scrolled around or scaled using the controls in the menu or by using the various mouse and keyboard shortcuts:' +
      '<h3>Viewer Controls</h3>' +
      '<table class="jsv-table">' +
      '<thead><tr><th>Action</th><th>Command</th></tr></thead><tbody>' +
      '<tr><td>Zoom In/Out X Axis</td><td>Scroll wheel</td></tr>' +
      '<tr><td>Zoom In/Out Y Axis</td><td>Option/Alt Key + Scroll wheel</td></tr>' +
      '<tr><td>Zoom In on Area</td><td>Option/Alt Key + Click and Drag around area</td></tr>' +
      '<tr><td>Zoom Out Completely</td><td>Option/Alt Key + Click once anywhere on viewer </td></tr>' +
      '<tr><td>Move Around</td><td>Click and Drag</td></tr></tbody></table>' +
      '<h3>Zoombox Controls (box in upper left corner)</h3>' +
      '<table class="jsv-table">' +
      '<thead><tr><th>Action</th><th>Command</th></tr></thead><tbody>' +
      '<tr><td>Move Around</td><td>Click and Drag grey selection box</td></tr>' +
      '<tr><td>Zoom In on Area</td><td>Click on unselected region and drag around new selection</td></tr>' +
      '<tr><td>Zoom Out Completely</td><td>Click once anywhere in unselected region</td></tr>' +
      '<tr><td>Alter Zoomed Area</td><td>Click and Drag on sides of grey selection box</td></tr></tbody></table>' +
      '<h3>Troubleshooting</h3>' +
      '<p>If the viewer is not showing any spectra or is slow, try updating to the latest version of your ' +
      'browser. We have found that <a href="https://www.google.com/chrome" target="_blank">Google Chrome</a> is the fastest.</p></div></div>';

  let help_text_2d = '' +
      'The view of the spectra can be scaled using the controls in the menu or by using the various mouse and keyboard shortcuts:' +
      '<h3>Viewer Controls</h3>' +
      '<table class="jsv-table">' +
      '<thead><tr><th>Action</th><th>Command</th></tr></thead><tbody>' +
      '<tr><td>Adjust Peak Sensitivity</td><td>Scroll wheel</td></tr>' +
      '<tr><td>Zoom In on Area</td><td>Click and Drag around area</td></tr>' +
      '<tr><td>Zoom Out Completely</td><td>Double click inside viewer</td></tr>' +
      '<h3>Troubleshooting</h3>' +
      '<p>If the viewer is not showing any spectra or is slow, try updating to the latest version of your ' +
      'browser. We have found that <a href="https://www.google.com/chrome" target="_blank">Google Chrome</a> is the fastest.</p></div></div>';

  JSV.SVHelp = SVHelp;

})(JSpectraViewer);
//////////////////////////////////////////////////////////////////////////////
// SpectraViewer Dialog
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  function SVDialog(sv, options) {
    options = options || {};
    const self = this;
    this.wrapper = sv.sv_wrapper.node();

    this.fade_time = JSV.default_for(options.fade_time, 500);
    this.header_text = JSV.default_for(options.header_text, '');
    this.content_text = JSV.default_for(options.content_text, '');
    this.height = JSV.default_for(options.height, 300);
    this.width = JSV.default_for(options.width, 300);
    this.buttons = options.buttons

    this.box = d3v7.select(this.wrapper).append('div')
        .style('display', 'none')
        .attr('class', 'jsv-dialog');

    this.header = this.box.append('div')
        .attr('class', 'jsv-dialog-header')
        .html(this.header_text);

    this.dismiss = this.box.append('div')
        .attr('class', 'jsv-dialog-dismiss')
        .html('X')
        .on('click', function() { self.close(); });

    this.contents = this.box.append('div')
        .attr('class', 'jsv-dialog-contents jsv-scroll');

    if (this.buttons) {
      this.footer = this.box.append('div')
          .attr('class', 'jsv-dialog-footer');
      this.generate_buttons();
    }

    this.contents.html(this.content_text);

    this.adjust_size();

    return self;
  }

  SVDialog.prototype.visible = function() {
    return (this.box.style('display') != 'none');
  }


  SVDialog.prototype.open = function() {
    this.adjust_size();
    this.box.style('display', 'block');
    this.box.transition().duration(this.fade_time)
        .style('opacity', 1);
    return this;
  }

  SVDialog.prototype.close = function() {
    this.box.transition().duration(this.fade_time)
        .style('opacity', 0)
        .on('end', function() {
          d3v7.select(this).style('display', 'none');
        });
    return this;
  }

  SVDialog.prototype.generate_buttons = function() {
    const self = this;
    const labels = Object.keys(this.buttons);
    labels.forEach(function(label) {
      self.footer.append('button')
          .html(label)
          .attr('class', 'jsv-button')
          .on('click', function() { self.buttons[label].call(self) });
    });

  }

  SVDialog.prototype.adjust_size = function() {
    // Minimum buffer between dialog and edges of container (times 2)
    const buffer = 50;
    const wrapper_width = this.wrapper.offsetWidth;
    const wrapper_height = this.wrapper.offsetHeight;
    let width = this.width;
    let height = this.height;

    if (this.height > wrapper_height - buffer) height = wrapper_height - buffer;
    if (this.width > wrapper_width - buffer) width = wrapper_width - buffer;

    const header_height = 40;
    const footer_height = this.buttons ? 35 : 0;
    const content_height = height - header_height - footer_height;

    this.box
        .style('width', width + 'px')
        .style('height', height + 'px')

    this.contents
        .style('height', content_height + 'px');
  }

  JSV.SVDialog = SVDialog;

})(JSpectraViewer);


//////////////////////////////////////////////////////////////////////////////
// SpectraViewer Settings
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  function SVSettings(sv, options) {
    options = options || {};
    const self = this;
    this.sv = sv;
    this.object = JSV.default_for(options.object, sv);
    this.title = JSV.default_for(options.title, 'Settings');
    this.height = JSV.default_for(options.height, 400);
    this.width = JSV.default_for(options.width, 400);
    options.settings = options.settings || [];
    this.settings = [];
    options.settings.forEach(function(setting_options) {
      self.settings.push(new Setting(self.object, setting_options));
    });

    this.dialog = new JSV.SVDialog(sv, {
      header_text: this.title,
      content_text: this.settings_html(),
      buttons: {
        'Done': function() { this.close(); }
      },
      width: this.width,
      height: this.height
    });

    return this;
  }

  // The html and listeners are regerated every time the dialog is opened
  // to catch any changes that may have been programatically
  SVSettings.prototype.open = function() {
    const self = this;
    this.dialog.contents.html(this.settings_html());
    d3v7.selectAll('.jsv-setting')
        .on('change', function() {
          const input = d3v7.select(this);
          const setting = self.find(input.attr('id'));
          const value = input.property('checked');
          setting.value(value);
          self.sv.full_draw();
        });

    this.dialog.open();
    return this;
  }

  SVSettings.prototype.close = function() {
    this.dialog.close();
    return this;
  }

  SVSettings.prototype.find = function(id) {
    return this.settings.filter(function(s) { return s.id() == id; })[0];
  }

  SVSettings.prototype.settings_html = function() {
    html = '<div class="jsv-settings">';
    this.settings.forEach(function(setting) {
      html += '<div><label class="jsv-label">' + setting.label + '</label>';
      html += '<div class="jsv-input-group">';
      if (setting.type == 'boolean') {
        html += checkbox(setting);
      }
      html += '</div></div>';
    });
    html += '</div>';

    return html;
  }

  const checkbox = function(setting) {
    html = '';
    html += '<input type="checkbox" class="jsv-input jsv-setting" id="' + setting.id() + '"';
    if (setting.value()) {
      html += ' checked="true" ';
    }
    html +=  ' />';
    return html;
  }

  let setting_id = 0;
  function Setting(object, options) {
    options = options || {};
    this.object = object;
    this.label = options.label;
    this.property = options.property;
    this.type = JSV.default_for(options.type, 'boolean');
    this.id();
  }

  Setting.prototype.id = function() {
    const new_id = generate_setting_id();
    this.id = function() { return new_id; }
    return new_id;
  }

  const generate_setting_id = function() {
    return 'jsv-setting-id-' + setting_id++;
  }

  Setting.prototype.value = function(value) {
    if (arguments.length == 0) {
      if (typeof this.property === 'function') {
        value = this.property.call(this.object);
      } else {
        value = this.object[this.property];
      }
    } else {
      if (typeof this.property === 'function') {
        this.property.call(this.object, value);
      } else {
        this.object[this.property] = value;
      }
      self.sv.full_draw();
    }
    return value;
  }

  JSV.SVSettings = SVSettings;

})(JSpectraViewer);

//////////////////////////////////////////////////////////////////////////////
// Zoombox
//////////////////////////////////////////////////////////////////////////////
(function(JSV) {

  // ZOOMBOX
  function ZoomBox(sv) {
    JSV.pixel(10);
    this.sv = sv;
    // Set up zoom box size
    let percentage = sv.zoombox_size || 10
    this.width = sv.width * percentage / 100;
    this.height = sv.height * percentage / 100;
    this.adjusting = false;

    // Create SVG
    this.svg = sv.sv_wrapper.append('svg')
        .attr('width', this.width + 1)
        .attr('height', this.height + 1)
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', sv.width - this.width - 1);

    if (sv.axis_x_reverse) {
      this.svg.style('left', 0);
    }

    // Draw Border
    this.border = this.svg.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', this.width)
        .attr('height', this.height)
        .attr('fill', 'white')
        .attr('stroke', '#BBB');

    // Set initial scales
    this.scale = new JSV.SVScale();
    this.scale.y.range([this.height, 0]);
    let x_range = this.sv.axis_x_reverse ? [this.width, 0] : [0, this.width];
    this.scale.x.range(x_range);


    // Brush for selecting a zoom area
    this.initialize_brushing();

    this.spectra_function = d3v7.line()
        .x((d) => this.scale.x(d.x))
        .y((d) => this.scale.y(d.y));
  }

  Object.defineProperty(ZoomBox.prototype, 'visible', {
    get: function() { return this._visible; },
    set: function(val) {
      this._visible = val;
      if (this._visible) {
        this.svg.style('display', 'block');
      } else {
        this.svg.style('display', 'none');
      }
      this.sv.legend.update();
      this.sv.draw();
    }
  });

  // ZOOM BOX BRUSHING
  ZoomBox.prototype.initialize_brushing = function() {
    const zb = this;
    const sv = zb.sv;
    // === MS-PORT: order corners min-first so brush extent is valid for both axis directions ===
    var __zb_x_min = Math.min(zb.scale.x.range()[0], zb.scale.x.range()[1]);
    var __zb_x_max = Math.max(zb.scale.x.range()[0], zb.scale.x.range()[1]);
    var __zb_y_min = Math.min(zb.scale.y.range()[0], zb.scale.y.range()[1]);
    var __zb_y_max = Math.max(zb.scale.y.range()[0], zb.scale.y.range()[1]);
    zb.brush = d3v7.brush()
        .extent([[__zb_x_min, __zb_y_min], [__zb_x_max, __zb_y_max]])
        .on('start', brushstart)
        .on('brush', brushing)
        .on('end',   brushend);

    zb.select_brush = zb.svg.append("g")
        .attr("class", "active-brush")
        .call(zb.brush);

    function brushstart(event) {
      if(event.sourceEvent)
        event.sourceEvent.preventDefault(); // Prevent text cursor
    }

    function brushing(event) {
      if (!(event.selection === null) && !zb.adjusting) {
        let extent;
          if (sv.axis_y_lock !== false) {
            const ex = event.selection;
            const x1 = ex[0][0];
            const x2 = ex[1][0];
            // Set y1 to the min y domain
            const y1 = zb.scale.y.domain()[0];
            const mouse_y = zb.scale.y.invert(d3v7.pointer(event, zb.svg.node())[1]);
            const max_y = zb.scale.y.domain()[1];
            let y2 = Math.min(mouse_y, max_y);
            y2 = Math.max(y1, y2);
            extent = [[zb.scale.x.invert(x2), 0], [zb.scale.x.invert(x1), y2]];
          }
          if (!extent) extent = [[zb.scale.x.invert(event.selection[1][0]), zb.scale.y.invert(event.selection[1][1])],
            [zb.scale.x.invert(event.selection[0][0]), zb.scale.y.invert(event.selection[0][1])]];
          sv.set_domain_to_brush_extent(extent, false);
          sv.fast_draw();
        }

        // DEBUG INFO
        if (sv.debug) {
          sv.debug_data.zbox['X1'] = JSV.round(zb.brush.extent()[0][0]);
          sv.debug_data.zbox['Y1'] = JSV.round(zb.brush.extent()[0][1]);
          sv.debug_data.zbox['X2'] = JSV.round(zb.brush.extent()[1][0]);
          sv.debug_data.zbox['Y2'] = JSV.round(zb.brush.extent()[1][1]);
        }
    }

    function brushend(event) {
      if(!zb.adjusting) {
        // Force setting next zoom to update zoom level
        sv.zoom_axis = '';
        sv.draw();
      }
    }
  }

  ZoomBox.prototype.add_spectrum = function(spectrum) {
    const boundary = this.sv.boundary;
    this.scale.x.domain(boundary.x.domain());
    this.scale.y.domain(boundary.y.domain());

    this.svg.append('path')
        .attr('id', spectrum.id)
        .attr('d', this.spectra_function(spectrum.simple_xy_data.asArray()))
        .attr('stroke', spectrum.color)
        .attr('stroke-width', 0.5)
        .attr('fill', 'none');

    // Redraw brush
    this.set_zoom_area(boundary);
  }

  ZoomBox.prototype.remove_spectra = function(id) {
    this.sv.container.select('path#' + id).remove();
  }

  ZoomBox.prototype.update = function() {
    const self = this;
    const sv = this.sv;
    if (sv.axis_x_reverse) {
      this.svg.style('left', 0);
    } else {
      this.svg.style('left', sv.width - this.width - 1);
    }
    this.sv.all_spectra().forEach(function(spectrum) {
      self.remove_spectra(spectrum.id);
      if (spectrum.active) {
        self.add_spectrum(spectrum);
      }
    });
  }

  ZoomBox.prototype.set_zoom_area = function(scale) {
    let zb = this;
    // === MS-PORT: order corners so [x1,y1] is topLeft and [x2,y2] is bottomRight ===
    const __xa = zb.scale.x(scale.x.domain()[1]);
    const __xb = zb.scale.x(scale.x.domain()[0]);
    const __ya = zb.scale.y(scale.y.domain()[1]);
    const __yb = zb.scale.y(scale.y.domain()[0]);
    const x1 = Math.min(__xa, __xb);
    const x2 = Math.max(__xa, __xb);
    const y1 = Math.min(__ya, __yb);
    const y2 = Math.max(__ya, __yb);
    // Redraw brush
    zb.adjusting = true;
    zb.select_brush.call(zb.brush.move, [[x1, y1], [x2, y2]]);
    zb.adjusting = false;
  }

  JSV.ZoomBox = ZoomBox;

})(JSpectraViewer);
