4.9.1 / 2025-03-24
==================

  * Fix modals animations 

4.9.0 / 2024-10-23
==================

  * Add header `x-process-name` to all responses, with uniqueProcessName as content, to simplify checking which process replied. 
  * Export `processTitle`, giving access to process title helper, which prefixes message with app name.
  * Accept WORKER_NAME environment variable, to be used when server starts "child" processes. It modifies logs field name, 
    process title, statsd prefix and unique process name

4.8.3 / 2023-09-28
==================

  * Fix installation on Node.js below version 18.
 
4.8.2 / 2023-08-25
==================

  * Upgrade Terser to v5. See all bug fixes in the
    [changelog](https://github.com/terser/terser/blob/master/CHANGELOG.md).

4.8.1 / 2023-08-25
==================

  * Fix ignored 'pugify' option in bundle configuration  

4.8.0 / 2023-06-01
==================

  * Send all errors own properties in the logs (only visible in the GELF output).  

4.7.1 / 2022-05-20
==================

  * The root directory where the `public`, `views` and `js` are now correctly located at
    the project root directory instead of the main file directory.

4.7.0 / 2022-04-01
==================

  * The `pugify` option can now take an object, containing the Pug compiler options,
    allowing for example to set the default doctype.

4.6.0 / 2022-03-23
==================

  * Downgrade express error handler log from fatal to error
  * Export `buildBundles` to generate bundles files
  * Load bundles from files if they are available, for production mode only

4.5.4 / 2021-12-10
==================

  * Skip dyno in process unique name when not provided

4.5.3 / 2021-11-19
==================

  * Use secure git protocol for GitHub dependencies
  * Switch back to official `bunyan`
  * Accept environment variables `APP_INSTANCE_NAME` (used as a unique process name, that stays the same over successive 
    deployments, and to identify app in logging, defaults to `appname_hostname_dyno`) and `STATSD_APPNAME` (used to identify app in
    statsd and graphite, defaults to `statsDPrefix.appname-dyno` where `statsDPrefix` is either env `STATSD_PREFIX`, or etcd
    `/server/statsd/prefix` or hostname)

4.5.2 / 2020-12-15
==================

  * Fix broken 4.5.1 release.

4.5.1 / 2020-12-15
==================

  * Log the HTTP method and url with the request/response logger.
  * Fix ignored error when failing to read the Stylus files list.
  * Disable Stylus compression and let clean-css handle it.

4.5.0 / 2020-05-26
==================
  
  * Export `uniqueProcessName` to be able to uniquely identify a dokku process
  When starting processes on many hosts, with dokku scale, we sometimes
  need a unique name for locks and synchronization.


4.4.1 / 2020-04-03
==================

  * Use DYNO when defined to replace DYNO_TYPE_NUMBER (dokku scaling) in statsd and logger data
  
4.4.0 / 2020-02-28
==================

  * Add `res.logger` logger.
  * Add `res.setError` to set an error to be logged with the end of request log.

4.3.1 / 2019-07-29
==================

  * Fix logged css sizes
  * Ensure dyno identifier used for sdc is usable
  * Require full lodash module instead of single modules

4.3.0 / 2019-05-20
==================

  * Update node-etcd to version 7.0.0 for node 10 compatibility (due to deasync dependency). This should work for node 6 and above.
  * Minify CSS in production mode with clean-css.

4.2.1 / 2019-04-26
==================

  * Upgraded bunyan-gelf to 0.3.0 to use only one socket for all logs, avoiding a crash when sending too many logs at once and running out of available ports

4.2.0 / 2019-03-06
==================

  * Upgraded Babel to v7.3.
  * Bundle entry points can now be specified with the file extension.
  * The bundles configuration is now correctly used in factored bundles. 
  
4.1.0 / 2019-01-23
==================

  * Export all i18n methods (except redefined ones)

4.0.3 / 2018-12-03
==================

  * Use our jquery in i18next.

4.0.2 / 2018-11-29
==================

  * Fixed logged file sizes.

4.0.1 / 2018-09-26
==================

  * Enable babel on browser files for old browsers like ie10 / phantomjs
  
4.0.0 / 2018-09-12
==================

  * Upgraded Browserify to v16.
  * Upgraded Babel to v7.
  * babelify can now be disabled by setting the option `babelify` to `false`.
  * Removed deprecated `jadeify` and `babelifyIgnore` options.
  * Removed aliasify transform.
  * Removed deprecated crossdomainMiddleware middleware. Use [cors](https://github.com/expressjs/cors) instead.
  * Removed cookie-parser middleware.
  * Removed express-session middleware.
  * Removed globalpassword middleware.
  * Removed etagify middleware (included with express).
  * Removed dataurify middleware.
  * Removed stringify middleware.
  * Removed multipart middleware.
  * Allow transform options: `{transform: Function, options: Object}`.
  * Transforms are not global anymore by default.
  * Pug files are now babelified.     
  * Removed stylus debug info.

3.6.0 / 2018-08-02
==================
  
  * Configurable i18next back via `backend` option. 

3.5.0 / 2017-11-23
==================
  
  * Removed i18n options `ajaxGlobal` and `ajaxCache`. 
  * Forward `fack.i18n.init` options to i18next. 

3.4.0 / 2017-09-25
==================
  
  * Added `preListen` and `postListen` callbacks.

3.3.1 / 2017-09-15
==================
  
  * i18next cookie is no longer secure.

3.3.0 / 2017-08-01
==================
  
  * Removed Font Awesome dependency on nib: in you need vendor prefix in Font
  Awesome, import nib in your project before Font Awesome.
  * Upgraded nib to import nib normalize instead of bootstrap one.
  
3.2.2 / 2017-07-24
==================
  
  * Added resolve function in stylus to allow @import to look in node_modules.

3.2.1 / 2017-06-14
==================

  * Removed vendor prefixes from bootstrap stylus since they're handled by nib anyway. 

3.2.0 / 2017-06-07
==================

  * Updated express from 4.10.7 to 4.15.3 to get sendFile fixes

3.1.2 / 2017-06-01
==================

  * Do not resolve log server host at startup

3.1.1 / 2017-05-30
==================

  * added dnscache to speed up all dns calls (including calls in request)

3.1.0 / 2017-04-13
==================

  * Expose `fack.hostname`.

3.0.0 / 2017-04-13
==================

  * Switched from jade to pug.

2.7.4 / 2017-03-02
==================

  * avoid localhost ip in logs ips

2.7.3 / 2017-01-26
==================

  * using custom nib version to allow stylus to really be a peer dependency
  
2.7.2 / 2017-01-25
==================

  * renamed mixins & variables from font awesome to allow importing bootstrap ones

2.7.1 / 2017-01-23
==================

  * Fixed crash when setting old i18n options.

2.7.0 / 2017-01-02
==================

  * Added `babelify` global and per bundle options (deprecates `babelifyIgnore` bundle option).

2.6.3 / 2016-12-06
==================

  * Fixed crash when i18n options for expressWrapper is not defined

2.6.2 / 2016-11-30
==================

  * Better handling of i18n options for expressWrapper

2.6.1 / 2016-11-23
==================

  * Wait for logs using callback

2.6.0 / 2016-11-03
==================

  * Never replace fields with dash in logs
  * Added user agent and referrer in request logger 

2.5.4 / 2016-10-19
==================

  * give more time for network logging on Uncaught exception

2.5.3 / 2016-10-19
==================

  * accept conf along with jsEntry

2.5.2 / 2016-10-13
==================

  * Send ips in logs as array, not as string

2.5.1 / 2016-10-10
==================

  * Log unhandled express errors using custom logger

2.5.0 / 2016-07-21
==================

  * Updated to socket.io 1.4.8

2.4.1 / 2016-07-07
==================

  * Fixed sourcemaps 

2.4.0 / 2016-07-01
==================

  * Reverted global Babel transform (too slow) 

2.3.0 / 2016-07-01
==================

  * Enabled Babel transform for all node modules 

2.2.0 / 2016-06-09
==================

  * Added Babel transform with ES 2015 preset 

2.1.0 / 2016-06-08
==================

  * Replaced invalid status code 0 with 499 when the client close the connection

2.0.0 / 2016-06-07
==================

  * Requires Node.js >=4.0.0

1.13.0 / 2016-02-17
===================

  * added res.logger.ignore() to ignore automatic request logger

1.12.0 / 2016-02-09
===================

  * add DYNO_TYPE_NUMBER (dokku scaling) to statsd and logger data

1.11.0 / 2016-01-29
===================

  * Pass `app` to `preconfigure` function.

1.10.2 / 2016-01-11
===================

  * Fixed urls of JS files in subdirectories on Windows.

1.9.5 / 2015-11-23
==================

  * moved browserify code to its own file and no longer uses custom browserify fork
  * generate js file even with "?" in the url

1.9.4 / 2015-11-20
==================

  * Fixed encoded cacheforever paths (with spaces for example).

1.9.3 / 2015-11-20
==================

  * cacheforever and options now added only when required

1.9.2 / 2015-11-17
==================

  * properly check buildBundleOnFirstRequest for factorBundle

1.9.0 / 2015-11-17
==================

  * Support for factor-bundle and requires/external bundles

1.8.0 / 2015-10-02
==================

  * Added `CacheForever#getFingerprints`.

1.7.6 / 2015-09-30
==================

  * Fixed i18n path.

1.7.5 / 2015-09-30
==================

  * Wait only 10ms before exit on uncaught exception.

1.7.4 / 2015-09-30
==================

  * Fixed fatal message not sent on crash.

1.7.3 / 2015-09-28
==================

  * Fixed fingerprints aggressive caching.

1.7.2 / 2015-09-25
==================

  * Set Cache-Control to avoid caching if requested md5 and registered md5 are different

1.7.1 / 2015-09-21
==================

  * Fixed debug log level with `--debug` command line option.

1.7.0 / 2015-09-21
==================

  * Catch and log uncaught exceptions.

1.6.1 / 2015-09-16
==================

  * Never prettify html generated by jade.

1.6.0 / 2015-09-15
==================

  * Added `size` field to compilation logs.

1.5.2 / 2015-09-15
==================

  * Fixed npm broken release.

1.5.1 / 2015-09-15
==================

  * Fixed `fullPaths` option.

1.5.0 / 2015-09-15
==================

  * Removed jade debug instrumentation if in release.
  * Added `fullPaths` option: forwarded to browserify.

1.4.0 / 2015-09-15
==================

  * appname : search into parents directory for a package.json file to get the appname

1.3.0 / 2015-09-02
==================

  * Allow to log an Error with additional fields.

1.2.0 / 2015-08-17
==================

  * Added `timeInMs` field to compilation logs

1.1.0 / 2015-08-11
==================

  * Allow to minify per file to optimize compile time
  * Add cache to optimize js compile when watchify is disabled

1.0.1 / 2015-07-30
==================

  * Added mandatory watchify configuration

1.0.0 / 2015-07-30
==================

  * Added sourcemaps
  * updated browserify to version 11.0.0 and associated libs


0.38.0 / 2015-07-28
===================

  * Fix overwritten logger component on multiple `sub` calls
  * Return bunyan logger with added methods instead of a wrapper
  * Fix lost message when logging an Error object

0.37.0 / 2015-07-22
===================

  * Don't expose fontawesome *.styl files

0.36.1 / 2015-07-17
===================

  * Fix incompatibility between bootstrap-stylus and nib (use custom nib version)

0.36.0 / 2015-07-02
===================

  * Give name to logger streams
  * Expose logger `.level()` and `.levels()`

0.35.1 / 2015-07-01
===================

  * Fix compatibility with node 0.10.x

0.35.0 / 2015-06-30
===================

  * Improve logger, resolve gelf hostname on start, avoid crash on gelf error

0.34.0 / 2015-06-24
===================

  * Read LOG_HOSTNAME and STATSD_PREFIX env vars
  * node-etcd@4.0.2

0.33.0 / 2015-06-23
===================

  * Fack answers on /__healthcheck, configurable with option healthCheckUrl

0.32.0 / 2015-06-22
===================

  * Allow list of hosts in ETCD_HOST

0.31.0 / 2015-06-09
===================

  * Fix default max-age in CacheForever
  * CacheForever options customizable

0.30.1 / 2015-06-01
===================

  * Fix crash on start

0.30.0 / 2015-06-01
===================

  * Expose i18n

0.29.1 / 2015-05-21
===================

  * Remove debug log

0.29.0 / 2015-05-21
===================

  * Allow to configure ajax.global and cache in translation download (default cache=true)

0.28.0 / 2015-05-05
===================

  * Removed CSS live reload

0.27.0 / 2015-03-02
===================

  * Expose logger.fields

0.26.4 / 2015-02-25
===================

  * removed etcd errors. everything required in fack is optional anyway

0.26.3 / 2015-02-25
===================

  * removed jade & stylus dependencies versions

0.26.2 / 2015-02-25
===================

  * only log etcd errors in productions (these are expected during dev)

0.26.1 / 2015-02-25
===================

  * jade & stylus back in peer dependencies

0.26.0 / 2015-02-24
===================

  * synchronous etcd to avoid init problems, and to ensure logger children get correct options

0.25.1 / 2015-02-24
===================

  * bunyan logger can now get hostname from etcd

0.25.0 / 2015-02-17
===================

  * Add extension automatically on `jsUrl` and `cssUrl` parameter

0.24.4 / 2015-02-16
===================

  * Fixed WOFF fonts on IE

0.22.2 / 2015-02-03
===================

  * Fixed `socket.io` conflicts

0.22.1 / 2015-02-03
===================

  * Fixed missing `socket.io` peer dependency

0.22.0 / 2015-02-03
===================

  * Added `jsUrl` and `cssUrl` functions beside `resourceUrl`
  * Added CSS live reload: call `fack.watch()` on the client

0.21.2 / 2015-02-02
===================

  * Fixed CSS compilation

0.21.1 / 2015-01-15
===================

  * Expose application name

0.21.0 / 2015-01-14
===================

  * js bundles, stylus and views now somehow accept multiple entries

0.20.0 / 2015-01-09
===================

  * Upgraded express to ~4.10.7

0.19.0 / 2015-01-09
===================

  * Expose cross domain tools in app.crossDomain

0.18.0 / 2015-01-09
===================

  * Expose cross domain middleware in app.crossDomain

0.17.5 / 2014-12-10
===================

  * Force i18next@1.7.4 (1.7.6 has wrong server-side dependency on jQuery)

0.17.4 / 2014-11-19
===================

  * Allow to delay build of some javascript files even on prod
  * Log css compile time and file size

0.17.3 / 2014-11-14
===================

  * Allow to customize bundles configuration

0.17.2 / 2014-11-12
===================

  * Added process state in process title (starting or listening)

0.17.1 / 2014-10-29
===================

  * Fix IE11 opening eot files on dev environment

0.17.0 / 2014-10-24
===================

  * Use `jquery` >= 2.0.0 npm package instead of `jquery-browserify`

0.16.4 / 2014-09-11
===================

  * Use f4-express-middlewares 0.0.4 (Cache-Control in allow headers)

0.16.3 / 2014-09-10
===================

  * Added noParse option

0.16.2 / 2014-08-13
===================

  * Fix incompatibility with browserify 5

0.16.0 / 2014-08-12
===================

  * Require at least socket.io-client 1.0.0

0.15.1 / 2014-08-12
===================

  * fix i18n preload
  * Can set option i18n:false to disable i18next initialisation

0.15.0 / 2014-07-25
===================

  * i18n cookie disabled by default

0.14.0 / 2014-06-23
===================

  * Upgraded Bootstrap to 3.1.1

0.13.0 / 2014-06-23
===================

  * font awesome updated to 4.1 and using resourceUrl (allowing for use in sub directories)

0.12.0 / 2014-06-10
===================

  * IE <= 7 is not supported anymore (trailing commas are not removed)

0.11.0 / 2014-06-05
===================

  * Can require('fack:i18n') on client for fack translation module
  * Use i18next ~1.7.3

0.10.2 / 2014-06-03
===================

  * Fixed bundles on Windows
  * Fixed URL for bundles in sub-directories

0.10.1 / 2014-06-03
===================

  * Fixed critical bug

0.10.0 / 2014-06-03
===================

  * Find JS entry points recursively

0.9.3 / 2014-06-03
==================

  * using /server/gelf/host provided by etcd

0.9.2 / 2014-06-03
==================

  * Fixed child method (broken in 0.9.1)

0.9.1 / 2014-06-03
==================

  * using etcd if ETCD_HOST envionment variable is set

0.9.0 / 2014-04-17
==================

  * Upgraded Express to 4.0.x
