const os = require('os');
const etcd = require('./etcd');

module.exports = process.env.LOG_HOSTNAME
    || etcd.getEtcdValue("/hostname")
    || os.hostname();
