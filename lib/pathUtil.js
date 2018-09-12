module.exports = {
    getPathWithoutPrefix: getPathWithoutPrefix,
};

function getPathWithoutPrefix(req, prefix) {
    let urlPath = req.url.split('?')[0];
    try {
        urlPath = decodeURIComponent(urlPath);
    } catch (err) {
        // keep the encoded path
    }
    return urlPath.substr(prefix.length);
}
