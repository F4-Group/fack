var path = require('path');

module.exports = findAppName;

function findAppName() {
    var mainFilename = require.main.filename;
    var appName;
    var currentDirName = path.dirname(mainFilename);
    var isSameDir = false;
    while (!appName && !isSameDir) {
        try {
            var packageJson = require(path.join(currentDirName, 'package.json'));
            appName = packageJson.name;
        } catch (e) {
            //do nothing
        }
        var previousDirName = path.resolve(currentDirName, '..');
        isSameDir = currentDirName == previousDirName;
        currentDirName = previousDirName;
    }
    if (!appName)
        appName = path.basename(mainFilename, '.js');
    return appName;
}
