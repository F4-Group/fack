const {expect} = require('chai');
const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const spawn = require('cross-spawn');
const portscanner = require('portscanner');
const axios = require('axios');
const mkdirp = require('mkdirp');

let LOCAL_SERVER_PORT = 44444;
const LOG_DIR = path.join(__dirname, './reports');
const SERVER_LOG_FILE = path.join(LOG_DIR, 'local_server.log');
mkdirp.sync(LOG_DIR);

const DYNO = "web-1";

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

describe('uniqueProcessName', function () {
    this.timeout(10e3); // fack takes some time to init
    let handle;
    afterEach(function () {
        if (handle) {
            handle.exit();
        }
    });

    it(`Use dyno fallback without APP_INSTANCE_NAME`, async function () {
        const port = LOCAL_SERVER_PORT++;
        handle = await runLocalServer(port, {
            DYNO,
            // no APP_INSTANCE_NAME,
            LOG_HOSTNAME: "hostname",
        });
        const {data: {uniqueProcessName}} = await axios({
            url: `http://127.0.0.1:${port}/internals`,
        });
        expect(uniqueProcessName).to.equal('fack_hostname_' + DYNO);
    });

    it(`Use APP_INSTANCE_NAME`, async function () {
        const port = LOCAL_SERVER_PORT++;
        const appInstanceName = "test_instance_app";
        handle = await runLocalServer(port, {
            DYNO,
            APP_INSTANCE_NAME: appInstanceName,
            LOG_HOSTNAME: "hostname",
        });
        const {data: {uniqueProcessName}} = await axios({
            url: `http://127.0.0.1:${port}/internals`,
        });
        expect(uniqueProcessName).to.equal(appInstanceName);
    });
});

describe('sdcPrefix', function () {
    this.timeout(10e3); // fack takes some time to init
    let handle;
    afterEach(function () {
        if (handle) {
            handle.exit();
        }
    });
    it(`Ensure prefix is used when STATSD_APPNAME is not set`, async function () {
        const port = LOCAL_SERVER_PORT++;
        handle = await runLocalServer(port, {
            DYNO,
        });
        const {data: {sdcPrefix}} = await axios({
            url: `http://127.0.0.1:${port}/internals`,
        });
        expect(sdcPrefix).to.equal(`${AVOID_ETCD_LOCKUP_ENV_VARIABLES.SERVER_STATSD_PREFIX}.fack-${DYNO}.`);
    });

    it(`Ensure STATSD_APPNAME is used`, async function () {
        const port = LOCAL_SERVER_PORT++;
        const STATSD_APPNAME = "manual name";
        handle = await runLocalServer(port, {
            DYNO,
            STATSD_APPNAME,
        });
        const {data: {sdcPrefix}} = await axios({
            url: `http://127.0.0.1:${port}/internals`,
        });
        expect(sdcPrefix).to.equal(`${STATSD_APPNAME}.`);
    });
});

function runLocalServer(port, additionalEnvironmentVariables) {
    const logStream = fs.createWriteStream(SERVER_LOG_FILE, {flags: 'a'});

    const env = _({})
        .defaults({
            ...AVOID_ETCD_LOCKUP_ENV_VARIABLES,
            ...additionalEnvironmentVariables,
        }, process.env)
        .pickBy()
        .value();
    const serverProcess = spawn('node', [
        path.join(__dirname, './local_server/index.js'),
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
