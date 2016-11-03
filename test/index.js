var fack = require('../');
var socketio = require('socket.io');
var logger = fack.logger;

var app = fack.express({
    bundles: [
        {
            name: 'libs.js',
            requires: ["jquery"],
        },
        {
            name: 'common.js',
            factorBundles: ['index.js', 'b.js'],
            external: ["jquery"],
        },
    ],
});

logger.info('Run with --debug to see debug logs');
logger.debug('This log should appear with --debug option');
logger.warn('Test warn log');
logger.error('Test error log');
logger.fatal('Test fatal log');

app.get('/', function (req, res) {
    res.render('index');
});

app.get('/sub', function (req, res) {
    res.render('sub');
});

app.post('/json', function (req, res) {
    res.json(req.body);
});

app.get('/log', function (req, res) {
    req.logger.info('Request log');
    res.send('watch the log');
});

app.start(function (server) {
    var io = socketio.listen(server, {
        logger: logger.sub('socket.io'),
    });
    io.on('connection', function (socket) {
        socket.emit('hello');
    });
});
