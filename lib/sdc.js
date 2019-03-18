var os = require('os');
var StatsdClient = require('statsd-client');
var appname = require('./appname');
var etcd = require("./etcd");

var prefix = [
    (process.env.STATSD_PREFIX || etcd.getEtcdValue('/server/statsd/prefix') || os.hostname()),
];
//dokku scaling
const dynoIdentifier = getDynoIdentifier();
if (dynoIdentifier) {
    prefix.push(appname() + "-" + dynoIdentifier);
} else {
    prefix.push(appname());
}
var sdc = new StatsdClient({
    prefix: prefix.join('.'),
    host: etcd.getEtcdValue('/server/statsd/host'),
    port: etcd.getEtcdValue('/server/statsd/port'),
});
module.exports = sdc;

function getDynoIdentifier() {
    const dynoTypeNumber = process.env.DYNO_TYPE_NUMBER;
    if (dynoTypeNumber) {
        return dynoTypeNumber.replace(/\./g, "-").replace(/[^\w-]+/g, "");
    } else {
        return null;
    }
}
