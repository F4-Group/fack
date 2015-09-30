var logger = require('./bunyule');

module.exports = {
    bind: bind,
};

function bind() {
    process.on('uncaughtException', function (err) {
        if (err instanceof Error || err instanceof Object)
            logger.fatal(err, 'Uncaught exception: %s', err);
        else
            logger.fatal('Uncaught exception: %s', err);
        setTimeout(function () {
            process.exit(1);
        }, 10); // wait some time so that the log is sent
    });
}
