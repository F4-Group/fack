var bunyule = require('./bunyule');
var Etcd = require('node-etcd');
var etcdWatcher = require('etcd-watcher');
var etcd = new Etcd(process.env.ETCD_HOST);

module.exports = {
    init: init,
    getOptDescriptions: getOptDescriptions,
};

var configWatcher = etcdWatcher.watcher(etcd, {
    gelf: {
        required: false,
        etcd: '/server/gelf/host',
    },
    hostname: {
        required: false,
        etcd: '/hostname',
    },
});

//TODO change streams dynamically
//configWatcher.on('change', readConfig);

function getOptDescriptions() {
    return {
        'gelf-loglevel': 'Log level for GELF format',
        'gelf-host': 'GELF server hostname - if set, enables GELF logging',
        'gelf-port': 'GELF server UDP port',
        'gelf-connectiontype': 'GELF connection type (wan or lan)',
    };
}

function init(argv) {
    configWatcher.wait(function (err, config) {
        if (config.hostname)
            bunyule.setHostname(config.hostname);

        //both init must be in sync
        bunyule.initConsoleStream(argv.debug ? 'debug' : 'info');
        if (err) {
            bunyule.warn('Logger initialization error: ' + err);
        } else {
            var logLevel = argv['gelf-loglevel'] || process.env.GELF_LOG_LEVEL || 'info';
            var host = config.gelf || argv['gelf-host'] || process.env.GELF_PORT_12201_UDP_ADDR;
            var port = argv['gelf-port'] || process.env.GELF_PORT_12201_UDP_PORT || 12201;
            var connectionType = argv['gelf-connectiontype'] || 'lan';
            if (host)
                bunyule.initGelfStream(logLevel, host, port, connectionType);
        }
    });
}
