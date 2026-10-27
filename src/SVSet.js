

export class SVSet extends Array {

    constructor(...args) {
        super();
        // console.log("in SVSet", args)
        if (args.length === 1 && Array.isArray(args[0])) {
            // console.log("in FIRST", args)
            this.push(...args[0]);
        } else if (args.length > 0 && args[0] != 0) {  // weird bug where sometimes args[0] is 0 even when no args is passed
            // console.log("in SECOND", args)
            this.push(...args);
        }
    }

    /**
     * Retrieve subset of SVSet or an individual element from SVSet depending on term provided.
     * @param {Undefined} term Return full SVSet
     * @param {Integer}   term Return element at that index (base-1)
     * @param {String}    term Return first element with id same as string. If the id starts
     *   with 'path-id-', the first element with that path-id will be returned.
     * @param {Array}     term Return SVSet with elements with matching ids
     * @return {SVSet|or|Element}
     */
    get(term) {
        // if (arguments.length == 0) {
        if (term == undefined) {
            return this;
        } else if (Number.isInteger(term)) {
            return this[term-1];
        } else if (typeof term == 'string') {
            console.log("looking for term", term)
            if (term.match(/^path-id-/)) {
                console.log("looking for path-id", term)
                return this.filter(function(element) { return element.path_id() == term; })[0];
            } else if ( term.match(/^label-id-/) ) {
                console.log("looking for label-id", term)
                return this.filter(function(element) { return element.label_id() == term; })[0];
            } else {
                console.log("looking for id", term)
                return this.filter(function(element) { return element.id == term; })[0];
            }
        } else if (Array.isArray(term)) {
            const filtered = this.filter(function (element) {
                return term.some(function (id) {
                return element.id == id;
                });
            });
            const svset = new SVSet();
            svset.push.apply(svset, filtered);
            return svset;
        } else {
            return new SVSet();
        }
    }

    /**
     * Push the elements of the supplied SVSet/Array on to the SVSet.
     * @param {SVSet|Array} svset SVSet or Array to add
     * @return {SVSet}
    */
    merge(svset) {
        this.push.apply(this, svset);
        return this;
    }

    /**
     * Change one or more properties of each element of the SVSet.
     * ```javascript
     * my_svset.attr(property, value)
     * my_svset.attr( {property1: value1, property2: value2} )
     * ```
     *
     * @param {Property|Value} attributes A property name and the new value.
     * @param {Object}     attributes An object properties and their new values.
     * @return {SVSet}
    */
    attr(attributes) {
        if ((arguments.length == 1) && (typeof attributes == 'object')) {
            const keys = Object.keys(attributes);
            const key_len = keys.length;
            let set_i = 0;
            const set_len = this.length;
            for (; set_i < set_len; set_i++) {
                for (let key_i=0; key_i < key_len; key_i++) {
                    this[set_i][keys[key_i]] = attributes[keys[key_i]];
                }
            }
        } else if (arguments.length == 2) {
            let i = 0;
            const len = this.length;
            for (; i < len; i++) {
                this[i][arguments[0]] = arguments[1];
            }
        } else if (attributes != undefined) {
            throw new Error('attr(): must be 2 arguments or a single object');
        }
        return this;
    }

    /**
     * Call the draw method for each element in the SVSet.
     * See [SVPath.draw](SVPath.js.html#draw) for details
     * @param {} context
     * @param {} scale
     * @param {} fast
     * @param {} calculated
     * @param {} pixel_skip
     * @retrun {SVSet}
    */
    draw(context, scale, fast, calculated, pixel_skip, threshold=null) {
        let i = 0;
        const len = this.length;
        for (; i < len; i++) {
            if (threshold) {  // ??? Not sure if this is correct => got from npmrd code
                this[i].draw(context, scale, fast, calculated, pixel_skip);
            } else {
                this[i].draw(context, scale, fast, calculated, pixel_skip, threshold);
            }
        } 
        return this;
    }

    /**
     * Iterates through each element of the SVSet and run the callback.
     * In the callback _this_ will refer to the element.
     * ```javascript
     * .each(function(index, element))
     * ```
     *
     * Note: This is slower then a _forEach_ or a _for loop_ directly on the set.
     * @param {Function} callback Callback run on each element of SVSet.
     *   The callback will be called with 2 parameters: the index of the element
     *   and the element itself.
     * @return {SVSet}
    */
    each(callback) {
        let i = 0;
        const len = this.length;
        for (; i < len; i++) {
            callback.call(this[i], i, this);
        }
        return this;
    }

    contains(element) {
        return this.indexOf(element) >= 0;
    }

    remove(element) {
        return new SVSet(this.filter(function(i) {return i != element}));
    }

    /**
     * Return true if the SVSet is empty.
     * @return {Boolean}
    */
    empty() {
        return this.length == 0;
    }

    /**
     * Returns true if the SVSet is not empty.
     * @return {Boolean}
    */
    present() {
        return this.length > 0;
    }

    order_by(property, descending) {
        if (this.length > 0) {
            if (typeof this[0][property] == "function") {
                this.sort(function(a,b) {
                    if (a[property]() > b[property]()) {
                      return 1;
                    } else if (a[property]() < b[property]()) {
                      return -1;
                    } else {
                      return 0;
                    }
                })
            } else {
                // Sort by property
                this.sort(function(a,b) {
                    if (a[property] > b[property]) {
                        return 1;
                    } else if (a[property] < b[property]) {
                        return -1;
                    } else {
                        return 0;
                    }
                })     
            }
        }
        if (descending) this.reverse();
        return this;
    }

    lineWidth(width) {
        let i = 0;
        const len = this.length;
        for (; i < len; i++) {
            this[i].lineWidth = width;
        }
        return this;
    }

    /**
     * Returns true if set matchs the supplied set. The order does not matter
     * and duplicates are ignored.
     * @param {SVSet}     term SVSet to compare against
     * @return {Boolean}
    */
    equals(set) {
        if (set.toString() != 'SVSet' && !Array.isArray(set)) { return false }
        const setA = this.unique();
        const setB = set.unique();
        let equals = true;
        if (setA.length != setB.length) {
            return false
        }
        setA.forEach(function(a) {
        if (!setB.contains(a)) {
            equals = false
            return
        }
        })
        return equals
    }

    /**
     * Return new SVSet with no duplicated values.
     * @return {SVSet}
    */
    unique() {
        return new SVSet(this.filter( this.onlyUnique ));
    }
    
    onlyUnique(value, index, self) {
        return self.indexOf(value) === index;
    }

    // Polyfill for Array
    find(predicate) {
        if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
        }
        const list = Object(this);
        const length = list.length >>> 0;
        const thisArg = arguments[1];
        let value;

        for (let i = 0; i < length; i++) {
        value = list[i];
        if (predicate.call(thisArg, value, i, list)) {
            return value;
        }
        }
        return undefined;
    };

}