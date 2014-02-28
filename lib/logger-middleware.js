var express = require('express');
var logger = require('./bunyule');
var humanize = require('humanize');
var clc = require('cli-color');

var isProd = 'production' === process.env.NODE_ENV;

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

        var logger = req.logger;
        var fields = [];
        fields.push(req.method);
        fields.push(req.originalUrl);
        fields.push(coloredStatus(res.statusCode));
        fields.push((new Date - req._startTime) + 'ms');
        var len = parseInt(res.getHeader('Content-Length'), 10);
        if(!isNaN(len)) {
            fields.push('-');
            fields.push(humanize.filesize(len));
        }
        if(isProd) {
            var referrer = req.headers['referer'] || req.headers['referrer'] || '-';
            fields.push('"' + referrer + '"');
            var userAgent = req.headers['user-agent'] || '-';
            fields.push('"' + userAgent + '"');
        }
        logger.info(fields.join(' '));
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