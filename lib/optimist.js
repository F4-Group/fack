var optimist = require('optimist');
var _ = require('underscore');
var loggerInit = require('./logger-init');
var opt = getOpt();
var ended = false;
loggerInit.init(opt.argv);
module.exports = optimistWrapper();

function getOpt() {
    return optimist
        .default({
            port: process.env.PORT || 5000,
        })
        .boolean(['debug', 'help'])
        .describe(_.extend({
            help: 'Display this help',
            port: 'This server port',
            debug: 'Log debug info',
        }, loggerInit.getOptDescriptions()));
}

function checkHelpOpt(opt) {
    var argv = opt.argv;
    if (argv.help) {
        opt.showHelp();
        process.exit();
    }
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
