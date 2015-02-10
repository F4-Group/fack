var os = require('os');
var Etcd = require('node-etcd');
var etcdWatcher = require('etcd-watcher');
var StatsdClient = require('statsd-client');
var etcd = new Etcd(process.env.ETCD_HOST);

var appname = require('./appname');

var configWatcher = etcdWatcher.watcher(etcd, {
    statsd: {
        required: false,
        etcd: '/server/statsd/host',
    }
});

var options = {
    prefix: process.env.STATSD_PREFIX || os.hostname() + '.' + appname(),
};

if (process.env.STATSD_HOST) {
    options.host = process.env.STATSD_HOST;
}

if (process.env.STATSD_PORT) {
    options.port = process.env.STATSD_PORT;
}

if (process.env.STATSD_DEBUG) {
    options.debug = true;
    //using console and not bunyan to avoid init complexity, and statsd-client will log on stderr anyway
    console.log("starting statsd with %j", options);
}

var sdc = new StatsdClient(options);
module.exports = sdc;

configWatcher.wait(function (err, config) {
    //both init must be in sync
    if (config.statsd) {
        changeHost(config.statsd);
    }
});

configWatcher.on('change', function (config) {
    if (config.statsd) {
        changeHost(config.statsd);
    }
});

function changeHost(host) {
    if (sdc.options.host != host) {
        console.log("changed statsd host to " + host);
        sdc.options.host = host;
        sdc.close();//closes current socket
        var EphemeralSocket = require('statsd-client/lib/EphemeralSocket');
        //assumes udp connection
        sdc._socket = new EphemeralSocket(sdc.options);
    }
}

