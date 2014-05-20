var optimist = require('optimist');
var _ = require('underscore');
var bunyule = require('./bunyule');

var opt = getOpt();
var ended = false;
initLoggerFromOpt(opt);
module.exports = optimistWrapper();

function getOpt() {
    return optimist
        .default({
            port: process.env.PORT || 5000,
        })
        .boolean(['debug', 'help'])
        .describe({
            help: 'Display this help',
            port: 'This server port',
            debug: 'Log debug info',
            'gelf-loglevel': 'Log level for gelf format - if set, enables gelf logging',
            'gelf-host': 'gelf server hostname',
            'gelf-port': 'gelf server udp port',
            'gelf-connectiontype': 'gelf connection type : wan or lan',
        });
}

function checkHelpOpt(opt) {
    var argv = opt.argv;
    if (argv.help) {
        opt.showHelp();
        process.exit();
    }
}

function initLoggerFromOpt(opt) {
    var argv = opt.argv;
    bunyule.initConsoleStream(argv.debug ? 'debug' : 'info');
    var logLevel = argv['gelf-loglevel'] || process.env.GELF_LOG_LEVEL || 'info';
    var host = argv['gelf-host'] || process.env.GELF_PORT_12201_UDP_ADDR;
    var port = argv['gelf-port'] || process.env.GELF_PORT_12201_UDP_PORT;
    var connectionType = argv['gelf-connectiontype'] || 'lan';
    if (host && port)
        bunyule.initGelfStream(logLevel, host, port, connectionType);
}

function end() {
    if (ended)
        return this;
    ended = true;
    checkHelpOpt(opt);
    return this;
}

function optimistWrapper() {
    var wrapper = {};
    _.each(opt, function (val, key) {
        if (_.isFunction(val)) {
            wrapper[key] = function () {
                var ret = opt[key].apply(opt, arguments);
                if (ret == opt)
                    ret = wrapper;
                return ret;
            };
        }
    });
    Object.defineProperty(wrapper, 'argv', {
        get: function () {
            return opt.argv;
        },
        enumerable: true,
    });
    wrapper.end = end;
    return wrapper;
}
