var optimist = require('optimist');
var _ = require('underscore');
var bunyule = require('./bunyule');

var opt = getOpt();
checkHelpOpt(opt);
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
            graylogLevel: 'grayLog level - if set, enables graylog logging',
            graylogHostname: 'grayLog Hostname',
            graylogPort: 'grayLog Port',
            graylogConnectionType: 'grayLog connectionType : wan or lan',
        });
}

function checkHelpOpt(opt) {
    var argv = opt.argv;
    if(argv.help) {
        opt.showHelp();
        process.exit();
    }
}

function initLoggerFromOpt(opt) {
    var argv = opt.argv;
    bunyule.initConsoleStream(argv.debug ? 'debug' : 'info');
    if(argv.graylogLevel) {
        bunyule.initGelfStream(argv.graylogLevel, argv.graylogHostname, argv.graylogPort, argv.graylogConnectionType)
    } else if(process.env.GRAYLOG_LEVEL) {
        bunyule.initGelfStream(
            process.env.GRAYLOG_LEVEL,
            process.env.GRAYLOG_PORT_12201_UDP_ADDR,
            process.env.GRAYLOG_PORT_12201_UDP_PORT,
            'lan');
    }
}

function optimistWrapper() {
    var wrapper = {};
    _.each(opt, function (val, key) {
        if(_.isFunction(val)) {
            wrapper[key] = function () {
                var ret = opt[key].apply(opt, arguments);
                if(ret == opt)
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
    return wrapper;
}
