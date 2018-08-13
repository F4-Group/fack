var $ = require('jquery');
var _ = require('underscore');
var fack = require('../../../browser');
var socketio = require('socket.io-client');
var es2015 = require('./es2015');
var sq = require('../lib/sq_exponentiation-operator');
var pugTemplate = require('../templates/test.pug');
var jadeTemplate = require('../templates/test.jade');

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
    .empty()
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

fack.i18n.init({
    language: 'fr',
    pluralSuffix: '_s',
}, function () {
    var salut = fack.i18n.translate('Hello');
    $('.i18n').text(salut)
        .addClass(salut == 'Salut' ? 'ok' : 'not-ok');
    var deuxChevaux = fack.i18n.translate('horse', {count: 2});
    $('.i18n-config').text(deuxChevaux)
        .addClass(deuxChevaux == '2 chevaux' ? 'ok' : 'not-ok');
});
$('body')
    .append(pugTemplate())
    .append(jadeTemplate());

es2015();
console.log('es2016 working: 42**2=' + sq(42));
