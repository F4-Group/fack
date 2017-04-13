var bunyan = require('bunyan');
var PrettyStream = require('bunyan-prettystream');
var _ = require('underscore');
var dns = require('dns');
var deasync = require('deasync');

var appName = require('./appname')();
var etcd = require("./etcd");
var optimist = require('./optimist');
var hostname = require('./hostname');

var level = optimist.argv.debug ? 'debug' : (etcd.getEtcdValue("/server/gelf/level") || 'info');

var prettyStdOut = new PrettyStream();
prettyStdOut.pipe(process.stdout);
var streams = [
    {
        name: 'stdout',
        level: level,
        type: 'raw',
        stream: prettyStdOut,
    },
];

var gelfHost = etcd.getEtcdValue("/server/gelf/host");
var gelfStream;
if (gelfHost) {
    var dnsLookup = deasync(dns.lookup);
    gelfStream = require('bunyan-gelf').createStream({
        //careful, second argument of dns.lookup, if set, must be a number on node 0.10.x but may be an object on node 0.12.x
        graylogHostname: dnsLookup(gelfHost),
        graylogPort: etcd.getEtcdValue("/server/gelf/port") || 12201,
        connection: etcd.getEtcdValue("/server/gelf/connectiontype") || 'wan',
        maxChunkSizeWan: 1420,
        maxChunkSizeLan: 8154,
    });
    gelfStream.gelf.on('error', function (err) {
        console.error('Gelf error: ', err);
    });

    streams.push({
        name: 'gelf',
        level: level,
        stream: gelfStream,
    });
}

var loggerOptions = {
    name: appName,
    streams: streams,
    hostname: hostname,
};
//dokku scaling
if (process.env.DYNO_TYPE_NUMBER) {
    loggerOptions.DYNO_TYPE_NUMBER = process.env.DYNO_TYPE_NUMBER;
}

var logger = bunyan.createLogger(loggerOptions);
module.exports = encapsulate(logger);

function encapsulate(logger) {
    return _.extend(logger, {
        init: function () {
            //logule compatibility
            return this;
        },
        closeAndFlush(callback){//To be used only by uncaughtException
            if (gelfStream)
                gelfStream.end(callback);
            else
                callback();
        },
        sub: function (id, simple) {
            var parentComponent = logger.fields.component;
            var component = parentComponent ? parentComponent + '/' + id : id;
            return encapsulate(logger.child({component: component}, simple));
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
    });
}
