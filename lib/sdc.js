const os = require('os');
const StatsdClient = require('statsd-client');
const appname = require('./appname');
const etcd = require("./etcd");
const dyno = require('./dyno');

const prefix = [
    (process.env.STATSD_PREFIX || etcd.getEtcdValue('/server/statsd/prefix') || os.hostname()),
];
//dokku scaling
const dynoIdentifier = getDynoIdentifier();
if (dynoIdentifier) {
    prefix.push(appname() + "-" + dynoIdentifier);
} else {
    prefix.push(appname());
}
const sdc = new StatsdClient({
    prefix: prefix.join('.'),
    host: etcd.getEtcdValue('/server/statsd/host'),
    port: etcd.getEtcdValue('/server/statsd/port'),
});
module.exports = sdc;

function getDynoIdentifier() {
    if (dyno) {
        return dyno.replace(/\./g, "-").replace(/[^\w-]+/g, "");
    } else {
        return null;
    }
}
