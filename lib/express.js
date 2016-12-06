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
var glob = require('glob');
var i18n = require('i18next');
var humanize = require('humanize');
var file = require('file');
var logger = require('./bunyule');
var cacheForever = require('./cacheforever');
var globalpassword = require('./globalpassword');
var sdc = require('./sdc');
var loggerMiddleware = require('./logger-middleware');
var f4ExpressMiddlewares = require('f4-express-middlewares');
var constants = require('./constants');
var processTitle = require('./process-title');
var ModuleDepsCache = require('./ModuleDepsCache');

module.exports = expressWrapper;

var nodeEnv = process.env.NODE_ENV || 'development';
var isDev = 'development' == nodeEnv;
var isProd = 'production' === nodeEnv;
var isIE9Debug = false;
var useForeverCache = isProd;
var minify = isProd;
var cssDebug = isDev && !isIE9Debug;
var cssCompress = isProd;
var noCache = isDev;

var oneYearCache = 1000 * 60 * 60 * 24 * 365;

_.each(_.keys(express), function (key) {
    expressWrapper[key] = express[key];
});

var staticUrlPrefix = constants.staticUrlPrefix;
var foreverUrlPrefix = constants.foreverUrlPrefix;

var bootstrapStylusDir = path.join(__dirname, '..', 'bootstrap-stylus');
var fontAwesomeDir = path.join(__dirname, '..', 'Font-Awesome');

var stylusSubDir = constants.stylusSubDir;

/**
 *
 * @typedef {object} bundle
 * @property {string} name mandatory when using require or factorBundles
 * @property {string} entryPoint filename without js & folder (relative to defaultEntryDir)
 * @property {string} [path] path if automatic build of path fails
 * @property {string[]} require libs to require. if no path is given, this allows to generate multiple bundles (using external for the other bundles)
 * @property {string[]} external libs to not package, they must be provided via another bundle (most of the time a require bundle)
 * @property {string[]} factorBundles use factor-bundle plugin.
 * this will generate a package with everything that is common to the given packages, removing it from those packages.
 * built bundles must not be in delayBuildSelector
 */
/**
 *
 * @param {object} options
 * @param {string[]} options.noParse will not parse requires in those files (usually for jQuery)
 * @param {object} options.bundlesConfiguration common conf for all bundles
 * @param {regexp} options.delayBuildSelector matching bundles will be built after server boot (on-demand)
 * @param {object} options.requireAliases define aliases (used for underscore)
 * @param {(bundle|string)[]} options.bundles bundles to build on top of default entries
 * @returns {*} express app
 */
function expressWrapper(options) { // jshint ignore:line
    optimist.end();
    var app = express();
    var rootDir = path.dirname(require.main.filename);
    if (options && 'crossdomainMiddleware' in options)
        logger.warn('crossdomainMiddleware option deprecated, use cors middleware instead (https://github.com/expressjs/cors)');
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
        minify: minify,
        enableMinifyPerFile: false,
        enableMinifyGlobal: true,
        //true middleware means use default, false middleware means disable, can also set a custom middleware
        cookieMiddleware: false,
        sessionMiddleware: false,
        globalpasswordMiddleware: false,
        jsonMiddleware: true,
        urlencodedMiddleware: true,
        multipartMiddleware: false,
        crossdomainMiddleware: false, // deprecated
        errormethodMiddleware: false,
        etagifyMiddleware: false,
        insertGlobalVars: {},
        requireAliases: {},
        noParse: [],
        bundlesConfiguration: null,
        delayBuildSelector: null,
        cacheForeverOptions: null,
        healthCheckUrl: '/__healthcheck',
        moduleDepsCache: new ModuleDepsCache(),
    });
    if (options.i18n === false) {
        options.i18n = {enabled: false};
    }

    var pubDir = options.public;
    var viewsDir = options.views;
    var jsDir = options.js;
    var i18nDir = path.join(pubDir, "i18n");
    var i18nResourcePath = filePathToStaticUriPath(pubDir, i18nDir);
    var i18nJsonTemplate = '__ns__.__lng__.json';
    var i18nOptions = {
        resGetPath: staticUrlPrefix + '/' + i18nResourcePath + '/' + i18nJsonTemplate,
    };

    fixI18nOptions();
    options.i18n = _.defaults(options.i18n || {}, {
        enabled: true,
        detectLngFromPath: false,
        forceDetectLngFromPath: false,
        supportedLngs: [],//if not empty, restrict available languages
        fallbackLng: 'fr',
        detectLngFromHeaders: true,
        useCookie: false,
        ns: 'translation',
        resGetPath: path.join(i18nDir, i18nJsonTemplate),
    });

    if (options.i18n.enabled) {
        configureI18n();
    }
    var staticDirs = [];
    if (options.preconfigure && _.isFunction(options.preconfigure))
        options.preconfigure(app);
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
            res.json({status: "OK"});
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
    if (options.globalpasswords && options.globalpasswords.length && !options.globalpasswordMiddleware)
        options.globalpasswordMiddleware = true;
    if (options.globalpasswordMiddleware === true && options.globalpasswords && options.globalpasswords.length) {
        options.globalpasswordMiddleware = globalpassword({
            passwords: options.globalpasswords,
        });
        options.sessionMiddleware = options.sessionMiddleware || true;
    } else {
        options.globalpasswordMiddleware = false;
    }

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

    if (options.i18n.enabled) {
        app.use(i18n.handle);
    }
    _.extend(app.locals, {
        resourceUrl: _.bind(cacheforeverMiddleware.resourceUrl, cacheforeverMiddleware),
        jsUrl: jsUrl,
        cssUrl: cssUrl,
    });

    app.use(sdc.helpers.getExpressMiddleware('http', {timeByUrl: true}));
    addOptionalMiddleware('jsonMiddleware', function () {
        return bodyParser.json();
    });
    addOptionalMiddleware('urlencodedMiddleware', function () {
        return bodyParser.urlencoded({
            extended: true,
        });
    });
    addOptionalMiddleware('multipartMiddleware', function () {
        return require('connect-multiparty')();
    });
    addOptionalMiddleware('cookieMiddleware');
    addOptionalMiddleware('sessionMiddleware');
    addOptionalMiddleware('globalpasswordMiddleware');
    addOptionalMiddleware('crossdomainMiddleware', function () { // deprecated
        return f4ExpressMiddlewares.crossDomain.middleware;
    });
    addOptionalMiddleware('errormethodMiddleware', function () {
        return f4ExpressMiddlewares.errorMethod.middleware(logger);
    });
    addOptionalMiddleware('etagifyMiddleware', function () {
        return f4ExpressMiddlewares.etagify;
    });
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

    var jsBundles = require('./jsBundles')(app, options, cacheforeverMiddleware, i18nOptions, bootstrapStylusDir);

    //register static middleware at the end, so that stylus file are indeed served
    app.use(staticUrlPrefix, jsBundles.getBrowserifyBundlesMiddleware());
    registerStaticDir(pubDir);
    registerStaticDir(path.join(fontAwesomeDir, 'static'));

    app.cacheforever = cacheforeverMiddleware;
    app.static = registerStaticDir;
    app.start = start;
    app.packageJavascript = jsBundles.createBundle;
    return app;

////////////////////////////////////////////////////////////////////////////////
    function start(cb) {
        async.series([
            readStaticFiles,
            readI18nFiles,
            compileStylusFiles,
            jsBundles.registerBrowserifyBundles,
            registerErrorHandler,
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
    function addOptionalMiddleware(name, defaultMiddlewareBuilder) {
        if (defaultMiddlewareBuilder && options[name] === true)
            options[name] = defaultMiddlewareBuilder();
        if (options[name])
            app.use(options[name]);
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
                                logger.info({timeInMs: durationInMs, size: css.length},
                                    'Compiled %s in %ds (%s)', file, durationInMs / 1000, humanize.filesize(css.length));
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

    function registerErrorHandler(cb) {
        app.use(function (err, req, res, next) {
            if (err)
                req.logger.fatal(err, "Unhandled error during at %s at %s", req.method, req.url);
            next(err);//default handler
        });
        setImmediate(cb);
    }

////////////////////////////////////////////////////////////////////////////////
    function configureI18n() {
        i18n.functions.log = _.bind(logger.debug, logger);
        if (!options.i18n.preload)
            options.i18n.preload =
                _.compact(
                    _.union(
                        ['en', 'fr', options.i18n.fallbackLng],
                        options.i18n.supportedLngs
                    )
                );
        i18n.init(options.i18n);
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
    function fixI18nOptions() {
        var conversionMap = {
            useHeaders: 'detectLngFromHeaders',
            supportedLanguages: 'supportedLngs',
            fallbackLanguage: 'fallbackLng',
        };
        _.each(conversionMap, (newKey, oldKey)=> {
            if (_.has(options.i18n, oldKey)) {
                options.i18n[newKey] = options.i18n[oldKey];
                delete options.i18[oldKey];
            }
        })
    }
}
