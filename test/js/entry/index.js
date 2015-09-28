var $ = require('jquery');
var _ = require('underscore');
var fack = require('../../../browser');
var socketio = require('socket.io');

$('.jsOut')
    .addClass('ok')
    .html('js OK');

var socket = socketio.connect();
socket.on('hello', function () {
    $('.socketioOut')
        .addClass('ok')
        .html('socketio OK');
});

$('.resources')
    .append('<div>_a url (should be in /cacheForever in production mode): ' + fack.jsUrl('_a') + '</div>')
    .append('<div>index url: ' + fack.jsUrl('index') + '</div>');

var $jsonMiddleware = $('.jsonMiddleware');
var jsonData = {
    i: 42,
    s: "foo",
    o: {
        f: 4.2,
        s: "bar",
    },
    a: [1, 2, 3],
};
$.ajax({
    type: "POST",
    url: '/json',
    contentType: 'application/json',
    data: JSON.stringify(jsonData),
    success: function (res) {
        if (_.isEqual(res, jsonData)) {
            $jsonMiddleware
                .addClass('ok')
                .text('json middleware ok');
        } else {
            $jsonMiddleware
                .addClass('not-ok')
                .text('Received: ' + JSON.stringify(res));
        }
    },
    error: function (jqXHR, textStatus) {
        $jsonMiddleware
            .addClass('not-ok')
            .text(textStatus);
    },
});
