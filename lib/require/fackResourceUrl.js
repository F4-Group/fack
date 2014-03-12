module.exports = function(resourcePath) {
    var hash = cacheforever.fingerprints[resourcePath];
    var prefix;
    if (resourcePath && hash)
        prefix = "/cacheForever/" + hash;
    else
        prefix = '/static';
    return prefix + '/' + resourcePath;
};
