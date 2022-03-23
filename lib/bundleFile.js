const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const humanize = require('humanize');

const logger = require('./bunyule');

module.exports = {
    save,
    load,
    canLoad,
};

function save(cacheDirectory, name, content) {
    const filePath = path.join(cacheDirectory, name);
    mkdirp.sync(path.dirname(filePath));
    fs.writeFileSync(filePath, content);
    logger.info('Saved %s', filePath);
}

function canLoad(fileName, options) {
    const {bundlesCache, preferCachedBundles} = options;
    return preferCachedBundles && fs.existsSync(path.join(bundlesCache, fileName));
}

function load(fileName, options) {
    const {bundlesCache} = options;
    const filePath = path.join(bundlesCache, fileName);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, {encoding: 'utf8'});
        const size = Buffer.byteLength(content);
        logger.info({size}, 'Read %s (%s)', fileName, humanize.filesize(size));
        return content;
    }
}
