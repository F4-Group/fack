var fack = require('../');
var socketio = require('socket.io');
var logger = fack.logger;

const MODERN_BABELIFY_CONFIG = {
    presets: [
        [
            "@babel/preset-env",
            {
                targets: "> 5%",
            },
        ],
    ]
};

var app = fack.express({
    babelify: {"plugins": ["transform-exponentiation-operator"]},
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
        {
            name: 'indexModern.js',
            entryPoint: 'index.js',
            babelify: MODERN_BABELIFY_CONFIG,
        },
        {
            name: 'bModern.js',
            entryPoint: 'b.js',
            babelify: MODERN_BABELIFY_CONFIG,
        },
        {
            name: 'commonModern.js',
            factorBundles: ['indexModern.js', 'bModern.js'],
            external: ["jquery"],
            babelify: MODERN_BABELIFY_CONFIG,
        },
    ],
    preListen: function () {
        logger.info('preListen callback');
    },
    postListen: function () {
        logger.info('postListen callback');
    },
});

logger.info('Run with --debug to see debug logs');
logger.debug('This log should appear with --debug option');
logger.warn('Test warn log');
logger.error('Test error log');
logger.fatal('Test fatal log');

app.get('/', function (req, res) {
    res.render('index');
});

app.get('/test', function (req, res) {
    res.render('test', {
        scripts: [
            "libs",
            "common",
            "index",
        ],
    });
});

app.get('/testModern', function (req, res) {
    res.render('test', {
        scripts: [
            "libs",
            "commonModern",
            "indexModern",
        ],
    });
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
