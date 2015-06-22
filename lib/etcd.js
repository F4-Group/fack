var Etcd = require('node-etcd');
var etcdHosts = process.env.ETCD_HOST;
if (etcdHosts && etcdHosts.indexOf(':') >= 0) {
    etcdHosts = etcdHosts.split(',');
}
var etcd = new Etcd(etcdHosts);

module.exports = {
    getEtcdValue: getEtcdValue,
};

function getEtcdValue(key) {
    var result = etcd.getSync(key);
    //ignore errors
    return result && result.body && result.body.node && result.body.node.value;
}