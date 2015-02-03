var fack = require('../');
var socketio = require('socket.io');
var logger = fack.logger;

var app = fack.express();

app.get('/', function (req, res) {
    res.render('index');
});

app.start(function (server) {
    var io = socketio.listen(server, {
        logger: logger.sub('socket.io')
    });
    io.on('connection', function (socket) {
        socket.emit('hello');
    });
});
