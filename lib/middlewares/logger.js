const logger = require('../bunyule');
const humanize = require('humanize');
const clc = require('cli-color');
const _ = require('lodash');

const nodeEnv = process.env.NODE_ENV || 'development';
const isDev = 'development' == nodeEnv;
const logReferrer = !isDev;
const logUserAgent = !isDev;

module.exports = loggerMiddleware;

function loggerMiddleware(req, res, next) {
    let ignoreLog = false;
    const requestLogger = _.extend(logger.child({
        ips: getIps(req),
        referrer: req.headers.referer || req.headers.referrer,
        userAgent: req.headers['user-agent'],
    }, true), {
        ignore: function () {
            ignoreLog = true;
        },
    });
    _.extend(req, {
        logger: requestLogger,
        _startTime: new Date(),
    });
    _.extend(res, {
        logger: requestLogger,
    });

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

        const time = (new Date() - req._startTime);

        const logger = req.logger;
        const fields = {
            method: req.method,
            originalUrl: req.originalUrl,
            statusCode: res.statusCode,
            timeInMs: time,
        };
        const message = [];
        if (res.closed) {
            fields.closed = res.closed;
            message.push("Closed");
        }
        message.push(req.method);
        message.push(req.originalUrl);
        message.push(coloredStatus(res.statusCode));
        message.push(time + 'ms');
        const len = parseInt(res.getHeader('Content-Length'), 10);
        if (!isNaN(len)) {
            message.push('-');
            message.push(humanize.filesize(len));
            fields.size = len;
        }
        if (logReferrer) {
            const referrer = req.headers.referer || req.headers.referrer;
            message.push('"' + (referrer || '-') + '"');
            fields.referrer = referrer;
        }
        if (logUserAgent) {
            const userAgent = req.headers['user-agent'];
            message.push('"' + (userAgent || '-') + '"');
            fields.userAgent = userAgent;
        }
        logger.info(_.extend({message: message.join(' ')}, fields));
    }
}

function getIps(req) {
    let ips = req.ips;
    if (!ips || ips.length == 0) {
        ips = [req.ip];
    }
    ips = _.without(ips, '127.0.0.1');
    if (ips.length == 0) {
        ips = ['127.0.0.1'];
    }
    return ips;
}

function coloredStatus(statusCode) {
    statusCode = statusCode || '-';
    let statusColor;
    if (statusCode >= 500) {
        statusColor = 'redBright';
    } else if (statusCode >= 400) {
        statusColor = 'yellowBright';
    } else if (statusCode >= 300) {
        statusColor = 'cyanBright';
    }
    if (statusColor) {
        return clc[statusColor](statusCode);
    } else {
        return statusCode;
    }
}
