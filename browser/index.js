var resourceUrl = require('./resourceUrl');
var constants = require('../lib/constants');

module.exports = {
    resourceUrl: resourceUrl,
    jsUrl: jsUrl,
    cssUrl: cssUrl,
    i18n: require('./i18n'),
    watch: require('./watch'),
};

function jsUrl(path) {
    return resourceUrl(path);
}

function cssUrl(path) {
    return resourceUrl(constants.stylusSubDir + '/' + path);
}
