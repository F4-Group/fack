var constants = require('../lib/constants');
var cacheforever = require('fack/cacheforever');

module.exports = function (resourcePath) {
    var hash = cacheforever.fingerprints[resourcePath];
    var prefix;
    if (resourcePath && hash)
        prefix = constants.foreverUrlPrefix + "/" + hash;
    else
        prefix = constants.staticUrlPrefix;
    return prefix + '/' + resourcePath;
};
