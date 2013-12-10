var express = require('express');
var logule = require('logule').init(module);

var isProd = 'production' === process.env.NODE_ENV;

module.exports = getLogger;

function getLogger() {
    var logStream = {
        write: function (log) {
            logule.info(log.replace(/\n*$/, ''));
        }
    };

    var logFormat = isProd
        ? ':ip - ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
        : 'dev';

    express.logger.token('ip', function (req) {
        if (req.ips && req.ips.length > 0)
            return req.ips.join(', ');
        else
            return req.ip;
    });
    return express.logger({ format: logFormat, stream: logStream });
}
