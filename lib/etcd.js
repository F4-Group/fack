const Etcd = require('node-etcd');
let etcdHosts = process.env.ETCD_HOST;
if (etcdHosts && etcdHosts.indexOf(':') >= 0) {
    etcdHosts = etcdHosts.split(',');
}
const etcd = new Etcd(etcdHosts);

module.exports = {
    getEtcdValue: getEtcdValue,
};

function getEtcdValue(key) {
    const result = etcd.getSync(key);
    //ignore errors
    return result && result.body && result.body.node && result.body.node.value;
}
