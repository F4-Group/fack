var bunyule = require('./bunyule');

module.exports = {
    init: init,
    getOptDescriptions: getOptDescriptions,
};

function getOptDescriptions() {
    return {
        'gelf-loglevel': 'Log level for gelf format - if set, enables gelf logging',
        'gelf-host': 'gelf server hostname',
        'gelf-port': 'gelf server udp port',
        'gelf-connectiontype': 'gelf connection type : wan or lan',
    };
}

function init(argv) {
    bunyule.initConsoleStream(argv.debug ? 'debug' : 'info');
    var logLevel = argv['gelf-loglevel'] || process.env.GELF_LOG_LEVEL || 'info';
    var host = argv['gelf-host'] || process.env.GELF_PORT_12201_UDP_ADDR;
    var port = argv['gelf-port'] || process.env.GELF_PORT_12201_UDP_PORT || 12201;
    var connectionType = argv['gelf-connectiontype'] || 'lan';
    if (host)
        bunyule.initGelfStream(logLevel, host, port, connectionType);
}
