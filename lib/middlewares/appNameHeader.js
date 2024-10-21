const uniqueProcessName = require('../uniqueProcessName');

module.exports = function appNameHeaderMiddleware(req, res, next) {
    res.set('x-process-name', uniqueProcessName);
    next();
};
