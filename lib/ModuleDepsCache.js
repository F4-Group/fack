const through2 = require('through2');
const path = require('path');
const _ = require('lodash');

module.exports = ModuleDepsCache;

function ModuleDepsCache() {
    if (!(this instanceof ModuleDepsCache)) {
        return new ModuleDepsCache();
    }

    this.args = {
        cache: {},
        packageCache: {},
    };
}

ModuleDepsCache.prototype.configure = function (b) {
    const cache = this.args.cache;
    const packageCache = this.args.packageCache;
    b.pipeline.get('deps').push(through2.obj(function (row, enc, next) {
        const file = row.expose ? b._expose[row.id] : row.file;
        cache[file] = {
            source: row.source,
            deps: _.extend({}, row.deps),
        };
        this.push(row);
        next();
    }));
    b.on('package', function (pkg) {
        const file = path.join(pkg.__dirname, 'package.json');
        packageCache[file] = pkg;
    });
};
