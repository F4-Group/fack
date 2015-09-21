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
        process.nextTick(function () {
            process.exit(1);
        });
    });
}
