var optimist = require('./optimist'); // let it init logger asap
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var express = require('express');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
var _ = require('underscore');
var async = require('async');
var stylus = require('stylus');
var nib = require('nib');
var browserify = require('browserify');
var watchify = require('watchify');
var jadeify = require('browserify-jade');
var through = require('through');
var glob = require('glob');
var i18n = require('i18next');
var humanize = require('humanize');
var UglifyJS = require('uglify-js');
var file = require('file');
var aliasify = require('aliasify');
var logger = require('./bunyule');
var cacheForever = require('./cacheforever');
var globalpassword = require('./globalpassword');
var sdc = require('./sdc');
var loggerMiddleware = require('./logger-middleware');
var f4ExpressMiddlewares = require('f4-express-middlewares');
var DataURI = require('datauri');
var constants = require('./constants');
var processTitle = require('./process-title');

module.exports = expressWrapper;

var nodeEnv = process.env.NODE_ENV || 'development';
var isDev = 'development' == nodeEnv;
var isProd = 'production' === nodeEnv;
var isIE9Debug = false;
var useForeverCache = isProd;
var minify = isProd;
var watch = isDev;
var jsDebug = isDev;
var cssDebug = isDev && !isIE9Debug;
var cssCompress = isProd;
var noCache = isDev;
var buildBundleOnFirstRequest = isDev;

if (watch) {
    browserify = (function (br) {
        return function () {
            return watchify(br.apply(this, arguments));
        };
    })(browserify);
}

var oneYearCache = 1000 * 60 * 60 * 24 * 365;

_.each(_.keys(express), function (key) {
    expressWrapper[key] = express[key];
});

var staticUrlPrefix = constants.staticUrlPrefix;
var foreverUrlPrefix = constants.foreverUrlPrefix;

var bootstrapStylusDir = path.join(__dirname, '..', 'bootstrap-stylus');
var fontAwesomeDir = path.join(__dirname, '..', 'Font-Awesome');

var requireAliases = getRequireAliases();

var stylusSubDir = constants.stylusSubDir;

////////////////////////////////////////////////////////////////////////////////
function expressWrapper(options) { // jshint ignore:line
    optimist.end();
    var app = express();
    var rootDir = path.dirname(require.main.filename);
    options = _.defaults(options || {}, {
        views: path.join(rootDir, 'views'),
        public: path.join(rootDir, 'public'),
        js: path.join(rootDir, 'js'),
        preconfigure: null,
        bundles: [],
        cookie: false,
        cookieSecret: 'secret',
        session: false,
        sessionSecret: 'secret',
        globalpasswords: [],
        //true middleware means use default, false middleware means disable, can also set a custom middleware
        cookieMiddleware: false,
        sessionMiddleware: false,
        globalpasswordMiddleware: false,
        jsonMiddleware: true,
        urlencodedMiddleware: true,
        multipartMiddleware: false,
        crossdomainMiddleware: false,
        errormethodMiddleware: false,
        etagifyMiddleware: false,
        insertGlobalVars: {},
        requireAliases: {},
        noParse: [],
        bundlesConfiguration: null,
        delayBuildSelector: null,
        cacheForeverOptions: null,
        healthCheckUrl: '/__healthcheck',
    });
    if (options.i18n === false) {
        options.i18n = {enabled: false};
    }
    options.i18n = _.defaults(options.i18n || {}, {
        enabled: true,
        supportedLanguages: [],//if not empty, restrict available languages
        fallbackLanguage: 'fr',
        useHeaders: true,
        useCookie: false,
    });
    var insertGlobalVars = options.insertGlobalVars;
    var pubDir = options.public;
    var viewsDir = options.views;
    var jsDir = options.js;
    var i18nDir = path.join(pubDir, "i18n");
    var i18nResourcePath = filePathToStaticUriPath(pubDir, i18nDir);
    var i18nJsonTemplate = '__ns__.__lng__.json';
    var i18nOptions = {
        resGetPath: staticUrlPrefix + '/' + i18nResourcePath + '/' + i18nJsonTemplate,
    };
    if (options.i18n.enabled) {
        configureI18n();
    }
    var staticDirs = [];
    if (options.preconfigure && _.isFunction(options.preconfigure))
        options.preconfigure();
    app.enable('trust proxy');
    app.set('view engine', 'jade');
    app.set('views', viewsDir);
    app.set("jsEntries", [path.join(jsDir, 'entry')]);
    app.set("stylusFolders", [path.join(viewsDir, stylusSubDir)]);
    if (options.healthCheckUrl) {
        app.use(options.healthCheckUrl, function (req, res) {
            res.set('Pragma', 'no-cache');
            res.set('Expires', '-1');
            res.set('Cache-Control', 'no-cache');
            res.set('Content-Type', 'application/json');
            res.status(200).send('{"status":"OK"}');
        });
    }
    app.use(loggerMiddleware);
    app.crossDomain = f4ExpressMiddlewares.crossDomain;
    if (noCache) {
        app.use(nocache);
        if (options.i18n.enabled) {
            app.use(clearI18nCache);
        }
    }
    var cacheforeverMiddleware = cacheForever(_.extend({
        staticPath: staticUrlPrefix,
        foreverPath: foreverUrlPrefix,
    }, options.cacheForeverOptions || {}));
    var browserifyBundlesMiddleware = createBrowserifyBundlesMiddleware();
    if (options.globalpasswords && options.globalpasswords.length && !options.globalpasswordMiddleware)
        options.globalpasswordMiddleware = true;
    if (options.globalpasswordMiddleware === true && options.globalpasswords && options.globalpasswords.length) {
        options.globalpasswordMiddleware = globalpassword({
            passwords: options.globalpasswords,
        });
        options.sessionMiddleware = options.sessionMiddleware || true;
    } else
        options.globalpasswordMiddleware = false;

    if (options.session && !options.sessionMiddleware)
        options.sessionMiddleware = true;
    if (options.sessionMiddleware === true) {
        options.sessionMiddleware = session({secret: options.sessionSecret});
        options.cookieMiddleware = options.cookieMiddleware || true;
    }

    if (options.cookie && !options.cookieMiddleware)
        options.cookieMiddleware = true;
    if (options.cookieMiddleware === true)
        options.cookieMiddleware = cookieParser(options.cookieSecret || null);

    if (options.jsonMiddleware === true)
        options.jsonMiddleware = bodyParser.json();
    if (options.urlencodedMiddleware === true)
        options.urlencodedMiddleware = bodyParser.urlencoded();
    if (options.multipartMiddleware === true)
        options.multipartMiddleware = require('connect-multiparty')();

    if (options.crossdomainMiddleware === true)
        options.crossdomainMiddleware = f4ExpressMiddlewares.crossDomain.middleware;
    if (options.errormethodMiddleware === true)
        options.errormethodMiddleware = f4ExpressMiddlewares.errorMethod.middleware(logger);
    if (options.etagifyMiddleware === true)
        options.etagifyMiddleware = f4ExpressMiddlewares.etagify;

    if (options.i18n.enabled) {
        app.use(i18n.handle);
    }
    _.extend(app.locals, {
        resourceUrl: _.bind(cacheforeverMiddleware.resourceUrl, cacheforeverMiddleware),
        jsUrl: jsUrl,
        cssUrl: cssUrl,
    });

    app.use(sdc.helpers.getExpressMiddleware('http', {timeByUrl: true}));
    if (options.jsonMiddleware)
        app.use(options.jsonMiddleware);
    if (options.urlencodedMiddleware)
        app.use(options.urlencodedMiddleware);
    if (options.multipartMiddleware)
        app.use(options.multipartMiddleware);
    if (options.cookieMiddleware)
        app.use(options.cookieMiddleware);
    if (options.sessionMiddleware)
        app.use(options.sessionMiddleware);
    if (options.globalpasswordMiddleware)
        app.use(options.globalpasswordMiddleware);
    if (options.crossdomainMiddleware)
        app.use(options.crossdomainMiddleware);
    if (options.errormethodMiddleware)
        app.use(options.errormethodMiddleware);
    if (options.etagifyMiddleware)
        app.use(options.etagifyMiddleware);
    app.use(cacheforeverMiddleware.middleware());
    if (options.i18n.enabled) {
        i18n.registerAppHelper(app);
    }

    if (options.configureCallbacks) {
        if (_.isArray(options.configureCallbacks)) {
            _.each(options.configureCallbacks, function (cb) {
                cb(app);
            });
        } else {
            options.configureCallbacks(app);
        }
    }

    var stylusMiddlewares = [];
    _.each(app.get("stylusFolders"), function (src) {
        stylusMiddlewares.push(stylus.middleware({
            src: src,
            dest: path.join(pubDir, "/css"),
            compile: compileStylus,
        }));
    });
    if (stylusMiddlewares.length > 0)
        app.use(staticUrlPrefix + "/css", stylusMiddlewares);

    //register static middleware at the end, so that stylus file are indeed served
    app.use(staticUrlPrefix, browserifyBundlesMiddleware);
    registerStaticDir(pubDir);
    registerStaticDir(path.join(fontAwesomeDir, 'static'));

    app.cacheforever = cacheforeverMiddleware;
    app.static = registerStaticDir;
    app.start = start;
    app.packageJavascript = createBundle;
    return app;

////////////////////////////////////////////////////////////////////////////////
    function start(cb) {
        async.series([
            readStaticFiles,
            readI18nFiles,
            compileStylusFiles,
            registerBrowserifyBundles,
        ], listen);

        function listen(err) {
            if (err) {
                logger.error(err, 'listen');
            } else {
                var argv = optimist.argv;
                var port = argv.port;
                var server = app.listen(port, function () {
                    processTitle.set('listening');
                    var address = server.address();
                    logger.info("Listening on %s:%d", address.address, address.port);
                });
                if (cb)
                    cb(server);
            }
        }
    }

////////////////////////////////////////////////////////////////////////////////
    function useNativePathSep(p) {
        return p.replace(/\//g, path.sep);
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
    //noinspection JSUnusedLocalSymbols
    function nocache(req, res, next) {
        //IE doesn't like Pragma cache on css resource fonts
        //see http://stackoverflow.com/questions/25857942/ie-11-fails-to-load-resource-files
        //see http://stackoverflow.com/questions/13415073/on-ie-css-font-face-works-only-when-navigating-through-inner-links
        if (!((/[^?]+\.(eot|woff)(\?.*)?$/).test(req.url))) {
            res.set('Pragma', 'no-cache');
        }
        res.set('Expires', '-1');
        res.set('Cache-Control', 'no-cache');
        next();
    }

////////////////////////////////////////////////////////////////////////////////
    function registerBrowserifyBundles(cb) {
        var defaultEntryDir = app.get("jsEntries")[0];
        var bundles = _.map(options.bundles,
            function (bundlePath) {
                return {
                    name: path.relative(defaultEntryDir, bundlePath).replace(/\\/g, '/'),
                    path: bundlePath,
                };
            });

        _.each(app.get("jsEntries"), function (jsEntryDir) {
            var jsEntriesPattern = path.join(jsEntryDir, '**', '*.js');
            var entries = glob.sync(jsEntriesPattern);
            bundles = bundles.concat(_.map(
                _.map(entries, useNativePathSep), // browserify fails with / on Windows
                function (bundlePath) {
                    return {
                        name: path.relative(jsEntryDir, bundlePath).replace(/\\/g, '/'),
                        path: bundlePath,
                    };
                }));
        });

        async.eachSeries(bundles, function (bundleConfiguration, cb) {
            var bundlePath = bundleConfiguration.path;
            if (options.bundlesConfiguration) {
                _.extend(bundleConfiguration, options.bundlesConfiguration);
            }
            var delayBuildSelector = options.delayBuildSelector;
            if (delayBuildSelector) {
                if (_.isString(delayBuildSelector))
                    bundleConfiguration.delayBuild = bundlePath.indexOf(delayBuildSelector) >= 0;
                else if (delayBuildSelector instanceof RegExp)
                    bundleConfiguration.delayBuild = delayBuildSelector.test(bundlePath);
                else if (_.isFunction(delayBuildSelector))
                    bundleConfiguration.delayBuild = Boolean(delayBuildSelector(bundlePath));
            }
            createBundle(bundleConfiguration, cb);
        }, cb);
    }

////////////////////////////////////////////////////////////////////////////////
    function createBrowserifyBundlesMiddleware() {
        var bundleHandlers = {};
        middleware.register = registerBundle;
        return middleware;

        function middleware(req, res, next) {
            if (buildBundleOnFirstRequest) {
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
    function createBundle(bundleConfiguration, cb) {
        if (_.isString(bundleConfiguration))
            bundleConfiguration = {path: bundleConfiguration};
        bundleConfiguration = _.defaults(bundleConfiguration, {
            name: null,
            jadeify: true,
            stringify: ['html', 'txt', 'vshader', 'fshader', 'shaderlib'],
            dataurify: ['jpg', 'png', 'gif'],
            transforms: [],
            requires: {},
            minify: minify,
            watch: watch,
            debug: jsDebug,
            serve: true,
            requireAliases: [],
        });
        var transforms = bundleConfiguration.transforms;
        if (bundleConfiguration.jadeify)
            transforms.push(jadeify.jade({pretty: false}));
        transforms.push(stringify(bundleConfiguration.stringify));
        transforms.push(dataurify(bundleConfiguration.dataurify));
        var requires = bundleConfiguration.requires;

        var name = bundleConfiguration.name;
        if (!name) {
            name = path.relative(app.get("jsEntries")[0], bundleConfiguration.path)
                .replace(/\\/g, '/');
        }

        var contentType = 'text/javascript';
        var bundle = getBundle(bundleConfiguration);
        if (!bundleConfiguration.serve) {
            build(bundle, cb);
        } else if (!bundleConfiguration.watch && !bundleConfiguration.delayBuild) {
            build(bundle, function (err, src) {
                if (err) {
                    logger.error(err, 'Building %s', name);
                } else {
                    cacheforeverMiddleware.register({
                        path: name,
                        content: src,
                        contentType: contentType,
                    });
                }
                cb(err, src);
            });
        } else if (!bundleConfiguration.watch) {
            logger.info('Delay build of %s', name);
            buildBundleOnFirstRequest = true; //override isDev value
            browserifyBundlesMiddleware.register('/' + name, function (req, res) {
                sendCache(bundle, res);
            });
            cb(null);
        } else {
            var oldIeOptions = _.extend({
                debug: false,
            }, bundleConfiguration);
            var oldIeBundle = getBundle(oldIeOptions);
            bundle.on('update', _.partial(updateCache, bundle));
            browserifyBundlesMiddleware.register('/' + name, function (req, res) {
                if (isIE9OrLower(req))
                    sendCache(oldIeBundle, res);
                else
                    sendCache(bundle, res);
            });
            cb(null);
        }

        function getBundle(getBundleOptions) {
            var noParse = _.uniq(['jquery'].concat(options.noParse || []));
            var bundle = browserify({
                entries: [getBundleOptions.path],
                noParse: noParse,
                insertGlobalVars: _.extend({
                    cacheforever: function () {
                        return cacheforeverMiddleware.getBrowserifyModule();
                    },
                    fack: function () {
                        return JSON.stringify({
                            i18next: {
                                options: i18nOptions || {},
                            },
                        });
                    },
                    global: function () {
                        return 'window';
                    },
                }, insertGlobalVars),
            });
            _.each(requires, function (opts, file) {
                bundle.require(file, opts);
            });
            bundle.transform({global: true, aliases: requireAliases}, aliasify);
            _.each(transforms, function (transform) {
                bundle.transform({global: true}, transform);
            });
            bundle.building = false;
            return bundle;
        }

        function sendCache(bundle, res) {
            if (null != bundle.cache) {
                respondWithCache(bundle, res);
            } else {
                if (!bundle.building)
                    updateCache(bundle);
                bundle.once('rebuilt', function () {
                    respondWithCache(bundle, res);
                });
            }
        }

        function respondWithCache(bundle, res) {
            res.set('Last-Modified', bundle.cacheDate.toISOString());
            res.set('Content-Type', contentType);
            res.status(200).send(bundle.cache);
        }

        function build(bundle, cb) {
            bundle.building = true;
            var startDate = Date.now();
            logger.info("Building %s...", name);
            //noinspection JSUnusedGlobalSymbols
            bundle.bundle(function (err, src) {
                if (err) {
                    err = new Error(err);
                    logger.error(err, 'Building %s', name);
                } else {
                    src = src.toString();
                    if (bundleConfiguration.minify)
                        src = compressJs(src);
                    var durationInMs = Date.now() - startDate;
                    logger.info('Built %s in %ds (%s)', name, durationInMs / 1000, humanize.filesize(src.length));
                    bundle.building = false;
                }
                cb(err, src);
            });
        }

        function updateCache(bundle) {
            bundle.cache = bundle.cacheDate = null;
            build(bundle, function (err, src) {
                if (err) {
                    bundle.cache = 'document.body.style.backgroundColor = "white";' +
                        'document.body.style.color = "red";' +
                        'document.body.style.fontSize = "16pt";' +
                        'document.body.innerHTML = ' + JSON.stringify(err.toString());
                } else {
                    bundle.cache = src;
                }
                bundle.cacheDate = new Date();
                bundle.emit('rebuilt');
            });
        }
    }

////////////////////////////////////////////////////////////////////////////////
    function readStaticFiles(cb) {
        if (useForeverCache) {
            logger.info("Computing static files fingerprints...");
            getStylusGeneratedResourcePaths(function (err, excludedPaths) {
                var fileCount = 0;
                _.each(staticDirs, function (staticDir) {
                    if (fs.existsSync(staticDir))
                        file.walkSync(staticDir, _.partial(staticWalker, staticDir));
                });
                logger.info("Computed %d static files fingerprints", fileCount);
                cb(null);

                //noinspection JSUnusedLocalSymbols
                function staticWalker(staticDir, dirPath, dirs, files) {
                    _.each(files, function (file) {
                        var filePath = path.join(dirPath, file);
                        var resourcePath = filePathToStaticUriPath(staticDir, filePath);
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

        function getStylusGeneratedResourcePaths(callback) {
            var cssPaths = [];
            async.each(app.get("stylusFolders"), function (stylusDir, cb) {
                glob(path.join(stylusDir, "*.styl"), function (err, stylusFiles) {
                    if (stylusFiles)
                        cssPaths = cssPaths.concat(_.map(stylusFiles, function (stylusFile) {
                            return stylusSubDir + '/' + path.relative(stylusDir, stylusFile).replace(/\.styl$/, '.css');
                        }));
                    cb(err);
                });
            }, function (err) {
                callback(err, cssPaths);
            });
        }
    }

    function getStylusFiles(callback) {
        var result = [];
        async.each(app.get("stylusFolders"), function (stylusDir, cb) {
            glob(path.join(stylusDir, "*.styl"), function (err, files) {
                if (files)
                    result = result.concat(files);
                cb(err);
            });
        }, function (err) {
            callback(err, result);
        });
    }

////////////////////////////////////////////////////////////////////////////////
    function compileStylusFiles(callback) {
        if (useForeverCache) {
            getStylusFiles(function (err, files) {
                if (err) {
                    logger.error(err, "compileStylusFiles");
                    callback(err);
                } else {
                    async.eachSeries(files, function (file, cb) {
                        var startDate = Date.now();
                        logger.info("Compiling %s", file);
                        var cssContent = fs.readFileSync(file, {encoding: "utf8"});
                        compileStylus(cssContent, file).render(function (err, css) {
                            if (err) {
                                logger.error(err, "compileStylusFiles failed for", file);
                            } else {
                                var durationInMs = Date.now() - startDate;
                                logger.info('Compiled %s in %ds (%s)', file, durationInMs / 1000, humanize.filesize(css.length));
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
        i18n.functions.log = _.bind(logger.debug, logger);
        i18n.init({
            resGetPath: path.join(i18nDir, i18nJsonTemplate),
            detectLngFromPath: false,
            forceDetectLngFromPath: false,
            detectLngFromHeaders: options.i18n.useHeaders,
            useCookie: options.i18n.useCookie,
            supportedLngs: options.i18n.supportedLanguages,
            fallbackLng: options.i18n.fallbackLanguage,
            ns: 'translation',
            preload: _.compact(_.union(['en', 'fr', options.i18n.fallbackLanguage], options.i18n.supportedLanguages)),
        });
        app.i18n = i18n;
    }

////////////////////////////////////////////////////////////////////////////////
    //noinspection JSUnusedLocalSymbols
    function clearI18nCache(req, res, next) {
        i18n.sync.resStore = {};
        i18n.resStore = {};
        next();
    }

////////////////////////////////////////////////////////////////////////////////
    function readI18nFiles(callback) {
        if (useForeverCache) {
            logger.info("Computing i18n files fingerprints...");
            glob(path.join(i18nDir, "*.json"), function (err, files) {
                if (err) {
                    logger.error(err, "readI18nFiles");
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
                            var resGetPath = foreverUrlPrefix
                                + '/' + translationFilesHash
                                + '/' + i18nResourcePath
                                + '/' + i18nJsonTemplate;
                            i18nOptions = {
                                resGetPath: resGetPath,
                            };
                            logger.info("Computed %d i18n files fingerprints", files.length);
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
                    body += (
                        chunk.toString()
                            .replace(/\r/g, '\\r')
                            .replace(/"/g, '\\"')
                            .replace(/\n/g, '\\n"\n+"')
                    );
                },
                function () {
                    this.queue('module.exports = \n"' + body + '";\n');
                    this.queue(null);
                }
            );
        };
    }

////////////////////////////////////////////////////////////////////////////////
    function dataurify(extensions) {
        var re = new RegExp('\\.(' + extensions.join('|') + ')$');
        return function (fileName) {
            var match = re.exec(fileName);
            if (!match)
                return through();
            return through(
                function (/*chunk*/) {
                },
                function () {
                    var stream = this;
                    DataURI(fileName, function (err, content) {
                        if (err) {
                            throw err;
                        }
                        stream.queue('module.exports = \n"' + content + '";\n');
                        stream.queue(null);
                    });
                }
            );
        };
    }

////////////////////////////////////////////////////////////////////////////////
    function compressJs(src) {
        try {
            var minified = UglifyJS.minify(src, {
                fromString: true,
            });
            src = minified.code;
        }
        catch (e) {
            logger.error('Uglifying: %s at line %d, column %d', e.message, e.line, e.col);
            if (e.line) {
                logger.error('%s ', jsString.split('\n')[e.line - 1]);
                if (e.col)
                    logger.error('%s^', (new Array(e.col)).join(' '));
            }
        }
        return src;
    }

////////////////////////////////////////////////////////////////////////////////
    function compileStylus(str, filename) {
        var paths = [].concat(app.get("stylusFolders")).concat([
            path.join(bootstrapStylusDir, 'stylus'),
            path.join(fontAwesomeDir, 'css'),
        ]);
        return stylus(str)
            .set('filename', filename)
            .set('compress', cssCompress)
            .set('include css', true)
            .set('firebug', cssDebug)
            .set('linenos', cssDebug)
            .set('paths', paths)
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
            var match = /^([^?#]*)([?#].*)$/.exec(resourcePath);
            var path = match && match[1] || resourcePath;
            var queryString = match && match[2] || "";
            var url = cacheforeverMiddleware.resourceUrl(path);
            return new stylus.nodes.Literal('url("' + url + queryString + '")');
        }
    }

////////////////////////////////////////////////////////////////////////////////
    function filePathToStaticUriPath(baseDir, filePath) {
        return path.relative(baseDir, filePath).replace(/\\/g, "/");
    }

////////////////////////////////////////////////////////////////////////////////
    function jsUrl(path) {
        return cacheforeverMiddleware.resourceUrl(addExt('js', path));
    }

////////////////////////////////////////////////////////////////////////////////
    function cssUrl(path) {
        return cacheforeverMiddleware.resourceUrl(stylusSubDir + '/' + addExt('css', path));
    }

////////////////////////////////////////////////////////////////////////////////
    function addExt(ext, path) {
        return new RegExp('\\.' + ext + '$').test(path) ? path : path + '.' + ext;
    }

////////////////////////////////////////////////////////////////////////////////
}
function isIE9OrLower(req) {
    var userAgent = req.get('user-agent');
    return /MSIE [1-9]\./.test(userAgent);
}
////////////////////////////////////////////////////////////////////////////////
function getRequireAliases() {
    var aliases = {
        'socket.io': 'socket.io-client',
        'fack:resourceUrl': 'fack/browser/resourceUrl',
        'fack:i18n': 'fack/browser/i18n',
    };
    var bootstrapJsDir = path.join(bootstrapStylusDir, 'js');
    var jsFiles = fs.readdirSync(bootstrapJsDir);
    _.each(jsFiles, function (jsFile) {
        if (/\.js$/.test(jsFiles)) {
            aliases['bootstrap-' + jsFile.replace(/\.js$/, '')] = "fack/bootstrap-stylus/js/" + jsFile;
        }
    });
    return aliases;
}
