// jsv_setup.js - JSpectraViewer namespace initialization
// Load order: 1 of 8
//
//////////////////////////////////////////////////////////////////////////////
// JSpectraViewer Setup
//////////////////////////////////////////////////////////////////////////////
window.JSpectraViewer = {};

JSpectraViewer.version = '0.1'

if (window.JSV === undefined) window.JSV = JSpectraViewer;
if (window.d3v7 === undefined) window.d3v7 = d3;

(function(JSV) {

  JSV.inherits = function(child, parent) {
    child.prototype = Object.create(parent.prototype);
  }

  JSV.initialize = function(){
    if (!d3v7.version.match(/^7\./g)) throw 'JSpectraViewer requires D3 v7'
    JSV._viewers = new JSV.SVSet();

    JSV.viewers = function(term) {
      return JSV._viewers.get(term);
    }

  }


})(JSpectraViewer);//////////////////////////////////////////////////////////////////////////////
