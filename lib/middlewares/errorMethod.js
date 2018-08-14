module.exports = function errorMethodMiddleware(logger) {
    return function (req, res, next) {
        res.error = function (err) {
            logger.error(err);
            var sent = err;
            if (err.message)
                sent = err.message;
            res.status(500).send(sent);
        };
        next();
    };
};
