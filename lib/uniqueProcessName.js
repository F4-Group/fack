const appName = require('./appname')();
const hostname = require('./hostname');
const dyno = require('./dyno');

module.exports = `${appName}_${hostname}_${dyno}`;
