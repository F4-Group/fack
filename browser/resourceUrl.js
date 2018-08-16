const constants = require('../lib/constants');
const cacheforever = require('fack/cacheforever');

module.exports = function (resourcePath) {
    const hash = cacheforever.fingerprints[resourcePath];
    let prefix;
    if (resourcePath && hash) {
        prefix = constants.foreverUrlPrefix + "/" + hash;
    } else {
        prefix = constants.staticUrlPrefix;
    }
    return prefix + '/' + resourcePath;
};
