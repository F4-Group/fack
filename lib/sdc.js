var os = require('os');
var Etcd = require('node-etcd');
var etcdWatcher = require('etcd-watcher');
var StatsdClient = require('statsd-client');
var etcd = new Etcd(process.env.ETCD_HOST);

var appname = require('./appname');

var configWatcher = etcdWatcher.watcher(etcd, {
    host: {
        required: false,
        etcd: '/server/statsd/host',
    },
    port: {
        required: false,
        etcd: '/server/statsd/port',
    },
    prefix: {
        required: false,
        etcd: '/server/statsd/prefix',
    },
});

var sdc = new StatsdClient({});
module.exports = sdc;

configWatcher.wait(function (err, config) {
    if (err)
        console.error("sdc etcd error", err);
    else if (config)
        applyConf(config);
});

configWatcher.on('change', applyConf);

function applyConf(config) {
    //statsd-client requires a trailing dot
    sdc.options.prefix = (config.prefix || os.hostname()) + '.' + appname() + ".";
    if (sdc.options.host != config.host || sdc.options.port != config.port) {
        //using console and not bunyan to avoid init complexity, and statsd-client will log on stderr anyway
        if (config.host)
            sdc.options.host = config.host;
        if (config.port)
            sdc.options.port = config.port;
        console.log("changed statsd host to " + sdc.options.host + ":" + sdc.options.port);
        sdc.close();//closes current socket
        var EphemeralSocket = require('statsd-client/lib/EphemeralSocket');
        //assumes udp connection
        sdc._socket = new EphemeralSocket(sdc.options);
    }
}

