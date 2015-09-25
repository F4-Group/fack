var $ = require('jquery');
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
