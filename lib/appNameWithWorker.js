const appName = require('./appname')();

module.exports = appName + (process.env.WORKER_NAME ? `-worker:${process.env.WORKER_NAME}` : '');
