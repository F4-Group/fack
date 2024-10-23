const appNameWithWorker = require('./appNameWithWorker');

module.exports = {
    set: set,
};

function set(suffix) {
    process.title = appNameWithWorker + (suffix ? ` - ${suffix}` : '');
}
