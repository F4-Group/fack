const os = require('os');
const StatsdClient = require('statsd-client');
const appname = require('./appname');
const etcd = require("./etcd");

const prefix = [
    (process.env.STATSD_PREFIX || etcd.getEtcdValue('/server/statsd/prefix') || os.hostname()),
];
//dokku scaling
if (process.env.DYNO_TYPE_NUMBER) {
    prefix.push(appname() + "-" + process.env.DYNO_TYPE_NUMBER.replace(/\./g, "-"));
} else {
    prefix.push(appname());
}
const sdc = new StatsdClient({
    prefix: prefix.join('.'),
    host: etcd.getEtcdValue('/server/statsd/host'),
    port: etcd.getEtcdValue('/server/statsd/port'),
});
module.exports = sdc;
