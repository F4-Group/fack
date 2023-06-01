const bunyan = require('bunyan');
const PrettyStream = require('bunyan-prettystream');
const _ = require('lodash');

const appName = require('./appname')();
const etcd = require("./etcd");
const optimist = require('./optimist');
const hostname = require('./hostname');
const uniqueProcessName = require('./uniqueProcessName');

const level = optimist.argv.debug ? 'debug' : (etcd.getEtcdValue("/server/gelf/level") || 'info');

const prettyStdOut = new PrettyStream();
prettyStdOut.pipe(process.stdout);
const streams = [
    {
        name: 'stdout',
        level: level,
        type: 'raw',
        stream: prettyStdOut,
    },
];

const gelfHost = etcd.getEtcdValue("/server/gelf/host");
let gelfStream;
if (gelfHost) {
    gelfStream = require('bunyan-gelf').createStream({
        //careful, second argument of dns.lookup, if set, must be a number on node 0.10.x but may be an object on node 0.12.x
        graylogHostname: gelfHost,
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

const loggerOptions = {
    name: appName,
    streams: streams,
    hostname: hostname,
    APP_INSTANCE_NAME: uniqueProcessName,
};

const logger = bunyan.createLogger(loggerOptions);
module.exports = encapsulate(logger);

function encapsulate(logger) {
    return _.extend(logger, {
        init: function () {
            //logule compatibility
            return this;
        },
        closeAndFlush(callback) {//To be used only by uncaughtException
            if (gelfStream) {
                gelfStream.end(callback);
            } else {
                callback();
            }
        },
        sub: function (id, simple) {
            const parentComponent = logger.fields.component;
            const component = parentComponent ? parentComponent + '/' + id : id;
            return encapsulate(logger.child({component: component}, simple));
        },
        mute: function (level) {
            const bunyanLevel = bunyan.resolveLevel(level);
            const nextLevel = bunyanLevel + 10;
            if (logger.level() <= bunyanLevel) {
                _.each(logger.levels(), function (level, pos) {
                    if (level <= bunyanLevel) {
                        logger.levels(pos, nextLevel);
                    }
                });
            }
            return this;
        },
        unmute: function (level) {
            const bunyanLevel = bunyan.resolveLevel(level);
            _.each(logger.levels(), function (level, pos) {
                if (level > bunyanLevel) {
                    logger.levels(pos, bunyanLevel);
                }
            });
            return this;
        },
        serializers: {
            err(err) {
                const obj = bunyan.stdSerializers.err(err);
                _.assign(obj, err);
                return obj;
            },
        },
    });
}
