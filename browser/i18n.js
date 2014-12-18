/* global fack */
var $ = require('jquery');
var _ = require('underscore');
var i18n = require('i18next/lib/dep/i18next');

exports.t = translate;
exports.translate = translate;
exports.init = init;
exports.ready = ready;

var i18nTranslate = null;
var deferred = $.Deferred();

function ready(cb) {
    deferred.done(cb);
}

function translate(key) {
    if (i18nTranslate)
        return i18nTranslate.apply(null, arguments);
    return ('{' + key + '}');
}

function init(options, callback) {
    if (_.isString(options)) {
        options = {
            language: options,
        };
    }

//don't want jquery to emit ajaxStart/ajaxStop for i18next requests
    var ajax = i18n.functions.ajax;
    i18n.functions.ajax = function (options) {
        options.global = false;
        ajax.apply(this, arguments);
    };

    var language = options.language;
    var i18nOptions = {
        fallbackLng: language,
        lng: language,
    };
    //fack global variable is injected by fack
    _.extend(i18nOptions, fack.i18next.options);

    var DEFAULT_NAMESPACE = 'translation';
    var namespace = options.namespace || DEFAULT_NAMESPACE;
    if (namespace == DEFAULT_NAMESPACE) {
        i18nOptions.ns = DEFAULT_NAMESPACE;
    } else {
        i18nOptions.ns = {
            namespaces: [namespace, DEFAULT_NAMESPACE],
            defaultNs: namespace
        };
        i18nOptions.fallbackNS = [DEFAULT_NAMESPACE];
    }
    i18n.init(i18nOptions, function (t) {
        i18nTranslate = t;
        if (callback)
            callback();
        deferred.resolve(t);
    });
}
