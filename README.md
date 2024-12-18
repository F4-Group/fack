Fack
====

[![NPM](https://nodei.co/npm/fack.png?downloads=true)](https://npmjs.org/package/fack "View this project on NPM")

F4 web stack with:

* express
* browserify
* jade
* stylus
* bootstrap
* font awesome 4.1 from https://github.com/raulghm/Font-Awesome-Stylus
* i18next
* bunyan
* optimist
* uglify

## Environment Variables

* `ETCD_HOST`: used to indicate on which hosts to read ETCD. Use comma to indicate multiple hosts
* `PORT`: on which port to start server (default to `5000`)
* `LOG_HOSTNAME`: used to override hostname, ends up exported, in unique process name, in logs and might be in sdc prefix
* `DYNO`: mainly for dokku scaling, to identify "instance" (can also be provided as `DYNO_TYPE_NUMBER`, for retro-compatibility)
* `APP_INSTANCE_NAME`: used as a unique process name, that stays the same over successive deployments, and to identify app in 
  logging, defaults to `appname_hostname_dyno`
* `STATSD_APPNAME`: used to identify app in statsd and graphite, defaults to `statsDPrefix.appname-dyno-workerName` where
  `statsDPrefix` is either env `STATSD_PREFIX` or etcd `/server/statsd/prefix` or hostname, and workerName comes from env var
  `WORKER_NAME`
* `WORKER_NAME`: to be used when server starts "child" processes. It modifies logs field name, process title, statsd prefix and 
  unique process name
