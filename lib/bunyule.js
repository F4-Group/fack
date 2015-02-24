var appName = require('./appname')();
var bunyan = require('bunyan');
var PrettyStream = require('bunyan-prettystream');
var _ = require('underscore');
var util = require('util');

var logger = bunyan.createLogger({
    name: appName,
    streams: [],
});

//out here to also apply to subs
var ready = false;
var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();

function encapsulate(logger) {
    var extendedLogger = {
        init: function () {
            //logule compatibility
            return extendedLogger;
        },
        sub: function (id) {
            return encapsulate(logger.child({component: id}));
        },
        mute: function (level) {
            var bunyanLevel = bunyan.resolveLevel(level);
            var nextLevel = bunyanLevel + 10;
            if (logger.level() <= bunyanLevel) {
                _.each(logger.levels(), function (level, pos) {
                    if (level <= bunyanLevel)
                        logger.levels(pos, nextLevel);
                });
            }
            return this;
        },
        unmute: function (level) {
            var bunyanLevel = bunyan.resolveLevel(level);
            _.each(logger.levels(), function (level, pos) {
                if (level > bunyanLevel)
                    logger.levels(pos, bunyanLevel);
            });
            return this;
        },
        trace: _.partial(deferUntilReady, logger.trace, "trace"),
        debug: _.partial(deferUntilReady, logger.debug, "debug"),
        info: _.partial(deferUntilReady, logger.info, "info"),
        warn: _.partial(deferUntilReady, logger.warn, "warn"),
        error: _.partial(deferUntilReady, logger.error, "error"),
        fatal: _.partial(deferUntilReady, logger.fatal, "fatal"),
        child: _.bind(logger.child, logger),
    };

    function deferUntilReady(cb, type) {
        var args = Array.prototype.slice.call(arguments, 2);
        if (ready)
            return cb.apply(logger, args);
        else {
            console.log("%s: %s", type, util.format.apply(util.format, args));
            emitter.once("ready", function () {
                cb.apply(logger, args);
            });
        }
    }

    return extendedLogger;
}

function setReady() {
    //using defer to allow all init to be called before unstacking logs
    _.defer(function () {
        ready = true;
        emitter.emit("ready");
    });
}

module.exports = _.extend(encapsulate(logger), {
    setHostname: function (hostname) {
        //looks like this isn't the way to go, but it seems basic enough to work
        logger.fields.hostname = hostname;
    },
    initConsoleStream: function (level) {
        var prettyStdOut = new PrettyStream();
        prettyStdOut.pipe(process.stdout);

        logger.addStream({
            level: level,
            type: 'raw',
            stream: prettyStdOut,
        });
        setReady();
    },
    initGelfStream: function (level, host, port, connectionType) {
        var gelfStream = require('bunyan-gelf').createStream({
            graylogHostname: host || '127.0.0.1',
            graylogPort:     port || 12201,
            connection:      connectionType || 'wan',
            maxChunkSizeWan: 1420,
            maxChunkSizeLan: 8154,
        });

        logger.addStream({
            level: level,
            stream: gelfStream,
        });
        setReady();
    },
});