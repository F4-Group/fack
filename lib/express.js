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
var uglify = require('uglify-js');
var file = require('file');
var logule = require('logule').init(module);
var cacheforever = require('./cacheforever');
var globalpassword = require('./globalpassword');
var sdc = require('./sdc');
var loggerMiddleware = require('./logger-middleware');
var f4ExpressMiddlewares = require('f4-express-middlewares');

module.exports = expressWrapper;

var isProd = 'production' === process.env.NODE_ENV;
var useForeverCache = isProd;
var isIE9Debug = false;

if (!isProd) {
    browserify = (function(br) {
        return function() {
            return watchify(br.apply(this, arguments));
        };
    })(browserify);
}

var oneYearCache = 1000 * 60 * 60 * 24 * 365;

_.each(_.keys(express), function(key) {
    expressWrapper[key] = express[key];
});

var staticUrlPrefix = '/static';
var foreverUrlPrefix = '/cacheForever';

var bootstrapStylusDir = path.join(__dirname, '..', 'bootstrap-stylus');
var fontAwesomeDir = path.join(__dirname, '..', 'Font-Awesome');

var requireAliases = (function() {
    var aliases = {
        'jquery': 'jquery-browserify',
        'socket.io': 'socket.io-client',
    };
    var bootserverStylusJsDir = path.join(bootstrapStylusDir, 'js');
    var jsFiles = fs.readdirSync(bootserverStylusJsDir);
    _.each(jsFiles, function(jsFile) {
        if (/\.js$/.test(jsFiles)) {
            aliases[jsFile.replace(/\.js$/, '')] = path.join(bootserverStylusJsDir, jsFile);
        }
    });
    return aliases;
})();
var resolve = require('browser-resolve');

////////////////////////////////////////////////////////////////////////////////
function expressWrapper(options) {
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
        multipartMiddleware: true,
        crossdomainMiddleware: false,
        errormethodMiddleware: false,
        etagifyMiddleware: false,
        insertGlobalVars: {},
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
    configureI18n();
    var stylusSubDir = "css";
    var stylusDir = path.join(viewsDir, stylusSubDir);
    var bundles = options.bundles.concat(getJsEntries());
    var staticDirs = [];
    var app = express();
    if (options.preconfigure && _.isFunction(options.preconfigure))
        app.configure(options.preconfigure);
    app.configure(function() {
        app.enable('trust proxy');
        app.set('view engine', 'jade');
        app.set('views', viewsDir);
        app.use(loggerMiddleware);
        app.use(i18nMiddleware);
    });
    app.configure('development', function() {
        app.use(nocache);
    });
    var cacheforeverMiddleware = cacheforever({
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
        options.sessionMiddleware = express.session({ secret: options.sessionSecret });
        options.cookieMiddleware = options.cookieMiddleware || true;
    }

    if (options.cookie && !options.cookieMiddleware)
        options.cookieMiddleware = true;
    if (options.cookieMiddleware === true)
        options.cookieMiddleware = express.cookieParser(options.cookieSecret || null);

    if (options.jsonMiddleware === true)
        options.jsonMiddleware = express.json();
    if (options.urlencodedMiddleware === true)
        options.urlencodedMiddleware = express.urlencoded();
    if (options.multipartMiddleware === true)
        options.multipartMiddleware = require('connect-multiparty')();

    if (options.crossdomainMiddleware === true)
        options.crossdomainMiddleware = f4ExpressMiddlewares.crossDomain.middleware;
    if (options.errormethodMiddleware === true)
        options.errormethodMiddleware = f4ExpressMiddlewares.errorMethod(logule);
    if (options.etagifyMiddleware === true)
        options.etagifyMiddleware = f4ExpressMiddlewares.etagify;

    app.configure(function() {
        app.locals.resourceUrl = _.bind(cacheforeverMiddleware.resourceUrl, cacheforeverMiddleware);
        app.locals.i18n = i18n;
        app.locals.t = i18n.t;
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
    });
    app.cacheforever = cacheforeverMiddleware;
    app.static = registerStaticDir;
    app.start = start;
    app.packageJavascript = function(options, cb) {
        createBundle(_.extend({
            serve: false,
            minify: true,
            fixTrailingComma: false,
            debug: false,
        }, options), cb);
    };
    return app;

////////////////////////////////////////////////////////////////////////////////
    function start(cb) {
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
                var server = app.listen(port, function() {
                    logule.info("Listening on localhost:%d", port);
                });
                if (cb)
                    cb(server);
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
        return _.map(_.filter(entries || [], function(entry) {
            return /\.js$/.test(entry)
        }), function(entry) {
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
    function nocache(req, res, next) {
        res.set('Pragma', 'no-cache');
        res.set('Expires', '-1');
        res.set('Cache-Control', 'no-cache');
        next();
    }

////////////////////////////////////////////////////////////////////////////////
    function registerBrowserifyBundles(cb) {
        async.eachSeries(bundles, function(options, cb) {
            createBundle(options, cb);
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
    function createBundle(options, cb) {
        if (_.isString(options))
            options = {path: options};
        options = _.defaults(options, {
            jadeify: true,
            stringify: ['html', 'txt', 'vshader', 'fshader', 'shaderlib'],
            transforms: [],
            requires: {},
            minify: isProd,
            watch: !isProd,
            debug: !isProd,
            fixTrailingComma: isProd,
            serve: true,
        });
        var transforms = options.transforms;
        if (options.fixTrailingComma)
            transforms.push(fixTrailingComma);
        if (options.jadeify)
            transforms.push(jadeify.jade({ pretty: false }));
        transforms.push(stringify(options.stringify));
        var requires = options.requires;

        var name = path.basename(options.path);
        var contentType = 'text/javascript';
        var bundle = getBundle(options);
        if (!options.serve) {
            build(bundle, cb);
        } else if (!options.watch) {
            build(bundle, function(err, src) {
                if (err) {
                    logule.error('Building %s', name, err);
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
            }, options);
            var oldIeBundle = getBundle(oldIeOptions);
            bundle.on('update', _.partial(updateCache, bundle));
            browserifyBundlesMiddleware.register('/' + name, function(req, res) {
                if (isIE9OrLower(req))
                    sendCache(oldIeBundle, res);
                else
                    sendCache(bundle, res);
            });
            cb(null);
        }

        function getBundle(options) {
            var bundle = browserify({
                entries: [options.path],
                noParse: ['jquery-browserify'],
                resolve: function(id, opts, callback) {
                    id = requireAliases[id] || id;
                    resolve(id, opts, callback);
                },
            });
            _.each(requires, function(opts, file) {
                bundle.require(file, opts);
            });
            _.each(transforms, function(transform) {
                bundle.transform(transform);
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
                bundle.once('rebuilt', function() {
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
            logule.info("Building %s...", name);
            bundle.bundle({
                debug: options.debug,
                insertGlobalVars: _.extend({
                    cacheforever: function() {
                        return cacheforeverMiddleware.getBrowserifyModule();
                    },
                    fack: function() {
                        return JSON.stringify({
                            i18next: {
                                options: i18nOptions || {},
                            },
                        });
                    },
                }, insertGlobalVars),
            }, function(err, src) {
                if (err) {
                    logule.error('Building %s', name, err);
                } else {
                    if (options.minify)
                        src = compressJs(src);
                    var durationInMs = Date.now() - startDate;
                    logule.info('Built %s in %ds (%s)', name, durationInMs / 1000, humanize.filesize(src.length));
                    bundle.building = false;
                }
                cb(err, src);
            });
        }

        function updateCache(bundle) {
            bundle.cache = bundle.cacheDate = null;
            build(bundle, function(err, src) {
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
            logule.info("Computing static files fingerprints...");
            getStylusGeneratedResourcePaths(function(err, excludedPaths) {
                var fileCount = 0;
                _.each(staticDirs, function(staticDir) {
                    if (fs.existsSync(staticDir))
                        file.walkSync(staticDir, _.partial(staticWalker, staticDir));
                });
                logule.info("Computed %d static files fingerprints", fileCount);
                cb(null);

                function staticWalker(staticDir, dirPath, dirs, files) {
                    _.each(files, function(file) {
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
            glob(path.join(stylusDir, "*.styl"), function(err, stylusFiles) {
                var cssPaths = _.map(stylusFiles, function(stylusFile) {
                    return stylusSubDir + '/' + path.relative(stylusDir, stylusFile).replace(/\.styl$/, '.css');
                });
                cb(err, cssPaths);
            });
        }
    }

////////////////////////////////////////////////////////////////////////////////
    function compileStylusFiles(callback) {
        if (useForeverCache) {
            glob(path.join(stylusDir, "*.styl"), function(err, files) {
                if (err) {
                    logule.error("compileStylusFiles", err);
                    callback(err);
                } else {
                    async.eachSeries(files, function(file, cb) {
                        logule.info("Compiling %s", file);
                        var cssContent = fs.readFileSync(file, {encoding: "utf8"});
                        compileStylus(cssContent, file).render(function(err, css) {
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
            glob(path.join(i18nDir, "*.json"), function(err, files) {
                if (err) {
                    logule.error("readI18nFiles", err);
                    callback(err);
                } else {
                    var concatenatedContent = '';
                    var contents = {};
                    async.eachSeries(files, function(file, cb) {
                        var content = fs.readFileSync(file, {encoding: "utf8"});
                        concatenatedContent += content;
                        contents[file] = content;
                        cb(null);
                    }, function(err) {
                        if (err) {
                            callback(err);
                        } else {
                            var shasum = crypto.createHash('sha1');
                            var translationFilesHash = shasum.update(concatenatedContent).digest("hex");
                            _.each(files, function(file) {
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
        return function(fileName) {
            if (!re.test(fileName))
                return through();
            var body = '';

            return through(
                    function(chunk) {
                        body += chunk
                                .replace(/\r/g, '\\r')
                                .replace(/"/g, '\\"')
                                .replace(/\n/g, '\\n"\n+"');
                    },
                    function() {
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
                function(chunk) {
                    js += chunk;
                },
                function() {
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
                .define('imageUrl', function(src) {
                    var cleanSrc = cleanSrcStr(src);
                    return resourceUrlNode('images/' + cleanSrc);
                })
                .define('resourceUrl', function(src) {
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
