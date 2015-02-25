var Etcd = require('node-etcd');
var etcd = new Etcd(process.env.ETCD_HOST);

module.exports = {
    getEtcdValue: getEtcdValue,
};

function getEtcdValue(key) {
    var result = etcd.getSync(key);
    //ignore errors
    return result && result.body && result.body.node && result.body.node.value;
}