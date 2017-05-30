var uncaughtException = require('./lib/uncaughtException');
var processTitle = require('./lib/process-title');
processTitle.set('starting');
require('dnscache')({
    enable: true,
});

module.exports = {
    sdc: require('./lib/sdc'),
    optimist: require('./lib/optimist'),
    express: require('./lib/express'),
    bunyule: require('./lib/bunyule'),
    logger: require('./lib/bunyule'),
    f4ExpressMiddlewares: require('f4-express-middlewares'),
    appName: require('./lib/appname')(),
    i18n: require('i18next'),
};

uncaughtException.bind();
