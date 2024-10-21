const chai = require('chai');
chai.use(require('chai-better-shallow-deep-equal'));
const {expect} = chai;
const axios = require('axios');

const DYNO = "web-1";

const {
    runLocalServer,
    AVOID_ETCD_LOCKUP_ENV_VARIABLES,
} = require('./lib/runLocalServer');

describe('uniqueProcessName', function () {
    this.timeout(10e3); // fack takes some time to init
    let handle;
    afterEach(function () {
        if (handle) {
            handle.exit();
        }
    });

    it(`Use dyno fallback without APP_INSTANCE_NAME`, async function () {
        handle = await runLocalServer({
            DYNO,
            // no APP_INSTANCE_NAME,
            LOG_HOSTNAME: "hostname",
        });
        const {data: {uniqueProcessName}, headers} = await axios({
            url: `http://127.0.0.1:${handle.port}/internals`,
        });
        const expectedUniqueProcessName = 'fack_hostname_' + DYNO;
        expect(uniqueProcessName).to.equal(expectedUniqueProcessName);
        expect(headers).to.shallowDeepEqual({
            'x-process-name': expectedUniqueProcessName,
        });
    });

    it('Ensure default unique process name does not contain undefined from missing dyno', async function () {
        handle = await runLocalServer({
            LOG_HOSTNAME: 'hostname',
        });
        const {data: {uniqueProcessName}, headers} = await axios({
            url: `http://127.0.0.1:${handle.port}/internals`,
        });
        const expectedUniqueProcessName = 'fack_hostname';
        expect(uniqueProcessName).to.equal(expectedUniqueProcessName);
        expect(headers).to.shallowDeepEqual({
            'x-process-name': expectedUniqueProcessName,
        });
    });

    it(`Use APP_INSTANCE_NAME`, async function () {
        const appInstanceName = "test_instance_app";
        handle = await runLocalServer({
            DYNO,
            APP_INSTANCE_NAME: appInstanceName,
            LOG_HOSTNAME: "hostname",
        });
        const {data: {uniqueProcessName}, headers} = await axios({
            url: `http://127.0.0.1:${handle.port}/internals`,
        });
        expect(uniqueProcessName).to.equal(appInstanceName);
        expect(headers).to.shallowDeepEqual({
            'x-process-name': appInstanceName,
        });
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
        handle = await runLocalServer({
            DYNO,
        });
        const {data: {sdcPrefix}} = await axios({
            url: `http://127.0.0.1:${handle.port}/internals`,
        });
        expect(sdcPrefix).to.equal(`${AVOID_ETCD_LOCKUP_ENV_VARIABLES.SERVER_STATSD_PREFIX}.fack-${DYNO}.`);
    });

    it(`Ensure STATSD_APPNAME is used`, async function () {
        const STATSD_APPNAME = "manual name";
        handle = await runLocalServer({
            DYNO,
            STATSD_APPNAME,
        });
        const {data: {sdcPrefix}} = await axios({
            url: `http://127.0.0.1:${handle.port}/internals`,
        });
        expect(sdcPrefix).to.equal(`${STATSD_APPNAME}.`);
    });
});
