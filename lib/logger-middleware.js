var express = require('express');
var logule = require('logule').init(module);
var humanize = require('humanize');
var clc = require('cli-color');

module.exports = loggerMiddleware;

function loggerMiddleware(req, res, next) {
    req.logger = logule.sub(req.ips && req.ips.length > 0 ? req.ips.join(', ') : req.ip);
    req._startTime = new Date;

    res.on('finish', logRequest);
    res.on('close', logRequest);
    next();

    function logRequest() {
        res.removeListener('finish', logRequest);
        res.removeListener('close', logRequest);

        var logger = req.logger;
        var status = res.statusCode;
        var statusColor = 'greenBright';
        if (status >= 500)
            statusColor = 'redBright';
        else if (status >= 400)
            statusColor = 'yellowBright';
        else if (status >= 300)
            statusColor = 'cyanBright';

        var fields = [];
        fields.push(req.method + ' ' + req.originalUrl);
        fields.push(clc[statusColor](res.statusCode));
        fields.push((new Date - req._startTime) + 'ms');
        var len = parseInt(res.getHeader('Content-Length'), 10);
        if (!isNaN(len)) {
            fields.push('-');
            fields.push(humanize.filesize(len));
        }
        var referrer = req.headers['referer'] || req.headers['referrer'] || '';
        fields.push('"' + referrer + '"');
        var userAgent = req.headers['user-agent'] || '';
        fields.push('"' + userAgent + '"');
        logger.info(fields.join(' '));
    }
}
