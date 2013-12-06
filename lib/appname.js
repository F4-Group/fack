var path = require('path');

module.exports = findAppName;

function findAppName() {
    var mainFilename = require.main.filename;
    var packageJson = require(path.join(path.dirname(mainFilename), 'package.json'));
    var appName = packageJson.name;
    if (!appName)
        appName = path.basename(mainFilename, '.js');
    return appName;
}
