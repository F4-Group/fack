var logger = require('./bunyule');

module.exports = {
    bind: bind,
};

function bind() {
    var caughtOne = false;
    process.on('uncaughtException', function (err) {
        if (caughtOne)
            return;
        caughtOne = true;
        if (err instanceof Error || err instanceof Object)
            logger.fatal(err, 'Uncaught exception: %s', err);
        else
            logger.fatal('Uncaught exception: %s', err);
        logger.closeAndFlush(function () {
            process.exit(1);
        });
        //exit anyway after one second
        setTimeout(function () {
            process.exit(2);
        }, 1000);
    });
}
