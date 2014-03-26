var os = require('os');
var appname = require('./appname');

var options = {
    prefix: os.hostname() + '.' + appname(),
};

if (process.env.STATSD_HOST) {
    options.host = process.env.STATSD_HOST;
}

if (process.env.STATSD_PORT) {
    options.port = process.env.STATSD_PORT;
}

var sdc = new (require('statsd-client'))(options);
module.exports = sdc;
