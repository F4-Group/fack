const fs = require('fs');
const crypto = require('crypto');
const _ = require('lodash');
const mime = require('mime');
const pathUtil = require('./pathUtil');

module.exports = CacheForever;

const oneYearCache = 60 * 60 * 24 * 365;

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
    if (/\/$/.test(path)) {
        return path;
    } else {
        return path + '/';
    }
}

function sendAsset(res, asset, maxAge) {
    res.statusCode = 200;
    res.setHeader('Etag', asset.fingerprint);
    res.setHeader('Content-Type', asset.contentType);
    let cacheControlHeader = 'public, max-age=' + (maxAge || 0); //expect maxAge in seconds
    if (!maxAge) {
        cacheControlHeader += ', must-revalidate';
    }
    res.setHeader('Cache-Control', cacheControlHeader);
    res.end(asset.content);
}

const proto = CacheForever.prototype;

proto.middleware = function () {
    const staticPath = this.staticPath;
    const foreverPath = this.foreverPath;
    const assets = this.assets;
    const foreverMaxAge = this.foreverMaxAge;
    const staticMaxAge = this.staticMaxAge;
    const that = this;
    return function (req, res, next) {
        req.resourceUrl = function (url) {
            return that.resourceUrl(url);
        };
        let asset;
        let maxAge;
        let path;
        if (req.url.indexOf(staticPath) == 0) {
            path = pathUtil.getPathWithoutPrefix(req, staticPath);
            asset = assets[path];
            if (asset) {
                maxAge = staticMaxAge;
            }
        } else if (req.url.indexOf(foreverPath) == 0) {
            const urlParts = req.url.split("/");
            const reqFingerprint = urlParts[2];
            const prefix = foreverPath + reqFingerprint + '/';
            path = pathUtil.getPathWithoutPrefix(req, prefix);
            asset = assets[path];
            if (asset && asset.fingerprint == reqFingerprint) {
                maxAge = foreverMaxAge;
            }
        }
        if (asset) {
            sendAsset(res, asset, maxAge);
        } else {
            next();
        }
    };
};

proto.register = function (options) {
    let fingerprint = options.fingerprint;
    let content = options.content;
    let contentType = options.contentType;
    if (!content && options.filePath) {
        content = fs.readFileSync(options.filePath);
        if (!contentType) {
            contentType = mime.getType(options.filePath);
        }
    }
    if (!fingerprint) {
        const shasum = crypto.createHash('sha1');
        fingerprint = shasum.update(content).digest("hex");
    }
    if (!contentType) {
        contentType = "text/plain";
    }
    const result = {
        content: content,
        fingerprint: fingerprint,
        contentType: contentType,
    };
    this.assets[options.path] = result;
    return result;
};

proto.resourceUrl = function (path) {
    const asset = this.assets[path];
    if (asset) {
        return this.foreverPath + asset.fingerprint + '/' + path;
    } else {
        return this.staticPath + path;
    }
};

proto.getBrowserifyModule = function () {
    const exportedCacheforever = {
        fingerprints: this.getFingerprints(),
    };
    return 'module.exports=' + JSON.stringify(exportedCacheforever) + ';';
};

proto.getFingerprints = function () {
    const fingerprints = {};
    _.each(this.assets, function (asset, path) {
        fingerprints[path] = asset.fingerprint;
    });
    return fingerprints;
};
