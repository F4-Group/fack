const axios = require('axios');
const chai = require('chai');
chai.use(require('chai-better-shallow-deep-equal'));
const {expect} = chai;

const {
    runLocalServer,
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
        handle = await runLocalServer();
        const {headers} = await axios({
            url: `http://127.0.0.1:${handle.port}/__healthcheck`,
        });
        expect(headers).to.shallowDeepEqual({
            'x-process-name': 'fack_automatic_test',
        });
    });
});
