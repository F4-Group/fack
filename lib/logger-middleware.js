var logger = require('./bunyule');
var humanize = require('humanize');
var clc = require('cli-color');
var _ = require('underscore');

var nodeEnv = process.env.NODE_ENV || 'development';
var isDev = 'development' == nodeEnv;
var logReferrer = !isDev;
var logUserAgent = !isDev;

module.exports = loggerMiddleware;

function loggerMiddleware(req, res, next) {
    req.logger = logger.child({
        ips: getIps(req),
        referrer: req.headers.referer || req.headers.referrer,
        userAgent: req.headers['user-agent'],
    }, true);
    req._startTime = new Date();

    var ignoreLog = false;

    res.logger = {
        ignore: function () {
            ignoreLog = true;
        },
    };

    res.on('finish', logRequest);
    res.on('close', requestClosed);
    next();

    //if closed without finish, then the user cancelled or a proxy closed the connection
    function requestClosed() {
        res.statusCode = 499; // see https://httpstatuses.com/499
        res.statusMessage = "Client Closed Request";
        res.closed = true;
        logRequest();
    }

    function logRequest() {
        res.removeListener('finish', logRequest);
        res.removeListener('close', requestClosed);

        if (ignoreLog) {
            return;
        }

        var time = (new Date() - req._startTime);

        var logger = req.logger;
        var fields = {
            method: req.method,
            originalUrl: req.originalUrl,
            statusCode: res.statusCode,
            timeInMs: time,
        };
        var message = [];
        if (res.closed) {
            fields.closed = res.closed;
            message.push("Closed");
        }
        message.push(req.method);
        message.push(req.originalUrl);
        message.push(coloredStatus(res.statusCode));
        message.push(time + 'ms');
        var len = parseInt(res.getHeader('Content-Length'), 10);
        if (!isNaN(len)) {
            message.push('-');
            message.push(humanize.filesize(len));
            fields.size = len;
        }
        if (logReferrer) {
            var referrer = req.headers.referer || req.headers.referrer;
            message.push('"' + (referrer || '-') + '"');
            fields.referrer = referrer;
        }
        if (logUserAgent) {
            var userAgent = req.headers['user-agent'];
            message.push('"' + (userAgent || '-') + '"');
            fields.userAgent = userAgent;
        }
        logger.info(_.extend({message: message.join(' ')}, fields));
    }
}

function getIps(req) {
    let ips = req.ips;
    if (!ips || ips.length == 0)
        ips = [req.ip];
    ips = _.without(ips, '127.0.0.1');
    if (ips.length == 0)
        ips = ['127.0.0.1'];
    return ips;
}

function coloredStatus(statusCode) {
    statusCode = statusCode || '-';
    var statusColor;
    if (statusCode >= 500)
        statusColor = 'redBright';
    else if (statusCode >= 400)
        statusColor = 'yellowBright';
    else if (statusCode >= 300)
        statusColor = 'cyanBright';
    if (statusColor)
        return clc[statusColor](statusCode);
    else
        return statusCode;
}
