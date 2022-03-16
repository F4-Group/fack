const _ = require('lodash');
const express = require('./express');

module.exports = function buildBundles(options, cb) {
    const bundlesApp = express(_.extend({
        saveBundles: true,
    }, options));
    bundlesApp._buildBundles(cb);
};
