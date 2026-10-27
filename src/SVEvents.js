
/**
   * SVEvents is a system to plug in callbacks to specific events in JSV.
   * Use [on](#on) to add a callback and [off](#off) to remove it.
   * Here are a list of events supported in JSV:
   *
   *  Event               | Description
   *  --------------------|-------------
   *  drag-start          | Called once before viewer starts drag animation
   *  drag                | Called every frame of the drag animation
   *  drag-end            | Called after dragging is complete
   *  zoom-start          | Called once before viewer starts zoom animation
   *  zoom                | Called every frame of the zoom animation
   *  zoom-end            | Called after zooming is complete
   *  domain-change       | Called after the viewer domains have changed
   *  adjust-start        | Called once on mouse down on a selection
   *  adjust              | Called while moving the selection
   *  adjust-end          | Called once after adjustment is complete, including deletions and peak creation
   *  adjust-peak-created | Called after peak creation
   *  selection-add       | Called when an element is added to the selection
   *  selection-remove    | Called after an element is removed from the selection
   *  selection-clear     | Called before the selection is cleared
   *  selection-empty     | Called after the selection becomes empty
   *  highlight-start     | Called when an element is highlighted
   *  highlight-end       | Called when an element is unhighlighted
   *  label-click         | Called when a annotation label is clicked
   *  cluster-navigator-updated | Called when the SVClusterNavigator table is updated
   *
   *  structure-click     | Called when atom or structure container is clicked
*/
export class SVEvents {

    static Handler = class {
        constructor(event, callback) {
            this.callback = callback;
            this.event_type = parse_event(event);
            this.namespace = parse_namespace(event);
        }
    }

    constructor() {

        const handlers = {};

        /**
         * Attach a callback function to a specific JSV event.
         * ```js
         * sv = new JSV.SpectraViewer('#my-spectra');
         * sv.on('drag-start', function() { console.log('Dragging has begun!') };
         *
         * // The event can be namespaced for easier removal later
         * sv.on('drag-start.my_plugin', function() { console.log('Dragging has begun!') };
         * ```
         * @param {String} event Name of event. Events can be namespaced.
         * @param {Function} callback Function to call when event is triggered
         */
        this.on = function (event, callback) {
            check_type(event);
            const type = parse_event(event);
            if (!handlers[type]) handlers[type] = [];
            handlers[type].push(new SVEvents.Handler(event, callback));
        }
    
        /**
         * Remove a callback function from a specific JSV event. If no __callback__ is provided,
         * then all callbacks for the event will be removed. Namespaced events can and should be used
         * to avoid unintentionally removing callbacks attached by other plugins.
         * ```js
         * // Remove all callbacks attached to the 'drag-start' event.
         * // This includes any namespaced events.
         * sv.off('drag-start');
         *
         * // Remove all callbacks attached to the 'drag-start' event namespaced to 'my_plugin'
         * sv.off('drag-start.my_plugin');
         *
         * // Remove all callbacks attached to any events namespaced to 'my_plugin'
         * sv.off('.my_plugin');
         * ```
         * @param {String} event Name of event. Events can be namespaced.
         * @param {Function} callback Specfic function to remove
         */
        this.off = function (event, callback) {
            check_type(event);
            const type = parse_event(event);
            const namespace = this.parse_namespace(event);
            // If no callback is supplied remove all of them
            if (arguments.length == 1) {
                if (namespace) {
                    if (type) {
                        handlers[type] = handlers[type].filter(function (h) {
                        return h.namespace != namespace;
                        });
                    } else {
                        Object.keys(handlers).forEach(function (key) {
                        handlers[key] = handlers[key].filter(function (h) {
                            return h.namespace != namespace;
                        });
                        });
                    }
                } else {
                    handlers[type] = undefined;
                }
                } else {
                    // Remove specific callback
                    handlers[type] = handlers[type].filter(function (h) {
                        return h.callback != callback;
                    });
            }
        }
    
        /**
         * Trigger a callback function for a specific event.
         * ```js
         * // Triggers all callback functions associated with drag-start
         * sv.trigger('drag-start');
         *
         * // Triggers can also be namespaced
         * sv.trigger('drag-start.my_plugin');
         * ```
         * @param {String} event Name of event. Events can be namespaced.
         * @param {Object} object Object to be passed back to 'on'.
         */
        this.trigger = function (event, object) {
            check_type(event);
            const type = parse_event(event);
            const namespace = parse_namespace(event);
            if (Array.isArray(handlers[type])) {
                handlers[type].forEach(function (handler) {
                    if (namespace) {
                        if (handler.namespace == namespace) handler.callback.call(null, object);
                    } else {
                        handler.callback.call(null, object);
                    }
                });
            }
        }
    
        /** @ignore */
        var check_type = function (type) {
            if (typeof type != 'string') {
                throw new Error('Type must be a string');
            }
        }
    };
        
    
}


function parse_event(event) {
    return event.replace(/\..*/, '');
}

function parse_namespace(event) {
    const result = event.match(/\.(.*)/);
    return result ? result[1] : undefined
}