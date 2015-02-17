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
