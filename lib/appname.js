const path = require('path');

module.exports = findAppName;

function findAppName() {
    const mainFilename = require.main.filename;
    let appName;
    let currentDirName = path.dirname(mainFilename);
    let isSameDir = false;
    while (!appName && !isSameDir) {
        try {
            const packageJson = require(path.join(currentDirName, 'package.json'));
            appName = packageJson.name;
        } catch (e) {
            //do nothing
        }
        const previousDirName = path.resolve(currentDirName, '..');
        isSameDir = currentDirName == previousDirName;
        currentDirName = previousDirName;
    }
    if (!appName) {
        appName = path.basename(mainFilename, '.js');
    }
    return appName;
}
