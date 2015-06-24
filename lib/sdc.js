var os = require('os');
var StatsdClient = require('statsd-client');
var appname = require('./appname');
var etcd = require("./etcd");

var sdc = new StatsdClient({
    prefix: (process.env.STATSD_PREFIX || etcd.getEtcdValue('/server/statsd/prefix') || os.hostname()) + '.' + appname() + ".",
    host: etcd.getEtcdValue('/server/statsd/host'),
    port: etcd.getEtcdValue('/server/statsd/port'),
});
module.exports = sdc;
