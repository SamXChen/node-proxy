const dns = require('dns')
const originLookup = dns.lookup

dns.lookup = (hostname, options, cb) => {
    const ipv6 = options.family === 6
    if (typeof options === 'function') {
        cb = options
        options = {}
    }
    originLookup(hostname, options, (err, ip, family) => {
        if (!err) {
            return cb(null, ip, family)
        }
        let version = 4
        let resolve = dns.resolve4
        if (ipv6) {
            version = 6
            resolve = dns.resolve6
        }
        resolve(hostname, (err, records) => {
            if (err || !records[0]) {
                return cb(err)
            }
            if (options.all) {
                return cb(null, records, version)
            }
            cb(null, records[0], version)
        })
    })
}