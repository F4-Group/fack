const $ = require('jquery');
const _ = require('lodash');
const oldJquery = window.jQuery;
window.jQuery = $;
const i18n = require('i18next/lib/dep/i18next');
window.jQuery = oldJquery;
const fackOptions = require('fack/options');

module.exports = _.defaults({
    t: translate,
    translate,
    init,
    ready,
}, i18n);

let i18nTranslate = null;
const deferred = $.Deferred();

function ready(cb) {
    deferred.done(cb);
}

function translate(key) {
    if (i18nTranslate) {
        return i18nTranslate.apply(null, arguments);
    }
    return ('{' + key + '}');
}

function init(options, callback) {
    if (_.isString(options)) {
        options = {
            language: options,
        };
    }

    //don't want jquery to emit ajaxStart/ajaxStop for i18next requests
    const ajax = i18n.functions.ajax;
    i18n.functions.ajax = function (ajaxOptions) {
        _.extend(ajaxOptions, {
            global: false,
            cache: true,
        });
        ajax.apply(this, arguments);
    };

    const language = options.language;
    const i18nOptions = {
        fallbackLng: language,
        lng: language,
    };
    _.extend(i18nOptions, fackOptions.i18next);

    const DEFAULT_NAMESPACE = 'translation';
    const namespace = options.namespace || DEFAULT_NAMESPACE;
    if (namespace == DEFAULT_NAMESPACE) {
        i18nOptions.ns = DEFAULT_NAMESPACE;
    } else {
        i18nOptions.ns = {
            namespaces: [namespace, DEFAULT_NAMESPACE],
            defaultNs: namespace,
        };
        i18nOptions.fallbackNS = [DEFAULT_NAMESPACE];
    }
    _.extend(i18nOptions, _.omit(options, [
        'language',
        'namespace',
    ]));
    i18n.init(i18nOptions, function (t) {
        i18nTranslate = t;
        if (callback) {
            callback();
        }
        deferred.resolve(t);
    });
}
