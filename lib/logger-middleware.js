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
    req.logger = logger.child({ips: (req.ips && req.ips.length > 0 ? req.ips.join(', ') : req.ip)}, true);
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

    //if closed without finish, then the user cancelled
    function requestClosed() {
        res.statusCode = 0;
        res.statusMessage = "Closed";
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
            var referrer = req.headers.referer || req.headers.referrer || '-';
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
