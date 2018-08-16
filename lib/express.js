const optimist = require('./optimist'); // let it init logger asap
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const _ = require('lodash');
const async = require('async');
const stylus = require('stylus');
const nib = require('nib');
const glob = require('glob');
const i18n = require('i18next');
const humanize = require('humanize');
const file = require('file');
const logger = require('./bunyule');
const cacheForever = require('./cacheforever');
const sdc = require('./sdc');
const loggerMiddleware = require('./middlewares/logger');
const errorMethodMiddleware = require('./middlewares/errorMethod');
const constants = require('./constants');
const processTitle = require('./process-title');
const ModuleDepsCache = require('./ModuleDepsCache');

module.exports = expressWrapper;

const nodeEnv = process.env.NODE_ENV || 'development';
const isDev = 'development' == nodeEnv;
const isProd = 'production' === nodeEnv;
const isIE9Debug = false;
const useForeverCache = isProd;
const minify = isProd;
const cssDebug = isDev && !isIE9Debug;
const cssCompress = isProd;
const noCache = isDev;

const oneYearCache = 1000 * 60 * 60 * 24 * 365;

_.each(_.keys(express), function (key) {
    expressWrapper[key] = express[key];
});

const staticUrlPrefix = constants.staticUrlPrefix;
const foreverUrlPrefix = constants.foreverUrlPrefix;

const bootstrapStylusDir = path.join(__dirname, '..', 'bootstrap-stylus');
const fontAwesomeDir = path.join(__dirname, '..', 'Font-Awesome');

const stylusSubDir = constants.stylusSubDir;

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
 * @param {(bundle|string)[]} options.bundles bundles to build on top of default entries
 * @returns {*} express app
 */
function expressWrapper(options) { // jshint ignore:line
    optimist.end();
    const app = express();
    const rootDir = path.dirname(require.main.filename);
    options = _.defaults(options || {}, {
        views: path.join(rootDir, 'views'),
        public: path.join(rootDir, 'public'),
        js: path.join(rootDir, 'js'),
        preconfigure: null,
        bundles: [],
        minify: minify,
        enableMinifyPerFile: false,
        enableMinifyGlobal: true,
        //true middleware means use default middleware, false middleware means disable, can also set a custom middleware
        jsonMiddleware: true,
        urlencodedMiddleware: true,
        errormethodMiddleware: false,
        insertGlobalVars: {},
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

    const pubDir = options.public;
    const viewsDir = options.views;
    const jsDir = options.js;
    const i18nDir = path.join(pubDir, "i18n");
    const i18nResourcePath = filePathToStaticUriPath(pubDir, i18nDir);
    const i18nJsonTemplate = '__ns__.__lng__.json';
    let i18nOptions = {
        resGetPath: staticUrlPrefix + '/' + i18nResourcePath + '/' + i18nJsonTemplate,
    };

    fixI18nOptions();
    options.i18n = _.defaults(options.i18n || {}, {
        enabled: true,
        detectLngFromPath: false,
        forceDetectLngFromPath: false,
        supportedLngs: [], //if not empty, restrict available languages
        fallbackLng: 'fr',
        detectLngFromHeaders: true,
        useCookie: false,
        ns: 'translation',
        resGetPath: path.join(i18nDir, i18nJsonTemplate),
    });

    if (options.i18n.enabled) {
        configureI18n();
    }
    const staticDirs = [];
    if (options.preconfigure && _.isFunction(options.preconfigure)) {
        options.preconfigure(app);
    }
    app.enable('trust proxy');
    app.set('view engine', 'pug');
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
    if (noCache) {
        app.use(nocache);
        if (options.i18n.enabled) {
            app.use(clearI18nCache);
        }
    }
    const cacheforeverMiddleware = cacheForever(_.extend({
        staticPath: staticUrlPrefix,
        foreverPath: foreverUrlPrefix,
    }, options.cacheForeverOptions || {}));

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
    addOptionalMiddleware('errormethodMiddleware', function () {
        return errorMethodMiddleware(logger);
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

    const stylusMiddlewares = [];
    _.each(app.get("stylusFolders"), function (src) {
        stylusMiddlewares.push(stylus.middleware({
            src: src,
            dest: path.join(pubDir, "/css"),
            compile: compileStylus,
        }));
    });
    if (stylusMiddlewares.length > 0) {
        app.use(staticUrlPrefix + "/css", stylusMiddlewares);
    }

    const jsBundles = require('./jsBundles')(app, options, cacheforeverMiddleware, i18nOptions);

    //register static middleware at the end, so that stylus file are indeed served
    app.use(staticUrlPrefix, jsBundles.getBrowserifyBundlesMiddleware());
    registerStaticDir(pubDir);
    registerStaticDir(path.join(fontAwesomeDir, 'static'));

    app.cacheforever = cacheforeverMiddleware;
    app.static = registerStaticDir;
    app.start = start;
    app.packageJavascript = jsBundles.createBundle;
    return app;

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
                if (options.preListen) {
                    options.preListen();
                }
                const argv = optimist.argv;
                const port = argv.port;
                const server = app.listen(port, function () {
                    processTitle.set('listening');
                    const address = server.address();
                    logger.info("Listening on %s:%d", address.address, address.port);
                    if (options.postListen) {
                        options.postListen(server);
                    }
                });
                if (cb) {
                    cb(server);
                }
            }
        }
    }

    function addOptionalMiddleware(name, defaultMiddlewareBuilder) {
        if (defaultMiddlewareBuilder && options[name] === true) {
            options[name] = defaultMiddlewareBuilder();
        }
        if (options[name]) {
            app.use(options[name]);
        }
    }

    function registerStaticDir(staticDir) {
        staticDirs.push(staticDir);
        addStaticMiddlewares(staticDir);
    }

    function addStaticMiddlewares(staticDir) {
        app.use(staticUrlPrefix, express.static(staticDir, {maxAge: 0}));
        //https://developers.google.com/speed/docs/best-practices/caching
        app.use(foreverUrlPrefix, express.static(staticDir, {maxAge: oneYearCache}));
    }

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

    function readStaticFiles(cb) {
        if (useForeverCache) {
            logger.info("Computing static files fingerprints...");
            getStylusGeneratedResourcePaths(function (err, excludedPaths) {
                let fileCount = 0;
                _.each(staticDirs, function (staticDir) {
                    if (fs.existsSync(staticDir)) {
                        file.walkSync(staticDir, _.partial(staticWalker, staticDir));
                    }
                });
                logger.info("Computed %d static files fingerprints", fileCount);
                cb(null);

                //noinspection JSUnusedLocalSymbols
                function staticWalker(staticDir, dirPath, dirs, files) {
                    _.each(files, function (file) {
                        const filePath = path.join(dirPath, file);
                        const resourcePath = filePathToStaticUriPath(staticDir, filePath);
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
            let cssPaths = [];
            async.each(app.get("stylusFolders"), function (stylusDir, cb) {
                glob(path.join(stylusDir, "*.styl"), function (err, stylusFiles) {
                    if (stylusFiles) {
                        cssPaths = cssPaths.concat(_.map(stylusFiles, function (stylusFile) {
                            return stylusSubDir + '/' + path.relative(stylusDir, stylusFile).replace(/\.styl$/, '.css');
                        }));
                    }
                    cb(err);
                });
            }, function (err) {
                callback(err, cssPaths);
            });
        }
    }

    function getStylusFiles(callback) {
        let result = [];
        async.each(app.get("stylusFolders"), function (stylusDir, cb) {
            glob(path.join(stylusDir, "*.styl"), function (err, files) {
                if (files) {
                    result = result.concat(files);
                }
                cb(err);
            });
        }, function (err) {
            callback(err, result);
        });
    }

    function compileStylusFiles(callback) {
        if (useForeverCache) {
            getStylusFiles(function (err, files) {
                if (err) {
                    logger.error(err, "compileStylusFiles");
                    callback(err);
                } else {
                    async.eachSeries(files, function (file, cb) {
                        const startDate = Date.now();
                        logger.info("Compiling %s", file);
                        const cssContent = fs.readFileSync(file, {encoding: "utf8"});
                        compileStylus(cssContent, file).render(function (err, css) {
                            if (err) {
                                logger.error(err, "compileStylusFiles failed for", file);
                            } else {
                                const durationInMs = Date.now() - startDate;
                                logger.info({timeInMs: durationInMs, size: css.length},
                                    'Compiled %s in %ds (%s)', file, durationInMs / 1000, humanize.filesize(css.length));
                                const cssFileName = filePathToStaticUriPath(viewsDir, file).replace(/\.styl$/, ".css");
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
            if (err) {
                req.logger.fatal(err, "Unhandled error during at %s at %s", req.method, req.url);
            }
            next(err);//default handler
        });
        setImmediate(cb);
    }

    function configureI18n() {
        i18n.functions.log = _.bind(logger.debug, logger);
        if (!options.i18n.preload) {
            options.i18n.preload =
                _.compact(
                    _.union(
                        ['en', 'fr', options.i18n.fallbackLng],
                        options.i18n.supportedLngs
                    )
                );
        }
        if (options.i18n.backend) {
            i18n.backend(options.i18n.backend);
        }
        i18n.init(options.i18n);
        app.i18n = i18n;
    }

    //noinspection JSUnusedLocalSymbols
    function clearI18nCache(req, res, next) {
        i18n.sync.resStore = {};
        i18n.resStore = {};
        next();
    }

    function readI18nFiles(callback) {
        if (useForeverCache) {
            logger.info("Computing i18n files fingerprints...");
            glob(path.join(i18nDir, "*.json"), function (err, files) {
                if (err) {
                    logger.error(err, "readI18nFiles");
                    callback(err);
                } else {
                    let concatenatedContent = '';
                    const contents = {};
                    async.eachSeries(files, function (file, cb) {
                        const content = fs.readFileSync(file, {encoding: "utf8"});
                        concatenatedContent += content;
                        contents[file] = content;
                        cb(null);
                    }, function (err) {
                        if (err) {
                            callback(err);
                        } else {
                            const shasum = crypto.createHash('sha1');
                            const translationFilesHash = shasum.update(concatenatedContent).digest("hex");
                            _.each(files, function (file) {
                                const staticPath = filePathToStaticUriPath(pubDir, file);
                                cacheforeverMiddleware.register({
                                    path: staticPath,
                                    content: contents[file],
                                    contentType: "application/json",
                                    fingerprint: translationFilesHash,
                                });
                            });
                            const resGetPath = foreverUrlPrefix
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


    function compileStylus(str, filename) {
        const paths = [].concat(app.get("stylusFolders")).concat([
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
                const cleanSrc = cleanSrcStr(src);
                return resourceUrlNode('images/' + cleanSrc);
            })
            .define('resourceUrl', function (src) {
                const cleanSrc = cleanSrcStr(src);
                return resourceUrlNode(cleanSrc);
            })
            .define('resolve', function (src) {
                return require.resolve(src.string);
            })
            .use(nib());

        function cleanSrcStr(src) {
            return src.string.replace(/['"]/g, "");
        }

        function resourceUrlNode(resourcePath) {
            const match = /^([^?#]*)([?#].*)$/.exec(resourcePath);
            const path = match && match[1] || resourcePath;
            const queryString = match && match[2] || "";
            const url = cacheforeverMiddleware.resourceUrl(path);
            return new stylus.nodes.Literal('url("' + url + queryString + '")');
        }
    }

    function filePathToStaticUriPath(baseDir, filePath) {
        return path.relative(baseDir, filePath).replace(/\\/g, "/");
    }

    function jsUrl(path) {
        return cacheforeverMiddleware.resourceUrl(addExt('js', path));
    }

    function cssUrl(path) {
        return cacheforeverMiddleware.resourceUrl(stylusSubDir + '/' + addExt('css', path));
    }

    function addExt(ext, path) {
        return new RegExp('\\.' + ext + '$').test(path) ? path : path + '.' + ext;
    }

    function fixI18nOptions() {
        const conversionMap = {
            useHeaders: 'detectLngFromHeaders',
            supportedLanguages: 'supportedLngs',
            fallbackLanguage: 'fallbackLng',
        };
        _.each(conversionMap, (newKey, oldKey) => {
            if (_.has(options.i18n, oldKey)) {
                options.i18n[newKey] = options.i18n[oldKey];
                delete options.i18n[oldKey];
            }
        });
    }
}
