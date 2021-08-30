const appName = require('./appname')();
const hostname = require('./hostname');
const dyno = require('./dyno');
const _ = require("lodash");

module.exports = _.defaultTo(process.env.APP_INSTANCE_NAME, `${appName}_${hostname}_${dyno}`);
