var fs = require('fs');
var crypto = require('crypto');
var _ = require('underscore');
var mime = require('mime');

module.exports = CacheForever;

var oneYearCache = 60 * 60 * 24 * 365 /*seconds*/;

function CacheForever(options) {
    options = options || {};
    if (this instanceof CacheForever) {
        this.assets = {};
        this.staticPath = addTrailingSlash(options.staticPath || '/static/');
        this.foreverPath = addTrailingSlash(options.foreverPath || '/cacheForever/');
        this.staticMaxAge = options.staticMaxAge || 0;
        this.foreverMaxAge = options.foreverMaxAge || oneYearCache;
    } else {
        return new CacheForever(options);
    }
}

function addTrailingSlash(path) {
    if (/\/$/.test(path))
        return path;
    else
        return path + '/';
}

function sendAsset(res, asset, maxAge) {
    res.statusCode = 200;
    res.setHeader('Etag', asset.fingerprint);
    res.setHeader('Content-Type', asset.contentType);
    var cacheControlHeader = 'public, max-age=' + (maxAge || 0); //expect maxAge in seconds
    if (!maxAge)
        cacheControlHeader += ', must-revalidate';
    res.setHeader('Cache-Control', cacheControlHeader);
    res.end(asset.content);
}

function getPathWithoutPrefix(req, prefix) {
    var urlPath = req.url.split('?')[0];
    return urlPath.substr(prefix.length);
}

var proto = CacheForever.prototype;

proto.middleware = function () {
    var staticPath = this.staticPath;
    var foreverPath = this.foreverPath;
    var assets = this.assets;
    var foreverMaxAge = this.foreverMaxAge;
    var staticMaxAge = this.staticMaxAge;
    var that = this;
    return function (req, res, next) {
        req.resourceUrl = function (url) {
            return that.resourceUrl(url);
        };
        var asset;
        var maxAge;
        var path;
        if (req.url.indexOf(staticPath) == 0) {
            path = getPathWithoutPrefix(req, staticPath);
            asset = assets[path];
            if (asset)
                maxAge = staticMaxAge;
        } else if (req.url.indexOf(foreverPath) == 0) {
            var urlParts = req.url.split("/");
            var reqFingerprint = urlParts[2];
            var prefix = foreverPath + reqFingerprint + '/';
            path = getPathWithoutPrefix(req, prefix);
            asset = assets[path];
            if (asset && asset.fingerprint == reqFingerprint)
                maxAge = foreverMaxAge;
        }
        if (asset)
            sendAsset(res, asset, maxAge);
        else
            next();
    };
};

proto.register = function (options) {
    var fingerprint = options.fingerprint;
    var content = options.content;
    var contentType = options.contentType;
    if (!content && options.filePath) {
        content = fs.readFileSync(options.filePath);
        if (!contentType)
            contentType = mime.lookup(options.filePath);
    }
    if (!fingerprint) {
        var shasum = crypto.createHash('sha1');
        fingerprint = shasum.update(content).digest("hex");
    }
    if (!contentType)
        contentType = "text/plain";
    var result = {
        content: content,
        fingerprint: fingerprint,
        contentType: contentType,
    };
    this.assets[options.path] = result;
    return result;
};

proto.resourceUrl = function (path) {
    var asset = this.assets[path];
    if (asset)
        return this.foreverPath + asset.fingerprint + '/' + path;
    else
        return this.staticPath + path;
};

proto.getBrowserifyModule = function () {
    var fingerprints = {};
    _.each(this.assets, function (asset, path) {
        fingerprints[path] = asset.fingerprint;
    });
    var exportedCacheforever = {
        fingerprints: fingerprints,
    };
    return 'module.exports=' + JSON.stringify(exportedCacheforever) + ';';
};
