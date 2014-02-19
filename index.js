var path = require('path');
var os = require('os');

var appName = require('./lib/appname')();
process.title = appName;

module.exports = {
    sdc: require('./lib/sdc'),
    optimist: require('./lib/optimist'),
    express: require('./lib/express'),
    f4ExpressMiddlewares: require('f4-express-middlewares'),
};
