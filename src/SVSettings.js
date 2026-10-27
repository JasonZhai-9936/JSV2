import * as JSV from "./Utils.js";
import * as d3 from "d3";


export default class SVSettings {

    constructor(sv, options) {
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
    open() {
        const self = this;
        this.dialog.contents.html(this.settings_html());
        d3.selectAll('.jsv-setting')
            .on('change', function() {
                const input = d3.select(this);
                const setting = self.find(input.attr('id'));
                const value = input.property('checked');
                setting.value(value);
                self.sv.full_draw();
            });

        this.dialog.open();
        return this;
    }

    close() {
        this.dialog.close();
        return this;
    }

    find(id) {
        return this.settings.filter(function(s) { return s.id() == id; })[0];
    }

    settings_html() {
        self = this
        let html = '<div class="jsv-settings">';
        this.settings.forEach(function(setting) {
            html += '<div><label class="jsv-label">' + setting.label + '</label>';
            html += '<div class="jsv-input-group">';
            if (setting.type == 'boolean') {
            html += self.checkbox(setting);
            }
            html += '</div></div>';
        });
        html += '</div>';

        return html;
    }

    checkbox(setting) {
        let html = '';
        html += '<input type="checkbox" class="jsv-input jsv-setting" id="' + setting.id() + '"';
        if (setting.value()) {
            html += ' checked="true" ';
        }
        html +=  ' />';
        return html;
    }

}


class Setting {
    static setting_id = 0;
    constructor(object, options) {
        options = options || {};
        this.object = object;
        this.label = options.label;
        this.property = options.property;
        this.type = JSV.default_for(options.type, 'boolean');
        this.id();
    }

    id() {
        const new_id = this.generate_setting_id();
        this.id = function() { return new_id; }
        return new_id;
    }

    generate_setting_id() {
        return 'jsv-setting-id-' + Setting.setting_id++;
    }

    value(value) {
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

}