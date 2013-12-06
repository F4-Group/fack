var os = require('os');
var appname = require('./appname');

var sdc = new (require('statsd-client'))({
    prefix: os.hostname() + '.' + appname(),
});
module.exports = sdc;
