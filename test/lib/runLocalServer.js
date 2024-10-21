const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const spawn = require('cross-spawn');
const portscanner = require('portscanner');
const mkdirp = require('mkdirp');

const LOG_DIR = path.join(__dirname, '../reports');
mkdirp.sync(LOG_DIR);
const SERVER_LOG_FILE = path.join(LOG_DIR, 'local_server.log');

const AVOID_ETCD_LOCKUP_ENV_VARIABLES = {
    LOG_HOSTNAME: "automatic_test",
    SERVER_GELF_LEVEL: "warn",
    SERVER_GELF_HOST: "localhost",
    SERVER_GELF_PORT: "12201",
    SERVER_GELF_CONNECTIONTYPE: "wan",
    SERVER_STATSD_PREFIX: "automatic_test",
    SERVER_STATSD_HOST: "localhost",
    SERVER_STATSD_PORT: "8125",
};

let LOCAL_SERVER_PORT = 44444;

module.exports = {
    runLocalServer,
    AVOID_ETCD_LOCKUP_ENV_VARIABLES,
};

function runLocalServer(additionalEnvironmentVariables) {
    const port = LOCAL_SERVER_PORT++;
    const logStream = fs.createWriteStream(SERVER_LOG_FILE, {flags: 'a'});

    const env = _({})
        .defaults({
            ...AVOID_ETCD_LOCKUP_ENV_VARIABLES,
            ...additionalEnvironmentVariables,
        }, process.env)
        .pickBy()
        .value();
    const serverProcess = spawn('node', [
        path.join(__dirname, '../local_server/index.js'),
        '--port', port,
    ], {
        env,
    });
    serverProcess.stdout.pipe(logStream);
    serverProcess.stderr.pipe(logStream);

    return new Promise((resolve, reject) => {
        serverProcess.on('error', reject);
        serverProcess.on('close', code => {
            if (code !== 0) {
                reject(new Error(`local server process exited with code ${code}`));
            }
        });
        waitPortStatus(port, '127.0.0.1', 'open', err => {
            if (err) {
                reject(new Error('Error waiting for local server: ' + err.message));
            } else {
                resolve({
                    port,
                    exit() {
                        serverProcess.kill();
                    }
                });
            }
        });
    });
}

function waitPortStatus(port, ip, expectedStatus, cb) {
    retry();

    function retry() {
        portscanner.checkPortStatus(port, ip, (err, status) => {
            if (err) {
                cb(err);
            } else if (status === expectedStatus) {
                cb(null);
            } else {
                setTimeout(retry, 1e3);
            }
        });
    }
}
