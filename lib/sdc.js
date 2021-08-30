const os = require('os');
const StatsdClient = require('statsd-client');
const appname = require('./appname');
const etcd = require("./etcd");
const dyno = require('./dyno');

const prefix = [];

if (process.env.STATSD_APPNAME) {
    prefix.push(process.env.STATSD_APPNAME);
} else {
    prefix.push(process.env.STATSD_PREFIX || etcd.getEtcdValue('/server/statsd/prefix') || os.hostname());
    //dokku scaling
    const dynoIdentifier = sanitizeIdentifier(dyno);
    if (dynoIdentifier) {
        prefix.push(appname() + "-" + dynoIdentifier);
    } else {
        prefix.push(appname());
    }
}

const sdc = new StatsdClient({
    prefix: prefix.join('.'),
    host: etcd.getEtcdValue('/server/statsd/host'),
    port: etcd.getEtcdValue('/server/statsd/port'),
});
module.exports = sdc;

function sanitizeIdentifier(identifier) {
    if (identifier) {
        return identifier.replace(/\./g, "-").replace(/[^\w-]+/g, "");
    } else {
        return null;
    }
}
