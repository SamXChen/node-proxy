require('./polyfill/dns')

const { ensureRootCert, ensureHostCert } = require('./keygen')
const { startListen, stopListen } = require('./server').init()

module.exports.start = function(opts = {}) {
    let rootCa
    if (opts.rootCa === undefined) {
        rootCa = ensureRootCert()
        opts.rootCa = rootCa
    }
    if (opts.ensureHostCert === undefined) {
        opts.ensureHostCert = ensureHostCert
    }
    startListen(opts)
}

module.exports.dispose = function() {
    stopListen()
}
