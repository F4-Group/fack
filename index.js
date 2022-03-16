const uncaughtException = require('./lib/uncaughtException');
const processTitle = require('./lib/process-title');
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
    appName: require('./lib/appname')(),
    hostname: require('./lib/hostname'),
    i18n: require('i18next'),
    uniqueProcessName: require('./lib/uniqueProcessName'),
    buildBundles: require('./lib/buildBundles'),
};

uncaughtException.bind();
