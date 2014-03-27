var appName = require('./lib/appname')();
process.title = appName;

module.exports = {
    sdc: require('./lib/sdc'),
    optimist: require('./lib/optimist'),
    express: require('./lib/express'),
    bunyule: require('./lib/bunyule'),
    f4ExpressMiddlewares: require('f4-express-middlewares'),
};

module.exports.logger = module.exports.bunyule;