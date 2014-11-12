var appName = require('./appname')();

module.exports = {
    set: set,
};

function set(suffix) {
    process.title = appName + (suffix ? ' - ' + suffix : '');
}
