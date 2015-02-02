var constants = require('../lib/constants');
/* global cacheforever */
module.exports = function (resourcePath) {
    var hash = cacheforever.fingerprints[resourcePath];
    var prefix;
    if (resourcePath && hash)
        prefix = constants.foreverUrlPrefix + "/" + hash;
    else
        prefix = constants.staticUrlPrefix;
    return prefix + '/' + resourcePath;
};
