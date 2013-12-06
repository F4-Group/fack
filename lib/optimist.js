var optimist = require('optimist');
var logule = require('logule').init(require.main);
var _ = require('underscore');

var opt = getOpt();
checkHelpOpt(opt);
initLoguleFromOpt(opt);
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
            });
}

function checkHelpOpt(opt) {
    var argv = opt.argv;
    if (argv.help) {
        opt.showHelp();
        process.exit();
    }
}

function initLoguleFromOpt(opt) {
    var argv = opt.argv;
    if (argv.debug)
        logule.unmute('debug');
    else
        logule.mute('debug');
}

function optimistWrapper() {
    var wrapper = {};
    _.each(opt, function(val, key) {
        if (_.isFunction(val)) {
            wrapper[key] = function() {
                var ret = opt[key].apply(opt, arguments);
                if (ret == opt)
                    ret = wrapper;
                return ret;
            };
        }
    });
    Object.defineProperty(wrapper, 'argv', {
        get: function() {
            return opt.argv;
        },
        enumerable: true,
    });
    return wrapper;
}
