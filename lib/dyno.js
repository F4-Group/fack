// DYNO in newer dokku, DYNO_TYPE_NUMBER in older ones
module.exports = process.env.DYNO || process.env.DYNO_TYPE_NUMBER;
