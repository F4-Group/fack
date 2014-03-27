var path = require('path');

module.exports = findAppName;

function findAppName() {
    var mainFilename = require.main.filename;
    var appName;
    try {
        var packageJson = require(path.join(path.dirname(mainFilename), 'package.json'));
        appName = packageJson.name;
    } catch (e) {
        //do nothing
    }
    if (!appName)
        appName = path.basename(mainFilename, '.js');
    return appName;
}
