var appName = require('./appname')();
var bunyan = require('bunyan');
var PrettyStream = require('bunyan-prettystream');
var _ = require('underscore');
var etcd = require("./etcd");

var level = etcd.getEtcdValue("/server/gelf/level") || 'info';

var prettyStdOut = new PrettyStream();
prettyStdOut.pipe(process.stdout);
var streams = [
    {
        level: level,
        type: 'raw',
        stream: prettyStdOut,
    },
];

var gelfHost = etcd.getEtcdValue("/server/gelf/host");
if (gelfHost) {
    var gelfStream = require('bunyan-gelf').createStream({
        graylogHostname: gelfHost,
        graylogPort: etcd.getEtcdValue("/server/gelf/port") || 12201,
        connection:  etcd.getEtcdValue("/server/gelf/connectiontype") || 'wan',
        maxChunkSizeWan: 1420,
        maxChunkSizeLan: 8154,
    });

    streams.push({
        level: level,
        stream: gelfStream,
    });
}

var logger = bunyan.createLogger({
    name: appName,
    streams: streams,
    hostname: etcd.getEtcdValue("/hostname"),
});

function encapsulate(logger) {
    var extendedLogger = {
        init: function () {
            //logule compatibility
            return extendedLogger;
        },
        sub: function (id, simple) {
            return encapsulate(logger.child({component: id}, simple));
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
        fields: logger.fields,
    };

    return extendedLogger;
}

module.exports = encapsulate(logger);
