const path = require('path');

let browserify = require('browserify');
const watchify = require('watchify');
const pugify = require('pugify');
const uglifyify = require('uglifyify');
const mold = require('mold-source-map');
const concat = require('concat-stream');
const factor = require('factor-bundle');
const Terser = require('terser');
const glob = require('glob');
const async = require('async');
const _ = require('lodash');
const humanize = require('humanize');

const logger = require('./bunyule');
const pathUtil = require('./pathUtil');

module.exports = jsBundles;

const nodeEnv = process.env.NODE_ENV || 'development';
const isDev = 'development' == nodeEnv;
const jsDebug = true; //source map
const pugDebug = isDev;
let buildBundleOnFirstRequest = isDev;
const watch = isDev;

if (watch) {
    browserify = (function (br) {
        return function () {
            return watchify(br.apply(this, arguments));
        };
    })(browserify);
}

function jsBundles(app, options, cacheforeverMiddleware, i18nOptions) {
    const browserifyBundlesMiddleware = createBrowserifyBundlesMiddleware();
    return {
        createBundle: createBundle,
        getBrowserifyBundlesMiddleware: function () {
            return browserifyBundlesMiddleware;
        },
        registerBrowserifyBundles: registerBrowserifyBundles,
    };

    function useNativePathSep(p) {
        // browserify fails with / on Windows
        return p.replace(/\//g, path.sep);
    }

    function nativePathSepToSlash(p) {
        return p.replace(/\\/g, '/');
    }

    function registerBrowserifyBundles(cb) {
        const defaultEntryDir = app.get("jsEntries")[0];

        const manuallyConfiguredBundles = [];
        let factoredBundles = [];
        let bundles = _.map(options.bundles,
            function (bundleConf) {
                if (_.isString(bundleConf)) {
                    manuallyConfiguredBundles.push(bundleConf);
                    return {
                        jsEntryDir: defaultEntryDir,
                        name: nativePathSepToSlash(path.relative(defaultEntryDir, bundleConf)),
                        path: bundleConf,
                    };
                } else {
                    if (!bundleConf.jsEntryDir) {
                        bundleConf.jsEntryDir = defaultEntryDir;
                    }
                    if (!bundleConf.path && !bundleConf.requires && !bundleConf.factorBundles) {
                        if (!bundleConf.entryPoint) {
                            throw new Error("bundleConf without entryPoint and path: " + JSON.stringify(bundleConf));
                        } else {
                            bundleConf.path = useNativePathSep(path.resolve(defaultEntryDir, bundleConf.entryPoint + ".js"));
                        }
                    }
                    if (!bundleConf.name) {
                        if (!bundleConf.path) {
                            throw new Error("bundleConf without path and name: " + JSON.stringify(bundleConf));
                        } else {
                            bundleConf.name = nativePathSepToSlash(path.relative(defaultEntryDir, bundleConf.path));
                        }
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
            let bundleConfiguration = {jsEntryDir};
            if (!_.isString(jsEntryDir)) {
                bundleConfiguration = _.clone(jsEntryDir);
            }

            const jsEntriesPattern = path.join(bundleConfiguration.jsEntryDir, '**', '*.js');
            const entries = glob.sync(jsEntriesPattern);
            bundles = bundles.concat(_.map(
                _.reject(_.map(entries, useNativePathSep), function (entry) {
                    return _.includes(manuallyConfiguredBundles, entry);
                }),
                function (bundlePath) {
                    return _.extend({
                        name: nativePathSepToSlash(path.relative(bundleConfiguration.jsEntryDir, bundlePath)),
                        path: bundlePath,
                    }, bundleConfiguration);
                }));
        });

        if (factoredBundles.length > 0) {
            //removes bundles which will be factored
            bundles = _.reject(bundles, function (bundle) {
                return _.includes(factoredBundles, bundle.name);
            });
        }

        //ensure bundles order (internal dependencies can rely on names to ensure order
        bundles = _.sortBy(bundles, function (bundle) {
            let result;
            if (bundle.factorBundles) {
                result = bundle.factorBundles.concat(bundle.name).sort()[0];
            } else {
                result = bundle.name;
            }
            return result;
        });

        async.eachSeries(bundles, function (bundleConfiguration, cb) {
            const bundlePath = bundleConfiguration.path;
            if (options.bundlesConfiguration) {
                _.extend(bundleConfiguration, options.bundlesConfiguration);
            }
            const delayBuildSelector = options.delayBuildSelector;
            if (delayBuildSelector) {
                if (_.isString(delayBuildSelector)) {
                    bundleConfiguration.delayBuild = bundlePath.indexOf(delayBuildSelector) >= 0;
                } else if (delayBuildSelector instanceof RegExp) {
                    bundleConfiguration.delayBuild = delayBuildSelector.test(bundlePath);
                } else if (_.isFunction(delayBuildSelector)) {
                    bundleConfiguration.delayBuild = Boolean(delayBuildSelector(bundlePath));
                }
            }
            createBundle(bundleConfiguration, cb);
        }, cb);
    }

    function createBrowserifyBundlesMiddleware() {
        const bundleHandlers = {};
        middleware.register = registerBundle;
        return middleware;

        function middleware(req, res, next) {
            if (buildBundleOnFirstRequest) {
                //using "" as prefix, since /static/ is not here
                const path = pathUtil.getPathWithoutPrefix(req, "");
                const bundleHandler = bundleHandlers[path];
                if (bundleHandler) {
                    bundleHandler(req, res);
                } else {
                    next();
                }
            } else {
                next();
            }
        }

        function registerBundle(url, handler) {
            bundleHandlers[url] = handler;
        }
    }

    function createBundle(bundleConfiguration, cb) {
        const insertGlobalVars = options.insertGlobalVars;
        if (_.isString(bundleConfiguration)) {
            bundleConfiguration = {path: bundleConfiguration};
        }
        bundleConfiguration = _.defaults(bundleConfiguration, {
            name: null,
            pugify: true,
            transforms: [],
            requires: [],
            minify: options.minify,
            enableMinifyPerFile: options.enableMinifyPerFile,
            enableMinifyGlobal: options.enableMinifyGlobal,
            watch: watch,
            debug: jsDebug,
            serve: true,
            fullPaths: options.fullPaths,
        });
        const transforms = _.clone(bundleConfiguration.transforms);
        if (bundleConfiguration.pugify) {
            transforms.push(pugify.pug({
                pretty: false,
                compileDebug: pugDebug,
            }));
        }
        const requires = bundleConfiguration.requires;

        let name = bundleConfiguration.name;
        if (!name) {
            name = useNativePathSep(path.relative(bundleConfiguration.jsEntryDir, bundleConfiguration.path));
        }

        const contentType = 'text/javascript; charset=utf-8';
        const bundle = getBundle(bundleConfiguration);
        if (bundleConfiguration.factorBundles) {
            buildUsingFactorBundle(bundle, cb);
        } else if (!bundleConfiguration.serve) {
            build(bundle, cb);
        } else if (!bundleConfiguration.watch && !bundleConfiguration.delayBuild) {
            build(bundle, function (err, src, sourceMap) {
                if (err) {
                    logger.error(err, 'Building %s', name);
                } else {
                    registerJs(name, src, sourceMap);
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
            const oldIeOptions = _.extend({
                debug: false,
            }, bundleConfiguration);
            const oldIeBundle = getBundle(oldIeOptions);
            bundle.on('update', _.partial(updateCache, bundle));
            browserifyBundlesMiddleware.register('/' + name, function (req, res) {
                if (isIE9OrLower(req)) {
                    sendCache(oldIeBundle, res);
                } else {
                    sendCache(bundle, res);
                }
            });
            cb(null);
        }

        function getBundle(bundleConfiguration) {
            const noParse = _.uniq(['jquery'].concat(options.noParse || []));

            const fackOptions = {
                i18next: i18nOptions || {},
            };
            const generatedModules = {
                'fack/cacheforever': cacheforeverMiddleware.getBrowserifyModule(),
                'fack/options': 'module.exports=' + JSON.stringify(fackOptions) + ';',
            };
            const bundleConf = {
                debug: bundleConfiguration.debug,
                fullPaths: bundleConfiguration.fullPaths,
                entries: [bundleConfiguration.path],
                noParse: noParse,
                insertGlobalVars: _.extend({
                    global: function () {
                        return 'window';
                    },
                }, insertGlobalVars),
                fileCache: _.clone(generatedModules),
            };
            if (watch) {//required conf for watchify
                bundleConf.cache = {};
                bundleConf.packageCache = {};
            } else if (options.moduleDepsCache) {
                _.extend(bundleConf, options.moduleDepsCache.args);
            }

            if (bundleConfiguration.factorBundles) {
                bundleConf.entries = _.map(bundleConfiguration.factorBundles, function (factorBundle) {
                    return useNativePathSep(path.resolve(bundleConfiguration.jsEntryDir, factorBundle));
                });
            }

            const bundle = browserify(bundleConf);
            bundle.plugin(generateRequires, {generated: generatedModules});
            _.each(bundleConfiguration.ignore || [], function (fileOrModule) {
                bundle.ignore(fileOrModule);
            });
            _.each(bundleConfiguration.exclude || [], function (fileOrModule) {
                bundle.exclude(fileOrModule);
            });
            if (_.isArray(requires) && requires.length > 0) {
                bundle.require(requires);
            } else if (_.isObject(requires)) {
                _.each(requires, function (opts, file) {
                    bundle.require(file, opts);
                });
            }
            if (bundleConfiguration.external) {
                bundle.external(bundleConfiguration.external);
            }
            bundle.transform("babelify", _.extend({
                presets: ["@babel/preset-env"],
            }, options.babelify, bundleConfiguration.babelify));
            _.each(transforms, function (transform) {
                let transformOptions;
                if (_.isPlainObject(transform)) {
                    transformOptions = transform.options;
                    transform = transform.transform;
                }
                bundle.transform(transform, transformOptions);
            });
            if (bundleConfiguration.minify && bundleConfiguration.enableMinifyPerFile) {
                bundle.transform(uglifyify, {global: true});
            }
            bundle.building = false;
            return bundle;
        }

        function sendCache(bundle, res) {
            if (null != bundle.cache) {
                respondWithCache(bundle, res);
            } else {
                if (!bundle.building) {
                    updateCache(bundle);
                }
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
            const startDate = Date.now();
            logger.info("Building factored bundle %s (with %s)...", bundleConfiguration.name, bundleConfiguration.factorBundles);
            const outputs = [];
            _.each(bundleConfiguration.factorBundles, function (factorBundle) {
                outputs.push(factoredStream(factorBundle));
            });
            bundle.plugin(factor, {outputs: outputs});
            bundle.bundle().pipe(factoredStream(bundleConfiguration.name, function (err) {
                const durationInMs = Date.now() - startDate;
                logger.info({timeInMs: durationInMs}, 'Built factored bundle %s (with %s) in %ds',
                    bundleConfiguration.name, bundleConfiguration.factorBundles, durationInMs / 1000);
                bundle.building = false;
                cb(err);
            }));
        }

        function factoredStream(fileName, cb) {
            let sourceMapJson;
            const writableStream = mold.transform(function (sourcemap) {
                sourceMapJson = sourcemap.toJSON();
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
                    const result = compressJs(src, sourceMapJson, fileName);
                    src = result.code;
                    sourceMapJson = result.map;
                }
                logger.info({size: src.length}, 'Built %s (%s)', fileName, humanize.filesize(src.length));

                registerJs(fileName, src, sourceMapJson);
                if (cb) {
                    cb(null);
                }
            }));
            return writableStream;
        }

        function build(bundle, cb) {
            bundle.building = true;
            const startDate = Date.now();
            logger.info("Building %s...", name);
            let sourceMapJson;
            let stream = bundle.bundle();
            if (bundleConfiguration.minify) {
                stream = stream.pipe(mold.transform(function (sourcemap) {
                    sourceMapJson = sourcemap.toJSON();
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
                    const result = compressJs(src, sourceMapJson, name);
                    src = result.code;
                    sourceMapJson = result.map;
                }
                const durationInMs = Date.now() - startDate;
                logger.info({timeInMs: durationInMs, size: src.length},
                    'Built %s in %ds (%s)', name, durationInMs / 1000, humanize.filesize(src.length));
                bundle.building = false;
                cb(null, src, sourceMapJson);
            }));
        }

        function registerJs(name, src, sourceMap) {
            const source = cacheforeverMiddleware.register({
                path: name,
                content: src,
                contentType: 'text/javascript; charset=utf-8',
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

    function compressJs(src, sourceMapJson, name) {
        let result = {code: src};
        try {
            const minifyResult = Terser.minify(src, {
                sourceMap: {
                    content: sourceMapJson,
                    url: name + ".map",
                },
            });
            if (minifyResult.error) {
                logger.error('Uglifying: %s for %s', minifyResult.error, name);
            } else {
                result = minifyResult;
            }
        } catch (e) {
            logger.error('Uglifying: %s for %s at line %d, column %d', e.message, name, e.line, e.col);
            if (e.line) {
                logger.error('%s ', src.split('\n')[e.line - 1]);
                if (e.col) {
                    logger.error('%s^', (new Array(e.col)).join(' '));
                }
            }
        }
        return result;
    }

    function isIE9OrLower(req) {
        const userAgent = req.get('user-agent');
        return /MSIE [1-9]\./.test(userAgent);
    }
}

function generateRequires(b, opts) {
    const generatedBundles = opts.generated || {};
    let deps = b.pipeline.get('deps');
    deps = deps.get(0);
    const defaultResolver = deps.resolver;
    deps.resolver = function (id, opts, cb) {
        if (generatedBundles[id]) {
            cb(null, id);
        } else {
            return defaultResolver(id, opts, cb);
        }
    };
}
