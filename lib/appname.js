const rootDir = require('app-root-path').toString();
const path = require('path');

module.exports = findAppName;

function findAppName() {
    let appName;
    try {
        const packageJson = require(path.join(rootDir, 'package.json'));
        appName = packageJson.name;
    } catch (e) {
        //do nothing
    }
    if (!appName) {
        const mainFilename = require.main.filename;
        appName = path.basename(mainFilename, '.js');
    }
    return appName;
}
