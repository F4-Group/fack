var path = require('path');

var browserify = require('browserify');
var watchify = require('watchify');
var jadeify = require('browserify-jade');
var uglifyify = require('uglifyify');
var aliasify = require('aliasify');
var mold = require('mold-source-map');
var concat = require('concat-stream');
var factor = require('factor-bundle');
var through = require('through');
var UglifyJS = require('uglify-js');
var DataURI = require('datauri');
var glob = require('glob');
var async = require('async');
var _ = require('underscore');
var fs = require('fs');
var humanize = require('humanize');

var logger = require('./bunyule');

module.exports = jsBundles;

var nodeEnv = process.env.NODE_ENV || 'development';
var isDev = 'development' == nodeEnv;
var jsDebug = true; //source map
var jadeDebug = isDev;
var buildBundleOnFirstRequest = isDev;
var watch = isDev;

if (watch) {
    browserify = (function (br) {
        return function () {
            return watchify(br.apply(this, arguments));
        };
    })(browserify);
}

function jsBundles(app, options, cacheforeverMiddleware, i18nOptions, bootstrapStylusDir) {
    var requireAliases = getRequireAliases();
    var browserifyBundlesMiddleware = createBrowserifyBundlesMiddleware();
    return {
        createBundle: createBundle,
        getBrowserifyBundlesMiddleware: function () {
            return browserifyBundlesMiddleware;
        },
        registerBrowserifyBundles: registerBrowserifyBundles,
    };

////////////////////////////////////////////////////////////////////////////////
    function useNativePathSep(p) {
        // browserify fails with / on Windows
        return p.replace(/\//g, path.sep);
    }

////////////////////////////////////////////////////////////////////////////////
    function registerBrowserifyBundles(cb) {
        var defaultEntryDir = app.get("jsEntries")[0];

        var manuallyConfiguredBundles = [];
        var factoredBundles = [];
        var bundles = _.map(options.bundles,
            function (bundleConf) {
                if (_.isString(bundleConf)) {
                    manuallyConfiguredBundles.push(bundleConf);
                    return {
                        name: useNativePathSep(path.relative(defaultEntryDir, bundleConf)),
                        path: bundleConf,
                    };
                } else {
                    if (!bundleConf.path && !bundleConf.requires && !bundleConf.factorBundles) {
                        if (!bundleConf.entryPoint)
                            throw new Error("bundleConf without entryPoint and path: " + JSON.stringify(bundleConf));
                        else
                            bundleConf.path = useNativePathSep(path.resolve(defaultEntryDir, bundleConf.entryPoint + ".js"));
                    }
                    if (!bundleConf.name) {
                        if (!bundleConf.path)
                            throw new Error("bundleConf without path and name: " + JSON.stringify(bundleConf));
                        else
                            bundleConf.name = useNativePathSep(path.relative(defaultEntryDir, bundleConf.path));
                    }
                    manuallyConfiguredBundles.push(bundleConf.path);

                    if (buildBundleOnFirstRequest) {
                        delete bundleConf.factorBundles;
                    }

                    if (bundleConf.factorBundles) {
                        factoredBundles = factoredBundles.concat(bundleConf.factorBundles);
                    }
                    return bundleConf;
                }
            });

        _.each(app.get("jsEntries"), function (jsEntryDir) {
            var jsEntriesPattern = path.join(jsEntryDir, '**', '*.js');
            var entries = glob.sync(jsEntriesPattern);
            bundles = bundles.concat(_.map(
                _.reject(_.map(entries, useNativePathSep), function (entry) {
                    return _.contains(manuallyConfiguredBundles, entry);
                }),
                function (bundlePath) {
                    return {
                        name: useNativePathSep(path.relative(jsEntryDir, bundlePath)),
                        path: bundlePath,
                    };
                }));
        });

        if (factoredBundles.length > 0) {
            //removes bundles which will be factored
            bundles = _.reject(bundles, function (bundle) {
                return _.contains(factoredBundles, bundle.name);
            });
        }

        //ensure bundles order (internal dependencies can rely on names to ensure order
        bundles = _.sortBy(bundles, function (bundle) {
            var result;
            if (bundle.factorBundles)
                result = bundle.factorBundles.concat(bundle.name).sort()[0];
            else
                result = bundle.name;
            return result;
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
        var insertGlobalVars = options.insertGlobalVars;
        var defaultEntryDir = app.get("jsEntries")[0];
        if (_.isString(bundleConfiguration))
            bundleConfiguration = {path: bundleConfiguration};
        bundleConfiguration = _.defaults(bundleConfiguration, {
            name: null,
            jadeify: true,
            stringify: ['html', 'txt', 'vshader', 'fshader', 'shaderlib'],
            dataurify: ['jpg', 'png', 'gif'],
            transforms: [],
            requires: [],
            minify: options.minify,
            enableMinifyPerFile: options.enableMinifyPerFile,
            enableMinifyGlobal: options.enableMinifyGlobal,
            watch: watch,
            debug: jsDebug,
            serve: true,
            fullPaths: options.fullPaths,
            requireAliases: [],
        });
        var transforms = bundleConfiguration.transforms;
        if (bundleConfiguration.jadeify) {
            transforms.push(jadeify.jade({
                pretty: false,
                compileDebug: jadeDebug,
            }));
        }
        transforms.push(stringify(bundleConfiguration.stringify));
        transforms.push(dataurify(bundleConfiguration.dataurify));
        var requires = bundleConfiguration.requires;

        var name = bundleConfiguration.name;
        if (!name) {
            name = useNativePathSep(path.relative(defaultEntryDir, bundleConfiguration.path));
        }

        var contentType = 'text/javascript';
        var bundle = getBundle(bundleConfiguration);
        if (bundleConfiguration.factorBundles) {
            buildUsingFactorBundle(bundle, cb);
        } else if (!bundleConfiguration.serve) {
            build(bundle, cb);
        } else if (!bundleConfiguration.watch && !bundleConfiguration.delayBuild) {
            build(bundle, function (err, src, sourceMap) {
                if (err) {
                    logger.error(err, 'Building %s', name);
                } else {
                    var source = cacheforeverMiddleware.register({
                        path: name,
                        content: src,
                        contentType: contentType,
                    });
                    if (sourceMap) {
                        cacheforeverMiddleware.register({
                            path: name + ".map",
                            content: sourceMap,
                            contentType: "application/json",
                            fingerprint: source.fingerprint,
                        });
                    }
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

        function getBundle(bundleConfiguration) {
            var noParse = _.uniq(['jquery'].concat(options.noParse || []));

            var fackOptions = {
                i18next: i18nOptions || {},
            };
            var generatedModules = {
                'fack/cacheforever': cacheforeverMiddleware.getBrowserifyModule(),
                'fack/options': 'module.exports=' + JSON.stringify(fackOptions) + ';',
            };
            var fileCache = {};
            _.each(generatedModules, function (val, key) {
                fileCache[key] = val;
            });

            var bundleConf = {
                debug: bundleConfiguration.debug,
                fullPaths: bundleConfiguration.fullPaths,
                entries: [bundleConfiguration.path],
                noParse: noParse,
                insertGlobalVars: _.extend({
                    global: function () {
                        return 'window';
                    },
                }, insertGlobalVars),
                fileCache: fileCache,
            };
            if (watch) {//required conf for watchify
                bundleConf.cache = {};
                bundleConf.packageCache = {};
            } else if (options.moduleDepsCache) {
                _.extend(bundleConf, options.moduleDepsCache.args);
            }

            if (bundleConfiguration.factorBundles) {
                bundleConf.entries = _.map(bundleConfiguration.factorBundles, function (factorBundle) {
                    return useNativePathSep(path.resolve(defaultEntryDir, factorBundle));
                });
            }

            var bundle = browserify(bundleConf);
            bundle.plugin(generateRequires, {generated: generatedModules});
            _.each(bundleConfiguration.ignore || [], function (fileOrModule) {
                bundle.ignore(fileOrModule);
            });
            _.each(bundleConfiguration.exclude || [], function (fileOrModule) {
                bundle.exclude(fileOrModule);
            });
            if (_.isArray(requires) && requires.length > 0)
                bundle.require(requires);
            else if (_.isObject(requires)) {
                _.each(requires, function (opts, file) {
                    bundle.require(file, opts);
                });
            }
            if (bundleConfiguration.external) {
                bundle.external(bundleConfiguration.external);
            }
            bundle.transform({global: true, aliases: requireAliases}, aliasify);
            _.each(transforms, function (transform) {
                bundle.transform({global: true}, transform);
            });
            if (bundleConfiguration.minify && bundleConfiguration.enableMinifyPerFile) {
                bundle.transform({global: true}, uglifyify);
            }
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

        function buildUsingFactorBundle(bundle, cb) {
            bundle.building = true;
            var startDate = Date.now();
            logger.info("Building factored bundle %s (with %s)...", bundleConfiguration.name, bundleConfiguration.factorBundles);
            var outputs = [];
            _.each(bundleConfiguration.factorBundles, function (factorBundle) {
                outputs.push(factoredStream(factorBundle));
            });
            bundle.plugin(factor, {outputs: outputs});
            bundle.bundle().pipe(factoredStream(bundleConfiguration.name, function (err) {
                var durationInMs = Date.now() - startDate;
                logger.info({timeInMs: durationInMs}, 'Built factored bundle %s (with %s) in %ds',
                    bundleConfiguration.name, bundleConfiguration.factorBundles, durationInMs / 1000);
                bundle.building = false;
                cb(err);
            }));
        }

        function factoredStream(fileName, cb) {
            var sourceMap;
            var writableStream = mold.transform(function (moldResult) {
                sourceMap = moldResult.sourcemap && moldResult.sourcemap.sourcemap;
                return '//# sourceMappingURL=' + fileName + ".map";
            });

            writableStream.on('error', function (err) {
                err = new Error(err);
                logger.error(err, 'Building %s', fileName);
                cb(err);
            });

            writableStream.pipe(concat(function (src) {
                src = src.toString();
                if (bundleConfiguration.minify && bundleConfiguration.enableMinifyGlobal) {
                    var result = compressJs(src, sourceMap, fileName);
                    src = result.code;
                    sourceMap = result.map;
                } else if (sourceMap) {
                    sourceMap = JSON.stringify(sourceMap);
                }
                logger.info({size: src.length}, 'Built %s (%s)', fileName, humanize.filesize(src.length));

                var source = cacheforeverMiddleware.register({
                    path: fileName,
                    content: src,
                    contentType: contentType,
                });
                if (sourceMap) {
                    cacheforeverMiddleware.register({
                        path: fileName + ".map",
                        content: sourceMap,
                        contentType: "application/json",
                        fingerprint: source.fingerprint,
                    });
                }
                if (cb)
                    cb(null);
            }));
            return writableStream;
        }

        function build(bundle, cb) {
            bundle.building = true;
            var startDate = Date.now();
            logger.info("Building %s...", name);
            var sourceMap;
            var stream = bundle.bundle();
            if (bundleConfiguration.minify) {
                stream = stream.pipe(mold.transform(function (moldResult) {
                    sourceMap = moldResult.sourcemap && moldResult.sourcemap.sourcemap;
                    return '//# sourceMappingURL=' + name + ".map";
                }));
            }
            stream.on('error', function (err) {
                err = new Error(err);
                logger.error(err, 'Building %s', name);
                cb(err);
            });
            stream.pipe(concat(function (src) {
                src = src.toString();
                if (bundleConfiguration.minify && bundleConfiguration.enableMinifyGlobal) {
                    var result = compressJs(src, sourceMap, name);
                    src = result.code;
                    sourceMap = result.map;
                } else if (sourceMap) {
                    sourceMap = JSON.stringify(sourceMap);
                }
                var durationInMs = Date.now() - startDate;
                logger.info({timeInMs: durationInMs, size: src.length},
                    'Built %s in %ds (%s)', name, durationInMs / 1000, humanize.filesize(src.length));
                bundle.building = false;
                cb(null, src, sourceMap);
            }));
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
    function compressJs(src, sourceMap, name) {
        var result = {code: src};
        try {
            result = UglifyJS.minify(src, {
                fromString: true,
                inSourceMap: sourceMap,
                outSourceMap: name + ".map",
            });
        }
        catch (e) {
            logger.error('Uglifying: %s for %s at line %d, column %d', e.message, name, e.line, e.col);
            if (e.line) {
                logger.error('%s ', src.split('\n')[e.line - 1]);
                if (e.col)
                    logger.error('%s^', (new Array(e.col)).join(' '));
            }
        }
        return result;
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
}

function generateRequires(b, opts) {
    var generatedBundles = opts.generated || {};
    var deps = b.pipeline.get('deps');
    deps = deps.get(0);
    var defaultResolver = deps.resolver;
    deps.resolver = function (id, opts, cb) {
        if (generatedBundles[id]) {
            cb(null, id);
        } else {
            return defaultResolver(id, opts, cb);
        }
    };
}
