const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');

const logger = require('./bunyule');

module.exports = {
    save,
};

function save(cacheDirectory, name, content) {
    const filePath = path.join(cacheDirectory, name);
    mkdirp.sync(path.dirname(filePath));
    fs.writeFileSync(filePath, content);
    logger.info('Saved %s', filePath);
}
