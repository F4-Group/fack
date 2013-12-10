var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var domain = require('domain');
var express = require('express');
var _ = require('underscore');
var async = require('async');
var jade = require('jade');
var stylus = require('stylus');
var nib = require('nib');
var browserify = require('browserify');
var watchify = require('watchify');
var jadeify = require('browserify-jade');
var through = require('through');
var glob = require('glob');
var i18n = require('i18next');
var humanize = require('humanize');
var _ = require('underscore');
var uglify = require('uglify-js');
var file = require('file');
var logule = require('logule').init(module);
var cacheforever = require('./cacheforever');
var sdc = require('./sdc');

module.exports = expressWrapper;

var isProd = 'production' === process.env.NODE_ENV;
var useForeverCache = isProd;
var isIE9Debug = false;

if (!isProd)
    browserify = watchify;

var oneYearCache = 1000 * 60 * 60 * 24 * 365;

_.each(_.keys(express), function (key) {
    expressWrapper[key] = express[key];
});

var staticUrlPrefix = '/static';
var foreverUrlPrefix = '/cacheForever';

var bootstrapStylusDir = path.join(__dirname, '..', 'bootstrap-stylus');
var fontAwesomeDir = path.join(__dirname, '..', 'Font-Awesome');

////////////////////////////////////////////////////////////////////////////////
function expressWrapper(options) {
    var rootDir = path.dirname(require.main.filename);
    options = _.defaults(options || {}, {
        views: path.join(rootDir, 'views'),
        public: path.join(rootDir, 'public'),
        js: path.join(rootDir, 'js'),
        bundles: [],
    });
    var pubDir = options.public;
    var viewsDir = options.views;
    var jsDir = options.js;
    var i18nDir = path.join(pubDir, "i18n");
    var i18nResourcePath = filePathToStaticUriPath(pubDir, i18nDir);
    var i18nJsonTemplate = '__ns__.__lng__.json';
    var i18nOptions = {
        resGetPath: staticUrlPrefix + '/' + i18nResourcePath + '/' + i18nJsonTemplate,
    };
    configureI18n();
    var stylusSubDir = "css";
    var stylusDir = path.join(viewsDir, stylusSubDir);
    var bundles = options.bundles.concat(getJsEntries());
    var staticDirs = [];
    var app = express();
    app.configure(function () {
        app.enable('trust proxy');
        app.set('view engine', 'jade');
        app.set('views', viewsDir);
        app.use(getLogger());
        app.use(i18nMiddleware);
    });
    app.configure('development', function () {
        app.use(nocache);
    });
    var cacheforeverMiddleware = cacheforever({
        staticPath: staticUrlPrefix,
        foreverPath: foreverUrlPrefix,
    });
    var browserifyBundlesMiddleware = createBrowserifyBundlesMiddleware();
    app.configure(function () {
        app.locals.resourceUrl = _.bind(cacheforeverMiddleware.resourceUrl, cacheforeverMiddleware);
        app.locals.i18n = i18n;
        app.locals.t = i18n.t;
        app.use(sdc.helpers.getExpressMiddleware('http', { timeByUrl: true }));
        app.use(express.bodyParser());
        app.use(cacheforeverMiddleware.middleware());
        app.use(staticUrlPrefix, browserifyBundlesMiddleware);
        app.use(staticUrlPrefix, stylus.middleware({
            src: viewsDir,
            dest: pubDir,
            compile: compileStylus
        }));
        registerStaticDir(pubDir);
        registerStaticDir(fontAwesomeDir);
    });
    app.cacheforever = cacheforeverMiddleware;
    app.static = registerStaticDir;
    app.start = start;
    return app;

////////////////////////////////////////////////////////////////////////////////
    function start() {
        app.use(app.router);
        async.series([
            readStaticFiles,
            readI18nFiles,
            compileStylusFiles,
            registerBrowserifyBundles,
        ], listen);

        function listen(err) {
            if (err) {
                logule.error(err);
            } else {
                var argv = require('./optimist').argv;
                var port = argv.port;
                app.listen(port, function () {
                    logule.info("Listening on localhost:%d", port);
                });
            }
        }
    }

////////////////////////////////////////////////////////////////////////////////
    function getJsEntries() {
        var jsEntryDir = path.join(jsDir, 'entry');
        try {
            var entries = fs.readdirSync(jsEntryDir);
        } catch (e) {
            logule.debug('Could not read JS entries from %s', jsEntryDir, e);
        }
        return _.map(_.filter(entries || [], function (entry) {
            return /\.js$/.test(entry)
        }), function (entry) {
            return path.join(jsEntryDir, entry);
        });
    }

////////////////////////////////////////////////////////////////////////////////
    function registerStaticDir(staticDir) {
        staticDirs.push(staticDir);
        addStaticMiddlewares(staticDir);
    }

////////////////////////////////////////////////////////////////////////////////
    function addStaticMiddlewares(staticDir) {
        app.use(staticUrlPrefix, express.static(staticDir, {maxAge: 0}));
        //https://developers.google.com/speed/docs/best-practices/caching
        app.use(foreverUrlPrefix, express.static(staticDir, {maxAge: oneYearCache}));
    }

    ////////////////////////////////////////////////////////////////////////////////
    function getLogger() {
        var logStream = {
            write: function (log) {
                logule.info(log.replace(/\n*$/, ''));
            }
        };

        var logFormat = isProd
            ? ':ip - ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
            : 'dev';

        express.logger.token('ip', function (req) {
            if (req.ips && req.ips.length > 0)
                return req.ips.join(', ');
            else
                return req.ip;
        });
        return express.logger({ format: logFormat, stream: logStream });
    }

////////////////////////////////////////////////////////////////////////////////
    function nocache(req, res, next) {
        res.set('Pragma', 'no-cache');
        res.set('Expires', '-1');
        res.set('Cache-Control', 'no-cache');
        next();
    }

////////////////////////////////////////////////////////////////////////////////
    function registerBrowserifyBundles(cb) {
        async.eachSeries(bundles, function (options, cb) {
            serveBundle(options, cb);
        }, cb);
    }

////////////////////////////////////////////////////////////////////////////////
    function createBrowserifyBundlesMiddleware() {
        var bundleHandlers = {};
        middleware.register = registerBundle;
        return middleware;

        function middleware(req, res, next) {
            if (!isProd) {
                var bundleHandler = bundleHandlers[req.url];
                if (bundleHandler)
                    bundleHandler(req, res);
                else
                    next();
            } else {
                next();
            }
        }

        function registerBundle(url, handler) {
            bundleHandlers[url] = handler;
        }
    }

////////////////////////////////////////////////////////////////////////////////
    function serveBundle(options, cb) {
        if (_.isString(options))
            options = {path: options};
        options = _.defaults(options, {
            jadeify: true,
            jquery: true,
            socketio: true,
            bootstrap: true,
            stringify: ['html', 'txt', 'vshader', 'fshader', 'shaderlib'],
            transforms: [],
            requires: {},
            minify: isProd,
            watch: !isProd,
            debug: !isProd && !isIE9Debug,
            fixTrailingComma: isProd || isIE9Debug,
        });
        var transforms = options.transforms;
        if (options.fixTrailingComma)
            transforms.push(fixTrailingComma);
        if (options.jadeify)
            transforms.push(jadeify);
        transforms.push(stringify(options.stringify));
        var requires = options.requires;
        if (options.jquery)
            requires['jquery-browserify'] = {expose: 'jquery'};
        if (options.socketio)
            requires['socket.io-client'] = {expose: 'socket.io'};
        if (options.bootstrap) {
            var bootserverStylusJsDir = path.join(bootstrapStylusDir, 'js');
            var jsFiles = fs.readdirSync(bootserverStylusJsDir);
            _.each(jsFiles, function (jsFile) {
                if (/\.js$/.test(jsFiles)) {
                    requires[path.join(bootserverStylusJsDir, jsFile)] = {expose: jsFile.replace(/\.js$/, '')};
                }
            });
        }

        var name = path.basename(options.path);
        var contentType = 'text/javascript';
        var bundle = getBundle();
        if (!options.watch) {
            build(function (err, src) {
                if (err) {
                    logule.error('Building %s', name, err);
                } else {
                    cacheforeverMiddleware.register({
                        path: name,
                        content: src,
                        contentType: contentType,
                    });
                }
                cb(err);
            });
        } else {
            var cache;
            var cacheDate;
            var building = false;
            bundle.on('update', updateCache);
            browserifyBundlesMiddleware.register('/' + name, function (req, res) {
                if (null != cache) {
                    sendCache(res);
                } else {
                    if (!building)
                        updateCache();
                    bundle.once('rebuilt', function () {
                        sendCache(res);
                    });
                }
            });
            cb(null);
        }

        function sendCache(res) {
            res.set('Last-Modified', cacheDate.toISOString());
            res.set('Content-Type', contentType);
            res.send(200, cache);
        }

        function getBundle() {
            var bundle = browserify({
                entries: [options.path],
                noParse: ['jquery-browserify'],
            });
            _.each(requires, function (opts, file) {
                bundle.require(file, opts);
            });
            _.each(transforms, function (transform) {
                bundle.transform(transform);
            });
            return bundle;
        }

        function build(cb) {
            building = true;
            var startDate = Date.now();
            logule.info("Building %s...", name);
            bundle.bundle({
                debug: options.debug,
                insertGlobalVars: {
                    cacheforever: function () {
                        return cacheforeverMiddleware.getBrowserifyModule();
                    },
                    fack: function () {
                        return JSON.stringify({
                            i18next: {
                                options: i18nOptions || {},
                            },
                        }) + ';';
                    },
                }
            }, function (err, src) {
                if (err) {
                    logule.error('Building %s', name, err);
                } else {
                    if (options.minify)
                        src = compressJs(src);
                    var durationInMs = Date.now() - startDate;
                    logule.info('Built %s in %ds (%s)', name, durationInMs / 1000, humanize.filesize(src.length));
                    building = false;
                }
                cb(err, src);
            });
        }

        function updateCache() {
            cache = cacheDate = null;
            build(function (err, src) {
                if (err) {
                    cache = 'document.body.style.backgroundColor = "white";' +
                        'document.body.style.color = "red";' +
                        'document.body.style.fontSize = "16pt";' +
                        'document.body.innerHTML = ' + JSON.stringify(err.toString());
                } else {
                    cache = src;
                }
                cacheDate = new Date();
                bundle.emit('rebuilt');
            });
        }
    }

////////////////////////////////////////////////////////////////////////////////
    function readStaticFiles(cb) {
        if (useForeverCache) {
            logule.info("Computing static files fingerprints...");
            getStylusGeneratedResourcePaths(function (err, excludedPaths) {
                var fileCount = 0;
                _.each(staticDirs, function (staticDir) {
                    if (fs.existsSync(staticDir))
                        file.walkSync(staticDir, staticWalker);
                });
                logule.info("Computed %d static files fingerprints", fileCount);
                cb(null);

                function staticWalker(dirPath, dirs, files) {
                    _.each(files, function (file) {
                        var filePath = path.join(dirPath, file);
                        var resourcePath = filePathToStaticUriPath(dirPath, filePath);
                        if (excludedPaths.indexOf(resourcePath) == -1) {
                            cacheforeverMiddleware.register({
                                filePath: filePath,
                                path: resourcePath,
                            });
                            ++fileCount;
                        }
                    });
                }
            });
        } else {
            cb(null);
        }

        function getStylusGeneratedResourcePaths(cb) {
            glob(path.join(stylusDir, "*.styl"), function (err, stylusFiles) {
                var cssPaths = _.map(stylusFiles, function (stylusFile) {
                    return stylusSubDir + '/' + path.relative(stylusDir, stylusFile).replace(/\.styl$/, '.css');
                });
                cb(err, cssPaths);
            });
        }
    }

////////////////////////////////////////////////////////////////////////////////
    function compileStylusFiles(callback) {
        if (useForeverCache) {
            glob(path.join(stylusDir, "*.styl"), function (err, files) {
                if (err) {
                    logule.error("compileStylusFiles", err);
                    callback(err);
                } else {
                    async.eachSeries(files, function (file, cb) {
                        logule.info("Compiling %s", file);
                        var cssContent = fs.readFileSync(file, {encoding: "utf8"});
                        compileStylus(cssContent, file).render(function (err, css) {
                            if (err) {
                                logule.error("compileStylusFiles failed for", file, err);
                            } else {
                                var cssFileName = filePathToStaticUriPath(viewsDir, file).replace(/\.styl$/, ".css");
                                cacheforeverMiddleware.register({
                                    path: cssFileName,
                                    content: css,
                                    contentType: "text/css",
                                });
                            }
                            cb(err);
                        });
                    }, callback);
                }
            });
        } else {
            callback();
        }
    }

////////////////////////////////////////////////////////////////////////////////
    function configureI18n() {
        i18n.functions.log = _.bind(logule.debug, logule);
        i18n.init({
            resGetPath: path.join(i18nDir, i18nJsonTemplate),
            fallbackLng: 'fr',
            ns: 'translation',
        });
    }

////////////////////////////////////////////////////////////////////////////////
    function clearI18nCache() {
        i18n.sync.resStore = {};
        i18n.resStore = {};
    }

////////////////////////////////////////////////////////////////////////////////
    function i18nMiddleware(req, res, next) {
        _.extend(req, {
            t: i18n.t,
            i18n: i18n,
        });
        if (!isProd)
            clearI18nCache();
        next();
    }

////////////////////////////////////////////////////////////////////////////////
    function readI18nFiles(callback) {
        if (useForeverCache) {
            logule.info("Computing i18n files fingerprints...");
            glob(path.join(i18nDir, "*.json"), function (err, files) {
                if (err) {
                    logule.error("readI18nFiles", err);
                    callback(err);
                } else {
                    var concatenatedContent = '';
                    var contents = {};
                    async.eachSeries(files, function (file, cb) {
                        var content = fs.readFileSync(file, {encoding: "utf8"});
                        concatenatedContent += content;
                        contents[file] = content;
                        cb(null);
                    }, function (err) {
                        if (err) {
                            callback(err);
                        } else {
                            var shasum = crypto.createHash('sha1');
                            var translationFilesHash = shasum.update(concatenatedContent).digest("hex");
                            _.each(files, function (file) {
                                var staticPath = filePathToStaticUriPath(pubDir, file);
                                cacheforeverMiddleware.register({
                                    path: staticPath,
                                    content: contents[file],
                                    contentType: "application/json",
                                    fingerprint: translationFilesHash,
                                });
                            });
                            i18nOptions = {
                                resGetPath: foreverUrlPrefix + '/' + translationFilesHash + '/' + i18nResourcePath + '/' + i18nJsonTemplate,
                            };
                            logule.info("Computed %d i18n files fingerprints", files.length);
                            callback();
                        }
                    });
                }
            });
        } else {
            callback();
        }
    }

////////////////////////////////////////////////////////////////////////////////
    function stringify(extensions) {
        var re = new RegExp('\\.(' + extensions.join('|') + ')$');
        return function (fileName) {
            if (!re.test(fileName))
                return through();
            var body = '';

            return through(
                function (chunk) {
                    body += chunk
                        .replace(/\r/g, '\\r')
                        .replace(/"/g, '\\"')
                        .replace(/\n/g, '\\n"\n+"');
                },
                function () {
                    this.queue('module.exports = \n"' + body + '";\n');
                    this.queue(null);
                }
            );
        };
    }

////////////////////////////////////////////////////////////////////////////////
    function fixTrailingComma(fileName) {
        var js = '';
        return through(
            function (chunk) {
                js += chunk;
            },
            function () {
                //this fixes ie < 8 parsing problems. can also happen in ie >=8 in compatibility mode
                //this does not work in debug mode, because \r\n appears as characters...
                // on a ce genre de regexp: /^data:(image\/[a-z]+;[^,]+),(.*)$/  qui pète la recherche de virgule dans les tableaux
                /*.replace(/,(\s*\])/g, "$1")*/
                this.queue(js.replace(/,(\s*)}/g, "$1}"));
                this.queue(null);
            }
        );
    }

////////////////////////////////////////////////////////////////////////////////
    function compressJs(js) {
        try {
            js = uglify(js, {
                squeeze_options: {
                    make_seqs: false // see https://github.com/mishoo/UglifyJS/issues/362
                }
            });
        }
        catch (e) {
            logule.error('Uglifying: %s at line %d, column %d', e.message, e.line, e.col);
            if (e.line) {
                logule.error('%s ', js.split('\n')[e.line - 1]);
                if (e.col)
                    logule.error('%s^', Array(e.col).join(' '));
            }
        }
        return js;
    }

////////////////////////////////////////////////////////////////////////////////
    function compileStylus(str, filename) {
        return stylus(str)
            .set('filename', filename)
            .set('compress', isProd)
            .set('include css', true)
            .set('firebug', !isProd && !isIE9Debug)
            .set('linenos', !isProd && !isIE9Debug)
            .set('paths', [
                viewsDir,
                path.join(bootstrapStylusDir, 'stylus'),
                path.join(fontAwesomeDir, 'css'),
            ])
            .define('imageUrl', function (src) {
                var cleanSrc = cleanSrcStr(src);
                return resourceUrlNode('images/' + cleanSrc);
            })
            .define('resourceUrl', function (src) {
                var cleanSrc = cleanSrcStr(src);
                return resourceUrlNode(cleanSrc);
            })
            .use(nib());

        function cleanSrcStr(src) {
            return src.string.replace(/['"]/g, "");
        }

        function resourceUrlNode(resourcePath) {
            var url = cacheforeverMiddleware.resourceUrl(resourcePath);
            return new stylus.nodes.Return('url("' + url + '")');
        }
    }

////////////////////////////////////////////////////////////////////////////////
    function filePathToStaticUriPath(baseDir, filePath) {
        return path.relative(baseDir, filePath).replace(/\\/g, "/");
    }

////////////////////////////////////////////////////////////////////////////////
}