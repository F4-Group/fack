/* global fack */
var constants = require('../lib/constants');
var $ = require('jquery');
var _ = require('underscore');
var io = require('socket.io');

module.exports = fack.watch ? watch : doNothing;

function doNothing() {
}

function watch() {
    var socket = io(constants.debugSocketIoNS);
    socket.on('reloadCss', reloadAllCss);
}

function reloadAllCss() {
    _.each($('link[rel=stylesheet]'), function (link) {
        var $link = $(link);
        var originalHref = $link.attr('data-original-href') || $link.attr('href');
        if (originalHref) {
            var href = originalHref;
            if (-1 == href.indexOf('?'))
                href += '?_=' + (+new Date());
            else
                href += '&_=' + (+new Date());
            $.ajax({
                url: href,
                success: function () {
                    $link.replaceWith('<link'
                    + ' rel="stylesheet"'
                    + ' type="text/css"'
                    + ' href="' + href + '"'
                    + ' data-original-href="' + originalHref + '"'
                    + '>');
                },
            });
        }
    });
}