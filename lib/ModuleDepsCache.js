var through2 = require('through2');
var path = require('path');
var _ = require('underscore');

module.exports = ModuleDepsCache;

function ModuleDepsCache() {
    if (!(this instanceof ModuleDepsCache)) return new ModuleDepsCache();

    this.args = {
        cache: {},
        packageCache: {},
    };
}

ModuleDepsCache.prototype.configure = function (b) {
    var cache = this.args.cache;
    var packageCache = this.args.packageCache;
    b.pipeline.get('deps').push(through2.obj(function (row, enc, next) {
        var file = row.expose ? b._expose[row.id] : row.file;
        cache[file] = {
            source: row.source,
            deps: _.extend({}, row.deps),
        };
        this.push(row);
        next();
    }));
    b.on('package', function (pkg) {
        var file = path.join(pkg.__dirname, 'package.json');
        packageCache[file] = pkg;
    });
};
