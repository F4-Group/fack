const path = require('path');
const fack = require('../../index');
const socketio = require('socket.io');
const logger = fack.logger;

const MODERN_BABELIFY_CONFIG = {
    presets: [
        [
            "@babel/preset-env",
            {
                targets: "> 5%",
            },
        ],
    ],
};

const app = fack.express({
    views: path.join(__dirname, 'views'),
    public: path.join(__dirname, 'public'),
    js: path.join(__dirname, 'js'),
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
const err = new Error('error message');
err.info = 'info field';
logger.error(err, 'Test error log');
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
    res.logger.info('Response log');
    res.send('watch the log');
});

app.get('/error', function (req, res) {
    res
        .status(500)
        .setError(new Error('Response error'))
        .send('watch the log');
});

app.get('/internals', function (req, res) {
    const {
        appName,
        uniqueProcessName,
        hostname,
        sdc: {
            options: {
                prefix: sdcPrefix,
            }
        }
    } = fack;
    res.json({
        appName,
        uniqueProcessName,
        hostname,
        sdcPrefix,
    });
});

app.start(function (server) {
    const io = socketio.listen(server, {
        logger: logger.sub('socket.io'),
    });
    io.on('connection', function (socket) {
        socket.emit('hello');
    });
});
