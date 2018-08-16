const resourceUrl = require('./resourceUrl');
const constants = require('../lib/constants');

module.exports = {
    resourceUrl: resourceUrl,
    jsUrl: jsUrl,
    cssUrl: cssUrl,
    i18n: require('./i18n'),
};

function jsUrl(path) {
    return resourceUrl(addExt('js', path));
}

function cssUrl(path) {
    return resourceUrl(constants.stylusSubDir + '/' + addExt('css', path));
}

function addExt(ext, path) {
    return new RegExp('\\.' + ext + '$').test(path) ? path : path + '.' + ext;
}
