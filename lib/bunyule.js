var appName = require('./appname')();
var bunyan = require('bunyan');
var PrettyStream = require('bunyan-prettystream');
var _ = require('underscore');

var logger = bunyan.createLogger({
    name: appName,
    streams: []
});

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
        trace: _.bind(logger.trace, logger),
        debug: _.bind(logger.debug, logger),
        info: _.bind(logger.info, logger),
        warn: _.bind(logger.warn, logger),
        error: _.bind(logger.error, logger),
        fatal: _.bind(logger.fatal, logger),
        child: _.bind(logger.child, logger),
    };
    return extendedLogger;
}

module.exports = _.extend(encapsulate(logger), {
    initConsoleStream: function (level) {
        var prettyStdOut = new PrettyStream();
        prettyStdOut.pipe(process.stdout);

        logger.addStream({
            level: level,
            type: 'raw',
            stream: prettyStdOut
        });
    },
    initGelfStream: function (level, host, port, connectionType) {
        var gelfStream = require('bunyan-gelf').createStream({
            graylogHostname: host || '127.0.0.1',
            graylogPort: port || 12201,
            connection: connectionType || 'wan',
            maxChunkSizeWan: 1420,
            maxChunkSizeLan: 8154
        });

        logger.addStream({
            level: level,
            stream: gelfStream
        })
    },
});