var $ = require('jquery');
var fack = require('../../../browser');
var socketio = require('socket.io');

fack.watch();

$('.jsOut')
    .addClass('ok')
    .html('js OK');

var socket = socketio.connect();
socket.on('hello', function () {
    $('.socketioOut')
        .addClass('ok')
        .html('socketio OK');
});
