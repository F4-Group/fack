var resourceUrl = require('./resourceUrl');

module.exports = {
    resourceUrl: resourceUrl,
    jsUrl: jsUrl,
    cssUrl: cssUrl,
    i18n: require('./i18n'),
};

function jsUrl(path) {
    return resourceUrl(path);
}

function cssUrl(path) {
    return resourceUrl('css/' + path);
}
