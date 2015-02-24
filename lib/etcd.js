var Etcd = require('node-etcd');
var etcd = new Etcd(process.env.ETCD_HOST);

module.exports = {
    getEtcdValue: getEtcdValue,
};

function getEtcdValue(key) {
    var result = etcd.getSync(key);
    if (result.err) {
        console.log("etcd error getting %s", key, result.err);
    }
    //ignore errors
    return result && result.body && result.body.node && result.body.node.value;
}