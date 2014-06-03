var optimist = require('./optimist'); //let it init logger asap
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var express = require('express');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
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
var uglify = require('uglify-js');
var file = require('file');
var logger = require('./bunyule');
var cacheForever = require('./cacheforever');
var globalpassword = require('./globalpassword');
var sdc = require('./sdc');
var loggerMiddleware = require('./logger-middleware');
var f4ExpressMiddlewares = require('f4-express-middlewares');
var DataURI = require('datauri');

module.exports = expressWrapper;

var nodeEnv = process.env.NODE_ENV || 'development';
var isDev = 'development' == nodeEnv;
var isProd = 'production' === nodeEnv;
var useForeverCache = isProd;
var isIE9Debug = false;

if (isDev) {
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

var staticUrlPrefix = '/static';
var foreverUrlPrefix = '/cacheForever';

var bootstrapStylusDir = path.join(__dirname, '..', 'bootstrap-stylus');
var fontAwesomeDir = path.join(__dirname, '..', 'Font-Awesome');

var requireAliases = (function () {
    var aliases = {
        'jquery': 'jquery-browserify',
        'socket.io': 'socket.io-client',
    };
    var bootserverStylusJsDir = path.join(bootstrapStylusDir, 'js');
    var jsFiles = fs.readdirSync(bootserverStylusJsDir);
    _.each(jsFiles, function (jsFile) {
        if (/\.js$/.test(jsFiles)) {
            aliases[jsFile.replace(/\.js$/, '')] = path.join(bootserverStylusJsDir, jsFile);
        }
    });
    return aliases;
})();
var resolve = require('browser-resolve');

////////////////////////////////////////////////////////////////////////////////
function expressWrapper(options) {
    optimist.end();
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
    });
    options.i18n = _.defaults(options.i18n || {}, {
        supportedLanguages: [],//if not empty, restrict available languages
        fallbackLanguage: 'fr',
        useHeaders: true,
        useCookie: true,
    });
    var insertGlobalVars = options.insertGlobalVars;
    var pubDir = options.public;
    var viewsDir = options.views;
    var jsDir = options.js;
    var jsEntryDir = path.join(jsDir, 'entry');
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
    if (options.preconfigure && _.isFunction(options.preconfigure))
        options.preconfigure();
    app.enable('trust proxy');
    app.set('view engine', 'jade');
    app.set('views', viewsDir);
    app.use(loggerMiddleware);
    if (isDev) {
        app.use(nocache);
        app.use(clearI18nCache);
    }
    var cacheforeverMiddleware = cacheForever({
        staticPath: staticUrlPrefix,
        foreverPath: foreverUrlPrefix,
    });
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
        options.sessionMiddleware = session({ secret: options.sessionSecret });
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

    app.use(i18n.handle);
    app.locals.resourceUrl = _.bind(cacheforeverMiddleware.resourceUrl, cacheforeverMiddleware);
    app.use(sdc.helpers.getExpressMiddleware('http', { timeByUrl: true }));
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
    app.use(staticUrlPrefix, browserifyBundlesMiddleware);
    app.use(staticUrlPrefix, stylus.middleware({
        src: viewsDir,
        dest: pubDir,
        compile: compileStylus
    }));
    registerStaticDir(pubDir);
    registerStaticDir(fontAwesomeDir);
    i18n.registerAppHelper(app);
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
                logger.error(err);
            } else {
                var argv = optimist.argv;
                var port = argv.port;
                var server = app.listen(port, function () {
                    var address = server.address();
                    logger.info("Listening on %s:%d", address.address, address.port);
                });
                if (cb)
                    cb(server);
            }
        }
    }

////////////////////////////////////////////////////////////////////////////////
    function getJsEntries() {
        var jsEntriesPattern = path.join(jsEntryDir, '**', '*.js');
        return _.map(glob.sync(jsEntriesPattern), useNativePathSep); // browserify fails with / on Windows
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
        res.set('Pragma', 'no-cache');
        res.set('Expires', '-1');
        res.set('Cache-Control', 'no-cache');
        next();
    }

////////////////////////////////////////////////////////////////////////////////
    function registerBrowserifyBundles(cb) {
        async.eachSeries(bundles, function (bundlePath, cb) {
            createBundle(bundlePath, cb);
        }, cb);
    }

////////////////////////////////////////////////////////////////////////////////
    function createBrowserifyBundlesMiddleware() {
        var bundleHandlers = {};
        middleware.register = registerBundle;
        return middleware;

        function middleware(req, res, next) {
            if (isDev) {
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
            minify: isProd,
            watch: isDev,
            debug: isDev,
            fixTrailingComma: isProd,
            serve: true,
            requireAliases: [],
        });
        var transforms = bundleConfiguration.transforms;
        if (bundleConfiguration.fixTrailingComma)
            transforms.push(fixTrailingComma);
        if (bundleConfiguration.jadeify)
            transforms.push(jadeify.jade({ pretty: false }));
        transforms.push(stringify(bundleConfiguration.stringify));
        transforms.push(dataurify(bundleConfiguration.dataurify));
        var requires = bundleConfiguration.requires;

        var name = bundleConfiguration.name;
        if (!name) {
            name = path.relative(jsEntryDir, bundleConfiguration.path)
                .replace(/\\/g, '/');
        }

        var contentType = 'text/javascript';
        var bundle = getBundle(bundleConfiguration);
        if (!bundleConfiguration.serve) {
            build(bundle, cb);
        } else if (!bundleConfiguration.watch) {
            build(bundle, function (err, src) {
                if (err) {
                    logger.error('Building %s', name, err);
                } else {
                    cacheforeverMiddleware.register({
                        path: name,
                        content: src,
                        contentType: contentType,
                    });
                }
                cb(err, src);
            });
        } else {
            var oldIeOptions = _.extend({
                debug: false,
                fixTrailingComma: true,
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
            var bundle = browserify({
                entries: [getBundleOptions.path],
                noParse: ['jquery-browserify'],
                resolve: function (id, opts, callback) {
                    id = bundleConfiguration.requireAliases[id] || options.requireAliases[id] || requireAliases[id] || id;
                    resolve(id, opts, callback);
                },
            });
            _.each(requires, function (opts, file) {
                bundle.require(file, opts);
            });
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
            res.send(200, bundle.cache);
        }

        function build(bundle, cb) {
            bundle.building = true;
            var startDate = Date.now();
            logger.info("Building %s...", name);
            //noinspection JSUnusedGlobalSymbols
            bundle.bundle({
                debug: bundleConfiguration.debug,
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
                }, insertGlobalVars),
            }, function (err, src) {
                if (err) {
                    logger.error('Building %s', name, err);
                } else {
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
                    logger.error("compileStylusFiles", err);
                    callback(err);
                } else {
                    async.eachSeries(files, function (file, cb) {
                        logger.info("Compiling %s", file);
                        var cssContent = fs.readFileSync(file, {encoding: "utf8"});
                        compileStylus(cssContent, file).render(function (err, css) {
                            if (err) {
                                logger.error("compileStylusFiles failed for", file, err);
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
            preload: _.uniq(_.compact(['en', 'fr'].concat(options.i18n.supportedLanguages).push(options.i18n.fallbackLanguage))),
        });
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
                    logger.error("readI18nFiles", err);
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
    function dataurify(extensions) {
        var re = new RegExp('\\.(' + extensions.join('|') + ')$');
        return function (fileName) {
            var match = re.exec(fileName);
            if (!match)
                return through();
            return through(
                function (chunk) {
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
    function fixTrailingComma() {
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
            logger.error('Uglifying: %s at line %d, column %d', e.message, e.line, e.col);
            if (e.line) {
                logger.error('%s ', js.split('\n')[e.line - 1]);
                if (e.col)
                    logger.error('%s^', (new Array(e.col)).join(' '));
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
            .set('firebug', isDev && !isIE9Debug)
            .set('linenos', isDev && !isIE9Debug)
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
            return new stylus.nodes.Literal('url("' + url + '")');
        }
    }

////////////////////////////////////////////////////////////////////////////////
    function filePathToStaticUriPath(baseDir, filePath) {
        return path.relative(baseDir, filePath).replace(/\\/g, "/");
    }

////////////////////////////////////////////////////////////////////////////////
}
function isIE9OrLower(req) {
    var userAgent = req.get('user-agent');
    return /MSIE [1-9]\./.test(userAgent);
}
