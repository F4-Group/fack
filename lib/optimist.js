const optimist = require('optimist');
const _ = require('lodash');
const opt = getOpt();
let ended = false;
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
        }));
}

function checkHelpOpt(opt) {
    const argv = opt.argv;
    if (argv.help) {
        opt.showHelp();
        process.exit();
    }
}

function end() {
    if (ended) {
        return this;
    }
    ended = true;
    checkHelpOpt(opt);
    return this;
}

function optimistWrapper() {
    const wrapper = {};
    _.each(opt, function (val, key) {
        if (_.isFunction(val)) {
            wrapper[key] = function () {
                let ret = opt[key].apply(opt, arguments);
                if (ret == opt) {
                    ret = wrapper;
                }
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
