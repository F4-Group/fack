var express = require('express');
var logger = require('./bunyule');
var humanize = require('humanize');
var clc = require('cli-color');
var _ = require('underscore');

var isProd = 'production' === process.env.NODE_ENV;
var logReferrer = isProd;
var logUserAgent = isProd;

module.exports = loggerMiddleware;

function loggerMiddleware(req, res, next) {
    req.logger = logger.child({ips: (req.ips && req.ips.length > 0 ? req.ips.join(', ') : req.ip)});
    req._startTime = new Date;

    res.on('finish', logRequest);
    res.on('close', logRequest);
    next();

    function logRequest() {
        res.removeListener('finish', logRequest);
        res.removeListener('close', logRequest);

        var time = (new Date - req._startTime);

        var logger = req.logger;
        var fields = {
            method: req.method,
            originalUrl: req.originalUrl,
            statusCode: res.statusCode,
            timeInMs: time
        };
        var message = [];
        message.push(req.method);
        message.push(req.originalUrl);
        message.push(coloredStatus(res.statusCode));
        message.push(time + 'ms');
        var len = parseInt(res.getHeader('Content-Length'), 10);
        if(!isNaN(len)) {
            message.push('-');
            message.push(humanize.filesize(len));
            fields.size = len;
        }
        if (logReferrer) {
            var referrer = req.headers['referer'] || req.headers['referrer'] || '-';
            message.push('"' + referrer + '"');
            fields.referrer = referrer;
        }
        if (logUserAgent) {
            var userAgent = req.headers['user-agent'] || '-';
            message.push('"' + userAgent + '"');
            fields.userAgent = userAgent;
        }
        logger.info(_.extend({message: message.join(' ')}, fields));
    }
}

function coloredStatus(statusCode) {
    var statusColor = 'greenBright';
    if(statusCode >= 500)
        statusColor = 'redBright';
    else if(statusCode >= 400)
        statusColor = 'yellowBright';
    else if(statusCode >= 300)
        statusColor = 'cyanBright';
    return clc[statusColor](statusCode);
}