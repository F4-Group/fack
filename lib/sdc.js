var os = require('os');
var appname = require('./appname');

var options = {
    prefix: process.env.STATSD_PREFIX || os.hostname() + '.' + appname(),
};

if (process.env.STATSD_HOST) {
    options.host = process.env.STATSD_HOST;
}

if (process.env.STATSD_PORT) {
    options.port = process.env.STATSD_PORT;
}

if (process.env.STATSD_DEBUG) {
    options.debug = true;
    //using console and not bunyan to avoid init complexity, and statsd-client will log on stderr anyway
    console.log("starting statsd with %j", options);
}

var sdc = new (require('statsd-client'))(options);
module.exports = sdc;
