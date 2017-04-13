var os = require('os');
var etcd = require('./etcd');

module.exports = process.env.LOG_HOSTNAME
    || etcd.getEtcdValue("/hostname")
    || os.hostname();
